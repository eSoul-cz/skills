package main

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestSecurePathRejectsEscape(t *testing.T) {
	root := t.TempDir()
	if _, err := securePath(root, "../escape"); err == nil {
		t.Fatal("expected project escape to fail")
	}
	path, err := securePath(root, "docs/guide.md")
	if err != nil {
		t.Fatalf("expected project path to pass: %v", err)
	}
	if path != filepath.Join(root, "docs", "guide.md") {
		t.Fatalf("unexpected secure path: %s", path)
	}
}

func TestSecurePathRejectsEscapingSymlink(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(root, "linked")); err != nil {
		t.Fatal(err)
	}
	if _, err := securePath(root, "linked/output"); err == nil {
		t.Fatal("expected path through escaping symlink to fail")
	}
}

func TestOpenFileNoSymlinksRejectsInternalSymlink(t *testing.T) {
	root := t.TempDir()
	realDirectory := filepath.Join(root, "real")
	if err := os.Mkdir(realDirectory, 0o755); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "linked")
	if err := os.Symlink(realDirectory, link); err != nil {
		t.Fatal(err)
	}
	if _, err := openFileNoSymlinks(root, filepath.Join(link, "plan.json")); err == nil {
		t.Fatal("expected an internal symlink component to fail")
	}
}

func TestOpenFileNoSymlinksReadsFromOpenedDescriptor(t *testing.T) {
	root := t.TempDir()
	planPath := filepath.Join(root, "plan.json")
	if err := os.WriteFile(planPath, []byte("original"), 0o644); err != nil {
		t.Fatal(err)
	}
	planFile, err := openFileNoSymlinks(root, planPath)
	if err != nil {
		t.Fatal(err)
	}
	defer planFile.Close()
	if err := os.Rename(planPath, filepath.Join(root, "original.json")); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(planPath, []byte("replacement"), 0o644); err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(planFile)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "original" {
		t.Fatalf("descriptor followed a replaced path: %q", data)
	}
}

func TestGuideDirectoryRejectsUnsafeIDs(t *testing.T) {
	root := t.TempDir()
	for _, value := range []string{"../escape", "/absolute", "nested/guide", ".", ""} {
		if _, err := guideDirectory(root, "build", value); err == nil {
			t.Errorf("expected guide id %q to fail", value)
		}
	}
}

func TestGuideDirectoryRejectsEscapingSymlink(t *testing.T) {
	root := t.TempDir()
	work := filepath.Join(root, "work")
	build := filepath.Join(work, "build")
	outside := filepath.Join(root, "outside")
	if err := os.MkdirAll(build, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(build, "guide")); err != nil {
		t.Fatal(err)
	}
	if _, err := guideDirectory(work, "build", "guide"); err == nil {
		t.Fatal("expected escaping guide symlink to fail")
	}
}

func TestFirstH1Identifier(t *testing.T) {
	raw := `{
	  "pandoc-api-version": [1,23,1],
	  "meta": {},
	  "blocks": [
	    {"t":"Header","c":[1,["café-heading",[],[]],[{"t":"Str","c":"Café"}]]}
	  ]
	}`
	var document pandocDocument
	if err := json.Unmarshal([]byte(raw), &document); err != nil {
		t.Fatal(err)
	}
	identifier, err := firstH1Identifier(document)
	if err != nil {
		t.Fatal(err)
	}
	if identifier != "café-heading" {
		t.Fatalf("unexpected identifier: %s", identifier)
	}
}

