package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/BurntSushi/toml"
)

var immutableImagePattern = regexp.MustCompile(`^[^\s@]+@sha256:[0-9a-f]{64}$`)
var sectionPattern = regexp.MustCompile(`^\s*\[([^\[\]]+)\]\s*(?:#.*)?$`)
var arraySectionPattern = regexp.MustCompile(`^\s*\[\[([^\[\]]+)\]\]\s*(?:#.*)?$`)
var pdfModeRewritePattern = regexp.MustCompile(`^(\s*mode\s*=\s*)"[^"\\]*"(\s*(?:#.*)?)$`)
var pdfImageRewritePattern = regexp.MustCompile(`^(\s*image\s*=\s*)"[^"\\]*"(\s*(?:#.*)?)$`)

type projectConfig struct {
	SchemaVersion int
	PDFMode       string
	PDFImage      string
}

type projectConfigDocument struct {
	SchemaVersion int `toml:"schema_version"`
	PDF           struct {
		Mode  string `toml:"mode"`
		Image string `toml:"image"`
	} `toml:"pdf"`
}

type remoteUpgradePlan struct {
	ProjectRoot        string
	DisplayProjectRoot string
	TargetVersion      string
	TargetImage        string
	TargetConfigSchema int
	Installed          manifest
	InstalledProfile   string
	Config             projectConfig
	ManagedFiles       map[string]string
	RetiredFiles       []string
	RetainedFileCount  int
}

type remoteUpgradeValidator func(plan remoteUpgradePlan) error

func readProjectConfig(projectRoot string) (projectConfig, error) {
	configPath, err := managedTarget(projectRoot, "docs/documentation.toml")
	if err != nil {
		return projectConfig{}, err
	}
	content, err := os.ReadFile(configPath)
	if err != nil {
		return projectConfig{}, fmt.Errorf("read project documentation configuration: %w", err)
	}
	return decodeProjectConfig(content)
}

