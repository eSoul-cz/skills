package main

import (
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

// writeValidationProject creates a project with one guide source and the local Dockerfile that
// baseValidationConfig refers to, and makes the Pandoc call return the given AST blocks.
func writeValidationProject(t *testing.T, blocks string) string {
	t.Helper()
	root := t.TempDir()
	source := filepath.Join(root, "docs", "guide", "page.md")
	dockerfile := filepath.Join(root, "docs", ".documentation-tools", "pdf", "Dockerfile")
	for path, content := range map[string]string{source: "# Guide\n", dockerfile: "FROM scratch\n"} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	document := `{"pandoc-api-version":[1,23,1],"meta":{},"blocks":[` +
		`{"t":"Header","c":[1,["guide",[],[]],[{"t":"Str","c":"Guide"}]]}` + blocks + `]}`
	originalRunner := runCommand
	runCommand = func(args []string, cwd string, env []string, input []byte) (commandResult, error) {
		return commandResult{Stdout: []byte(document)}, nil
	}
	t.Cleanup(func() { runCommand = originalRunner })
	return root
}

func mathBlock(t *testing.T, formulas ...string) string {
	t.Helper()
	var inlines []string
	for _, formula := range formulas {
		quoted, err := json.Marshal(formula)
		if err != nil {
			t.Fatal(err)
		}
		inlines = append(inlines, `{"t":"Math","c":[{"t":"InlineMath"},`+string(quoted)+`]}`)
	}
	return `,{"t":"Para","c":[` + strings.Join(inlines, ",") + `]}`
}

func TestCommitPDFOutputsTrueIsANoticeOnly(t *testing.T) {
	root := writeValidationProject(t, "")
	cfg := baseValidationConfig()

	result := validateProject(root, cfg)
	if validationContains(result.Notices, "commit_pdf_outputs") || len(result.Errors) != 0 {
		t.Fatalf("the default (false) must stay silent; notices: %#v errors: %#v", result.Notices, result.Errors)
	}

	cfg.CommitPDFOutputs = true
	result = validateProject(root, cfg)
	if !validationContains(result.Notices, "commit_pdf_outputs is true") {
		t.Errorf("expected a notice for commit_pdf_outputs = true; notices: %#v", result.Notices)
	}
	if validationContains(result.Warnings, "commit_pdf_outputs") {
		t.Errorf("commit_pdf_outputs = true must not warn; warnings: %#v", result.Warnings)
	}
	if len(result.Errors) != 0 {
		t.Errorf("commit_pdf_outputs = true must not add an error; errors: %#v", result.Errors)
	}
}

func TestValidateGitStateOutputIgnoreCheck(t *testing.T) {
	cases := []struct {
		name         string
		commitPDFs   bool
		outputIgnore string
		wantError    bool
	}{
		{"default and ignored", false, "1", false},
		{"default and not ignored", false, "0", true},
		{"commit_pdf_outputs skips the check", true, "0", false},
		{"commit_pdf_outputs and ignored", true, "1", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			if err := os.Mkdir(filepath.Join(root, ".git"), 0o755); err != nil {
				t.Fatal(err)
			}
			t.Setenv("DOC_GIT_CHECKS_AVAILABLE", "1")
			t.Setenv("DOC_WORK_IGNORED", "1")
			t.Setenv("DOC_OUTPUT_IGNORED", tc.outputIgnore)
			t.Setenv("DOC_COMMIT", "abc1234")
			cfg := baseValidationConfig()
			cfg.CommitPDFOutputs = tc.commitPDFs
			result := validationResult{}
			validateGitState(root, cfg, &result)
			got := validationContains(result.Errors, "PDF output directory is not ignored by Git")
			if got != tc.wantError {
				t.Fatalf("error for the unignored output directory = %v, want %v; errors: %#v", got, tc.wantError, result.Errors)
			}
		})
	}
}

func TestCheckMathFormula(t *testing.T) {
	valid := []string{`x^2 + y^2`, `\frac{a}{b}`, `\sqrt{x} \cdot \alpha`, `\text{hello} \operatorname{rank}(A)`, `\left( x \right)`}
	for _, formula := range valid {
		if err := checkMathFormula(formula); err != nil {
			t.Errorf("%q must pass: %v", formula, err)
		}
	}
	invalid := map[string]string{
		`\input{secrets}`: `unsafe TeX math command \input`,
		`\write18{x}`:     `unsafe TeX math command \write`,
		`a^^41`:           "control sequence ^^",
		`a \\ b`:          "unsafe TeX math control sequence",
		`a \{ b`:          "unsafe TeX math control sequence",
	}
	for formula, want := range invalid {
		err := checkMathFormula(formula)
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("%q: want an error containing %q, got %v", formula, want, err)
		}
	}
}

