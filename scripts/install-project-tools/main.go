package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const manifestRelativePath = "docs/.documentation-tools/managed-files.json"

var semanticVersionPattern = regexp.MustCompile(`^(\d+)\.(\d+)\.(\d+)$`)

var remoteProfileFiles = map[string]bool{
	"docs/documentation":                       true,
	"docs/.documentation-tools/VERSION":        true,
	"docs/.documentation-tools/pdf/header.tex": true,
}

type manifest struct {
	SchemaVersion  int               `json:"schema_version"`
	ToolVersion    string            `json:"tool_version"`
	InstallProfile string            `json:"install_profile,omitempty"`
	ManagedFiles   map[string]string `json:"managed_files"`
}

type semanticVersion struct {
	Major int
	Minor int
	Patch int
}

func main() {
	assetRoot := flag.String("asset-root", "", "absolute bundled project-tools directory")
	checkOnly := flag.Bool("check", false, "check installed managed files without changing them")
	upgrade := flag.Bool("upgrade", false, "upgrade an existing managed installation")
	profile := flag.String("profile", "auto", "installation profile: auto, local, or remote")
	flag.Parse()

	if *checkOnly && *upgrade {
		exitError(errors.New("--check and --upgrade cannot be combined"), 2)
	}
	if strings.TrimSpace(*assetRoot) == "" || flag.NArg() != 1 {
		exitError(errors.New("usage: install-project-tools --asset-root PATH [--check|--upgrade] [--profile auto|local|remote] PROJECT_ROOT"), 2)
	}
	if *profile != "auto" && *profile != "local" && *profile != "remote" {
		exitError(errors.New("--profile must be 'auto', 'local', or 'remote'"), 2)
	}
	projectRoot, err := filepath.Abs(flag.Arg(0))
	if err != nil {
		exitError(fmt.Errorf("resolve project root: %w", err), 1)
	}
	assets, err := filepath.Abs(*assetRoot)
	if err != nil {
		exitError(fmt.Errorf("resolve asset root: %w", err), 1)
	}
	if *checkOnly {
		code, err := check(projectRoot, assets)
		if err != nil {
			exitError(err, 1)
		}
		os.Exit(code)
	}
	if err := install(projectRoot, assets, *upgrade, *profile); err != nil {
		exitError(err, 1)
	}
}

func exitError(err error, code int) {
	fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
	os.Exit(code)
}

func parseSemanticVersion(value string) (semanticVersion, bool) {
	match := semanticVersionPattern.FindStringSubmatch(value)
	if match == nil {
		return semanticVersion{}, false
	}
	var version semanticVersion
	parts := []*int{&version.Major, &version.Minor, &version.Patch}
	for index, part := range parts {
		parsed, err := strconv.Atoi(match[index+1])
		if err != nil {
			return semanticVersion{}, false
		}
		*part = parsed
	}
	return version, true
}

func compareVersions(left, right semanticVersion) int {
	leftParts := []int{left.Major, left.Minor, left.Patch}
	rightParts := []int{right.Major, right.Minor, right.Patch}
	for index := range leftParts {
		if leftParts[index] < rightParts[index] {
			return -1
		}
		if leftParts[index] > rightParts[index] {
			return 1
		}
	}
	return 0
}

func bundledVersion(assetRoot string) (string, error) {
	data, err := os.ReadFile(filepath.Join(assetRoot, "docs", ".documentation-tools", "VERSION"))
	if err != nil {
		return "", fmt.Errorf("read bundled tool version: %w", err)
	}
	version := strings.TrimSpace(string(data))
	if _, ok := parseSemanticVersion(version); !ok {
		return "", fmt.Errorf("bundled tool version is not semantic: %q", version)
	}
	return version, nil
}