func TestPandocAnchorsUseASTIdentifierForHeadingBeginningWithNumber(t *testing.T) {
	raw := `{
	  "pandoc-api-version": [1,23,1],
	  "meta": {},
	  "blocks": [
	    {"t":"Header","c":[2,["chapter-overview",[],[]],[{"t":"Str","c":"12."},{"t":"Space"},{"t":"Str","c":"Chapter"},{"t":"Space"},{"t":"Str","c":"Overview"}]]}
	  ]
	}`
	var document pandocDocument
	if err := json.Unmarshal([]byte(raw), &document); err != nil {
		t.Fatal(err)
	}
	anchors := pandocAnchors(document)
	if !anchors["chapter-overview"] {
		t.Fatalf("Pandoc AST identifier was not indexed: %#v", anchors)
	}
	if anchors["12-chapter-overview"] {
		t.Fatalf("anchor index reconstructed a raw Markdown slug: %#v", anchors)
	}

	root := t.TempDir()
	source := filepath.Join(root, "source.md")
	target := filepath.Join(root, "target.md")
	for _, path := range []string{source, target} {
		if err := os.WriteFile(path, []byte("# fixture\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	inspection := inspectLinkReference(
		root,
		source,
		"target.md#chapter-overview",
		map[string]bool{source: true, target: true},
		map[string]map[string]bool{},
		map[string]pandocDocument{target: document},
	)
	if inspection.Issue != "" {
		t.Fatalf("Pandoc identifier was reported as broken: %#v", inspection)
	}
}

func TestGeneratedAtHonorsSourceDateEpoch(t *testing.T) {
	t.Setenv("DOC_GENERATED_AT", "")
	t.Setenv("SOURCE_DATE_EPOCH", "946684800")
	generated, err := generatedAt()
	if err != nil {
		t.Fatal(err)
	}
	if generated != "2000-01-01 00:00 UTC" {
		t.Fatalf("unexpected reproducible timestamp: %s", generated)
	}

	t.Setenv("SOURCE_DATE_EPOCH", "invalid")
	if _, err := generatedAt(); err == nil {
		t.Fatal("expected invalid SOURCE_DATE_EPOCH to fail")
	}
}

func TestInternalDivCarriesToken(t *testing.T) {
	block, err := divBlock("documentation-page-break", "secret", nil)
	if err != nil {
		t.Fatal(err)
	}
	value := string(block)
	if !strings.Contains(value, "documentation-page-break") || !strings.Contains(value, "secret") {
		t.Fatalf("internal div does not carry class and token: %s", value)
	}
}

func TestValidateRegion(t *testing.T) {
	maxInt := int(^uint(0) >> 1)
	tests := []struct {
		name    string
		region  redactionRegion
		width   int
		height  int
		wantErr bool
	}{
		{name: "inside", region: redactionRegion{X: 1, Y: 2, Width: 10, Height: 12}, width: 100, height: 100},
		{name: "exact bounds", region: redactionRegion{X: 0, Y: 0, Width: 100, Height: 100}, width: 100, height: 100},
		{name: "negative origin", region: redactionRegion{X: -1, Y: 0, Width: 1, Height: 1}, width: 100, height: 100, wantErr: true},
		{name: "zero width", region: redactionRegion{X: 0, Y: 0, Width: 0, Height: 1}, width: 100, height: 100, wantErr: true},
		{name: "horizontal overflow", region: redactionRegion{X: 95, Y: 2, Width: 10, Height: 12}, width: 100, height: 100, wantErr: true},
		{name: "vertical overflow", region: redactionRegion{X: 2, Y: 95, Width: 10, Height: 12}, width: 100, height: 100, wantErr: true},
		{name: "origin past image", region: redactionRegion{X: maxInt, Y: 0, Width: 10, Height: 1}, width: 100, height: 100, wantErr: true},
		{name: "integer overflow", region: redactionRegion{X: maxInt - 5, Y: 0, Width: 10, Height: 1}, width: maxInt, height: 100, wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateRegion(test.region, test.width, test.height)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateRegion() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestValidatedRedactionColor(t *testing.T) {
	for _, value := range []string{"", "#123456", "#12345678"} {
		if _, err := validatedRedactionColor(value); err != nil {
			t.Errorf("expected redaction color %q to pass: %v", value, err)
		}
	}
	for _, value := range []string{"red", "#123", "url(https://example.com/color)"} {
		if _, err := validatedRedactionColor(value); err == nil {
			t.Errorf("expected redaction color %q to fail", value)
		}
	}
}

func TestValidateGuideOutput(t *testing.T) {
	if err := validateGuideOutput("guide.pdf"); err != nil {
		t.Fatalf("expected PDF filename to pass: %v", err)
	}
	for _, output := range []string{"", "../guide.pdf", "nested/guide.pdf", `nested\guide.pdf`, "guide.txt"} {
		if err := validateGuideOutput(output); err == nil {
			t.Errorf("expected output %q to fail", output)
		}
	}
}

func TestValidateDisplayMetadataRejectsUnsafePresentationValues(t *testing.T) {
	result := validationResult{}
	validateDisplayMetadata("classification", "line one\nline two", 80, "guide", &result)
	validateDisplayMetadata("document_date", strings.Repeat("x", 81), 80, "guide", &result)
	validateDisplayMetadata("document_version", "   ", 80, "guide", &result)
	for _, expected := range []string{"single line", "at most 80", "only whitespace"} {
		if !validationContains(result.Errors, expected) {
			t.Errorf("expected validation error containing %q: %#v", expected, result.Errors)
		}
	}
}

func TestValidateProjectLogoRequiresSupportedProjectFile(t *testing.T) {
	root := t.TempDir()
	unsupported := filepath.Join(root, "logo.txt")
	if err := os.WriteFile(unsupported, []byte("logo"), 0o644); err != nil {
		t.Fatal(err)
	}
	result := validationResult{}
	validateProjectLogo(root, "logo.txt", &result)
	validateProjectLogo(root, "missing.svg", &result)
	for _, expected := range []string{"must be an SVG", "Missing project.logo"} {
		if !validationContains(result.Errors, expected) {
			t.Errorf("expected validation error containing %q: %#v", expected, result.Errors)
		}
	}
}

func TestWriteHeadingMapEscapesValues(t *testing.T) {
	path := filepath.Join(t.TempDir(), "map.lua")
	headings := map[string]string{"/workspace/docs/quo\"te.md": "café"}
	if err := writeHeadingMap(path, headings); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), `quo\"te.md`) || !strings.Contains(string(content), "café") {
		t.Fatalf("unexpected heading map: %s", content)
	}
}

func TestWriteMetadataFallsBackFromInvalidAccentColor(t *testing.T) {
	root := t.TempDir()
	metadataPath := filepath.Join(root, "metadata.yaml")
	cfg := config{PDF: pdfConfig{AccentColor: "blue"}}
	if err := writeMetadata(root, root, metadataPath, cfg, guideConfig{}); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(metadataPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), `titlepage-rule-color: "1B6B93"`) {
		t.Fatalf("invalid accent color did not use the default: %s", content)
	}
}

func TestBuildGuideUsesPandocJSONAndCheckedInFilters(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "docs", "guide", "page.md")
	if err := os.MkdirAll(filepath.Dir(source), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("# Guide\n\n[Missing](../missing.md)\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	tools := filepath.Join(root, "tools")
	if err := os.MkdirAll(tools, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"source.lua", "render.lua", "mermaid-config.json"} {
		if err := os.WriteFile(filepath.Join(tools, name), []byte("-- fixture\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("DOCUMENTATION_TOOLS_ROOT", tools)

	document := `{
	  "pandoc-api-version": [1,23,1],
	  "meta": {},
	  "blocks": [
	    {"t":"Header","c":[1,["guide",[],[]],[{"t":"Str","c":"Guide"}]]},
	    {"t":"Para","c":[
	      {"t":"Link","c":[["",[],[]],[{"t":"Str","c":"Missing"}],["../missing.md",""]]}
	    ]}
	  ]
	}`
	var commands [][]string
	var sourceFilterEnv []string
	originalRunner := runCommand
	runCommand = func(args []string, cwd string, env []string, input []byte) (commandResult, error) {
		commands = append(commands, append([]string(nil), args...))
		if containsArgument(args, "--lua-filter="+filepath.Join(tools, "source.lua")) {
			sourceFilterEnv = append([]string(nil), env...)
		}
		if args[0] == "pandoc" && containsArgument(args, "--to=json") {
			return commandResult{Stdout: []byte(document)}, nil
		}
		if args[0] == "pandoc" {
			for index, argument := range args {
				if argument == "--output" && index+1 < len(args) {
					if err := os.WriteFile(args[index+1], []byte("%PDF fixture"), 0o644); err != nil {
						return commandResult{}, err
					}
				}
			}
		}
		return commandResult{}, nil
	}
	t.Cleanup(func() { runCommand = originalRunner })

	cfg := config{
		PrimaryLanguage: "en",
		OutputDir:       "docs/pdf",
		WorkDir:         "docs/work",
	}
	guide := guideConfig{
		ID:                 "guide",
		Title:              "Guide",
		Output:             "guide.pdf",
		Sources:            []string{"docs/guide/page.md"},
		CrossDocumentLinks: "notice",
		InvalidLinks:       "notice",
		LinkNoticeStyle:    "footnote",
		LinkNoticePaths:    "project-relative",
	}
	output, err := buildGuide(root, cfg, guide)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(output); err != nil {
		t.Fatalf("missing rendered fixture: %v", err)
	}
	combined := filepath.Join(root, "docs", "work", "build", "guide", "staging", "combined.json")
	if _, err := os.Stat(combined); err != nil {
		t.Fatalf("missing combined Pandoc AST: %v", err)
	}
	var usedSourceFilter, usedRenderFilter bool
	for _, command := range commands {
		for _, argument := range command {
			usedSourceFilter = usedSourceFilter || strings.HasSuffix(argument, "source.lua")
			usedRenderFilter = usedRenderFilter || strings.HasSuffix(argument, "render.lua")
		}
	}
	if !usedSourceFilter || !usedRenderFilter {
		t.Fatalf("expected source and render filters, commands: %#v", commands)
	}
	if !containsArgument(sourceFilterEnv, "DOCUMENTATION_CROSS_DOCUMENT_LINKS=notice") {
		t.Fatalf("cross-document link policy was not passed to the source filter: %#v", sourceFilterEnv)
	}
	if !containsArgument(sourceFilterEnv, "DOCUMENTATION_LINK_NOTICE_STYLE=footnote") {
		t.Fatalf("link notice style was not passed to the source filter: %#v", sourceFilterEnv)
	}
	noticeMap := filepath.Join(root, "docs", "work", "build", "guide", "staging", "link-notice-map.lua")
	if !containsArgument(sourceFilterEnv, "DOCUMENTATION_LINK_NOTICE_MAP="+noticeMap) {
		t.Fatalf("link notice map path was not passed to the source filter: %#v", sourceFilterEnv)
	}
	content, err := os.ReadFile(noticeMap)
	if err != nil {
		t.Fatalf("missing link notice map: %v", err)
	}
	if !strings.Contains(string(content), `["../missing.md"] = "docs/missing.md"`) {
		t.Fatalf("link notice map does not contain the expected mapping: %s", content)
	}
}

func containsArgument(arguments []string, expected string) bool {
	for _, argument := range arguments {
		if argument == expected {
			return true
		}
	}
	return false
}

func TestValidationReportsSuccessAndErrors(t *testing.T) {
	success := validationResult{}
	success.notice("informational")
	if !success.report() {
		t.Fatal("expected notices not to fail validation")
	}
	failure := validationResult{}
	failure.error("broken")
	failure.warn("review")
	if failure.report() {
		t.Fatal("expected validation error to fail")
	}
}

func TestLinkSeverity(t *testing.T) {
	for value, expected := range map[string]string{
		"":       "error",
		"error":  "error",
		"notice": "notice",
	} {
		severity, valid := linkSeverity(value)
		if !valid || severity != expected {
			t.Errorf("linkSeverity(%q) = %q, %t; want %q, true", value, severity, valid, expected)
		}
	}
	if _, valid := linkSeverity("warning"); valid {
		t.Fatal("unsupported link severity must be rejected")
	}
}

func TestLinkNoticeStyle(t *testing.T) {
	for value, expected := range map[string]string{
		"":            "plain",
		"plain":       "plain",
		"parentheses": "parentheses",
		"footnote":    "footnote",
	} {
		style, valid := linkNoticeStyle(value)
		if !valid || style != expected {
			t.Errorf("linkNoticeStyle(%q) = %q, %t; want %q, true", value, style, valid, expected)
		}
	}
}

func TestLinkNoticePaths(t *testing.T) {
	for value, expected := range map[string]string{
		"":                 "original",
		"original":         "original",
		"project-relative": "project-relative",
	} {
		paths, valid := linkNoticePaths(value)
		if !valid || paths != expected {
			t.Errorf("linkNoticePaths(%q) = %q, %t; want %q, true", value, paths, valid, expected)
		}
	}
}

func TestCrossDocumentLinksCanBecomeNotices(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "docs", "guide", "page.md")
	target := filepath.Join(root, "docs", "other", "page.md")
	for _, path := range []string{source, target} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("# Page\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	guideSources := map[string]bool{source: true}

	strict := validationResult{}
	validateLinkReference(
		root,
		source,
		"docs/guide/page.md",
		"../other/page.md",
		guideSources,
		"error",
		"error",
		&strict,
		map[string]map[string]bool{},
		map[string]pandocDocument{},
	)
	if !validationContains(strict.Errors, "not part of the rendered guide") {
		t.Fatalf("expected strict cross-document link error: %#v", strict.Errors)
	}

	permissive := validationResult{}
	validateLinkReference(
		root,
		source,
		"docs/guide/page.md",
		"../other/page.md",
		guideSources,
		"notice",
		"error",
		&permissive,
		map[string]map[string]bool{},
		map[string]pandocDocument{},
	)
	if len(permissive.Errors) != 0 {
		t.Fatalf("notice policy must not produce errors: %#v", permissive.Errors)
	}
	if !validationContains(permissive.Notices, "rendered with a link notice") {
		t.Fatalf("expected cross-document link notice: %#v", permissive.Notices)
	}

	invalid := validationResult{}
	validateLinkReference(
		root,
		source,
		"docs/guide/page.md",
		"../missing.md",
		guideSources,
		"error",
		"notice",
		&invalid,
		map[string]map[string]bool{},
		map[string]pandocDocument{},
	)
	if len(invalid.Errors) != 0 {
		t.Fatalf("invalid-link notice policy must not produce errors: %#v", invalid.Errors)
	}
	if !validationContains(invalid.Notices, "broken local link") {
		t.Fatalf("expected invalid-link notice: %#v", invalid.Notices)
	}
}

func TestCollectLinkNoticesUsesProjectRelativePaths(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "docs", "guide", "page.md")
	target := filepath.Join(root, "file.md")
	for _, path := range []string{source, target} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("# Page\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	raw := `{
	  "pandoc-api-version": [1,23,1],
	  "meta": {},
	  "blocks": [
	    {"t":"Para","c":[
	      {"t":"Link","c":[["",[],[]],[{"t":"Str","c":"External"}],["../../file.md",""]]},
	      {"t":"Space"},
	      {"t":"Link","c":[["",[],[]],[{"t":"Str","c":"Missing"}],["../../missing.md#draft",""]]}
	    ]}
	  ]
	}`
	var document pandocDocument
	if err := json.Unmarshal([]byte(raw), &document); err != nil {
		t.Fatal(err)
	}
	notices := collectLinkNotices(
		root,
		[]string{source},
		map[string]pandocDocument{source: document},
		guideConfig{
			CrossDocumentLinks: "notice",
			InvalidLinks:       "notice",
			LinkNoticePaths:    "project-relative",
		},
	)
	if notices[source]["../../file.md"] != "file.md" {
		t.Fatalf("unexpected cross-document display path: %#v", notices)
	}
	if notices[source]["../../missing.md#draft"] != "missing.md#draft" {
		t.Fatalf("unexpected invalid-link display path: %#v", notices)
	}
}

func TestValidateProjectRejectsUnsafeMarkdown(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "docs", "guide", "page.md")
	dockerfile := filepath.Join(root, "docs", ".documentation-tools", "pdf", "Dockerfile")
	if err := os.MkdirAll(filepath.Dir(source), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(dockerfile), 0o755); err != nil {
		t.Fatal(err)
	}
	markdown := "# Guide\n\n" +
		"![Remote](https://example.com/image.png)\n" +
		"![Embedded](data:image/png;base64,AAAA)\n" +
		"![Missing](missing.svg)\n" +
		"![Escape](../../../outside.svg)\n" +
		"```mermaid\nflowchart LR\n  A --> B\n```\n" +
		"\\begin{danger}\n" +
		"-----BEGIN PRIVATE KEY-----\n"
	if err := os.WriteFile(source, []byte(markdown), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dockerfile, []byte("FROM scratch\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	document := `{
	  "pandoc-api-version": [1,23,1],
	  "meta": {},
	  "blocks": [
	    {"t":"Header","c":[1,["guide",[],[]],[{"t":"Str","c":"Guide"}]]},
	    {"t":"Para","c":[{"t":"Image","c":[["",[],[]],[{"t":"Str","c":"Remote"}],["https://example.com/image.png",""]]}]},
	    {"t":"Para","c":[{"t":"Image","c":[["",[],[]],[{"t":"Str","c":"Embedded"}],["data:image/png;base64,AAAA",""]]}]},
	    {"t":"Para","c":[{"t":"Image","c":[["",[],[]],[{"t":"Str","c":"Missing"}],["missing.svg",""]]}]},
	    {"t":"Para","c":[{"t":"Image","c":[["",[],[]],[{"t":"Str","c":"Escape"}],["../../../outside.svg",""]]}]}
	  ]
	}`
	originalRunner := runCommand
	runCommand = func(args []string, cwd string, env []string, input []byte) (commandResult, error) {
		return commandResult{Stdout: []byte(document)}, nil
	}
	t.Cleanup(func() { runCommand = originalRunner })

	cfg := baseValidationConfig()
	result := validateProject(root, cfg)
	for _, expected := range []string{
		"remote images",
		"embedded data URI",
		"does not exist",
		"escapes the project",
		"diagram-alt",
		"raw LaTeX",
		"private key material",
	} {
		if !validationContains(result.Errors, expected) {
			t.Errorf("expected validation error containing %q; errors: %#v", expected, result.Errors)
		}
	}
}

func TestScreenshotManifestRowsRejectUnsafeEntries(t *testing.T) {
	root := t.TempDir()
	manifest := filepath.Join(root, "docs", "guide", "SCREENSHOTS.md")
	if err := os.MkdirAll(filepath.Dir(manifest), 0o755); err != nil {
		t.Fatal(err)
	}
	content := "| Published path | Approval |\n" +
		"|---|---|\n" +
		"| `example.png` | Approved |\n" +
		"| `docs/guide/images/example.png` | Approved |\n" +
		"| `docs/guide/images/example.png` | Approved |\n"
	if err := os.WriteFile(manifest, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	result := validationResult{}
	rows := screenshotManifestRows(root, manifest, &result)
	if len(rows) != 1 || rows["docs/guide/images/example.png"] == nil {
		t.Fatalf("unexpected manifest rows: %#v", rows)
	}
	for _, expected := range []string{"normalized and project-relative", "duplicate screenshot manifest path"} {
		if !validationContains(result.Errors, expected) {
			t.Errorf("expected error containing %q; errors: %#v", expected, result.Errors)
		}
	}
}

func TestRawHTMLImageValidationUsesPandocNodes(t *testing.T) {
	raw := `{
	  "pandoc-api-version": [1,23,1],
	  "meta": {},
	  "blocks": [
	    {"t":"RawBlock","c":["html","<img src=\"https://example.com/published.png\" alt=\"\"><img src=\"\" alt=\"Missing source\">"]},
	    {"t":"CodeBlock","c":[["",[],[]],"<img src=\"ignored.png\" alt=\"Ignored\">"]}
	  ]
	}`
	var document pandocDocument
	if err := json.Unmarshal([]byte(raw), &document); err != nil {
		t.Fatal(err)
	}
	html := pandocRawHTML(document)
	if strings.Contains(html, "ignored.png") || !strings.Contains(html, "published.png") {
		t.Fatalf("unexpected raw HTML extraction: %s", html)
	}
	result := validationResult{}
	validateRawHTMLImages(t.TempDir(), "source.md", "source.md", html, &result, map[string]publishedRaster{})
	for _, expected := range []string{"remote images", "alt text is empty", "missing a non-empty src"} {
		if !validationContains(result.Errors, expected) {
			t.Errorf("expected error containing %q; errors: %#v", expected, result.Errors)
		}
	}
}

func TestRawHTMLImageValidationIgnoresPrefixedAttributes(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "docs", "guide", "page.md")
	image := filepath.Join(root, "docs", "guide", "published.png")
	if err := os.MkdirAll(filepath.Dir(source), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(image, []byte("fixture"), 0o644); err != nil {
		t.Fatal(err)
	}
	rawHTML := `<img data-src="https://example.com/lazy.png" x-alt="" src="published.png" alt="Published image">`
	result := validationResult{}
	validateRawHTMLImages(root, source, "docs/guide/page.md", rawHTML, &result, map[string]publishedRaster{})
	if len(result.Errors) != 0 {
		t.Fatalf("prefixed attributes must not be treated as src or alt: %#v", result.Errors)
	}
}

func TestMermaidAlternativeAndMarkdownAnchorPassValidation(t *testing.T) {
	result := validationResult{}
	validateMermaidAlternatives(
		"docs/guide/page.md",
		"<!-- diagram-alt: A useful flow. -->\n\n```mermaid\nflowchart LR\n  A --> B\n```\n",
		&result,
	)
	if len(result.Errors) != 0 {
		t.Fatalf("valid Mermaid alternative failed: %#v", result.Errors)
	}

	root := t.TempDir()
	source := filepath.Join(root, "docs", "guide", "page.md")
	target := filepath.Join(root, "docs", "guide", "target.md")
	if err := os.MkdirAll(filepath.Dir(source), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{source, target} {
		if err := os.WriteFile(path, []byte("# Page\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	validateLinkReference(
		root,
		source,
		"docs/guide/page.md",
		"target.md#section",
		map[string]bool{source: true, target: true},
		"error",
		"error",
		&result,
		map[string]map[string]bool{target: {"section": true}},
		map[string]pandocDocument{},
	)
	if len(result.Errors) != 0 {
		t.Fatalf("valid Markdown anchor failed: %#v", result.Errors)
	}
}

func TestRemoteRendererRequiresTrustedDigest(t *testing.T) {
	root := t.TempDir()
	image := "registry.example/documentation@sha256:" + strings.Repeat("a", 64)
	result := validationResult{}
	validatePDFConfig(root, pdfConfig{Mode: "remote", Image: image}, &result)
	if !validationContains(result.Errors, "trusted runtime configuration") {
		t.Fatalf("expected trusted runtime error: %#v", result.Errors)
	}

	t.Setenv(remoteRendererImageEnv, image)
	result = validationResult{}
	validatePDFConfig(root, pdfConfig{Mode: "remote", Image: image}, &result)
	if len(result.Errors) != 0 {
		t.Fatalf("expected trusted digest to pass: %#v", result.Errors)
	}
}

func TestPackagingUsesGoAndMermanWithoutBrowserRuntime(t *testing.T) {
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate renderer test source")
	}
	pdfTools := filepath.Clean(filepath.Join(filepath.Dir(sourceFile), "..", ".."))
	dockerfile, err := os.ReadFile(filepath.Join(pdfTools, "Dockerfile"))
	if err != nil {
		t.Fatal(err)
	}
	dockerText := strings.ToLower(string(dockerfile))
	for _, forbidden := range []string{"chromium", "node:", "nodejs", "npm install", "puppeteer"} {
		if strings.Contains(dockerText, forbidden) {
			t.Errorf("Dockerfile contains forbidden browser dependency %q", forbidden)
		}
	}
	if !strings.Contains(dockerText, "merman-cli") {
		t.Error("Dockerfile does not package Merman")
	}
}

func baseValidationConfig() config {
	return config{
		SchemaVersion:    1,
		PrimaryLanguage:  "en",
		OutputDir:        "docs/pdf",
		WorkDir:          "docs/.documentation-work",
		CommitPDFOutputs: true,
		PDF: pdfConfig{
			Mode:       "local",
			Dockerfile: "docs/.documentation-tools/pdf/Dockerfile",
		},
		Guides: []guideConfig{{
			ID:      "guide",
			Title:   "Guide",
			Output:  "guide.pdf",
			Sources: []string{"docs/guide/page.md"},
		}},
	}
}

func validationContains(messages []string, expected string) bool {
	for _, message := range messages {
		if strings.Contains(message, expected) {
			return true
		}
	}
	return false
}