func TestValidateProjectRejectsMathOutsideTheAllowList(t *testing.T) {
	root := writeValidationProject(t, mathBlock(t, `\frac{1}{2}`, `\newcommand{\x}{y}`, `\newcommand{\x}{y}`))
	result := validateProject(root, baseValidationConfig())
	if !validationContains(result.Errors, `docs/guide/page.md: unsafe TeX math command \newcommand`) {
		t.Fatalf("expected a math error naming the file and command; errors: %#v", result.Errors)
	}
	if len(result.Errors) != 1 {
		t.Fatalf("a repeated formula must be reported once and a valid one not at all; errors: %#v", result.Errors)
	}

	root = writeValidationProject(t, mathBlock(t, `\frac{1}{2}`, `\sum_{i} x_i`))
	if result := validateProject(root, baseValidationConfig()); len(result.Errors) != 0 {
		t.Fatalf("allowed commands must pass; errors: %#v", result.Errors)
	}
}

func TestMathAllowListMatchesRenderFilter(t *testing.T) {
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate renderer test source")
	}
	lua, err := os.ReadFile(filepath.Join(filepath.Dir(sourceFile), "..", "..", "filters", "render.lua"))
	if err != nil {
		t.Fatal(err)
	}
	block := regexp.MustCompile(`(?s)local allowed_math_commands = \{(.*?)\n\}`).FindSubmatch(lua)
	if block == nil {
		t.Fatal("allowed_math_commands table not found in filters/render.lua")
	}
	fromLua := map[string]bool{}
	for _, match := range regexp.MustCompile(`([a-z]+) = true`).FindAllSubmatch(block[1], -1) {
		fromLua[string(match[1])] = true
	}
	for command := range fromLua {
		if !allowedMathCommands[command] {
			t.Errorf("render.lua allows \\%s but math.go does not", command)
		}
	}
	for command := range allowedMathCommands {
		if !fromLua[command] {
			t.Errorf("math.go allows \\%s but render.lua does not", command)
		}
	}
}

func TestGuideLanguageFallsBackToPrimaryLanguage(t *testing.T) {
	cfg := baseValidationConfig()
	cfg.PrimaryLanguage = "cs"
	if got := guideLanguage(cfg, guideConfig{}); got != "cs" {
		t.Errorf("guide without language: got %q, want the primary language", got)
	}
	if got := guideLanguage(cfg, guideConfig{Language: "en"}); got != "en" {
		t.Errorf("guide with language: got %q, want its own language", got)
	}
	cfg.PrimaryLanguage = ""
	if got := guideLanguage(cfg, guideConfig{Language: "  "}); got != "en" {
		t.Errorf("no language anywhere: got %q, want en", got)
	}
}

func TestGuideLanguageDrivesThemeAndConfigParsing(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "docs"), 0o755); err != nil {
		t.Fatal(err)
	}
	toml := "schema_version = 1\nprimary_language = \"en\"\n\n" +
		"[[guides]]\nid = \"user-guide\"\nlanguage = \"cs\"\n\n[[guides]]\nid = \"developer-guide\"\n"
	if err := os.WriteFile(filepath.Join(root, "docs", "documentation.toml"), []byte(toml), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg, err := loadConfig(root, "docs/documentation.toml")
	if err != nil {
		t.Fatal(err)
	}
	if got := newThemeDocument(cfg, cfg.Guides[0]).Language; got != "cs" {
		t.Errorf("user guide theme language = %q, want cs", got)
	}
	if got := newThemeDocument(cfg, cfg.Guides[1]).Language; got != "en" {
		t.Errorf("developer guide theme language = %q, want en", got)
	}
}

func TestValidateProjectRejectsInvalidGuideLanguage(t *testing.T) {
	root := writeValidationProject(t, "")
	for _, language := range []string{"English", "c", "cs_CZ"} {
		cfg := baseValidationConfig()
		cfg.Guides[0].Language = language
		result := validateProject(root, cfg)
		if !validationContains(result.Errors, "language must be a language tag") {
			t.Errorf("language %q must be rejected; errors: %#v", language, result.Errors)
		}
	}
	for _, language := range []string{"", "cs", "en-GB", "pt-BR"} {
		cfg := baseValidationConfig()
		cfg.Guides[0].Language = language
		if result := validateProject(root, cfg); len(result.Errors) != 0 {
			t.Errorf("language %q must pass; errors: %#v", language, result.Errors)
		}
	}
}

