package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

const legacyPublishedImage = "rg.fr-par.scw.cloud/esoul-internal-tools/documentation-tools@sha256:bd62621c8b51b3069e045ff4ebc9f455a588f874fc82f7d52d43f1ce1f646158"

func TestSemanticVersionComparison(t *testing.T) {
	left, ok := parseSemanticVersion("0.4.0")
	if !ok {
		t.Fatal("expected semantic version")
	}
	right, ok := parseSemanticVersion("0.5.0")
	if !ok {
		t.Fatal("expected semantic version")
	}
	if compareVersions(left, right) >= 0 || compareVersions(right, left) <= 0 {
		t.Fatal("unexpected semantic version ordering")
	}
	if _, ok := parseSemanticVersion("0.4"); ok {
		t.Fatal("expected incomplete version to fail")
	}
}

func TestManagedTargetRejectsUnsafePathsAndSymlinks(t *testing.T) {
	root := t.TempDir()
	for _, value := range []string{"", ".", "../escape", "/absolute", "docs//file", `docs\file`} {
		if _, err := managedTarget(root, value); err == nil {
			t.Errorf("expected %q to fail", value)
		}
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(root, "docs")); err != nil {
		t.Fatal(err)
	}
	if _, err := managedTarget(root, "docs/tool"); err == nil {
		t.Fatal("expected managed path through symlink to fail")
	}
}

