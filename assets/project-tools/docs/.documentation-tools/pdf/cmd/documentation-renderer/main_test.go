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
