package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
	if err := install(project, assets, false); err != nil {
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
	err := install(project, assets, false)
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
	if err := install(project, oldAssets, false); err != nil {
		t.Fatal(err)
	}
	if err := install(project, newAssets, true); err != nil {
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
	if err := install(project, assets, false); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(project, "docs", "documentation")
	if err := os.WriteFile(target, []byte("local change\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := install(project, assets, true); err == nil || !strings.Contains(err.Error(), "local drift") {
		t.Fatalf("expected drift refusal, got %v", err)
	}

	newerProject := t.TempDir()
	if err := install(newerProject, assets, false); err != nil {
		t.Fatal(err)
	}
	installed := readFixtureManifest(t, newerProject)
	installed.ToolVersion = "9.0.0"
	writeFixtureManifest(t, newerProject, installed)
	if err := install(newerProject, assets, true); err == nil || !strings.Contains(err.Error(), "refusing to downgrade") {
		t.Fatalf("expected downgrade refusal, got %v", err)
	}
}

type fixtureFile struct {
	Content string
	Mode    os.FileMode
}

func fixtureAssets(t *testing.T, version string, files map[string]fixtureFile) string {
	t.Helper()
	root := t.TempDir()
	for relative, fixture := range files {
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