func TestFreshInstallCheckAndDrift(t *testing.T) {
	assets := fixtureAssets(t, "0.4.0", map[string]fixtureFile{
		"docs/documentation":                           {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION":            {Content: "0.4.0\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/config-example": {Content: "fixture\n", Mode: 0o644},
	})
	project := t.TempDir()
	projectConfig := filepath.Join(project, "docs", "documentation.toml")
	if err := os.MkdirAll(filepath.Dir(projectConfig), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(projectConfig, []byte("project-owned\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := install(project, assets, false, "local"); err != nil {
		t.Fatal(err)
	}
	configData, err := os.ReadFile(projectConfig)
	if err != nil {
		t.Fatal(err)
	}
	if string(configData) != "project-owned\n" {
		t.Fatalf("project-owned configuration was modified: %q", configData)
	}
	wrapper := filepath.Join(project, "docs", "documentation")
	info, err := os.Stat(wrapper)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o755 {
		t.Fatalf("expected executable wrapper, got %o", info.Mode().Perm())
	}
	if code, err := check(project, assets); err != nil || code != 0 {
		t.Fatalf("expected clean check, code=%d err=%v", code, err)
	}
	if err := os.WriteFile(wrapper, []byte("changed\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if code, err := check(project, assets); err != nil || code != 1 {
		t.Fatalf("expected drift check failure, code=%d err=%v", code, err)
	}
}

func TestFreshInstallRefusesUnmanagedConflict(t *testing.T) {
	assets := fixtureAssets(t, "0.4.0", map[string]fixtureFile{
		"docs/documentation":                {Content: "managed\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION": {Content: "0.4.0\n", Mode: 0o644},
	})
	project := t.TempDir()
	conflict := filepath.Join(project, "docs", "documentation")
	if err := os.MkdirAll(filepath.Dir(conflict), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(conflict, []byte("unmanaged\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	err := install(project, assets, false, "local")
	if err == nil || !strings.Contains(err.Error(), "refusing to overwrite") {
		t.Fatalf("expected unmanaged conflict refusal, got %v", err)
	}
}

func TestUpgradeRemovesRetiredFiles(t *testing.T) {
	oldAssets := fixtureAssets(t, "0.3.1", map[string]fixtureFile{
		"docs/documentation":                        {Content: "old\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION":         {Content: "0.3.1\n", Mode: 0o644},
		"docs/.documentation-tools/retired-tool.py": {Content: "old\n", Mode: 0o644},
	})
	newAssets := fixtureAssets(t, "0.4.0", map[string]fixtureFile{
		"docs/documentation":                {Content: "new\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION": {Content: "0.4.0\n", Mode: 0o644},
	})
	project := t.TempDir()
	if err := install(project, oldAssets, false, "local"); err != nil {
		t.Fatal(err)
	}
	if err := install(project, newAssets, true, "local"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(project, "docs", ".documentation-tools", "retired-tool.py")); !os.IsNotExist(err) {
		t.Fatalf("expected retired file removal, got %v", err)
	}
	installed := readFixtureManifest(t, project)
	if installed.ToolVersion != "0.4.0" {
		t.Fatalf("unexpected installed version: %s", installed.ToolVersion)
	}
}

func TestUpgradeRefusesDriftAndDowngrade(t *testing.T) {
	assets := fixtureAssets(t, "0.4.0", map[string]fixtureFile{
		"docs/documentation":                {Content: "stable\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION": {Content: "0.4.0\n", Mode: 0o644},
	})
	project := t.TempDir()
	if err := install(project, assets, false, "local"); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(project, "docs", "documentation")
	if err := os.WriteFile(target, []byte("local change\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := install(project, assets, true, "local"); err == nil || !strings.Contains(err.Error(), "local drift") {
		t.Fatalf("expected drift refusal, got %v", err)
	}

	newerProject := t.TempDir()
	if err := install(newerProject, assets, false, "local"); err != nil {
		t.Fatal(err)
	}
	installed := readFixtureManifest(t, newerProject)
	installed.ToolVersion = "9.0.0"
	writeFixtureManifest(t, newerProject, installed)
	if err := install(newerProject, assets, true, "local"); err == nil || !strings.Contains(err.Error(), "refusing to downgrade") {
		t.Fatalf("expected downgrade refusal, got %v", err)
	}
}

func TestRemoteProfileInstallsOnlyRuntimeFiles(t *testing.T) {
	assets := fixtureAssets(t, "0.5.0", map[string]fixtureFile{
		"docs/documentation":                                 {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION":                  {Content: "0.5.0\n", Mode: 0o644},
		"docs/.documentation-tools/release-catalog":          {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/releases/LATEST":          {Content: "0.5.0\n", Mode: 0o644},
		"docs/.documentation-tools/releases/0.5.0.env":       {Content: "RENDERER_VERSION=0.5.0\n", Mode: 0o644},
		"docs/.documentation-tools/releases/README.md":       {Content: "catalog\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/header.tex":           {Content: "header\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/Dockerfile":           {Content: "FROM scratch\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/filters/source.lua":   {Content: "filter\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/cmd/renderer/main.go": {Content: "package main\n", Mode: 0o644},
	})
	project := t.TempDir()
	if err := install(project, assets, false, "remote"); err != nil {
		t.Fatal(err)
	}
	for _, relative := range []string{
		"docs/documentation",
		"docs/.documentation-tools/VERSION",
		"docs/.documentation-tools/release-catalog",
		"docs/.documentation-tools/releases/LATEST",
		"docs/.documentation-tools/releases/0.5.0.env",
		"docs/.documentation-tools/releases/README.md",
		"docs/.documentation-tools/pdf/header.tex",
	} {
		if _, err := os.Stat(filepath.Join(project, filepath.FromSlash(relative))); err != nil {
			t.Fatalf("expected remote runtime file %s: %v", relative, err)
		}
	}
	for _, relative := range []string{
		"docs/.documentation-tools/pdf/Dockerfile",
		"docs/.documentation-tools/pdf/filters/source.lua",
		"docs/.documentation-tools/pdf/cmd/renderer/main.go",
	} {
		if _, err := os.Stat(filepath.Join(project, filepath.FromSlash(relative))); !os.IsNotExist(err) {
			t.Fatalf("remote profile unexpectedly installed %s", relative)
		}
	}
	installed := readFixtureManifest(t, project)
	if installed.InstallProfile != "remote" || len(installed.ManagedFiles) != 7 {
		t.Fatalf("unexpected remote manifest: %#v", installed)
	}
}

func TestUpgradeFromLocalToRemoteRetiresBuildSources(t *testing.T) {
	assets := fixtureAssets(t, "0.5.0", map[string]fixtureFile{
		"docs/documentation":                               {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION":                {Content: "0.5.0\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/header.tex":         {Content: "header\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/Dockerfile":         {Content: "FROM scratch\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/filters/source.lua": {Content: "filter\n", Mode: 0o644},
	})
	project := t.TempDir()
	if err := install(project, assets, false, "local"); err != nil {
		t.Fatal(err)
	}
	if err := install(project, assets, true, "remote"); err != nil {
		t.Fatal(err)
	}
	for _, relative := range []string{
		"docs/.documentation-tools/pdf/Dockerfile",
		"docs/.documentation-tools/pdf/filters/source.lua",
	} {
		if _, err := os.Stat(filepath.Join(project, filepath.FromSlash(relative))); !os.IsNotExist(err) {
			t.Fatalf("expected remote upgrade to retire %s", relative)
		}
	}
	installed := readFixtureManifest(t, project)
	if installed.InstallProfile != "remote" {
		t.Fatalf("unexpected install profile: %q", installed.InstallProfile)
	}
}

func TestAutoProfilePreservesRemoteInstallation(t *testing.T) {
	assets := fixtureAssets(t, "0.5.0", map[string]fixtureFile{
		"docs/documentation":                               {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION":                {Content: "0.5.0\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/header.tex":         {Content: "header\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/Dockerfile":         {Content: "FROM scratch\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/filters/source.lua": {Content: "filter\n", Mode: 0o644},
	})
	project := t.TempDir()
	if err := install(project, assets, false, "remote"); err != nil {
		t.Fatal(err)
	}
	if err := install(project, assets, true, "auto"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(project, "docs", ".documentation-tools", "pdf", "Dockerfile")); !os.IsNotExist(err) {
		t.Fatal("auto profile unexpectedly restored local build sources")
	}
	installed := readFixtureManifest(t, project)
	if installed.InstallProfile != "remote" {
		t.Fatalf("unexpected install profile: %q", installed.InstallProfile)
	}
}

func TestExplicitLocalProfileRestoresBuildSources(t *testing.T) {
	assets := fixtureAssets(t, "0.5.0", map[string]fixtureFile{
		"docs/documentation":                               {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/VERSION":                {Content: "0.5.0\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/header.tex":         {Content: "header\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/Dockerfile":         {Content: "FROM scratch\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/filters/source.lua": {Content: "filter\n", Mode: 0o644},
	})
	project := t.TempDir()
	if err := install(project, assets, false, "remote"); err != nil {
		t.Fatal(err)
	}
	if err := install(project, assets, true, "local"); err != nil {
		t.Fatal(err)
	}
	for _, relative := range []string{
		"docs/.documentation-tools/pdf/Dockerfile",
		"docs/.documentation-tools/pdf/filters/source.lua",
	} {
		if _, err := os.Stat(filepath.Join(project, filepath.FromSlash(relative))); err != nil {
			t.Fatalf("expected local profile to restore %s: %v", relative, err)
		}
	}
	installed := readFixtureManifest(t, project)
	if installed.InstallProfile != "local" {
		t.Fatalf("unexpected install profile: %q", installed.InstallProfile)
	}
}

func TestRemoteUpgradePlanIsReadOnlyAndReportsExactChanges(t *testing.T) {
	assets := fixtureAssets(t, "0.6.0", map[string]fixtureFile{
		"docs/documentation":                               {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/pdf/header.tex":         {Content: "header\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/Dockerfile":         {Content: "FROM scratch\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/filters/source.lua": {Content: "filter\n", Mode: 0o644},
	})
	project := t.TempDir()
	writeDoctorConfig(t, project, strings.Join([]string{
		"schema_version = 1",
		"",
		"[pdf]",
		`mode = "local"`,
		`image = ""`,
		"",
	}, "\n"))
	if err := install(project, assets, false, "local"); err != nil {
		t.Fatal(err)
	}

	before := fixtureTreeDigests(t, project)

	targetImage := "registry.example/docs@sha256:" + strings.Repeat("a", 64)
	output, err := captureStdout(t, func() error {
		return planRemoteProfileUpgrade(project, assets, "0.6.0", targetImage, 1, "")
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{
		"Installed managed tooling: 0.6.0 (local profile)",
		"Target managed tooling: 0.6.0 (remote profile)",
		`[pdf].mode: "local" -> "remote"`,
		`[pdf].image: "" -> "` + targetImage + `"`,
		"DOCUMENTATION_REMOTE_RENDERER_IMAGE=" + targetImage,
		"docs/.documentation-tools/pdf/Dockerfile",
		"No files were changed.",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("upgrade plan is missing %q:\n%s", expected, output)
		}
	}

	after := fixtureTreeDigests(t, project)
	if !reflect.DeepEqual(after, before) {
		t.Fatalf("read-only plan changed project files:\nbefore=%v\nafter=%v", before, after)
	}
}

func TestRemoteUpgradePlanRefusesIncompatibleOrUnsafeState(t *testing.T) {
	assets := fixtureAssets(t, "0.6.0", map[string]fixtureFile{
		"docs/documentation":                       {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/pdf/header.tex": {Content: "header\n", Mode: 0o644},
	})
	targetImage := "registry.example/docs@sha256:" + strings.Repeat("b", 64)
	newProject := func(t *testing.T, schema int) string {
		t.Helper()
		project := t.TempDir()
		writeDoctorConfig(t, project, fmt.Sprintf(
			"schema_version = %d\n\n[pdf]\nmode = \"local\"\nimage = \"\"\n",
			schema,
		))
		if err := install(project, assets, false, "local"); err != nil {
			t.Fatal(err)
		}
		return project
	}

	t.Run("configuration schema", func(t *testing.T) {
		err := planRemoteProfileUpgrade(newProject(t, 2), assets, "0.6.0", targetImage, 1, "")
		if err == nil || !strings.Contains(err.Error(), "incompatible") {
			t.Fatalf("expected schema incompatibility, got %v", err)
		}
	})
	t.Run("managed drift", func(t *testing.T) {
		project := newProject(t, 1)
		if err := os.WriteFile(filepath.Join(project, "docs", "documentation"), []byte("drift\n"), 0o755); err != nil {
			t.Fatal(err)
		}
		err := planRemoteProfileUpgrade(project, assets, "0.6.0", targetImage, 1, "")
		if err == nil || !strings.Contains(err.Error(), "local drift") {
			t.Fatalf("expected managed drift refusal, got %v", err)
		}
	})
	t.Run("bundle mismatch", func(t *testing.T) {
		err := planRemoteProfileUpgrade(newProject(t, 1), assets, "0.7.0", targetImage, 1, "")
		if err == nil || !strings.Contains(err.Error(), "does not match bundled managed tooling") {
			t.Fatalf("expected bundle mismatch, got %v", err)
		}
	})
	t.Run("downgrade", func(t *testing.T) {
		project := newProject(t, 1)
		installed := readFixtureManifest(t, project)
		installed.ToolVersion = "0.7.0"
		writeFixtureManifest(t, project, installed)
		err := planRemoteProfileUpgrade(project, assets, "0.6.0", targetImage, 1, "")
		if err == nil || !strings.Contains(err.Error(), "refusing to plan a downgrade") {
			t.Fatalf("expected downgrade refusal, got %v", err)
		}
	})
}

func TestLocalUpgradeRefusesUnmanagedFileCollision(t *testing.T) {
	assets := fixtureAssets(t, "0.5.0", map[string]fixtureFile{
		"docs/documentation":                               {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/.documentation-tools/pdf/header.tex":         {Content: "header\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/Dockerfile":         {Content: "FROM scratch\n", Mode: 0o644},
		"docs/.documentation-tools/pdf/filters/source.lua": {Content: "filter\n", Mode: 0o644},
	})
	project := t.TempDir()
	if err := install(project, assets, false, "remote"); err != nil {
		t.Fatal(err)
	}
	dockerfile := filepath.Join(project, "docs", ".documentation-tools", "pdf", "Dockerfile")
	if err := os.WriteFile(dockerfile, []byte("user-owned\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	err := install(project, assets, true, "local")
	if err == nil || !strings.Contains(err.Error(), "not owned by a managed manifest") {
		t.Fatalf("expected unmanaged collision refusal, got %v", err)
	}
	content, readErr := os.ReadFile(dockerfile)
	if readErr != nil {
		t.Fatal(readErr)
	}
	if string(content) != "user-owned\n" {
		t.Fatalf("unmanaged Dockerfile was changed: %q", content)
	}
}

func TestUpgradeReplacesRetiredFileWithManagedDirectory(t *testing.T) {
	oldAssets := fixtureAssets(t, "0.4.0", map[string]fixtureFile{
		"docs/documentation": {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/tool":          {Content: "old file\n", Mode: 0o644},
	})
	newAssets := fixtureAssets(t, "0.5.0", map[string]fixtureFile{
		"docs/documentation": {Content: "#!/bin/sh\n", Mode: 0o755},
		"docs/tool/config":   {Content: "new child\n", Mode: 0o644},
	})
	project := t.TempDir()
	if err := install(project, oldAssets, false, "local"); err != nil {
		t.Fatal(err)
	}
	if err := install(project, newAssets, true, "local"); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(project, "docs", "tool", "config"))
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "new child\n" {
		t.Fatalf("unexpected migrated content: %q", content)
	}
}

func TestUpgradeRollbackRestoresManagedFileBeforeDirectoryMigration(t *testing.T) {
	project := t.TempDir()
	target := filepath.Join(project, "docs", "tool")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("old file\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	backupRoot, err := os.MkdirTemp(project, ".upgrade-test-")
	if err != nil {
		t.Fatal(err)
	}
	backupPath, err := backupManagedFile(project, backupRoot, "docs/tool")
	if err != nil {
		t.Fatal(err)
	}
	replacement := filepath.Join(project, "docs", "tool", "config")
	if err := os.MkdirAll(filepath.Dir(replacement), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(replacement, []byte("new child\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := restoreManagedFiles(
		project,
		map[string]string{"docs/tool": backupPath},
		[]string{"docs/tool/config"},
	); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(target)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "old file\n" {
		t.Fatalf("rollback did not restore managed file: %q", content)
	}
}

func TestManagedReleaseCatalogValidatesAndRejectsRevokedRelease(t *testing.T) {
	skillRoot := repositoryRoot(t)
	catalogTool := filepath.Join(
		skillRoot,
		"assets",
		"project-tools",
		"docs",
		".documentation-tools",
		"release-catalog",
	)
	command := exec.Command(catalogTool, "validate")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("expected bundled release catalog to validate: %v\n%s", err, output)
	}

	catalogDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(catalogDir, "LATEST"), []byte("1.2.3\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	entry := strings.Join([]string{
		"CATALOG_SCHEMA_VERSION=1",
		"RENDERER_VERSION=1.2.3",
		"RENDERER_IMAGE=registry.example/docs@sha256:" + strings.Repeat("a", 64),
		"ARCHITECTURES=linux/amd64,linux/arm64",
		"PUBLISHED_AT=2026-07-28T10:00:00Z",
		"SOURCE_COMMIT=" + strings.Repeat("b", 40),
		"CONFIG_SCHEMA_VERSION=1",
		"RELEASE_STATUS=revoked",
		"UPGRADE_NOTES=Revoked test release.",
		"SBOM=fixture",
		"SCAN=fixture",
		"PROVENANCE=fixture",
		"SIGNATURE=fixture",
		"",
	}, "\n")
	if err := os.WriteFile(filepath.Join(catalogDir, "1.2.3.env"), []byte(entry), 0o644); err != nil {
		t.Fatal(err)
	}
	command = exec.Command(catalogTool, "resolve", "1.2.3")
	command.Env = append(os.Environ(), "DOCUMENTATION_RELEASE_CATALOG_DIR="+catalogDir)
	output, err := command.CombinedOutput()
	if err == nil || !strings.Contains(string(output), "revoked") {
		t.Fatalf("expected revoked release resolution to fail, got %v\n%s", err, output)
	}

	invalidEntry := strings.Replace(entry, strings.Repeat("a", 64), "mutable", 1)
	invalidEntry = strings.Replace(invalidEntry, "RELEASE_STATUS=revoked", "RELEASE_STATUS=active", 1)
	if err := os.WriteFile(filepath.Join(catalogDir, "1.2.3.env"), []byte(invalidEntry), 0o644); err != nil {
		t.Fatal(err)
	}
	command = exec.Command(catalogTool, "validate")
	command.Env = append(os.Environ(), "DOCUMENTATION_RELEASE_CATALOG_DIR="+catalogDir)
	output, err = command.CombinedOutput()
	if err == nil || !strings.Contains(string(output), "immutable sha256 digest") {
		t.Fatalf("expected mutable catalog image to fail, got %v\n%s", err, output)
	}
}

func TestDocumentationDoctorReportsLocalAndRemoteReadiness(t *testing.T) {
	skillRoot := repositoryRoot(t)
	assets := filepath.Join(skillRoot, "assets", "project-tools")
	template, err := os.ReadFile(filepath.Join(skillRoot, "assets", "project-templates", "docs", "documentation.toml"))
	if err != nil {
		t.Fatal(err)
	}
	fakeBin := t.TempDir()
	fakeDocker := filepath.Join(fakeBin, "docker")
	if err := os.WriteFile(
		fakeDocker,
		[]byte("#!/bin/sh\ncase \"${1:-}\" in\n  info) exit 0 ;;\n  manifest) [ \"${2:-}\" = inspect ] && exit 0 ;;\nesac\nexit 1\n"),
		0o755,
	); err != nil {
		t.Fatal(err)
	}

	localProject := t.TempDir()
	writeDoctorConfig(t, localProject, string(template))
	if err := install(localProject, assets, false, "local"); err != nil {
		t.Fatal(err)
	}
	output, err := runDoctor(localProject, fakeBin, "")
	if err != nil {
		t.Fatalf("expected local doctor to pass: %v\n%s", err, output)
	}
	for _, expected := range []string{
		"OK: installation profile local",
		"OK: managed files match their recorded checksums",
		"OK: local renderer Dockerfile is available",
		"Doctor completed with 0 error(s)",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("local doctor output is missing %q:\n%s", expected, output)
		}
	}

	remoteProject := t.TempDir()
	remoteConfig := strings.Replace(string(template), `mode = "local"`, `mode = "remote"`, 1)
	remoteConfig = strings.Replace(remoteConfig, `image = ""`, `image = "`+legacyPublishedImage+`"`, 1)
	writeDoctorConfig(t, remoteProject, remoteConfig)
	if err := install(remoteProject, assets, false, "remote"); err != nil {
		t.Fatal(err)
	}
	output, err = runDoctor(remoteProject, fakeBin, legacyPublishedImage)
	if err != nil {
		t.Fatalf("expected remote doctor to pass: %v\n%s", err, output)
	}
	for _, expected := range []string{
		"OK: installation profile remote",
		"OK: configured renderer matches catalog release 0.5.0",
		"OK: trusted renderer allowlist matches configured pdf.image",
		"OK: registry manifest is reachable",
	} {
		if !strings.Contains(output, expected) {
			t.Fatalf("remote doctor output is missing %q:\n%s", expected, output)
		}
	}

	output, err = runDoctor(remoteProject, fakeBin, "")
	if err == nil || !strings.Contains(output, "DOCUMENTATION_REMOTE_RENDERER_IMAGE is missing") {
		t.Fatalf("expected doctor to require the independent renderer allowlist, got %v\n%s", err, output)
	}

	header := filepath.Join(remoteProject, "docs", ".documentation-tools", "pdf", "header.tex")
	if err := os.WriteFile(header, []byte("drift\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	output, err = runDoctor(remoteProject, fakeBin, legacyPublishedImage)
	if err == nil || !strings.Contains(output, "managed-file drift detected") {
		t.Fatalf("expected doctor to reject managed drift, got %v\n%s", err, output)
	}
}

type fixtureFile struct {
	Content string
	Mode    os.FileMode
}

func repositoryRoot(t *testing.T) string {
	t.Helper()
	if configured := os.Getenv("DOCUMENTATION_SKILL_ROOT"); configured != "" {
		return configured
	}
	current, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	return filepath.Clean(filepath.Join(current, "..", ".."))
}

func writeDoctorConfig(t *testing.T, project, content string) {
	t.Helper()
	path := filepath.Join(project, "docs", "documentation.toml")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func runDoctor(project, fakeBin, allowlistedImage string) (string, error) {
	command := exec.Command(filepath.Join(project, "docs", "documentation"), "doctor")
	environment := append(os.Environ(), "PATH="+fakeBin+string(os.PathListSeparator)+os.Getenv("PATH"))
	if allowlistedImage != "" {
		environment = append(environment, "DOCUMENTATION_REMOTE_RENDERER_IMAGE="+allowlistedImage)
	}
	command.Env = environment
	output, err := command.CombinedOutput()
	return string(output), err
}

func captureStdout(t *testing.T, action func() error) (string, error) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "stdout")
	output, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	previous := os.Stdout
	os.Stdout = output
	actionErr := action()
	os.Stdout = previous
	if err := output.Close(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data), actionErr
}

func fixtureTreeDigests(t *testing.T, root string) map[string]string {
	t.Helper()
	digests := map[string]string{}
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if !entry.Type().IsRegular() {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		digest, err := fileSHA256(path)
		if err != nil {
			return err
		}
		digests[filepath.ToSlash(relative)] = digest
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return digests
}

func fixtureAssets(t *testing.T, version string, files map[string]fixtureFile) string {
	t.Helper()
	root := t.TempDir()
	for relative, fixture := range files {
		if relative == "docs/.documentation-tools/VERSION" {
			continue
		}
		path := filepath.Join(root, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(fixture.Content), fixture.Mode); err != nil {
			t.Fatal(err)
		}
	}
	versionPath := filepath.Join(root, "docs", ".documentation-tools", "VERSION")
	if err := os.MkdirAll(filepath.Dir(versionPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(versionPath, []byte(version+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	return root
}

func readFixtureManifest(t *testing.T, project string) manifest {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(project, filepath.FromSlash(manifestRelativePath)))
	if err != nil {
		t.Fatal(err)
	}
	var value manifest
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	return value
}

func writeFixtureManifest(t *testing.T, project string, value manifest) {
	t.Helper()
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(project, filepath.FromSlash(manifestRelativePath))
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		t.Fatal(err)
	}
}
