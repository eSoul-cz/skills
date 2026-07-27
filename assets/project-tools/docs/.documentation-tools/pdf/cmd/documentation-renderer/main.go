package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/BurntSushi/toml"
)

const (
	defaultProjectRoot = "/workspace"
	defaultConfigPath  = "docs/documentation.toml"
	defaultTemplate    = "/opt/eisvogel.latex"
	defaultHeader      = "/opt/documentation-tools/header.tex"
	defaultSourceLua   = "/opt/documentation-tools/filters/source.lua"
	defaultRenderLua   = "/opt/documentation-tools/filters/render.lua"
	commandTimeout     = 10 * time.Minute
)

var (
	guideIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
	pagesPattern   = regexp.MustCompile(`(?m)^Pages:\s+([0-9]+)$`)
	hexPattern     = regexp.MustCompile(`[^0-9A-Fa-f]`)
	runCommand     = execute
)

type config struct {
	SchemaVersion        int           `toml:"schema_version"`
	DocumentationVersion string        `toml:"documentation_version"`
	PrimaryLanguage      string        `toml:"primary_language"`
	OutputDir            string        `toml:"output_dir"`
	WorkDir              string        `toml:"work_dir"`
	CommitPDFOutputs     bool          `toml:"commit_pdf_outputs"`
	Project              projectConfig `toml:"project"`
	PDF                  pdfConfig     `toml:"pdf"`
	Privacy              privacyConfig `toml:"privacy"`
	Guides               []guideConfig `toml:"guides"`
}

type projectConfig struct {
	Name      string `toml:"name"`
	Logo      string `toml:"logo"`
	Copyright string `toml:"copyright"`
	Contact   string `toml:"contact"`
}

type pdfConfig struct {
	Mode          string `toml:"mode"`
	Image         string `toml:"image"`
	Platform      string `toml:"platform"`
	Dockerfile    string `toml:"dockerfile"`
	Template      string `toml:"template"`
	HeaderInclude string `toml:"header_include"`
	PaperSize     string `toml:"paper_size"`
	MainFont      string `toml:"main_font"`
	MonoFont      string `toml:"mono_font"`
	AccentColor   string `toml:"accent_color"`
	HeaderLeft    string `toml:"header_left"`
	FooterLeft    string `toml:"footer_left"`
}

type privacyConfig struct {
	AllowedEmailDomains []string `toml:"allowed_email_domains"`
	AllowedHosts        []string `toml:"allowed_hosts"`
}

type guideConfig struct {
	ID                 string   `toml:"id"`
	Title              string   `toml:"title"`
	Output             string   `toml:"output"`
	CrossDocumentLinks string   `toml:"cross_document_links"`
	InvalidLinks       string   `toml:"invalid_links"`
	LinkNoticeStyle    string   `toml:"link_notice_style"`
	LinkNoticePaths    string   `toml:"link_notice_paths"`
	Sources            []string `toml:"sources"`
	LandscapeSources   []string `toml:"landscape_sources"`
}

type pandocDocument struct {
	APIVersion []int             `json:"pandoc-api-version"`
	Meta       map[string]any    `json:"meta"`
	Blocks     []json.RawMessage `json:"blocks"`
}

type commandResult struct {
	Stdout []byte
}

type redactionPlan struct {
	Source  string            `json:"source"`
	Output  string            `json:"output"`
	Crop    *redactionRegion  `json:"crop"`
	Regions []redactionRegion `json:"regions"`
}

