package main

import (
	"encoding/json"
	"fmt"
	"html"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const remoteRendererImageEnv = "DOCUMENTATION_REMOTE_RENDERER_IMAGE"

var (
	validationGuideIDPattern = regexp.MustCompile(`^[a-z0-9-]+$`)
	headingPattern           = regexp.MustCompile(`(?m)^(#{1,6})[ \t]+\S.*$`)
	mermaidFencePattern      = regexp.MustCompile(`(?s)(?:^|\n)[ \t]*` + "```mermaid[ \t]*\r?\n.*?\r?\n[ \t]*```")
	mermaidStartPattern      = regexp.MustCompile(`(?m)^[ \t]*` + "```mermaid[ \t]*$")
	diagramAltPattern        = regexp.MustCompile(`(?s)<!--\s*diagram-alt:\s*\S.*?-->\s*$`)
	rawLatexPattern          = regexp.MustCompile(`(?m)^\\(?:begin|end)\{`)
	privateKeyPattern        = regexp.MustCompile(`-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----`)
	credentialPattern        = regexp.MustCompile(`(?i)(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*['"]?([A-Za-z0-9_./+\-=]{12,})`)
	emailPattern             = regexp.MustCompile(`(?i)\b[A-Z0-9._%+\-]+@([A-Z0-9.\-]+\.[A-Z]{2,})\b`)
	htmlImagePattern         = regexp.MustCompile(`(?is)<img\b[^>]*>`)
	htmlAttributePattern     = regexp.MustCompile(`(?is)\b(src|srcset|alt)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`)
	dimensionPattern         = regexp.MustCompile(`^\s*(\d+)\s*[x×]\s*(\d+)\s*$`)
	rasterExtensions         = map[string]bool{".jpeg": true, ".jpg": true, ".png": true, ".tif": true, ".tiff": true, ".webp": true}
)

type validationResult struct {
	Errors   []string
	Warnings []string
}

func (result *validationResult) error(message string) {
	result.Errors = append(result.Errors, message)
}

func (result *validationResult) warn(message string) {
	result.Warnings = append(result.Warnings, message)
}

func (result validationResult) report() bool {
	for _, message := range result.Warnings {
		fmt.Printf("WARNING: %s\n", message)
	}
	for _, message := range result.Errors {
		fmt.Fprintf(os.Stderr, "ERROR: %s\n", message)
	}
	if len(result.Errors) > 0 {
		return false
	}
	fmt.Printf("Validation passed with %d warning(s).\n", len(result.Warnings))
	return true
}

type documentReference struct {
	Kind   string
	Label  string
	Target string
}

type publishedRaster struct {
	Source string
	Path   string
}

func validateProject(root string, cfg config) validationResult {
	result := validationResult{}
	if cfg.SchemaVersion != 1 {
		result.error("schema_version must be 1.")
	}
	if strings.TrimSpace(cfg.OutputDir) == "" {
		result.error("Configuration key 'output_dir' must be a non-empty string.")
	}
	if strings.TrimSpace(cfg.WorkDir) == "" {
		result.error("Configuration key 'work_dir' must be a non-empty string.")
	}
	if strings.TrimSpace(cfg.PrimaryLanguage) == "" {
		result.error("Configuration key 'primary_language' must be a non-empty string.")
	}

	outputDir, outputErr := securePath(root, valueOr(cfg.OutputDir, "docs/pdf"))
	workDir, workErr := securePath(root, valueOr(cfg.WorkDir, "docs/.documentation-work"))
	if outputErr != nil {
		result.error(outputErr.Error())
	}
	if workErr != nil {
		result.error(workErr.Error())
	}
	if outputErr == nil {
		validateDedicatedDirectory(root, outputDir, "output_dir", &result)
	}
	if workErr == nil {
		validateDedicatedDirectory(root, workDir, "work_dir", &result)
	}
	validateGitState(root, cfg, &result)
	validatePDFConfig(root, cfg.PDF, &result)

	if len(cfg.Guides) == 0 {
		result.error("At least one [[guides]] table is required.")
		return result
	}

	seenIDs := map[string]bool{}
	seenOutputs := map[string]bool{}
	seenSources := map[string]bool{}
	rasters := map[string]publishedRaster{}
	anchorCache := map[string]map[string]bool{}
	for index, guide := range cfg.Guides {
		label := guide.ID
		if label == "" {
			label = strconv.Itoa(index + 1)
		}
		if !validationGuideIDPattern.MatchString(guide.ID) {
			result.error(fmt.Sprintf("Guide %d: id must use lowercase letters, digits, and hyphens.", index+1))
		} else if seenIDs[guide.ID] {
			result.error("Duplicate guide id: " + guide.ID)
		}
		seenIDs[guide.ID] = true
		if strings.TrimSpace(guide.Title) == "" {
			result.error(fmt.Sprintf("Guide %s: title is required.", label))
		}
		if !strings.HasSuffix(strings.ToLower(guide.Output), ".pdf") || strings.ContainsAny(guide.Output, `/\`) {
			result.error(fmt.Sprintf("Guide %s: output must be a PDF filename, not a path.", label))
		} else if seenOutputs[guide.Output] {
			result.error("Duplicate guide output: " + guide.Output)
		}
		seenOutputs[guide.Output] = true
		if len(guide.Sources) == 0 {
			result.error(fmt.Sprintf("Guide %s: sources must be a non-empty array.", label))
			continue
		}
		for _, sourceValue := range guide.Sources {
			source, err := securePath(root, sourceValue)
			if err != nil {
				result.error(err.Error())
				continue
			}
			if seenSources[source] {
				result.warn("Source appears in multiple guides: " + sourceValue)
			}
			seenSources[source] = true
			info, err := os.Stat(source)
			if err != nil || !info.Mode().IsRegular() {
				result.error("Missing source: " + sourceValue)
				continue
			}
			validateMarkdown(root, source, cfg, &result, rasters, anchorCache)
		}
	}
	validateScreenshotManifests(root, rasters, &result)
	return result
}

func validateDedicatedDirectory(root, directory, key string, result *validationResult) {
	gitDir := filepath.Join(root, ".git")
	if filepath.Clean(directory) == filepath.Clean(root) || inside(gitDir, directory) {
		result.error(fmt.Sprintf("Configuration key '%s' must use a dedicated directory outside .git.", key))
	}
}

func validateGitState(root string, cfg config, result *validationResult) {
	if _, err := os.Stat(filepath.Join(root, ".git")); err != nil {
		result.warn("Git metadata is unavailable; ignore rules and revision metadata cannot be verified.")
		return
	}
	if os.Getenv("DOC_GIT_CHECKS_AVAILABLE") != "1" {
		result.warn("Git metadata is present, but the wrapper could not verify ignore rules.")
		return
	}
	if os.Getenv("DOC_WORK_IGNORED") != "1" {
		result.error("Work directory is not ignored by Git: " + valueOr(cfg.WorkDir, "docs/.documentation-work"))
	}
	if !cfg.CommitPDFOutputs && os.Getenv("DOC_OUTPUT_IGNORED") != "1" {
		result.error("PDF output directory is not ignored by Git: " + valueOr(cfg.OutputDir, "docs/pdf"))
	}
	if valueOr(os.Getenv("DOC_COMMIT"), "unknown") == "unknown" {
		if strings.TrimSpace(cfg.DocumentationVersion) != "" {
			result.warn("Git revision is unavailable; PDFs will rely on documentation_version for traceability.")
		} else {
			result.warn("Git revision and documentation_version are unavailable; generated PDFs are not publish-ready without an explicit review disposition.")
		}
	}
}

func validatePDFConfig(root string, pdf pdfConfig, result *validationResult) {
	mode := valueOr(pdf.Mode, "local")
	if mode != "local" && mode != "remote" {
		result.error("pdf.mode must be 'local' or 'remote'.")
		return
	}
	if mode == "remote" {
		if !strings.Contains(pdf.Image, "@sha256:") {
			result.error("Remote pdf.image must be pinned by an immutable sha256 digest.")
		}
		trusted := strings.TrimSpace(os.Getenv(remoteRendererImageEnv))
		if trusted == "" {
			result.error("Remote PDF mode requires DOCUMENTATION_REMOTE_RENDERER_IMAGE to be set by trusted runtime configuration outside the repository.")
		} else if pdf.Image != trusted {
			result.error("Configured remote renderer is not allowlisted by DOCUMENTATION_REMOTE_RENDERER_IMAGE.")
		}
		return
	}
	dockerfile, err := securePath(root, pdf.Dockerfile)
	if err != nil {
		result.error(err.Error())
		return
	}
	if info, err := os.Stat(dockerfile); err != nil || !info.Mode().IsRegular() {
		relative, _ := filepath.Rel(root, dockerfile)
		result.error("Missing configured Dockerfile: " + filepath.ToSlash(relative))
	}
}

func validateMarkdown(root, source string, cfg config, result *validationResult, rasters map[string]publishedRaster, anchorCache map[string]map[string]bool) {
	relative, _ := filepath.Rel(root, source)
	relative = filepath.ToSlash(relative)
	data, err := os.ReadFile(source)
	if err != nil {
		result.error(fmt.Sprintf("%s: cannot read source: %v", relative, err))
		return
	}
	text := string(data)

	headings := headingPattern.FindAllStringSubmatch(text, -1)
	h1Count := 0
	previousLevel := 0
	for _, heading := range headings {
		level := len(heading[1])
		if level == 1 {
			h1Count++
		}
		if previousLevel > 0 && level > previousLevel+1 {
			result.warn(fmt.Sprintf("%s: heading level jumps from H%d to H%d.", relative, previousLevel, level))
		}
		previousLevel = level
	}
	if h1Count != 1 {
		result.error(fmt.Sprintf("%s: expected exactly one H1, found %d.", relative, h1Count))
	}
	if strings.Contains(text, "```{=latex}") || rawLatexPattern.MatchString(stripFencedCode(text)) {
		result.error(relative + ": authored Markdown contains renderer-specific raw LaTeX.")
	}
	validateMermaidAlternatives(relative, text, result)
	if location := privateKeyPattern.FindStringIndex(text); location != nil {
		result.error(fmt.Sprintf("%s:%d: private key material detected.", relative, sourceLine(text, location[0])))
	}
	for _, location := range credentialPattern.FindAllStringIndex(text, -1) {
		result.warn(fmt.Sprintf("%s:%d: credential-shaped value requires review.", relative, sourceLine(text, location[0])))
	}
	allowedDomains := map[string]bool{}
	for _, domain := range cfg.Privacy.AllowedEmailDomains {
		allowedDomains[strings.ToLower(domain)] = true
	}
	for _, match := range emailPattern.FindAllStringSubmatchIndex(text, -1) {
		domain := strings.ToLower(text[match[2]:match[3]])
		if !allowedDomains[domain] {
			result.warn(fmt.Sprintf("%s:%d: email address outside the privacy allowlist.", relative, sourceLine(text, match[0])))
		}
	}

	document, err := parsePandocDocument(source)
	if err != nil {
		result.error(fmt.Sprintf("%s: %v", relative, err))
		return
	}
	for _, reference := range pandocReferences(document) {
		if reference.Kind == "Image" {
			if strings.TrimSpace(reference.Label) == "" {
				result.error(relative + ": image alt text is empty.")
			}
			validateImageReference(root, source, relative, reference.Target, result, rasters)
			continue
		}
		label := strings.ToLower(strings.TrimSpace(reference.Label))
		if label == "click here" || label == "here" || label == "link" || label == "more" {
			result.warn(fmt.Sprintf("%s: link text '%s' is not descriptive.", relative, label))
		}
		validateLinkReference(root, source, relative, reference.Target, result, anchorCache)
	}
	validateRawHTMLImages(root, source, relative, pandocRawHTML(document), result, rasters)
}

func parsePandocDocument(path string) (pandocDocument, error) {
	response, err := runCommand(
		[]string{"pandoc", path, "--from=markdown+tex_math_dollars+footnotes-raw_tex-raw_attribute", "--to=json"},
		filepath.Dir(path),
		nil,
		nil,
	)
	if err != nil {
		return pandocDocument{}, fmt.Errorf("cannot parse Markdown: %w", err)
	}
	var document pandocDocument
	if err := json.Unmarshal(response.Stdout, &document); err != nil {
		return pandocDocument{}, fmt.Errorf("cannot decode Pandoc AST: %w", err)
	}
	return document, nil
}

func pandocReferences(document pandocDocument) []documentReference {
	var references []documentReference
	var visit func(any)
	visit = func(value any) {
		switch node := value.(type) {
		case map[string]any:
			nodeType, _ := node["t"].(string)
			if nodeType == "Image" || nodeType == "Link" {
				if content, ok := node["c"].([]any); ok && len(content) >= 3 {
					target := pandocTarget(content[len(content)-1])
					references = append(references, documentReference{
						Kind: nodeType, Label: pandocText(content[len(content)-2]), Target: target,
					})
				}
			}
			for _, child := range node {
				visit(child)
			}
		case []any:
			for _, child := range node {
				visit(child)
			}
		}
	}
	raw, _ := json.Marshal(document.Blocks)
	var blocks any
	if json.Unmarshal(raw, &blocks) == nil {
		visit(blocks)
	}
	return references
}

func pandocRawHTML(document pandocDocument) string {
	var values []string
	var visit func(any)
	visit = func(value any) {
		switch node := value.(type) {
		case map[string]any:
			nodeType, _ := node["t"].(string)
			if nodeType == "RawInline" || nodeType == "RawBlock" {
				if content, ok := node["c"].([]any); ok && len(content) == 2 {
					format, _ := content[0].(string)
					raw, _ := content[1].(string)
					if strings.EqualFold(format, "html") {
						values = append(values, raw)
					}
				}
			}
			for _, child := range node {
				visit(child)
			}
		case []any:
			for _, child := range node {
				visit(child)
			}
		}
	}
	raw, _ := json.Marshal(document.Blocks)
	var blocks any
	if json.Unmarshal(raw, &blocks) == nil {
		visit(blocks)
	}
	return strings.Join(values, "\n")
}

func pandocTarget(value any) string {
	target, ok := value.([]any)
	if !ok || len(target) == 0 {
		return ""
	}
	text, _ := target[0].(string)
	return text
}

func pandocText(value any) string {
	var parts []string
	var visit func(any)
	visit = func(current any) {
		switch node := current.(type) {
		case map[string]any:
			switch node["t"] {
			case "Str", "Code", "Math":
				switch content := node["c"].(type) {
				case string:
					parts = append(parts, content)
				case []any:
					if len(content) > 0 {
						if text, ok := content[len(content)-1].(string); ok {
							parts = append(parts, text)
						}
					}
				}
			case "Space", "SoftBreak", "LineBreak":
				parts = append(parts, " ")
			default:
				visit(node["c"])
			}
		case []any:
			for _, child := range node {
				visit(child)
			}
		}
	}
	visit(value)
	return strings.TrimSpace(strings.Join(parts, ""))
}

func validateImageReference(root, source, relative, target string, result *validationResult, rasters map[string]publishedRaster) {
	parsed, err := url.Parse(strings.TrimSpace(target))
	if err != nil {
		result.error(fmt.Sprintf("%s: invalid image target: %s", relative, target))
		return
	}
	if strings.EqualFold(parsed.Scheme, "data") {
		result.error(relative + ": embedded data URI images are not permitted; publish an approved project-local raster instead.")
		return
	}
	if parsed.Scheme != "" || parsed.Host != "" || strings.HasPrefix(target, "//") {
		result.error(relative + ": remote images are not permitted; publish an approved project-local raster instead.")
		return
	}
	pathValue, err := url.PathUnescape(parsed.Path)
	if err != nil {
		result.error(fmt.Sprintf("%s: invalid image target: %s", relative, target))
		return
	}
	if pathValue == "" {
		return
	}
	imagePath, err := securePath(root, filepath.Join(filepath.Dir(source), pathValue))
	if err != nil {
		result.error(fmt.Sprintf("%s: published image escapes the project: %s", relative, target))
		return
	}
	info, statErr := os.Stat(imagePath)
	if statErr != nil || !info.Mode().IsRegular() {
		result.error(fmt.Sprintf("%s: published image does not exist: %s", relative, target))
		return
	}
	if rasterExtensions[strings.ToLower(filepath.Ext(imagePath))] {
		publishedPath, _ := filepath.Rel(root, imagePath)
		publishedPath = filepath.ToSlash(publishedPath)
		if _, exists := rasters[publishedPath]; !exists {
			rasters[publishedPath] = publishedRaster{Source: relative, Path: imagePath}
		}
	}
}

func validateRawHTMLImages(root, source, relative, rawHTML string, result *validationResult, rasters map[string]publishedRaster) {
	for _, tag := range htmlImagePattern.FindAllString(rawHTML, -1) {
		altFound := false
		for _, match := range htmlAttributePattern.FindAllStringSubmatch(tag, -1) {
			value := match[2]
			if value == "" {
				value = match[3]
			}
			if value == "" {
				value = match[4]
			}
			value = html.UnescapeString(value)
			if strings.EqualFold(match[1], "alt") {
				altFound = true
				if strings.TrimSpace(value) == "" {
					result.error(relative + ": image alt text is empty.")
				}
			} else if strings.EqualFold(match[1], "srcset") {
				result.error(relative + ": HTML srcset images are not supported; use one approved project-local src image instead.")
			} else {
				validateImageReference(root, source, relative, value, result, rasters)
			}
		}
		if !altFound {
			result.error(relative + ": image alt text is empty.")
		}
	}
}

func validateLinkReference(root, source, relative, target string, result *validationResult, anchorCache map[string]map[string]bool) {
	parsed, err := url.Parse(target)
	if err != nil {
		result.error(fmt.Sprintf("%s: invalid link target: %s", relative, target))
		return
	}
	if parsed.Scheme != "" || parsed.Host != "" || strings.HasPrefix(target, "//") {
		return
	}
	pathValue, err := url.PathUnescape(parsed.Path)
	if err != nil {
		result.error(fmt.Sprintf("%s: invalid link target: %s", relative, target))
		return
	}
	resolved := source
	if pathValue != "" {
		resolved, err = securePath(root, filepath.Join(filepath.Dir(source), pathValue))
		if err != nil {
			result.error(fmt.Sprintf("%s: local link escapes the project: %s", relative, target))
			return
		}
	}
	info, statErr := os.Stat(resolved)
	if statErr != nil || (pathValue != "" && info.IsDir()) {
		result.error(fmt.Sprintf("%s: broken local link: %s", relative, target))
		return
	}
	if parsed.Fragment == "" || !strings.EqualFold(filepath.Ext(resolved), ".md") {
		return
	}
	fragment, _ := url.PathUnescape(parsed.Fragment)
	anchors, ok := anchorCache[resolved]
	if !ok {
		anchors = markdownAnchors(resolved)
		anchorCache[resolved] = anchors
	}
	if !anchors[fragment] {
		result.error(fmt.Sprintf("%s: broken Markdown anchor: %s", relative, target))
	}
}

func markdownAnchors(path string) map[string]bool {
	anchors := map[string]bool{}
	document, err := parsePandocDocument(path)
	if err != nil {
		return anchors
	}
	for _, raw := range document.Blocks {
		var block struct {
			Type    string            `json:"t"`
			Content []json.RawMessage `json:"c"`
		}
		if json.Unmarshal(raw, &block) != nil || block.Type != "Header" || len(block.Content) < 2 {
			continue
		}
		var attr []json.RawMessage
		if json.Unmarshal(block.Content[1], &attr) != nil || len(attr) == 0 {
			continue
		}
		var identifier string
		if json.Unmarshal(attr[0], &identifier) == nil && identifier != "" {
			anchors[identifier] = true
		}
	}
	return anchors
}

func validateMermaidAlternatives(relative, text string, result *validationResult) {
	complete := mermaidFencePattern.FindAllStringIndex(text, -1)
	starts := mermaidStartPattern.FindAllStringIndex(text, -1)
	if len(starts) > len(complete) {
		result.error(relative + ": unterminated Mermaid fence.")
	}
	for _, location := range complete {
		prefixStart := location[0] - 500
		if prefixStart < 0 {
			prefixStart = 0
		}
		if !diagramAltPattern.MatchString(text[prefixStart:location[0]]) {
			result.error(fmt.Sprintf("%s:%d: Mermaid diagram needs an immediately preceding '<!-- diagram-alt: ... -->' text alternative.", relative, sourceLine(text, location[0])))
		}
	}
}

func stripFencedCode(text string) string {
	lines := strings.SplitAfter(text, "\n")
	var output strings.Builder
	var fence string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if fence == "" {
			if strings.HasPrefix(trimmed, "```") {
				fence = "```"
				continue
			}
			if strings.HasPrefix(trimmed, "~~~") {
				fence = "~~~"
				continue
			}
			output.WriteString(line)
			continue
		}
		if strings.HasPrefix(trimmed, fence) {
			fence = ""
		}
	}
	return output.String()
}

func sourceLine(text string, offset int) int {
	return strings.Count(text[:offset], "\n") + 1
}

func validateScreenshotManifests(root string, rasters map[string]publishedRaster, result *validationResult) {
	if len(rasters) == 0 {
		return
	}
	rows := map[string]map[string]string{}
	rowManifests := map[string]string{}
	manifestCount := 0
	_ = filepath.WalkDir(filepath.Join(root, "docs"), func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() || entry.Name() != "SCREENSHOTS.md" {
			return nil
		}
		manifestCount++
		for publishedPath, row := range screenshotManifestRows(root, path, result) {
			if previous, exists := rowManifests[publishedPath]; exists {
				current, _ := filepath.Rel(root, path)
				result.error(fmt.Sprintf("Duplicate screenshot manifest path %s: %s and %s", publishedPath, previous, filepath.ToSlash(current)))
				continue
			}
			rows[publishedPath] = row
			relative, _ := filepath.Rel(root, path)
			rowManifests[publishedPath] = filepath.ToSlash(relative)
		}
		return nil
	})
	if manifestCount == 0 {
		result.error("Published images exist but no SCREENSHOTS.md manifest was found.")
		return
	}
	for publishedPath, raster := range rasters {
		row, ok := rows[publishedPath]
		if !ok {
			result.error(fmt.Sprintf("%s: published raster image is absent from screenshot manifests: %s", raster.Source, publishedPath))
			continue
		}
		width, height, err := imageDimensions(raster.Path)
		if err != nil {
			result.error(fmt.Sprintf("%s: cannot read dimensions for published raster: %s", raster.Source, publishedPath))
			continue
		}
		match := dimensionPattern.FindStringSubmatch(row["image dimensions"])
		if match == nil {
			result.error(fmt.Sprintf("%s: screenshot manifest must record Image dimensions for %s as %d×%d.", raster.Source, publishedPath, width, height))
		} else {
			recordedWidth, _ := strconv.Atoi(match[1])
			recordedHeight, _ := strconv.Atoi(match[2])
			if width != recordedWidth || height != recordedHeight {
				result.error(fmt.Sprintf("%s: screenshot dimensions drifted for %s; manifest says %d×%d, file is %d×%d.", raster.Source, publishedPath, recordedWidth, recordedHeight, width, height))
			}
		}
		approval := strings.ToLower(strings.TrimSpace(row["approval"]))
		if approval != "approved" && approval != "not required" {
			result.error(fmt.Sprintf("%s: screenshot %s lacks publication approval.", raster.Source, publishedPath))
		}
	}
}