func sourceFiles(assetRoot, profile string) (map[string]string, error) {
	files := map[string]string{}
	err := filepath.WalkDir(assetRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			if entry.Name() == "__pycache__" {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("bundled asset must not be a symbolic link: %s", path)
		}
		if !entry.Type().IsRegular() || strings.HasSuffix(entry.Name(), ".pyc") {
			return nil
		}
		relative, err := filepath.Rel(assetRoot, path)
		if err != nil {
			return err
		}
		normalized := filepath.ToSlash(relative)
		if normalized == manifestRelativePath {
			return nil
		}
		if profile == "remote" && !remoteProfileFiles[normalized] {
			return nil
		}
		files[normalized] = path
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("inventory bundled project tools: %w", err)
	}
	if len(files) == 0 {
		return nil, errors.New("bundled project-tools directory is empty")
	}
	return files, nil
}

func loadManifest(projectRoot string) (*manifest, error) {
	path, err := managedTarget(projectRoot, manifestRelativePath)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read managed-tool manifest: %w", err)
	}
	var value manifest
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, fmt.Errorf("read managed-tool manifest: %w", err)
	}
	if value.SchemaVersion != 1 {
		return nil, fmt.Errorf("managed-tool manifest schema_version must be 1")
	}
	if value.ManagedFiles == nil {
		return nil, errors.New("managed-tool manifest must contain a managed_files object")
	}
	return &value, nil
}

