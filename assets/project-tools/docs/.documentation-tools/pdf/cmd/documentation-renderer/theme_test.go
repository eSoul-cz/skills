package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveDefaultThemePreservesExistingRenderingDefaults(t *testing.T) {
	theme, err := resolveTheme(pdfConfig{})
	if err != nil {
		t.Fatal(err)
	}
	if theme.Name != "default" || theme.Branded {
		t.Fatalf("unexpected default theme identity: %#v", theme)
	}
	if theme.MainFont != "Noto Sans" || theme.HeadingFont != "Noto Sans" ||
		theme.MonoFont != "Noto Sans Mono" || theme.FontSize != "11pt" {
		t.Fatalf("unexpected default fonts: %#v", theme)
	}
	if theme.AccentColor != "1B6B93" || theme.Margin != "24mm" || theme.LinkColor.value != "blue" {
		t.Fatalf("unexpected default rendering tokens: %#v", theme)
	}
}

func TestResolveESoulThemeUsesReferenceDesignTokens(t *testing.T) {
	theme, err := resolveTheme(pdfConfig{Theme: "esoul"})
	if err != nil {
		t.Fatal(err)
	}
	if !theme.Branded || theme.MainFont != "Poppins" || theme.HeadingFont != "Syne" {
		t.Fatalf("unexpected eSoul font tokens: %#v", theme)
	}
	if theme.TextColor.value != "1B1B1D" || theme.HeadingColor.value != "0E0F11" || theme.AccentColor != "4A494A" {
		t.Fatalf("unexpected eSoul color tokens: %#v", theme)
	}
	if theme.Margin != "25.4mm" || theme.FontSize != "12pt" {
		t.Fatalf("unexpected eSoul dimensions: %#v", theme)
	}
	if theme.NoteBorder.value != "78858A" || theme.TipBorder.value != "718378" ||
		theme.ImportantBorder.value != "827587" || theme.WarningBorder.value != "9A825C" ||
		theme.CautionBorder.value != "987171" || theme.PlannedBorder.value != "777677" {
		t.Fatalf("unexpected eSoul callout palette: %#v", theme)
	}
}

func TestResolveThemeAppliesTypedThenLegacyOverrides(t *testing.T) {
	theme, err := resolveTheme(pdfConfig{
		Theme: "esoul",
		ThemeOverrides: themeOverridesConfig{
			AccentColor: "abcdef",
			MainFont:    "Typed Main",
			HeadingFont: "Typed Heading",
			Margin:      "2.5cm",
		},
		MainFont:    "Legacy Main",
		AccentColor: "123456",
	})
	if err != nil {
		t.Fatal(err)
	}
	if theme.MainFont != "Legacy Main" || theme.HeadingFont != "Legacy Main" {
		t.Fatalf("legacy main_font did not retain precedence: %#v", theme)
	}
	if theme.AccentColor != "123456" || theme.Margin != "2.5cm" {
		t.Fatalf("unexpected override precedence: %#v", theme)
	}
}

func TestResolveThemeRejectsInvalidTypedValues(t *testing.T) {
	tests := []pdfConfig{
		{Theme: "unknown"},
		{ThemeOverrides: themeOverridesConfig{AccentColor: "blue"}},
		{ThemeOverrides: themeOverridesConfig{Margin: "0mm"}},
		{ThemeOverrides: themeOverridesConfig{FontSize: "24pt"}},
		{ThemeOverrides: themeOverridesConfig{PaperSize: "legal"}},
	}
	for _, pdf := range tests {
		if _, err := resolveTheme(pdf); err == nil {
			t.Errorf("expected invalid theme configuration to fail: %#v", pdf)
		}
	}
}

func TestPrepareESoulThemeFilesUsesVectorLogos(t *testing.T) {
	stagingDir := t.TempDir()
	toolsDir := t.TempDir()
	for _, relative := range []string{
		"themes/esoul/logo-simple.svg",
		"themes/esoul/logo-text.svg",
	} {
		path := filepath.Join(toolsDir, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("<svg/>"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("DOCUMENTATION_TOOLS_ROOT", toolsDir)

	var commands [][]string
	originalRunner := runCommand
	runCommand = func(args []string, cwd string, env []string, input []byte) (commandResult, error) {
		commands = append(commands, append([]string(nil), args...))
		return commandResult{}, nil
	}
	t.Cleanup(func() { runCommand = originalRunner })

	theme, err := resolveTheme(pdfConfig{Theme: "esoul"})
	if err != nil {
		t.Fatal(err)
	}
	files, err := prepareThemeFiles(stagingDir, guideConfig{Title: "Client & Operations"}, theme)
	if err != nil {
		t.Fatal(err)
	}
	if files.Header == "" || files.BeforeBody == "" {
		t.Fatalf("missing prepared eSoul theme files: %#v", files)
	}
	if len(commands) != 2 {
		t.Fatalf("expected two vector logo conversions, got %#v", commands)
	}
	for _, command := range commands {
		if !containsArgument(command, "--format=pdf") {
			t.Fatalf("logo was not converted to vector PDF: %#v", command)
		}
	}
	cover, err := os.ReadFile(files.BeforeBody)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(cover), `Client \& Operations`) {
		t.Fatalf("cover title was not safely escaped: %s", cover)
	}
	header, err := os.ReadFile(files.Header)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(header), "documentationesoulfooterleft") ||
		!strings.Contains(string(header), "documentationheading") {
		t.Fatalf("eSoul header is incomplete: %s", header)
	}
	if !strings.Contains(string(header), `\fontsize{12}{16}\selectfont`) {
		t.Fatalf("eSoul footer is not compact: %s", header)
	}
}

func TestWriteMetadataUsesESoulTheme(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "metadata.yaml")
	cfg := config{PDF: pdfConfig{Theme: "esoul"}}
	if err := writeMetadata(root, root, path, cfg, guideConfig{}); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(content)
	for _, expected := range []string{
		"titlepage: false",
		`fontsize: "12pt"`,
		`mainfont: "Poppins"`,
		`monofont: "Noto Sans Mono"`,
		`geometry: "left=25.4mm,right=25.4mm,top=12.5mm,bottom=45mm"`,
		"disable-header-and-footer: true",
	} {
		if !strings.Contains(text, expected) {
			t.Errorf("metadata is missing %q:\n%s", expected, text)
		}
	}
}