func decodeProjectConfig(content []byte) (projectConfig, error) {
	var document projectConfigDocument
	metadata, err := toml.Decode(string(content), &document)
	if err != nil {
		return projectConfig{}, fmt.Errorf("parse documentation.toml: %w", err)
	}
	if !metadata.IsDefined("schema_version") {
		return projectConfig{}, errors.New("documentation.toml is missing root schema_version")
	}
	if document.SchemaVersion < 1 {
		return projectConfig{}, errors.New("documentation.toml schema_version must be a positive integer")
	}
	if !metadata.IsDefined("pdf", "mode") {
		return projectConfig{}, errors.New("documentation.toml is missing [pdf].mode")
	}
	if !metadata.IsDefined("pdf", "image") {
		return projectConfig{}, errors.New("documentation.toml is missing [pdf].image")
	}
	if document.PDF.Mode != "local" && document.PDF.Mode != "remote" {
		return projectConfig{}, fmt.Errorf(`documentation.toml [pdf].mode must be "local" or "remote", got %q`, document.PDF.Mode)
	}
	if document.PDF.Mode == "remote" && !immutableImagePattern.MatchString(document.PDF.Image) {
		return projectConfig{}, errors.New("documentation.toml remote [pdf].image must be pinned by an immutable sha256 digest")
	}
	return projectConfig{
		SchemaVersion: document.SchemaVersion,
		PDFMode:       document.PDF.Mode,
		PDFImage:      document.PDF.Image,
	}, nil
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func prepareRemoteProfileUpgrade(
	projectRoot,
	assetRoot,
	targetVersion,
	targetImage string,
	targetConfigSchema int,
	displayProjectRoot string,
) (remoteUpgradePlan, error) {
	info, err := os.Stat(projectRoot)
	if err != nil || !info.IsDir() {
		return remoteUpgradePlan{}, fmt.Errorf("project root does not exist: %s", projectRoot)
	}
	if _, ok := parseSemanticVersion(targetVersion); !ok {
		return remoteUpgradePlan{}, fmt.Errorf("target renderer version is not semantic: %q", targetVersion)
	}
	if !immutableImagePattern.MatchString(targetImage) {
		return remoteUpgradePlan{}, errors.New("target renderer image is not pinned by an immutable sha256 digest")
	}
	if displayProjectRoot == "" {
		displayProjectRoot = projectRoot
	}
	if strings.ContainsAny(displayProjectRoot, "\r\n") {
		return remoteUpgradePlan{}, errors.New("display project root must not contain a line break")
	}
	version, err := bundledVersion(assetRoot)
	if err != nil {
		return remoteUpgradePlan{}, err
	}
	if version != targetVersion {
		return remoteUpgradePlan{}, fmt.Errorf(
			"catalog release %s does not match bundled managed tooling %s; use the skill revision published for the target release",
			targetVersion,
			version,
		)
	}
	existing, err := loadManifest(projectRoot)
	if err != nil {
		return remoteUpgradePlan{}, err
	}
	if existing == nil {
		return remoteUpgradePlan{}, errors.New("documentation tooling is not installed; install it before planning an upgrade")
	}
	installedVersion, installedOK := parseSemanticVersion(existing.ToolVersion)
	targetSemanticVersion, _ := parseSemanticVersion(targetVersion)
	if !installedOK {
		return remoteUpgradePlan{}, fmt.Errorf("installed managed tool version is not semantic: %q", existing.ToolVersion)
	}
	if compareVersions(installedVersion, targetSemanticVersion) > 0 {
		return remoteUpgradePlan{}, fmt.Errorf("refusing to plan a downgrade from %s to %s", existing.ToolVersion, targetVersion)
	}
	profile := existing.InstallProfile
	if profile == "" {
		profile = "local"
	}
	if profile != "local" && profile != "remote" {
		return remoteUpgradePlan{}, fmt.Errorf("installed manifest has unsupported install_profile %q", profile)
	}
	config, err := readProjectConfig(projectRoot)
	if err != nil {
		return remoteUpgradePlan{}, err
	}
	if config.SchemaVersion != targetConfigSchema {
		return remoteUpgradePlan{}, fmt.Errorf(
			"documentation.toml schema_version %d is incompatible with release %s, which requires schema %d",
			config.SchemaVersion,
			targetVersion,
			targetConfigSchema,
		)
	}
	files, err := sourceFiles(assetRoot, "remote")
	if err != nil {
		return remoteUpgradePlan{}, err
	}
	retired, err := prepareExistingInstall(projectRoot, *existing, files)
	if err != nil {
		return remoteUpgradePlan{}, err
	}

	retained := 0
	for relative := range files {
		if _, managed := existing.ManagedFiles[relative]; managed {
			retained++
		}
	}
	return remoteUpgradePlan{
		ProjectRoot:        projectRoot,
		DisplayProjectRoot: displayProjectRoot,
		TargetVersion:      targetVersion,
		TargetImage:        targetImage,
		TargetConfigSchema: targetConfigSchema,
		Installed:          *existing,
		InstalledProfile:   profile,
		Config:             config,
		ManagedFiles:       files,
		RetiredFiles:       retired,
		RetainedFileCount:  retained,
	}, nil
}

func printRemoteUpgradePlan(plan remoteUpgradePlan) {
	fmt.Println("Documentation tooling remote-upgrade plan")
	fmt.Printf("Project: %s\n", plan.DisplayProjectRoot)
	fmt.Printf("Installed managed tooling: %s (%s profile)\n", plan.Installed.ToolVersion, plan.InstalledProfile)
	fmt.Printf("Target managed tooling: %s (remote profile)\n", plan.TargetVersion)
	fmt.Printf("Target renderer: %s\n", plan.TargetImage)
	fmt.Printf("Configuration schema: %d (compatible)\n", plan.TargetConfigSchema)
	fmt.Printf(
		"Managed files: %d retained or replaced, %d added, %d retired\n",
		plan.RetainedFileCount,
		len(plan.ManagedFiles)-plan.RetainedFileCount,
		len(plan.RetiredFiles),
	)
	fmt.Println("Project configuration changes:")
	fmt.Printf("- docs/documentation.toml [pdf].mode: %q -> %q\n", plan.Config.PDFMode, "remote")
	fmt.Printf("- docs/documentation.toml [pdf].image: %q -> %q\n", plan.Config.PDFImage, plan.TargetImage)
	fmt.Println("Trusted runtime configuration:")
	fmt.Printf("- DOCUMENTATION_REMOTE_RENDERER_IMAGE=%s\n", plan.TargetImage)
	fmt.Println("Apply command:")
	fmt.Printf(
		"- tooling/scripts/upgrade_project_tools %s --to %s --apply\n",
		shellQuote(plan.DisplayProjectRoot),
		shellQuote(plan.TargetVersion),
	)
	if len(plan.RetiredFiles) > 0 {
		fmt.Println("Retired managed files:")
		for _, relative := range plan.RetiredFiles {
			fmt.Printf("- %s\n", relative)
		}
	}
}

func planRemoteProfileUpgrade(
	projectRoot,
	assetRoot,
	targetVersion,
	targetImage string,
	targetConfigSchema int,
	displayProjectRoot string,
) error {
	plan, err := prepareRemoteProfileUpgrade(
		projectRoot,
		assetRoot,
		targetVersion,
		targetImage,
		targetConfigSchema,
		displayProjectRoot,
	)
	if err != nil {
		return err
	}
	printRemoteUpgradePlan(plan)
	fmt.Println("No files were changed. Re-run with --apply to execute this plan.")
	return nil
}

func renderRemoteProjectConfig(content []byte, targetImage string) ([]byte, error) {
	if _, err := decodeProjectConfig(content); err != nil {
		return nil, err
	}
	lines := strings.SplitAfter(string(content), "\n")
	section := ""
	multilineDelimiter := ""
	modeUpdated := false
	imageUpdated := false
	for index, completeLine := range lines {
		line := strings.TrimSuffix(completeLine, "\n")
		lineEnding := ""
		if len(line) != len(completeLine) {
			lineEnding = "\n"
		}
		if strings.HasSuffix(line, "\r") {
			line = strings.TrimSuffix(line, "\r")
			lineEnding = "\r" + lineEnding
		}
		structuralLine := multilineDelimiter == ""
		multilineDelimiter = advanceTOMLMultilineState(line, multilineDelimiter)
		if !structuralLine {
			continue
		}
		if match := sectionPattern.FindStringSubmatch(line); match != nil {
			section = strings.TrimSpace(match[1])
			continue
		}
		if match := arraySectionPattern.FindStringSubmatch(line); match != nil {
			section = strings.TrimSpace(match[1])
			continue
		}
		if section != "pdf" {
			continue
		}
		if match := pdfModeRewritePattern.FindStringSubmatch(line); match != nil {
			if modeUpdated {
				return nil, errors.New("documentation.toml contains duplicate [pdf].mode values")
			}
			lines[index] = match[1] + `"remote"` + match[2] + lineEnding
			modeUpdated = true
			continue
		}
		if match := pdfImageRewritePattern.FindStringSubmatch(line); match != nil {
			if imageUpdated {
				return nil, errors.New("documentation.toml contains duplicate [pdf].image values")
			}
			lines[index] = match[1] + `"` + targetImage + `"` + match[2] + lineEnding
			imageUpdated = true
		}
	}
	if !modeUpdated || !imageUpdated {
		return nil, errors.New("documentation.toml is missing rewritable [pdf].mode or [pdf].image")
	}
	rendered := []byte(strings.Join(lines, ""))
	config, err := decodeProjectConfig(rendered)
	if err != nil {
		return nil, fmt.Errorf("validate rewritten documentation.toml: %w", err)
	}
	if config.PDFMode != "remote" || config.PDFImage != targetImage {
		return nil, errors.New("documentation.toml rewrite did not update the actual [pdf].mode and [pdf].image")
	}
	return rendered, nil
}

func advanceTOMLMultilineState(line, delimiter string) string {
	for index := 0; index < len(line); {
		if delimiter != "" {
			position := strings.Index(line[index:], delimiter)
			if position < 0 {
				return delimiter
			}
			position += index
			if delimiter == `"""` {
				backslashes := 0
				for previous := position - 1; previous >= 0 && line[previous] == '\\'; previous-- {
					backslashes++
				}
				if backslashes%2 == 1 {
					index = position + len(delimiter)
					continue
				}
			}
			delimiter = ""
			index = position + 3
			continue
		}

		switch line[index] {
		case '#':
			return ""
		case '"':
			if strings.HasPrefix(line[index:], `"""`) {
				delimiter = `"""`
				index += 3
				continue
			}
			index++
			for index < len(line) {
				if line[index] == '\\' {
					index += 2
					continue
				}
				if index < len(line) && line[index] == '"' {
					index++
					break
				}
				index++
			}
		case '\'':
			if strings.HasPrefix(line[index:], `'''`) {
				delimiter = `'''`
				index += 3
				continue
			}
			index++
			for index < len(line) && line[index] != '\'' {
				index++
			}
			if index < len(line) {
				index++
			}
		default:
			index++
		}
	}
	return delimiter
}

func writeProjectConfig(path string, content []byte, mode os.FileMode) error {
	output, err := os.CreateTemp(filepath.Dir(path), ".documentation-config-*")
	if err != nil {
		return fmt.Errorf("create temporary documentation configuration: %w", err)
	}
	tempPath := output.Name()
	success := false
	defer func() {
		output.Close()
		if !success {
			os.Remove(tempPath)
		}
	}()
	if err := output.Chmod(mode.Perm()); err != nil {
		return fmt.Errorf("preserve documentation configuration permissions: %w", err)
	}
	if _, err := output.Write(content); err != nil {
		return fmt.Errorf("write documentation configuration: %w", err)
	}
	if err := output.Sync(); err != nil {
		return fmt.Errorf("sync documentation configuration: %w", err)
	}
	if err := output.Close(); err != nil {
		return fmt.Errorf("close documentation configuration: %w", err)
	}
	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("publish documentation configuration: %w", err)
	}
	success = true
	return nil
}