func managedTarget(projectRoot, value string) (string, error) {
	if value == "" || value == "." || filepath.IsAbs(value) || strings.Contains(value, `\`) {
		return "", fmt.Errorf("invalid managed path: %s", value)
	}
	platformPath := filepath.FromSlash(value)
	if filepath.ToSlash(filepath.Clean(platformPath)) != value {
		return "", fmt.Errorf("managed path is not normalized: %s", value)
	}
	root := filepath.Clean(projectRoot)
	target := filepath.Join(root, platformPath)
	relative, err := filepath.Rel(root, target)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("managed path escapes the project: %s", value)
	}
	current := root
	for _, component := range strings.Split(value, "/") {
		current = filepath.Join(current, component)
		info, statErr := os.Lstat(current)
		if errors.Is(statErr, os.ErrNotExist) {
			continue
		}
		if statErr != nil {
			return "", fmt.Errorf("inspect managed path %s: %w", value, statErr)
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return "", fmt.Errorf("managed path traverses a symbolic link: %s", value)
		}
	}
	return target, nil
}

func fileSHA256(path string) (string, error) {
	input, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer input.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, input); err != nil {
		return "", err
	}
	return hex.EncodeToString(digest.Sum(nil)), nil
}

func drift(projectRoot string, installed manifest) ([]string, error) {
	paths := make([]string, 0, len(installed.ManagedFiles))
	for relative := range installed.ManagedFiles {
		paths = append(paths, relative)
	}
	sort.Strings(paths)
	var findings []string
	for _, relative := range paths {
		expected := installed.ManagedFiles[relative]
		target, err := managedTarget(projectRoot, relative)
		if err != nil {
			findings = append(findings, err.Error())
			continue
		}
		info, err := os.Stat(target)
		if errors.Is(err, os.ErrNotExist) {
			findings = append(findings, "Missing managed file: "+relative)
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("inspect managed file %s: %w", relative, err)
		}
		if !info.Mode().IsRegular() {
			findings = append(findings, "Managed path is not a regular file: "+relative)
			continue
		}
		actual, err := fileSHA256(target)
		if err != nil {
			return nil, fmt.Errorf("hash managed file %s: %w", relative, err)
		}
		if actual != expected {
			findings = append(findings, "Locally modified managed file: "+relative)
		}
	}
	return findings, nil
}

func install(projectRoot, assetRoot string, upgrade bool, profile string) (installErr error) {
	info, err := os.Stat(projectRoot)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("project root does not exist: %s", projectRoot)
	}
	version, err := bundledVersion(assetRoot)
	if err != nil {
		return err
	}
	existing, err := loadManifest(projectRoot)
	if err != nil {
		return err
	}
	if profile == "auto" {
		profile = "local"
		if existing != nil && existing.InstallProfile == "remote" {
			profile = "remote"
		}
	}
	files, err := sourceFiles(assetRoot, profile)
	if err != nil {
		return err
	}

	var retired []string
	if existing != nil {
		findings, err := drift(projectRoot, *existing)
		if err != nil {
			return err
		}
		if len(findings) > 0 {
			return fmt.Errorf(
				"managed tooling has local drift; resolve it before installation:\n- %s",
				strings.Join(findings, "\n- "),
			)
		}
		if !upgrade {
			return fmt.Errorf(
				"managed tooling %s is already installed; use --check or explicitly approve and run --upgrade",
				existing.ToolVersion,
			)
		}
		installedVersion, installedOK := parseSemanticVersion(existing.ToolVersion)
		bundleVersion, bundleOK := parseSemanticVersion(version)
		if installedOK && bundleOK && compareVersions(installedVersion, bundleVersion) > 0 {
			return fmt.Errorf("refusing to downgrade managed tooling from %s to bundled version %s", existing.ToolVersion, version)
		}
		for relative := range existing.ManagedFiles {
			if _, retained := files[relative]; !retained && relative != manifestRelativePath {
				retired = append(retired, relative)
			}
		}
		sort.Strings(retired)
		var conflicts []string
		for relative := range files {
			if _, managed := existing.ManagedFiles[relative]; managed {
				continue
			}
			blockedByRetiredFile := false
			for _, retiredPath := range retired {
				if strings.HasPrefix(relative, retiredPath+"/") {
					blockedByRetiredFile = true
					break
				}
			}
			if blockedByRetiredFile {
				continue
			}
			target, err := managedTarget(projectRoot, relative)
			if err != nil {
				return err
			}
			if _, err := os.Lstat(target); err == nil {
				conflicts = append(conflicts, relative)
			} else if !errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("inspect target %s: %w", relative, err)
			}
		}
		sort.Strings(conflicts)
		if len(conflicts) > 0 {
			return fmt.Errorf(
				"refusing to overwrite files not owned by a managed manifest:\n- %s",
				strings.Join(conflicts, "\n- "),
			)
		}
	} else {
		var conflicts []string
		for relative := range files {
			target, err := managedTarget(projectRoot, relative)
			if err != nil {
				return err
			}
			if _, err := os.Lstat(target); err == nil {
				conflicts = append(conflicts, relative)
			} else if !errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("inspect target %s: %w", relative, err)
			}
		}
		sort.Strings(conflicts)
		if len(conflicts) > 0 {
			return fmt.Errorf(
				"refusing to overwrite files not owned by a managed manifest:\n- %s",
				strings.Join(conflicts, "\n- "),
			)
		}
	}

	relativeFiles := make([]string, 0, len(files))
	for relative := range files {
		relativeFiles = append(relativeFiles, relative)
	}
	sort.Strings(relativeFiles)

	backupRoot := ""
	backups := map[string]string{}
	copyStarted := false
	transactionCommitted := false
	backupRoot, err = os.MkdirTemp(projectRoot, ".documentation-tools-upgrade-")
	if err != nil {
		return fmt.Errorf("create managed-tool upgrade backup: %w", err)
	}
	defer func() {
		if !transactionCommitted {
			replacements := []string(nil)
			if copyStarted {
				replacements = relativeFiles
			}
			if restoreErr := restoreManagedFiles(projectRoot, backups, replacements); restoreErr != nil {
				installErr = errors.Join(
					installErr,
					restoreErr,
					fmt.Errorf("managed-tool upgrade backup preserved for manual recovery: %s", backupRoot),
				)
				return
			}
		}
		if cleanupErr := os.RemoveAll(backupRoot); cleanupErr != nil {
			installErr = errors.Join(installErr, fmt.Errorf("remove managed-tool upgrade backup: %w", cleanupErr))
		}
	}()

	if existing != nil {
		previousFiles := make([]string, 0, len(existing.ManagedFiles))
		for relative := range existing.ManagedFiles {
			previousFiles = append(previousFiles, relative)
		}
		sort.Strings(previousFiles)
		for _, relative := range previousFiles {
			backupPath, err := backupManagedFile(projectRoot, backupRoot, relative)
			if err != nil {
				return err
			}
			if backupPath != "" {
				backups[relative] = backupPath
			}
		}
	}

	copyStarted = true
	for _, relative := range relativeFiles {
		target, err := managedTarget(projectRoot, relative)
		if err != nil {
			return err
		}
		if err := copyManagedFile(files[relative], target); err != nil {
			return fmt.Errorf("install managed file %s: %w", relative, err)
		}
	}

	managedHashes := make(map[string]string, len(relativeFiles))
	for _, relative := range relativeFiles {
		target, err := managedTarget(projectRoot, relative)
		if err != nil {
			return err
		}
		digest, err := fileSHA256(target)
		if err != nil {
			return fmt.Errorf("hash installed managed file %s: %w", relative, err)
		}
		managedHashes[relative] = digest
	}
	payload := manifest{
		SchemaVersion:  1,
		ToolVersion:    version,
		InstallProfile: profile,
		ManagedFiles:   managedHashes,
	}
	manifestPath, err := managedTarget(projectRoot, manifestRelativePath)
	if err != nil {
		return err
	}
	if err := writeManifest(manifestPath, payload); err != nil {
		return err
	}
	transactionCommitted = true

	action := "Installed"
	if existing != nil {
		action = "Upgraded"
	}
	fmt.Printf("%s documentation tooling %s (%s profile) in %s\n", action, version, profile, projectRoot)
	if len(retired) > 0 {
		fmt.Printf("Removed %d retired managed file(s).\n", len(retired))
	}
	fmt.Println("Project-owned configuration and documentation templates were not overwritten.")
	fmt.Println("Ensure /docs/.documentation-work/ is ignored by Git.")
	fmt.Println("Ignore /docs/pdf/ unless documentation.toml intentionally commits PDF outputs.")
	return nil
}

func backupManagedFile(projectRoot, backupRoot, relative string) (string, error) {
	target, err := managedTarget(projectRoot, relative)
	if err != nil {
		return "", err
	}
	info, err := os.Lstat(target)
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("inspect managed file for upgrade backup %s: %w", relative, err)
	}
	if !info.Mode().IsRegular() {
		return "", fmt.Errorf("refusing to back up managed non-file path: %s", relative)
	}
	backupPath := filepath.Join(backupRoot, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(backupPath), 0o700); err != nil {
		return "", fmt.Errorf("prepare managed file upgrade backup %s: %w", relative, err)
	}
	if err := os.Rename(target, backupPath); err != nil {
		return "", fmt.Errorf("back up managed file %s: %w", relative, err)
	}
	return backupPath, nil
}

func restoreManagedFiles(projectRoot string, backups map[string]string, newManaged []string) error {
	var rollbackErr error
	candidateTargets := map[string]string{}
	for _, relative := range newManaged {
		target, err := managedTarget(projectRoot, relative)
		if err != nil {
			rollbackErr = errors.Join(rollbackErr, fmt.Errorf("resolve replacement managed file %s during rollback: %w", relative, err))
			continue
		}
		candidateTargets[relative] = target
		if err := os.Remove(target); err != nil && !errors.Is(err, os.ErrNotExist) {
			rollbackErr = errors.Join(rollbackErr, fmt.Errorf("remove replacement managed file %s during rollback: %w", relative, err))
		}
	}

	relativeBackups := make([]string, 0, len(backups))
	for relative := range backups {
		relativeBackups = append(relativeBackups, relative)
	}
	sort.Strings(relativeBackups)

	emptyDirectories := map[string]bool{}
	for _, relative := range relativeBackups {
		target, err := managedTarget(projectRoot, relative)
		if err != nil {
			rollbackErr = errors.Join(rollbackErr, fmt.Errorf("resolve managed file %s during rollback: %w", relative, err))
			continue
		}
		for candidate, candidateTarget := range candidateTargets {
			if !strings.HasPrefix(candidate, relative+"/") {
				continue
			}
			for directory := filepath.Dir(candidateTarget); directory == target || strings.HasPrefix(directory, target+string(filepath.Separator)); directory = filepath.Dir(directory) {
				emptyDirectories[directory] = true
				if directory == target {
					break
				}
			}
		}
	}

	directories := make([]string, 0, len(emptyDirectories))
	for directory := range emptyDirectories {
		directories = append(directories, directory)
	}
	sort.Slice(directories, func(left, right int) bool {
		return len(directories[left]) > len(directories[right])
	})
	for _, directory := range directories {
		if err := os.Remove(directory); err != nil && !errors.Is(err, os.ErrNotExist) {
			rollbackErr = errors.Join(rollbackErr, fmt.Errorf("remove replacement directory during rollback %s: %w", directory, err))
		}
	}

	for _, relative := range relativeBackups {
		target, err := managedTarget(projectRoot, relative)
		if err != nil {
			rollbackErr = errors.Join(rollbackErr, fmt.Errorf("restore managed file %s: %w", relative, err))
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			rollbackErr = errors.Join(rollbackErr, fmt.Errorf("restore managed file %s: %w", relative, err))
			continue
		}
		if err := os.Rename(backups[relative], target); err != nil {
			rollbackErr = errors.Join(rollbackErr, fmt.Errorf("restore managed file %s: %w", relative, err))
		}
	}
	return rollbackErr
}

func copyManagedFile(source, target string) error {
	info, err := os.Stat(source)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("source is not a regular file")
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.CreateTemp(filepath.Dir(target), ".documentation-install-*")
	if err != nil {
		return err
	}
	tempPath := output.Name()
	success := false
	defer func() {
		output.Close()
		if !success {
			os.Remove(tempPath)
		}
	}()
	if err := output.Chmod(info.Mode().Perm()); err != nil {
		return err
	}
	if _, err := io.Copy(output, input); err != nil {
		return err
	}
	if err := output.Sync(); err != nil {
		return err
	}
	if err := output.Close(); err != nil {
		return err
	}
	if err := os.Rename(tempPath, target); err != nil {
		return err
	}
	success = true
	return nil
}

func writeManifest(path string, value manifest) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("encode managed-tool manifest: %w", err)
	}
	data = append(data, '\n')
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create managed-tool directory: %w", err)
	}
	output, err := os.CreateTemp(filepath.Dir(path), ".documentation-manifest-*")
	if err != nil {
		return fmt.Errorf("create managed-tool manifest: %w", err)
	}
	tempPath := output.Name()
	success := false
	defer func() {
		output.Close()
		if !success {
			os.Remove(tempPath)
		}
	}()
	if err := output.Chmod(0o644); err != nil {
		return err
	}
	if _, err := output.Write(data); err != nil {
		return err
	}
	if err := output.Sync(); err != nil {
		return err
	}
	if err := output.Close(); err != nil {
		return err
	}
	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("publish managed-tool manifest: %w", err)
	}
	success = true
	return nil
}

func check(projectRoot, assetRoot string) (int, error) {
	version, err := bundledVersion(assetRoot)
	if err != nil {
		return 1, err
	}
	installed, err := loadManifest(projectRoot)
	if err != nil {
		return 1, err
	}
	if installed == nil {
		fmt.Fprintln(os.Stderr, "Documentation tooling is not installed.")
		return 1, nil
	}
	findings, err := drift(projectRoot, *installed)
	if err != nil {
		return 1, err
	}
	fmt.Printf("Installed documentation tooling: %s\n", installed.ToolVersion)
	fmt.Printf("Bundled documentation tooling: %s\n", version)
	profile := installed.InstallProfile
	if profile == "" {
		profile = "local"
	}
	fmt.Printf("Installation profile: %s\n", profile)
	if len(findings) > 0 {
		for _, finding := range findings {
			fmt.Fprintf(os.Stderr, "DRIFT: %s\n", finding)
		}
		return 1, nil
	}

	installedVersion, installedOK := parseSemanticVersion(installed.ToolVersion)
	bundleVersion, bundleOK := parseSemanticVersion(version)
	switch {
	case !installedOK || !bundleOK:
		if installed.ToolVersion != version {
			fmt.Println("VERSION DIFFERS: inspect versions before explicitly running --upgrade.")
		}
	case compareVersions(installedVersion, bundleVersion) < 0:
		fmt.Println("UPDATE AVAILABLE: explicit --upgrade is required.")
	case compareVersions(installedVersion, bundleVersion) > 0:
		fmt.Println("Installed tooling is newer than the bundle; downgrade is disabled.")
	default:
		fmt.Println("Managed files match their recorded checksums.")
	}
	return 0, nil
}