func screenshotManifestRows(root, path string, result *validationResult) map[string]map[string]string {
	rows := map[string]map[string]string{}
	data, err := os.ReadFile(path)
	if err != nil {
		return rows
	}
	var header []string
	for _, line := range strings.Split(string(data), "\n") {
		if !strings.HasPrefix(strings.TrimSpace(line), "|") {
			continue
		}
		cells := splitTableRow(line)
		if header == nil {
			for _, cell := range cells {
				header = append(header, strings.ToLower(cell))
			}
			continue
		}
		separator := true
		for _, cell := range cells {
			if !regexp.MustCompile(`^:?-{3,}:?$`).MatchString(cell) {
				separator = false
				break
			}
		}
		if separator || len(cells) != len(header) {
			continue
		}
		row := map[string]string{}
		for index, key := range header {
			row[key] = cells[index]
		}
		published := strings.Trim(row["published path"], "` ")
		if published == "" {
			published = strings.Trim(row["filename"], "` ")
		}
		if published == "" {
			continue
		}
		resolved, secureErr := securePath(root, published)
		relativeManifest, _ := filepath.Rel(root, path)
		if secureErr != nil {
			result.error(fmt.Sprintf("%s: %v", filepath.ToSlash(relativeManifest), secureErr))
			continue
		}
		relative, _ := filepath.Rel(root, resolved)
		relative = filepath.ToSlash(relative)
		if filepath.IsAbs(published) || !strings.Contains(published, "/") || published != relative {
			result.error(fmt.Sprintf("%s: screenshot path must be normalized and project-relative: %s", filepath.ToSlash(relativeManifest), published))
			continue
		}
		if _, exists := rows[relative]; exists {
			result.error(fmt.Sprintf("%s: duplicate screenshot manifest path: %s", filepath.ToSlash(relativeManifest), relative))
			continue
		}
		rows[relative] = row
	}
	return rows
}

func splitTableRow(line string) []string {
	trimmed := strings.Trim(strings.TrimSpace(line), "|")
	raw := strings.Split(trimmed, "|")
	cells := make([]string, len(raw))
	for index, cell := range raw {
		cells[index] = strings.TrimSpace(cell)
	}
	return cells
}
