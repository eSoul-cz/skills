package main

import (
	"encoding/json"
	"os"
	"path/filepath"
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
	if err := validateRegion(redactionRegion{X: 1, Y: 2, Width: 10, Height: 12}, 100, 100); err != nil {
		t.Fatalf("valid region failed: %v", err)
	}
	if err := validateRegion(redactionRegion{X: 95, Y: 2, Width: 10, Height: 12}, 100, 100); err == nil {
		t.Fatal("expected overflowing region to fail")
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

func TestBuildGuideUsesPandocJSONAndCheckedInFilters(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "docs", "guide", "page.md")
	if err := os.MkdirAll(filepath.Dir(source), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("# Guide\n\nContent.\n"), 0o644); err != nil {
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
	    {"t":"Para","c":[{"t":"Str","c":"Content."}]}
	  ]
	}`
	var commands [][]string
	originalRunner := runCommand
	runCommand = func(args []string, cwd string, env []string, input []byte) (commandResult, error) {
		commands = append(commands, append([]string(nil), args...))
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
		ID:      "guide",
		Title:   "Guide",
		Output:  "guide.pdf",
		Sources: []string{"docs/guide/page.md"},
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
	if !success.report() {
		t.Fatal("expected empty validation to pass")
	}
	failure := validationResult{}
	failure.error("broken")
	failure.warn("review")
	if failure.report() {
		t.Fatal("expected validation error to fail")
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
	    {"t":"RawBlock","c":["html","<img src=\"https://example.com/published.png\" alt=\"\">"]},
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
	for _, expected := range []string{"remote images", "alt text is empty"} {
		if !validationContains(result.Errors, expected) {
			t.Errorf("expected error containing %q; errors: %#v", expected, result.Errors)
		}
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
	workingDirectory, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	pdfTools := filepath.Clean(filepath.Join(workingDirectory, "..", ".."))
	dockerfile, err := os.ReadFile(filepath.Join(pdfTools, "Dockerfile"))
	if err != nil {
		t.Fatal(err)
	}
	sourceFilter, err := os.ReadFile(filepath.Join(pdfTools, "filters", "source.lua"))
	if err != nil {
		t.Fatal(err)
	}
	dockerText := strings.ToLower(string(dockerfile))
	for _, forbidden := range []string{"chromium", "node:", "nodejs", "npm install", "puppeteer"} {
		if strings.Contains(dockerText, forbidden) {
			t.Errorf("Dockerfile contains forbidden browser dependency %q", forbidden)
		}
	}
	filterText := string(sourceFilter)
	for _, expected := range []string{`pandoc.pipe("merman-cli"`, `"--outputFormat", "pdf"`, `"--pdfFit"`} {
		if !strings.Contains(filterText, expected) {
			t.Errorf("source filter missing %q", expected)
		}
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
