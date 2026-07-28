package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPrepareFontEnvironmentCreatesIsolatedFontconfig(t *testing.T) {
	root := t.TempDir()
	fontDir := filepath.Join(root, "docs", "fonts & type")
	if err := os.MkdirAll(fontDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(fontDir, "Client.otf"), []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}
	staging := t.TempDir()

	env, err := prepareFontEnvironment(root, staging, []string{"docs/fonts & type"})
	if err != nil {
		t.Fatal(err)
	}
	if len(env) != 1 || !strings.HasPrefix(env[0], "FONTCONFIG_FILE=") {
		t.Fatalf("unexpected font environment: %#v", env)
	}
	content, err := os.ReadFile(strings.TrimPrefix(env[0], "FONTCONFIG_FILE="))
	if err != nil {
		t.Fatal(err)
	}
	text := string(content)
	if !strings.Contains(text, "<include ignore_missing=\"no\">/etc/fonts/fonts.conf</include>") ||
		!strings.Contains(text, "fonts &amp; type") {
		t.Fatalf("unexpected Fontconfig file:\n%s", text)
	}
}

func TestResolveFontDirectoriesDeduplicatesResolvedPaths(t *testing.T) {
	root := t.TempDir()
	fontDir := filepath.Join(root, "docs", "fonts")
	if err := os.MkdirAll(fontDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(fontDir, "Client.TTF"), []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}

	directories, err := resolveFontDirectories(root, []string{"docs/fonts", "docs/fonts/."})
	if err != nil {
		t.Fatal(err)
	}
	if len(directories) != 1 {
		t.Fatalf("expected one resolved font directory, got %#v", directories)
	}
}

func TestResolveFontDirectoriesRejectsInvalidEntries(t *testing.T) {
	root := t.TempDir()
	emptyDir := filepath.Join(root, "empty")
	if err := os.MkdirAll(emptyDir, 0o755); err != nil {
		t.Fatal(err)
	}
	filePath := filepath.Join(root, "font.ttf")
	if err := os.WriteFile(filePath, []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}

	tests := [][]string{
		{""},
		{"missing"},
		{"font.ttf"},
		{"empty"},
		{"../outside"},
	}
	for _, configured := range tests {
		if _, err := resolveFontDirectories(root, configured); err == nil {
			t.Errorf("expected font directories to fail: %#v", configured)
		}
	}
}

func TestResolveFontDirectoriesRejectsNestedSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	fontDir := filepath.Join(root, "docs", "fonts")
	if err := os.MkdirAll(fontDir, 0o755); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "Outside.ttf")
	if err := os.WriteFile(outside, []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(fontDir, "Outside.ttf")); err != nil {
		t.Fatal(err)
	}

	if _, err := resolveFontDirectories(root, []string{"docs/fonts"}); err == nil {
		t.Fatal("expected a nested font symlink outside the project to fail")
	}
}

func TestPrepareFontEnvironmentDoesNothingWithoutConfiguredDirectories(t *testing.T) {
	env, err := prepareFontEnvironment(t.TempDir(), t.TempDir(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if env != nil {
		t.Fatalf("unexpected font environment: %#v", env)
	}
}