type redactionRegion struct {
	X         int    `json:"x"`
	Y         int    `json:"y"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Style     string `json:"style"`
	Color     string `json:"color"`
	BlockSize int    `json:"block_size"`
}

func main() {
	projectRoot := flag.String("project-root", defaultProjectRoot, "absolute project root")
	configPath := flag.String("config", defaultConfigPath, "project-relative documentation configuration")
	renderOnly := flag.Bool("render-only", false, "inspect existing PDFs without rebuilding")
	validateOnly := flag.Bool("validate-only", false, "validate configuration and Markdown without rendering")
	redactPlan := flag.String("redact", "", "project-relative redaction plan")
	flag.Parse()

	if *validateOnly && (*renderOnly || *redactPlan != "") {
		fmt.Fprintln(os.Stderr, "ERROR: --validate-only cannot be combined with rendering or redaction")
		os.Exit(2)
	}
	if err := run(*projectRoot, *configPath, *renderOnly, *validateOnly, *redactPlan); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}
}

func run(projectRoot, configPath string, renderOnly, validateOnly bool, redactPlan string) error {
	root, err := filepath.Abs(projectRoot)
	if err != nil {
		return fmt.Errorf("resolve project root: %w", err)
	}
	cfg, err := loadConfig(root, configPath)
	if err != nil {
		return err
	}
	if redactPlan != "" {
		return redact(root, cfg, redactPlan)
	}
	if !renderOnly {
		validation := validateProject(root, cfg)
		if !validation.report() {
			return fmt.Errorf(
				"validation failed with %d error(s) and %d warning(s)",
				len(validation.Errors),
				len(validation.Warnings),
			)
		}
		if validateOnly {
			return nil
		}
	}
	outputDir, err := securePath(root, valueOr(cfg.OutputDir, "docs/pdf"))
	if err != nil {
		return err
	}
	for _, guide := range cfg.Guides {
		var pdfPath string
		if renderOnly {
			if err := validateGuideOutput(guide.Output); err != nil {
				return fmt.Errorf("guide %s: %w", valueOr(guide.ID, "guide"), err)
			}
			pdfPath = filepath.Join(outputDir, guide.Output)
		} else {
			pdfPath, err = buildGuide(root, cfg, guide)
			if err != nil {
				return err
			}
		}
		if err := inspectPDF(root, cfg, guide, pdfPath); err != nil {
			return err
		}
		relative, _ := filepath.Rel(root, pdfPath)
		fmt.Printf("Verified %s\n", filepath.ToSlash(relative))
	}
	return nil
}

func loadConfig(root, relative string) (config, error) {
	path, err := securePath(root, relative)
	if err != nil {
		return config{}, err
	}
	var cfg config
	if _, err := toml.DecodeFile(path, &cfg); err != nil {
		return config{}, fmt.Errorf("cannot load %s: %w", relative, err)
	}
	return cfg, nil
}

func valueOr(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func validateGuideOutput(output string) error {
	if !strings.HasSuffix(strings.ToLower(output), ".pdf") || strings.ContainsAny(output, `/\`) {
		return errors.New("output must be a PDF filename, not a path")
	}
	return nil
}

func securePath(root, value string) (string, error) {
	if strings.TrimSpace(value) == "" {
		return "", errors.New("path must not be empty")
	}
	var path string
	if filepath.IsAbs(value) {
		path = filepath.Clean(value)
	} else {
		path = filepath.Clean(filepath.Join(root, value))
	}
	relative, err := filepath.Rel(root, path)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes project root: %s", value)
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", fmt.Errorf("resolve project root: %w", err)
	}
	ancestor := path
	for {
		if _, err := os.Lstat(ancestor); err == nil {
			break
		}
		parent := filepath.Dir(ancestor)
		if parent == ancestor {
			return "", fmt.Errorf("cannot resolve project path: %s", value)
		}
		ancestor = parent
	}
	resolvedAncestor, err := filepath.EvalSymlinks(ancestor)
	if err != nil {
		return "", fmt.Errorf("resolve project path %s: %w", value, err)
	}
	if !inside(resolvedRoot, resolvedAncestor) {
		return "", fmt.Errorf("path escapes project root through a symbolic link: %s", value)
	}
	return path, nil
}

func guideDirectory(workRoot, category, guideID string) (string, error) {
	if !guideIDPattern.MatchString(guideID) {
		return "", errors.New("guide id must contain only ASCII letters, digits, underscores, and hyphens")
	}
	categoryRoot := filepath.Join(workRoot, category)
	directory := filepath.Join(categoryRoot, guideID)
	relative, err := filepath.Rel(categoryRoot, directory)
	if err != nil || relative == "." || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("guide work directory escapes %s: %s", categoryRoot, guideID)
	}
	if resolved, err := filepath.EvalSymlinks(directory); err == nil {
		resolvedRoot, rootErr := filepath.EvalSymlinks(workRoot)
		if rootErr == nil {
			rel, relErr := filepath.Rel(resolvedRoot, resolved)
			if relErr != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
				return "", fmt.Errorf("guide work directory escapes %s: %s", workRoot, guideID)
			}
		}
	}
	return directory, nil
}

func execute(args []string, cwd string, env []string, input []byte) (commandResult, error) {
	if len(args) == 0 {
		return commandResult{}, errors.New("empty command")
	}
	ctx, cancel := context.WithTimeout(context.Background(), commandTimeout)
	defer cancel()
	command := exec.CommandContext(ctx, args[0], args[1:]...)
	command.Dir = cwd
	command.Env = append(os.Environ(), env...)
	command.Stdin = bytes.NewReader(input)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr
	if err := command.Run(); err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return commandResult{}, fmt.Errorf("%s timed out after %s", args[0], commandTimeout)
		}
		message := strings.TrimSpace(stderr.String())
		if message != "" {
			return commandResult{}, fmt.Errorf("%s: %w: %s", args[0], err, message)
		}
		return commandResult{}, fmt.Errorf("%s: %w", args[0], err)
	}
	return commandResult{Stdout: stdout.Bytes()}, nil
}

func buildGuide(root string, cfg config, guide guideConfig) (string, error) {
	workRoot, err := securePath(root, valueOr(cfg.WorkDir, "docs/.documentation-work"))
	if err != nil {
		return "", err
	}
	workDir, err := guideDirectory(workRoot, "build", valueOr(guide.ID, "guide"))
	if err != nil {
		return "", err
	}
	if err := os.RemoveAll(workDir); err != nil {
		return "", fmt.Errorf("clear guide work directory: %w", err)
	}
	stagingDir := filepath.Join(workDir, "staging")
	if err := os.MkdirAll(stagingDir, 0o755); err != nil {
		return "", fmt.Errorf("create staging directory: %w", err)
	}
	if len(guide.Sources) == 0 {
		return "", fmt.Errorf("guide %s has no sources", guide.ID)
	}

	sourcePaths := make([]string, 0, len(guide.Sources))
	for _, value := range guide.Sources {
		path, err := securePath(root, value)
		if err != nil {
			return "", err
		}
		sourcePaths = append(sourcePaths, path)
	}

	reader := "markdown+tex_math_dollars+footnotes-raw_tex-raw_attribute"
	headings := make(map[string]string, len(sourcePaths))
	documents := make(map[string]pandocDocument, len(sourcePaths))
	for _, source := range sourcePaths {
		result, err := runCommand(
			[]string{"pandoc", source, "--from=" + reader, "--to=json"},
			stagingDir,
			nil,
			nil,
		)
		if err != nil {
			return "", fmt.Errorf("parse %s: %w", source, err)
		}
		var document pandocDocument
		if err := json.Unmarshal(result.Stdout, &document); err != nil {
			return "", fmt.Errorf("decode Pandoc AST for %s: %w", source, err)
		}
		documents[filepath.Clean(source)] = document
		heading, err := firstH1Identifier(document)
		if err != nil {
			return "", fmt.Errorf("%s: %w", source, err)
		}
		headings[filepath.Clean(source)] = heading
	}

	headingMapPath := filepath.Join(stagingDir, "heading-map.lua")
	if err := writeHeadingMap(headingMapPath, headings); err != nil {
		return "", err
	}
	linkNoticeMapPath := filepath.Join(stagingDir, "link-notice-map.lua")
	linkNotices := collectLinkNotices(root, sourcePaths, documents, guide)
	if err := writeLinkNoticeMap(linkNoticeMapPath, linkNotices); err != nil {
		return "", err
	}
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	sourceLua := runtimePath("source.lua", defaultSourceLua)
	renderLua := runtimePath("render.lua", defaultRenderLua)
	landscape := make(map[string]bool, len(guide.LandscapeSources))
	for _, value := range guide.LandscapeSources {
		path, err := securePath(root, value)
		if err != nil {
			return "", err
		}
		landscape[filepath.Clean(path)] = true
	}

	var combined pandocDocument
	for index, source := range sourcePaths {
		env := []string{
			"DOCUMENTATION_PROJECT_ROOT=" + root,
			"DOCUMENTATION_SOURCE_DIR=" + filepath.Dir(source),
			"DOCUMENTATION_STAGING_DIR=" + stagingDir,
			"DOCUMENTATION_HEADING_MAP=" + headingMapPath,
			"DOCUMENTATION_INTERNAL_TOKEN=" + token,
			"DOCUMENTATION_MERMAID_CONFIG=" + runtimePath("mermaid-config.json", "/opt/documentation-tools/mermaid-config.json"),
			"DOCUMENTATION_CROSS_DOCUMENT_LINKS=" + valueOr(guide.CrossDocumentLinks, "error"),
			"DOCUMENTATION_SOURCE_PATH=" + filepath.Clean(source),
			"DOCUMENTATION_LINK_NOTICE_MAP=" + linkNoticeMapPath,
			"DOCUMENTATION_LINK_NOTICE_STYLE=" + valueOr(guide.LinkNoticeStyle, "plain"),
		}
		result, err := runCommand(
			[]string{
				"pandoc",
				source,
				"--from=" + reader,
				"--to=json",
				"--lua-filter=" + sourceLua,
			},
			stagingDir,
			env,
			nil,
		)
		if err != nil {
			return "", fmt.Errorf("prepare %s: %w", source, err)
		}
		var document pandocDocument
		if err := json.Unmarshal(result.Stdout, &document); err != nil {
			return "", fmt.Errorf("decode filtered Pandoc AST for %s: %w", source, err)
		}
		if landscape[filepath.Clean(source)] {
			wrapped, err := divBlock("documentation-landscape", token, document.Blocks)
			if err != nil {
				return "", err
			}
			document.Blocks = []json.RawMessage{wrapped}
		}
		if index == 0 {
			combined.APIVersion = document.APIVersion
			combined.Meta = map[string]any{}
		} else {
			pageBreak, err := divBlock("documentation-page-break", token, nil)
			if err != nil {
				return "", err
			}
			combined.Blocks = append(combined.Blocks, pageBreak)
		}
		combined.Blocks = append(combined.Blocks, document.Blocks...)
	}

	combinedPath := filepath.Join(stagingDir, "combined.json")
	combinedJSON, err := json.Marshal(combined)
	if err != nil {
		return "", fmt.Errorf("encode combined Pandoc AST: %w", err)
	}
	if err := os.WriteFile(combinedPath, append(combinedJSON, '\n'), 0o644); err != nil {
		return "", fmt.Errorf("write combined Pandoc AST: %w", err)
	}

	metadataPath := filepath.Join(stagingDir, "metadata.yaml")
	if err := writeMetadata(root, stagingDir, metadataPath, cfg, guide); err != nil {
		return "", err
	}
	outputDir, err := securePath(root, valueOr(cfg.OutputDir, "docs/pdf"))
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", fmt.Errorf("create PDF output directory: %w", err)
	}
	output := filepath.Join(outputDir, valueOr(guide.Output, guide.ID+".pdf"))
	template := defaultTemplate
	if cfg.PDF.Template != "" {
		template, err = securePath(root, cfg.PDF.Template)
		if err != nil {
			return "", err
		}
	}
	header := defaultHeader
	if cfg.PDF.HeaderInclude != "" {
		header, err = securePath(root, cfg.PDF.HeaderInclude)
		if err != nil {
			return "", err
		}
	}
	_, err = runCommand(
		[]string{
			"pandoc",
			filepath.Base(combinedPath),
			"--from=json",
			"--lua-filter=" + renderLua,
			"--metadata-file=" + filepath.Base(metadataPath),
			"--template=" + template,
			"--pdf-engine=xelatex",
			"--toc",
			"--number-sections",
			"--listings",
			"--include-in-header=" + header,
			"--resource-path=" + stagingDir,
			"--output",
			output,
		},
		stagingDir,
		[]string{"DOCUMENTATION_INTERNAL_TOKEN=" + token},
		nil,
	)
	if err != nil {
		return "", fmt.Errorf("render guide %s: %w", guide.ID, err)
	}
	return output, nil
}

func firstH1Identifier(document pandocDocument) (string, error) {
	for _, raw := range document.Blocks {
		var block struct {
			Type    string            `json:"t"`
			Content []json.RawMessage `json:"c"`
		}
		if err := json.Unmarshal(raw, &block); err != nil || block.Type != "Header" || len(block.Content) < 2 {
			continue
		}
		var level int
		if err := json.Unmarshal(block.Content[0], &level); err != nil || level != 1 {
			continue
		}
		var attr []json.RawMessage
		if err := json.Unmarshal(block.Content[1], &attr); err != nil || len(attr) == 0 {
			continue
		}
		var identifier string
		if err := json.Unmarshal(attr[0], &identifier); err == nil && identifier != "" {
			return identifier, nil
		}
	}
	return "", errors.New("each PDF source page needs one H1")
}

func writeHeadingMap(path string, headings map[string]string) error {
	var buffer strings.Builder
	buffer.WriteString("return {\n")
	sources := make([]string, 0, len(headings))
	for source := range headings {
		sources = append(sources, source)
	}
	sort.Strings(sources)
	for _, source := range sources {
		heading := headings[source]
		buffer.WriteString("  [")
		buffer.WriteString(strconv.Quote(filepath.Clean(source)))
		buffer.WriteString("] = ")
		buffer.WriteString(strconv.Quote(heading))
		buffer.WriteString(",\n")
	}
	buffer.WriteString("}\n")
	if err := os.WriteFile(path, []byte(buffer.String()), 0o600); err != nil {
		return fmt.Errorf("write heading map: %w", err)
	}
	return nil
}

func writeLinkNoticeMap(path string, notices map[string]map[string]string) error {
	var buffer strings.Builder
	buffer.WriteString("return {\n")
	sources := make([]string, 0, len(notices))
	for source := range notices {
		sources = append(sources, source)
	}
	sort.Strings(sources)
	for _, source := range sources {
		buffer.WriteString("  [")
		buffer.WriteString(strconv.Quote(filepath.Clean(source)))
		buffer.WriteString("] = {\n")
		targets := make([]string, 0, len(notices[source]))
		for target := range notices[source] {
			targets = append(targets, target)
		}
		sort.Strings(targets)
		for _, target := range targets {
			buffer.WriteString("    [")
			buffer.WriteString(strconv.Quote(target))
			buffer.WriteString("] = ")
			buffer.WriteString(strconv.Quote(notices[source][target]))
			buffer.WriteString(",\n")
		}
		buffer.WriteString("  },\n")
	}
	buffer.WriteString("}\n")
	if err := os.WriteFile(path, []byte(buffer.String()), 0o600); err != nil {
		return fmt.Errorf("write link notice map: %w", err)
	}
	return nil
}

func randomToken() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("create renderer token: %w", err)
	}
	return hex.EncodeToString(value), nil
}

func divBlock(className, token string, blocks []json.RawMessage) (json.RawMessage, error) {
	if blocks == nil {
		blocks = []json.RawMessage{}
	}
	value := map[string]any{
		"t": "Div",
		"c": []any{
			[]any{"", []string{className}, [][]string{{"data-documentation-token", token}}},
			blocks,
		},
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("encode internal layout block: %w", err)
	}
	return encoded, nil
}

func runtimePath(name, fallback string) string {
	if root := strings.TrimSpace(os.Getenv("DOCUMENTATION_TOOLS_ROOT")); root != "" {
		return filepath.Join(root, name)
	}
	return fallback
}

func writeMetadata(root, stagingDir, path string, cfg config, guide guideConfig) error {
	generated := strings.TrimSpace(os.Getenv("DOC_GENERATED_AT"))
	if generated == "" {
		generated = time.Now().UTC().Format("2006-01-02 15:04 UTC")
	}
	commit := valueOr(os.Getenv("DOC_COMMIT"), "unknown")
	metadata := []string{"Commit " + commit}
	if tag := strings.TrimSpace(os.Getenv("DOC_GIT_TAG")); tag != "" {
		metadata = append(metadata, "Application version "+tag)
	}
	if cfg.DocumentationVersion != "" {
		metadata = append(metadata, "Documentation version "+cfg.DocumentationVersion)
	}
	metadata = append(metadata, "Generated "+generated)

	accent := hexPattern.ReplaceAllString(valueOr(cfg.PDF.AccentColor, "1B6B93"), "")
	if len(accent) != 6 {
		accent = "1B6B93"
	}
	title := valueOr(guide.Title, "Documentation")
	mainFont := valueOr(cfg.PDF.MainFont, "Noto Sans")
	projectName := cfg.Project.Name
	headerLeft := valueOr(cfg.PDF.HeaderLeft, projectName)
	footerLeft := valueOr(cfg.PDF.FooterLeft, cfg.Project.Copyright)
	values := []string{
		"title: " + yamlString(title),
		"subtitle: " + yamlString(strings.Join(metadata, " | ")),
		"lang: " + yamlString(valueOr(cfg.PrimaryLanguage, "en")),
		"titlepage: true",
		"toc: true",
		"toc-own-page: true",
		"numbersections: true",
		"papersize: " + yamlString(valueOr(cfg.PDF.PaperSize, "a4")),
		"mainfont: " + yamlString(mainFont),
		"sansfont: " + yamlString(mainFont),
		"monofont: " + yamlString(valueOr(cfg.PDF.MonoFont, "Noto Sans Mono")),
		"colorlinks: true",
		"linkcolor: blue",
		"urlcolor: blue",
		"titlepage-rule-color: " + yamlString(accent),
		"header-left: " + yamlString(headerLeft),
		"header-right: " + yamlString(title),
		"footer-left: " + yamlString(footerLeft),
		"geometry: " + yamlString("margin=24mm"),
	}
	if cfg.Project.Logo != "" {
		logo, err := securePath(root, cfg.Project.Logo)
		if err != nil {
			return err
		}
		if strings.EqualFold(filepath.Ext(logo), ".svg") {
			output := filepath.Join(stagingDir, "cover-logo.png")
			if _, err := runCommand(
				[]string{"rsvg-convert", "--width", "900", "--output", output, logo},
				stagingDir,
				nil,
				nil,
			); err != nil {
				return fmt.Errorf("convert cover logo: %w", err)
			}
			logo = output
		}
		values = append(values, "titlepage-logo: "+yamlString(logo))
	}
	if cfg.Project.Contact != "" {
		values = append(values, "footer-center: "+yamlString(cfg.Project.Contact))
	}
	if err := os.WriteFile(path, []byte(strings.Join(values, "\n")+"\n"), 0o644); err != nil {
		return fmt.Errorf("write Pandoc metadata: %w", err)
	}
	return nil
}

func yamlString(value string) string {
	return strconv.Quote(value)
}

func inspectPDF(root string, cfg config, guide guideConfig, pdfPath string) error {
	info, err := os.Stat(pdfPath)
	if err != nil || info.IsDir() {
		return fmt.Errorf("missing PDF for inspection: %s", pdfPath)
	}
	workRoot, err := securePath(root, valueOr(cfg.WorkDir, "docs/.documentation-work"))
	if err != nil {
		return err
	}
	renderedDir, err := guideDirectory(workRoot, "rendered", valueOr(guide.ID, strings.TrimSuffix(filepath.Base(pdfPath), filepath.Ext(pdfPath))))
	if err != nil {
		return err
	}
	reviewDir, err := guideDirectory(workRoot, "review", valueOr(guide.ID, strings.TrimSuffix(filepath.Base(pdfPath), filepath.Ext(pdfPath))))
	if err != nil {
		return err
	}
	for _, directory := range []string{renderedDir, reviewDir} {
		if err := os.RemoveAll(directory); err != nil {
			return fmt.Errorf("clear review directory: %w", err)
		}
		if err := os.MkdirAll(directory, 0o755); err != nil {
			return fmt.Errorf("create review directory: %w", err)
		}
	}
	result, err := runCommand([]string{"pdfinfo", pdfPath}, root, nil, nil)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(reviewDir, "pdfinfo.txt"), result.Stdout, 0o644); err != nil {
		return fmt.Errorf("write PDF metadata review: %w", err)
	}
	match := pagesPattern.FindSubmatch(result.Stdout)
	if len(match) != 2 {
		return fmt.Errorf("could not verify a non-empty page count for %s", pdfPath)
	}
	pages, _ := strconv.Atoi(string(match[1]))
	if pages < 1 {
		return fmt.Errorf("could not verify a non-empty page count for %s", pdfPath)
	}
	if _, err := runCommand(
		[]string{"pdftotext", pdfPath, filepath.Join(reviewDir, "extracted.txt")},
		root,
		nil,
		nil,
	); err != nil {
		return err
	}
	prefix := filepath.Join(renderedDir, "page")
	if _, err := runCommand([]string{"pdftoppm", "-png", "-r", "144", pdfPath, prefix}, root, nil, nil); err != nil {
		return err
	}
	pagesOnDisk, _ := filepath.Glob(prefix + "-*.png")
	if len(pagesOnDisk) == 0 {
		return fmt.Errorf("no rendered review pages were produced for %s", pdfPath)
	}
	return nil
}

func redact(root string, cfg config, planValue string) error {
	planPath, err := securePath(root, planValue)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(planPath)
	if err != nil {
		return fmt.Errorf("cannot load redaction plan: %w", err)
	}
	var plan redactionPlan
	if err := json.Unmarshal(data, &plan); err != nil {
		return fmt.Errorf("cannot load redaction plan: %w", err)
	}
	workRoot, err := securePath(root, valueOr(cfg.WorkDir, "docs/.documentation-work"))
	if err != nil {
		return err
	}
	rawRoot := filepath.Join(workRoot, "raw-screenshots")
	redactedRoot := filepath.Join(workRoot, "redacted-screenshots")
	source, err := securePath(root, plan.Source)
	if err != nil {
		return err
	}
	output, err := securePath(root, plan.Output)
	if err != nil {
		return err
	}
	if !inside(rawRoot, source) {
		return errors.New("redaction source must exist under the raw-screenshots work directory")
	}
	if stat, err := os.Stat(source); err != nil || stat.IsDir() {
		return errors.New("redaction source must exist under the raw-screenshots work directory")
	}
	if !inside(redactedRoot, output) {
		return errors.New("redaction output must be under the redacted-screenshots work directory")
	}
	if _, err := os.Stat(output); err == nil {
		return fmt.Errorf("refusing to overwrite existing redacted image: %s", output)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(output), 0o755); err != nil {
		return err
	}
	tempDir, err := os.MkdirTemp("", "documentation-redaction-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)

	current := filepath.Join(tempDir, strings.TrimSuffix(filepath.Base(output), filepath.Ext(output))+"-0.png")
	if plan.Crop != nil {
		width, height, err := imageDimensions(source)
		if err != nil {
			return err
		}
		if err := validateRegion(*plan.Crop, width, height); err != nil {
			return fmt.Errorf("top-level crop: %w", err)
		}
		geometry := fmt.Sprintf("%dx%d+%d+%d", plan.Crop.Width, plan.Crop.Height, plan.Crop.X, plan.Crop.Y)
		if _, err := runCommand([]string{"convert", source, "-crop", geometry, "+repage", current}, tempDir, nil, nil); err != nil {
			return err
		}
	} else if err := copyFile(source, current); err != nil {
		return err
	}

	for index, region := range plan.Regions {
		width, height, err := imageDimensions(current)
		if err != nil {
			return err
		}
		if err := validateRegion(region, width, height); err != nil {
			return fmt.Errorf("redaction region %d: %w", index+1, err)
		}
		nextPath := filepath.Join(tempDir, fmt.Sprintf("%s-%d.png", strings.TrimSuffix(filepath.Base(output), filepath.Ext(output)), index+1))
		style := valueOr(region.Style, "solid")
		switch style {
		case "solid":
			color := valueOr(region.Color, "#111111")
			rectangle := fmt.Sprintf(
				"rectangle %d,%d %d,%d",
				region.X,
				region.Y,
				region.X+region.Width-1,
				region.Y+region.Height-1,
			)
			if _, err := runCommand(
				[]string{"convert", current, "-fill", color, "-draw", rectangle, nextPath},
				tempDir,
				nil,
				nil,
			); err != nil {
				return err
			}
		case "mosaic":
			blockSize := region.BlockSize
			if blockSize == 0 {
				blockSize = 14
			}
			if blockSize < 2 {
				return errors.New("mosaic block_size must be at least 2 pixels")
			}
			smallWidth := int(math.Max(1, math.Ceil(float64(region.Width)/float64(blockSize))))
			smallHeight := int(math.Max(1, math.Ceil(float64(region.Height)/float64(blockSize))))
			crop := fmt.Sprintf("%dx%d+%d+%d", region.Width, region.Height, region.X, region.Y)
			if _, err := runCommand(
				[]string{
					"convert", current, "(", "+clone", "-crop", crop, "+repage",
					"-resize", fmt.Sprintf("%dx%d!", smallWidth, smallHeight),
					"-filter", "point",
					"-resize", fmt.Sprintf("%dx%d!", region.Width, region.Height),
					")", "-geometry", fmt.Sprintf("+%d+%d", region.X, region.Y),
					"-composite", nextPath,
				},
				tempDir,
				nil,
				nil,
			); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported redaction style: %s", style)
		}
		current = nextPath
	}

	finalImage := filepath.Join(tempDir, strings.TrimSuffix(filepath.Base(output), filepath.Ext(output))+"-final.png")
	if _, err := runCommand([]string{"convert", current, "-strip", finalImage}, tempDir, nil, nil); err != nil {
		return err
	}
	if err := os.Rename(finalImage, output); err != nil {
		if err := copyFile(finalImage, output); err != nil {
			return err
		}
	}
	relative, _ := filepath.Rel(root, output)
	fmt.Printf("Created redacted copy: %s\n", filepath.ToSlash(relative))
	fmt.Println("The original remains in quarantine. Human verification is required before promotion.")
	return nil
}

func inside(root, path string) bool {
	relative, err := filepath.Rel(filepath.Clean(root), filepath.Clean(path))
	return err == nil && relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

func imageDimensions(path string) (int, int, error) {
	result, err := runCommand([]string{"identify", "-format", "%w %h", path}, filepath.Dir(path), nil, nil)
	if err != nil {
		return 0, 0, err
	}
	parts := strings.Fields(string(result.Stdout))
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("cannot read image dimensions for %s", path)
	}
	width, widthErr := strconv.Atoi(parts[0])
	height, heightErr := strconv.Atoi(parts[1])
	if widthErr != nil || heightErr != nil {
		return 0, 0, fmt.Errorf("cannot read image dimensions for %s", path)
	}
	return width, height, nil
}

func validateRegion(region redactionRegion, width, height int) error {
	if region.X < 0 || region.Y < 0 || region.Width < 1 || region.Height < 1 {
		return errors.New("redaction coordinates must be positive")
	}
	if region.X > width || region.Y > height || region.Width > width || region.Height > height {
		return fmt.Errorf("redaction region exceeds image dimensions %dx%d", width, height)
	}
	if region.X > width-region.Width || region.Y > height-region.Height {
		return fmt.Errorf("redaction region exceeds image dimensions %dx%d", width, height)
	}
	return nil
}

func copyFile(source, target string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	success := false
	defer func() {
		output.Close()
		if !success {
			os.Remove(target)
		}
	}()
	if _, err := io.Copy(output, input); err != nil {
		return err
	}
	if err := output.Close(); err != nil {
		return err
	}
	success = true
	return nil
}