func redactionFixture(t *testing.T) (root string, cfg config) {
	t.Helper()
	root = t.TempDir()
	cfg = baseValidationConfig()
	raw := filepath.Join(root, "docs", ".documentation-work", "raw-screenshots")
	if err := os.MkdirAll(raw, 0o755); err != nil {
		t.Fatal(err)
	}
	picture := image.NewRGBA(image.Rect(0, 0, 40, 20))
	for y := range 20 {
		for x := range 40 {
			picture.Set(x, y, color.RGBA{R: uint8(x * 6), G: uint8(y * 12), B: 200, A: 255})
		}
	}
	file, err := os.Create(filepath.Join(raw, "page.png"))
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(file, picture); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return root, cfg
}

func writeRedactionPlan(t *testing.T, root, source, output, regions string) string {
	t.Helper()
	plan := `{"source":"` + source + `","output":"` + output + `","regions":` + regions + `}`
	path := filepath.Join(root, "docs", ".documentation-work", "plan.json")
	if err := os.WriteFile(path, []byte(plan), 0o644); err != nil {
		t.Fatal(err)
	}
	return "docs/.documentation-work/plan.json"
}

func decodePNG(t *testing.T, path string) image.Image {
	t.Helper()
	file, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	decoded, err := png.Decode(file)
	if err != nil {
		t.Fatal(err)
	}
	return decoded
}

func TestRedactWritesSolidAndMosaicRegionsAndKeepsTheOriginal(t *testing.T) {
	if _, err := exec.LookPath("convert"); err != nil {
		t.Skip("ImageMagick is not installed; the Docker smoke build covers redact")
	}
	if _, err := exec.LookPath("identify"); err != nil {
		t.Skip("ImageMagick is not installed; the Docker smoke build covers redact")
	}
	root, cfg := redactionFixture(t)
	source := "docs/.documentation-work/raw-screenshots/page.png"
	output := "docs/.documentation-work/redacted-screenshots/page.png"
	plan := writeRedactionPlan(t, root, source, output,
		`[{"x":2,"y":2,"width":6,"height":4,"style":"solid","color":"#FF0000"},`+
			`{"x":20,"y":4,"width":16,"height":12,"style":"mosaic","block_size":8}]`)

	if err := redact(root, cfg, plan); err != nil {
		t.Fatal(err)
	}

	original := decodePNG(t, filepath.Join(root, source))
	redacted := decodePNG(t, filepath.Join(root, output))
	if redacted.Bounds() != original.Bounds() {
		t.Fatalf("redaction changed the image size: %v -> %v", original.Bounds(), redacted.Bounds())
	}
	equal := func(x1, y1, x2, y2 int) bool {
		r1, g1, b1, a1 := redacted.At(x1, y1).RGBA()
		r2, g2, b2, a2 := redacted.At(x2, y2).RGBA()
		return r1 == r2 && g1 == g2 && b1 == b2 && a1 == a2
	}
	if r, g, b, _ := redacted.At(4, 3).RGBA(); r>>8 != 255 || g>>8 != 0 || b>>8 != 0 {
		t.Errorf("solid region is not red: %d %d %d", r>>8, g>>8, b>>8)
	}
	// The 16x12 region with block_size 8 becomes a 2x2 grid of 8x6-pixel blocks.
	if !equal(20, 4, 27, 9) {
		t.Error("pixels of one mosaic block differ")
	}
	if equal(35, 15, 20, 4) {
		t.Error("two mosaic blocks must not be identical in this fixture")
	}
	for _, point := range [][2]int{{0, 0}, {39, 19}, {12, 10}} {
		ro, goo, bo, ao := original.At(point[0], point[1]).RGBA()
		rr, gr, br, ar := redacted.At(point[0], point[1]).RGBA()
		if ro != rr || goo != gr || bo != br || ao != ar {
			t.Errorf("pixel %v outside every region changed", point)
		}
	}

	if err := redact(root, cfg, plan); err == nil || !strings.Contains(err.Error(), "refusing to overwrite") {
		t.Errorf("a second run must refuse to overwrite the redacted copy; got %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, source)); err != nil {
		t.Errorf("redaction must never delete the original: %v", err)
	}
}

func TestRedactRefusesSourcesAndOutputsOutsideTheQuarantineDirectories(t *testing.T) {
	root, cfg := redactionFixture(t)
	plan := writeRedactionPlan(t, root,
		"docs/user-guide/images/page.png", "docs/.documentation-work/redacted-screenshots/page.png", `[]`)
	if err := redact(root, cfg, plan); err == nil || !strings.Contains(err.Error(), "raw-screenshots") {
		t.Errorf("a source outside raw-screenshots must be refused; got %v", err)
	}
	plan = writeRedactionPlan(t, root,
		"docs/.documentation-work/raw-screenshots/page.png", "docs/user-guide/images/page.png", `[]`)
	if err := redact(root, cfg, plan); err == nil || !strings.Contains(err.Error(), "redacted-screenshots") {
		t.Errorf("an output outside redacted-screenshots must be refused; got %v", err)
	}
}