func validateRemoteUpgradeState(plan remoteUpgradePlan) error {
	installed, err := loadManifest(plan.ProjectRoot)
	if err != nil {
		return err
	}
	if installed == nil {
		return errors.New("managed-tool manifest is missing after upgrade")
	}
	if installed.ToolVersion != plan.TargetVersion || installed.InstallProfile != "remote" {
		return fmt.Errorf(
			"managed-tool manifest does not describe target %s remote profile",
			plan.TargetVersion,
		)
	}
	if len(installed.ManagedFiles) != len(plan.ManagedFiles) {
		return errors.New("managed-tool manifest does not contain the expected remote-profile inventory")
	}
	for relative := range plan.ManagedFiles {
		if _, installedFile := installed.ManagedFiles[relative]; !installedFile {
			return fmt.Errorf("managed-tool manifest is missing expected remote file %s", relative)
		}
	}
	if err := requireNoManagedDrift(plan.ProjectRoot, *installed); err != nil {
		return err
	}
	for _, relative := range plan.RetiredFiles {
		target, err := managedTarget(plan.ProjectRoot, relative)
		if err != nil {
			return err
		}
		if _, err := os.Lstat(target); err == nil {
			return fmt.Errorf("retired managed file still exists after upgrade: %s", relative)
		} else if !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("inspect retired managed file %s: %w", relative, err)
		}
	}
	config, err := readProjectConfig(plan.ProjectRoot)
	if err != nil {
		return err
	}
	if config.SchemaVersion != plan.TargetConfigSchema ||
		config.PDFMode != "remote" ||
		config.PDFImage != plan.TargetImage {
		return errors.New("documentation.toml does not match the requested remote release after upgrade")
	}
	return nil
}

