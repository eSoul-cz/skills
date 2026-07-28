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
	root := t.TempDir()
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
	clientLogo := filepath.Join(root, "docs", "client.svg")
	if err := os.MkdirAll(filepath.Dir(clientLogo), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(clientLogo, []byte("<svg/>"), 0o644); err != nil {
		t.Fatal(err)
	}

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
	files, err := prepareThemeFiles(
		root,
		stagingDir,
		themeDocument{
			Title:           "Client & Operations",
			ClientName:      "Northstar & Partners",
			ClientLogo:      "docs/client.svg",
			DocumentVersion: "1.2",
			DocumentDate:    "28 July 2026",
			Classification:  "Client Confidential",
			Language:        "en",
		},
		theme,
	)
	if err != nil {
		t.Fatal(err)
	}
	if files.Header == "" || files.BeforeBody == "" {
		t.Fatalf("missing prepared eSoul theme files: %#v", files)
	}
	if len(commands) != 3 {
		t.Fatalf("expected three vector logo conversions, got %#v", commands)
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
	for _, expected := range []string{
		`Client \& Operations`,
		`Northstar \& Partners`,
		"Client Confidential",
		"28 July 2026",
		"client-logo.pdf",
		`width=58mm,height=24mm`,
		`\makebox[34mm]`,
	} {
		if !strings.Contains(string(cover), expected) {
			t.Fatalf("cover is missing %q: %s", expected, cover)
		}
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
	for _, expected := range []string{
		`width=38mm,height=13mm,keepaspectratio]{client-logo.pdf}`,
		`\includegraphics[width=28mm]{esoul-logo-text.pdf}`,
	} {
		if !strings.Contains(string(header), expected) {
			t.Fatalf("eSoul header is missing %q: %s", expected, header)
		}
	}
	if strings.Contains(string(header), `\ihead{\hspace*{-17mm}`) {
		t.Fatalf("eSoul publisher mark remained in a client-branded running header: %s", header)
	}
}

func TestESoulCoverOmitsAbsentClientMetadata(t *testing.T) {
	cover := esoulCover(themeDocument{Title: "Minimal Guide", Language: "en"}, "")
	if strings.Contains(cover, `\makebox[34mm]`) || strings.Contains(cover, "client-logo") {
		t.Fatalf("minimal cover contains optional client presentation: %s", cover)
	}
}

func TestESoulLayoutUsesPublisherHeaderWithoutClientLogo(t *testing.T) {
	header := esoulLayoutHeader("")
	if !strings.Contains(header, `\ihead{\hspace*{-17mm}`) ||
		!strings.Contains(header, `width=19mm]{esoul-logo-simple.pdf}`) {
		t.Fatalf("minimal eSoul layout is missing its publisher header fallback: %s", header)
	}
	if !strings.Contains(header, `\includegraphics[width=28mm]{esoul-logo-text.pdf}`) {
		t.Fatalf("minimal eSoul layout is missing its compact footer wordmark: %s", header)
	}
}

func TestESoulCoverLocalizesMetadataLabels(t *testing.T) {
	cover := esoulCover(themeDocument{
		Title:           "Příručka",
		ClientName:      "Ukázkový klient",
		DocumentVersion: "1.0",
		DocumentDate:    "28. 7. 2026",
		Classification:  "Důvěrné",
		Language:        "cs-CZ",
	}, "")
	for _, expected := range []string{"Klient", "Verze", "Datum", "Klasifikace"} {
		if !strings.Contains(cover, expected) {
			t.Fatalf("Czech cover is missing %q: %s", expected, cover)
		}
	}
}

func TestNewThemeDocumentUsesGuideMetadataOverrides(t *testing.T) {
	document := newThemeDocument(
		config{
			DocumentationVersion: "1.0",
			PrimaryLanguage:      "cs",
			Project:              projectConfig{Name: "Client", Logo: "docs/client.svg"},
		},
		guideConfig{
			Title:           "Guide",
			DocumentVersion: "2.0",
			DocumentDate:    "2026-07-28",
			Classification:  "Internal",
		},
	)
	if document.DocumentVersion != "2.0" || document.ClientName != "Client" ||
		document.ClientLogo != "docs/client.svg" || document.Language != "cs" {
		t.Fatalf("unexpected theme document: %#v", document)
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