func applyRemoteProfileUpgrade(
	projectRoot,
	assetRoot,
	targetVersion,
	targetImage string,
	targetConfigSchema int,
	displayProjectRoot string,
) error {
	return applyRemoteProfileUpgradeWithValidator(
		projectRoot,
		assetRoot,
		targetVersion,
		targetImage,
		targetConfigSchema,
		displayProjectRoot,
		validateRemoteUpgradeState,
	)
}

func applyRemoteProfileUpgradeWithValidator(
	projectRoot,
	assetRoot,
	targetVersion,
	targetImage string,
	targetConfigSchema int,
	displayProjectRoot string,
	validator remoteUpgradeValidator,
) error {
	plan, err := prepareRemoteProfileUpgrade(
		projectRoot,
		assetRoot,
		targetVersion,
		targetImage,
		targetConfigSchema,
		displayProjectRoot,
	)
	if err != nil {
		return err
	}
	printRemoteUpgradePlan(plan)

	configPath, err := managedTarget(projectRoot, "docs/documentation.toml")
	if err != nil {
		return err
	}
	configInfo, err := os.Stat(configPath)
	if err != nil {
		return fmt.Errorf("inspect project documentation configuration: %w", err)
	}
	originalConfig, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("read project documentation configuration: %w", err)
	}
	updatedConfig, err := renderRemoteProjectConfig(originalConfig, targetImage)
	if err != nil {
		return err
	}

	postAction := func() error {
		if err := writeProjectConfig(configPath, updatedConfig, configInfo.Mode()); err != nil {
			return err
		}
		return validator(plan)
	}

	fmt.Println("Applying remote-upgrade transaction...")
	if err := installWithPostAction(
		projectRoot,
		assetRoot,
		true,
		"remote",
		[]string{"docs/documentation.toml"},
		postAction,
	); err != nil {
		return err
	}
	fmt.Println("Remote-upgrade transaction committed.")
	fmt.Printf("Set DOCUMENTATION_REMOTE_RENDERER_IMAGE=%s in trusted local and CI configuration.\n", targetImage)
	return nil
}
