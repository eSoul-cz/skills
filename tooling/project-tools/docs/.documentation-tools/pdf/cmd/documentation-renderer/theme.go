package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const (
	defaultThemeName = "default"
	esoulThemeName   = "esoul"
)

var (
	themeHexPattern       = regexp.MustCompile(`^[0-9A-Fa-f]{6}$`)
	themeDimensionPattern = regexp.MustCompile(`^([0-9]+(?:\.[0-9]+)?)(?:mm|cm|in|pt)$`)
)

type themeOverridesConfig struct {
	AccentColor         string `toml:"accent_color"`
	TextColor           string `toml:"text_color"`
	HeadingColor        string `toml:"heading_color"`
	LinkColor           string `toml:"link_color"`
	URLColor            string `toml:"url_color"`
	PaperSize           string `toml:"paper_size"`
	MainFont            string `toml:"main_font"`
	HeadingFont         string `toml:"heading_font"`
	MonoFont            string `toml:"mono_font"`
	FontSize            string `toml:"font_size"`
	Margin              string `toml:"margin"`
	NoteBackground      string `toml:"note_background"`
	NoteBorder          string `toml:"note_border"`
	TipBackground       string `toml:"tip_background"`
	TipBorder           string `toml:"tip_border"`
	ImportantBackground string `toml:"important_background"`
	ImportantBorder     string `toml:"important_border"`
	WarningBackground   string `toml:"warning_background"`
	WarningBorder       string `toml:"warning_border"`
	CautionBackground   string `toml:"caution_background"`
	CautionBorder       string `toml:"caution_border"`
	PlannedBackground   string `toml:"planned_background"`
	PlannedBorder       string `toml:"planned_border"`
}

type themeColor struct {
	value string
	hex   bool
}

type resolvedTheme struct {
	Name                string
	Branded             bool
	AccentColor         string
	TextColor           themeColor
	HeadingColor        themeColor
	LinkColor           themeColor
	URLColor            themeColor
	PaperSize           string
	MainFont            string
	HeadingFont         string
	MonoFont            string
	FontSize            string
	Margin              string
	NoteBackground      themeColor
	NoteBorder          themeColor
	TipBackground       themeColor
	TipBorder           themeColor
	ImportantBackground themeColor
	ImportantBorder     themeColor
	WarningBackground   themeColor
	WarningBorder       themeColor
	CautionBackground   themeColor
	CautionBorder       themeColor
	PlannedBackground   themeColor
	PlannedBorder       themeColor
}

type preparedThemeFiles struct {
	Header     string
	BeforeBody string
}

type themeDocument struct {
	Title           string
	ClientName      string
	ClientLogo      string
	DocumentVersion string
	DocumentDate    string
	Classification  string
	Language        string
}

func builtInTheme(name string) (resolvedTheme, bool) {
	base := resolvedTheme{
		Name:                name,
		AccentColor:         "1B6B93",
		TextColor:           themeColor{value: "black"},
		HeadingColor:        themeColor{value: "black"},
		LinkColor:           themeColor{value: "blue"},
		URLColor:            themeColor{value: "blue"},
		PaperSize:           "a4",
		MainFont:            "Noto Sans",
		HeadingFont:         "Noto Sans",
		MonoFont:            "Noto Sans Mono",
		FontSize:            "11pt",
		Margin:              "24mm",
		NoteBackground:      themeColor{value: "blue!3"},
		NoteBorder:          themeColor{value: "blue!55!black"},
		TipBackground:       themeColor{value: "green!3"},
		TipBorder:           themeColor{value: "green!45!black"},
		ImportantBackground: themeColor{value: "violet!3"},
		ImportantBorder:     themeColor{value: "violet!55!black"},
		WarningBackground:   themeColor{value: "orange!5"},
		WarningBorder:       themeColor{value: "orange!70!black"},
		CautionBackground:   themeColor{value: "red!3"},
		CautionBorder:       themeColor{value: "red!65!black"},
		PlannedBackground:   themeColor{value: "gray!5"},
		PlannedBorder:       themeColor{value: "gray!65!black"},
	}
	switch name {
	case defaultThemeName:
		return base, true
	case esoulThemeName:
		base.Branded = true
		base.AccentColor = "4A494A"
		base.TextColor = themeColor{value: "1B1B1D", hex: true}
		base.HeadingColor = themeColor{value: "0E0F11", hex: true}
		base.LinkColor = themeColor{value: "4A494A", hex: true}
		base.URLColor = themeColor{value: "4A494A", hex: true}
		base.MainFont = "Poppins"
		base.HeadingFont = "Syne"
		base.FontSize = "12pt"
		base.Margin = "25.4mm"
		base.NoteBackground = themeColor{value: "F1F3F4", hex: true}
		base.NoteBorder = themeColor{value: "78858A", hex: true}
		base.TipBackground = themeColor{value: "F0F4F1", hex: true}
		base.TipBorder = themeColor{value: "718378", hex: true}
		base.ImportantBackground = themeColor{value: "F3F0F4", hex: true}
		base.ImportantBorder = themeColor{value: "827587", hex: true}
		base.WarningBackground = themeColor{value: "F6F2E9", hex: true}
		base.WarningBorder = themeColor{value: "9A825C", hex: true}
		base.CautionBackground = themeColor{value: "F5EEEE", hex: true}
		base.CautionBorder = themeColor{value: "987171", hex: true}
		base.PlannedBackground = themeColor{value: "F2F2F2", hex: true}
		base.PlannedBorder = themeColor{value: "777677", hex: true}
		return base, true
	default:
		return resolvedTheme{}, false
	}
}

func resolveTheme(pdf pdfConfig) (resolvedTheme, error) {
	name := valueOr(strings.TrimSpace(pdf.Theme), defaultThemeName)
	theme, ok := builtInTheme(name)
	if !ok {
		return resolvedTheme{}, fmt.Errorf("pdf.theme must be '%s' or '%s'", defaultThemeName, esoulThemeName)
	}
	if err := applyThemeOverrides(&theme, pdf.ThemeOverrides); err != nil {
		return resolvedTheme{}, err
	}

	if value := strings.TrimSpace(pdf.PaperSize); value != "" {
		if value != "a4" && value != "letter" {
			return resolvedTheme{}, fmt.Errorf("pdf.paper_size must be 'a4' or 'letter'")
		}
		theme.PaperSize = value
	}
	if value := strings.TrimSpace(pdf.MainFont); value != "" {
		// Legacy pdf.main_font predates separate typed font overrides and retains
		// final precedence for compatibility, intentionally setting both fonts.
		theme.MainFont = value
		theme.HeadingFont = value
	}
	if value := strings.TrimSpace(pdf.MonoFont); value != "" {
		theme.MonoFont = value
	}
	if value := normalizedThemeHex(pdf.AccentColor); value != "" {
		theme.AccentColor = value
	}
	return theme, nil
}

func applyThemeOverrides(theme *resolvedTheme, overrides themeOverridesConfig) error {
	var err error
	if theme.AccentColor, err = overrideHex("pdf.theme_overrides.accent_color", theme.AccentColor, overrides.AccentColor); err != nil {
		return err
	}
	if theme.TextColor, err = overrideThemeColor("pdf.theme_overrides.text_color", theme.TextColor, overrides.TextColor); err != nil {
		return err
	}
	if theme.HeadingColor, err = overrideThemeColor("pdf.theme_overrides.heading_color", theme.HeadingColor, overrides.HeadingColor); err != nil {
		return err
	}
	if theme.LinkColor, err = overrideThemeColor("pdf.theme_overrides.link_color", theme.LinkColor, overrides.LinkColor); err != nil {
		return err
	}
	if theme.URLColor, err = overrideThemeColor("pdf.theme_overrides.url_color", theme.URLColor, overrides.URLColor); err != nil {
		return err
	}
	if value := strings.TrimSpace(overrides.PaperSize); value != "" {
		if value != "a4" && value != "letter" {
			return fmt.Errorf("pdf.theme_overrides.paper_size must be 'a4' or 'letter'")
		}
		theme.PaperSize = value
	}
	if value := strings.TrimSpace(overrides.MainFont); value != "" {
		theme.MainFont = value
	}
	if value := strings.TrimSpace(overrides.HeadingFont); value != "" {
		theme.HeadingFont = value
	}
	if value := strings.TrimSpace(overrides.MonoFont); value != "" {
		theme.MonoFont = value
	}
	if value := strings.TrimSpace(overrides.FontSize); value != "" {
		match := themeDimensionPattern.FindStringSubmatch(value)
		amount := 0.0
		if len(match) == 2 && strings.HasSuffix(value, "pt") {
			amount, _ = strconv.ParseFloat(match[1], 64)
		}
		if amount < 6 || amount > 20 {
			return fmt.Errorf("pdf.theme_overrides.font_size must be between 6pt and 20pt")
		}
		theme.FontSize = value
	}
	if value := strings.TrimSpace(overrides.Margin); value != "" {
		match := themeDimensionPattern.FindStringSubmatch(value)
		amount := 0.0
		if len(match) == 2 {
			amount, _ = strconv.ParseFloat(match[1], 64)
		}
		if amount <= 0 {
			return fmt.Errorf("pdf.theme_overrides.margin must be a positive TeX dimension using mm, cm, in, or pt")
		}
		theme.Margin = value
	}

	colorOverrides := []struct {
		key     string
		current *themeColor
		value   string
	}{
		{"note_background", &theme.NoteBackground, overrides.NoteBackground},
		{"note_border", &theme.NoteBorder, overrides.NoteBorder},
		{"tip_background", &theme.TipBackground, overrides.TipBackground},
		{"tip_border", &theme.TipBorder, overrides.TipBorder},
		{"important_background", &theme.ImportantBackground, overrides.ImportantBackground},
		{"important_border", &theme.ImportantBorder, overrides.ImportantBorder},
		{"warning_background", &theme.WarningBackground, overrides.WarningBackground},
		{"warning_border", &theme.WarningBorder, overrides.WarningBorder},
		{"caution_background", &theme.CautionBackground, overrides.CautionBackground},
		{"caution_border", &theme.CautionBorder, overrides.CautionBorder},
		{"planned_background", &theme.PlannedBackground, overrides.PlannedBackground},
		{"planned_border", &theme.PlannedBorder, overrides.PlannedBorder},
	}
	for _, override := range colorOverrides {
		resolved, err := overrideThemeColor("pdf.theme_overrides."+override.key, *override.current, override.value)
		if err != nil {
			return err
		}
		*override.current = resolved
	}
	return nil
}

func overrideHex(key, current, value string) (string, error) {
	if strings.TrimSpace(value) == "" {
		return current, nil
	}
	value = normalizedThemeHex(value)
	if value == "" {
		return "", fmt.Errorf("%s must be a six-digit hexadecimal color", key)
	}
	return value, nil
}

func overrideThemeColor(key string, current themeColor, value string) (themeColor, error) {
	if strings.TrimSpace(value) == "" {
		return current, nil
	}
	hex := normalizedThemeHex(value)
	if hex == "" {
		return themeColor{}, fmt.Errorf("%s must be a six-digit hexadecimal color", key)
	}
	return themeColor{value: hex, hex: true}, nil
}

func normalizedThemeHex(value string) string {
	value = strings.TrimPrefix(strings.TrimSpace(value), "#")
	if !themeHexPattern.MatchString(value) {
		return ""
	}
	return strings.ToUpper(value)
}

func newThemeDocument(cfg config, guide guideConfig) themeDocument {
	return themeDocument{
		Title:           valueOr(guide.Title, "Documentation"),
		ClientName:      strings.TrimSpace(cfg.Project.Name),
		ClientLogo:      strings.TrimSpace(cfg.Project.Logo),
		DocumentVersion: valueOr(guide.DocumentVersion, cfg.DocumentationVersion),
		DocumentDate:    strings.TrimSpace(guide.DocumentDate),
		Classification:  strings.TrimSpace(guide.Classification),
		Language:        valueOr(cfg.PrimaryLanguage, "en"),
	}
}

func prepareThemeFiles(root, stagingDir string, document themeDocument, theme resolvedTheme) (preparedThemeFiles, error) {
	header := filepath.Join(stagingDir, "documentation-theme.tex")
	files := preparedThemeFiles{Header: header}
	if !theme.Branded {
		if err := os.WriteFile(header, []byte(themeHeader(theme)), 0o644); err != nil {
			return preparedThemeFiles{}, fmt.Errorf("write theme header: %w", err)
		}
		return files, nil
	}

	simpleLogo := runtimePath(
		"themes/esoul/logo-simple.svg",
		"/opt/documentation-tools/themes/esoul/logo-simple.svg",
	)
	textLogo := runtimePath(
		"themes/esoul/logo-text.svg",
		"/opt/documentation-tools/themes/esoul/logo-text.svg",
	)
	simplePDF := filepath.Join(stagingDir, "esoul-logo-simple.pdf")
	textPDF := filepath.Join(stagingDir, "esoul-logo-text.pdf")
	logos := []struct {
		source string
		output string
	}{
		{source: simpleLogo, output: simplePDF},
		{source: textLogo, output: textPDF},
	}
	for _, logo := range logos {
		if _, err := runCommand(
			[]string{"rsvg-convert", "--format=pdf", "--output=" + logo.output, logo.source},
			stagingDir,
			nil,
			nil,
		); err != nil {
			return preparedThemeFiles{}, fmt.Errorf("prepare eSoul theme logo: %w", err)
		}
	}
	clientLogo, err := prepareThemeClientLogo(root, stagingDir, document.ClientLogo)
	if err != nil {
		return preparedThemeFiles{}, err
	}

	if err := os.WriteFile(header, []byte(themeHeader(theme)+esoulLayoutHeader(clientLogo)), 0o644); err != nil {
		return preparedThemeFiles{}, fmt.Errorf("write eSoul theme header: %w", err)
	}
	cover := filepath.Join(stagingDir, "documentation-esoul-cover.tex")
	if err := os.WriteFile(cover, []byte(esoulCover(document, clientLogo)), 0o644); err != nil {
		return preparedThemeFiles{}, fmt.Errorf("write eSoul cover: %w", err)
	}
	files.BeforeBody = cover
	return files, nil
}

func prepareThemeClientLogo(root, stagingDir, configured string) (string, error) {
	if strings.TrimSpace(configured) == "" {
		return "", nil
	}
	source, err := securePath(root, configured)
	if err != nil {
		return "", fmt.Errorf("prepare client logo: %w", err)
	}
	extension := strings.ToLower(filepath.Ext(source))
	if !supportedLogoExtensions[extension] {
		return "", fmt.Errorf("project.logo must be an SVG, PDF, PNG, JPEG, or JPG file")
	}
	if extension == ".svg" {
		output := filepath.Join(stagingDir, "client-logo.pdf")
		if _, err := runCommand(
			[]string{"rsvg-convert", "--format=pdf", "--output=" + output, source},
			stagingDir,
			nil,
			nil,
		); err != nil {
			return "", fmt.Errorf("prepare client logo: %w", err)
		}
		return filepath.Base(output), nil
	}

	output := filepath.Join(stagingDir, "client-logo"+extension)
	content, err := os.ReadFile(source)
	if err != nil {
		return "", fmt.Errorf("read client logo: %w", err)
	}
	if err := os.WriteFile(output, content, 0o644); err != nil {
		return "", fmt.Errorf("write client logo: %w", err)
	}
	return filepath.Base(output), nil
}

func themeHeader(theme resolvedTheme) string {
	var output strings.Builder
	output.WriteString("\\usepackage{xcolor}\n")
	writeThemeColor(&output, "documentationaccent", themeColor{value: theme.AccentColor, hex: true})
	writeThemeColor(&output, "documentationtext", theme.TextColor)
	writeThemeColor(&output, "documentationheading", theme.HeadingColor)
	writeThemeColor(&output, "documentationlink", theme.LinkColor)
	writeThemeColor(&output, "documentationurl", theme.URLColor)
	writeThemeColor(&output, "documentationnotebackground", theme.NoteBackground)
	writeThemeColor(&output, "documentationnoteborder", theme.NoteBorder)
	writeThemeColor(&output, "documentationtipbackground", theme.TipBackground)
	writeThemeColor(&output, "documentationtipborder", theme.TipBorder)
	writeThemeColor(&output, "documentationimportantbackground", theme.ImportantBackground)
	writeThemeColor(&output, "documentationimportantborder", theme.ImportantBorder)
	writeThemeColor(&output, "documentationwarningbackground", theme.WarningBackground)
	writeThemeColor(&output, "documentationwarningborder", theme.WarningBorder)
	writeThemeColor(&output, "documentationcautionbackground", theme.CautionBackground)
	writeThemeColor(&output, "documentationcautionborder", theme.CautionBorder)
	writeThemeColor(&output, "documentationplannedbackground", theme.PlannedBackground)
	writeThemeColor(&output, "documentationplannedborder", theme.PlannedBorder)
	if theme.Branded {
		fmt.Fprintf(
			&output,
			"\\newfontfamily\\documentationheadingfont{%s}[BoldFont={%s}]\n",
			latexEscape(theme.HeadingFont),
			latexEscape(theme.HeadingFont),
		)
	} else {
		fmt.Fprintf(
			&output,
			"\\newfontfamily\\documentationheadingfont{%s}\n",
			latexEscape(theme.HeadingFont),
		)
	}
	output.WriteString("\\ifdefined\\addtokomafont\n")
	output.WriteString("  \\addtokomafont{disposition}{\\documentationheadingfont\\color{documentationheading}}\n")
	output.WriteString("\\fi\n")
	output.WriteString("\\AtBeginDocument{\\color{documentationtext}}\n")
	return output.String()
}

func writeThemeColor(output *strings.Builder, name string, color themeColor) {
	if color.hex {
		fmt.Fprintf(output, "\\definecolor{%s}{HTML}{%s}\n", name, color.value)
		return
	}
	fmt.Fprintf(output, "\\colorlet{%s}{%s}\n", name, color.value)
}

func esoulLayoutHeader(clientLogo string) string {
	runningLogo := `\hspace*{-17mm}\raisebox{-6.5mm}[0pt][0pt]{\includegraphics[width=19mm]{esoul-logo-simple.pdf}}`
	if clientLogo != "" {
		runningLogo = fmt.Sprintf(
			`\raisebox{-2mm}[0pt][0pt]{\includegraphics[width=38mm,height=13mm,keepaspectratio]{%s}}`,
			latexEscape(clientLogo),
		)
	}
	header := `\usepackage{scrlayer-scrpage}
\usepackage{etoolbox}
\setlength{\headheight}{20mm}
\setlength{\footheight}{10mm}
\setkomafont{pageheadfoot}{\normalfont\color{documentationaccent}}
\newcommand{\documentationesoulfooterleft}{%
  \parbox[b]{47mm}{\fontsize{12}{16}\selectfont
    \href{https://www.esoul.cz}{esoul.cz}\\
    \href{mailto:info@esoul.cz}{info@esoul.cz}}}
\newcommand{\documentationesoulfootercenter}{%
  \parbox[b]{50mm}{\fontsize{12}{16}\selectfont
    IČ: 17582571\\
    DIČ: CZ17582571}}
\newcommand{\documentationesoulfooterright}{%
  \includegraphics[width=28mm]{esoul-logo-text.pdf}}
\newpairofpagestyles{documentationesoul}{%
  \ihead{DOCUMENTATION_RUNNING_LOGO}
  \ohead{\raisebox{-1mm}[0pt][0pt]{\fontsize{12}{14}\selectfont\pagemark}}
  \ifoot{\raisebox{-6mm}[0pt][0pt]{\hspace*{2mm}\documentationesoulfooterleft}}
  \cfoot{\raisebox{-6mm}[0pt][0pt]{\hspace*{-25mm}\documentationesoulfootercenter}}
  \ofoot{\raisebox{-6mm}[0pt][0pt]{\documentationesoulfooterright}}
}
\newpairofpagestyles{documentationesoulcover}{%
  \ifoot{\raisebox{-20mm}[0pt][0pt]{\hspace*{2mm}\documentationesoulfooterleft}}
  \cfoot{\raisebox{-20mm}[0pt][0pt]{\hspace*{-25mm}\documentationesoulfootercenter}}
  \ofoot{\raisebox{-20mm}[0pt][0pt]{\documentationesoulfooterright}}
}
\setkomafont{section}{\documentationheadingfont\color{documentationheading}\fontsize{20}{24}\selectfont}
\setkomafont{subsection}{\documentationheadingfont\color{documentationheading}\fontsize{16}{20}\selectfont}
\setkomafont{subsubsection}{\documentationheadingfont\color{documentationheading}\fontsize{14}{18}\selectfont}
\AtBeginEnvironment{landscape}{\pagestyle{empty}\thispagestyle{empty}}
\AtEndEnvironment{landscape}{\pagestyle{documentationesoul}}
\pagestyle{documentationesoul}
`
	return strings.Replace(header, "DOCUMENTATION_RUNNING_LOGO", runningLogo, 1)
}

func esoulCover(document themeDocument, clientLogo string) string {
	title := latexEscape(document.Title)
	var logo string
	if clientLogo != "" {
		logo = fmt.Sprintf(
			`\hfill\raisebox{1mm}[0pt][0pt]{\includegraphics[width=58mm,height=24mm,keepaspectratio]{%s}}`,
			latexEscape(clientLogo),
		)
	}
	metadata := esoulCoverMetadata(document)
	return fmt.Sprintf(`\begin{titlepage}
\newgeometry{top=4mm,right=25.4mm,bottom=45mm,left=25.4mm}
\thispagestyle{documentationesoulcover}
\noindent\makebox[\textwidth][l]{\hspace*{-16.4mm}\includegraphics[width=35.2mm]{esoul-logo-simple.pdf}%s}
\par\vspace{12.5mm}
\begin{minipage}{155mm}
  {\documentationheadingfont\color{documentationheading}\fontsize{26}{31}\selectfont\bfseries %s\par}
\end{minipage}
%s
\end{titlepage}
\restoregeometry
\setcounter{page}{1}
\pagestyle{documentationesoul}
`, logo, title, metadata)
}

func esoulCoverMetadata(document themeDocument) string {
	labels := map[string]string{
		"client":         "Client",
		"version":        "Version",
		"date":           "Date",
		"classification": "Classification",
	}
	language := strings.ToLower(document.Language)
	if language == "cs" || strings.HasPrefix(language, "cs-") {
		labels = map[string]string{
			"client":         "Klient",
			"version":        "Verze",
			"date":           "Datum",
			"classification": "Klasifikace",
		}
	}
	rows := []struct {
		label string
		value string
	}{
		{labels["client"], document.ClientName},
		{labels["version"], document.DocumentVersion},
		{labels["date"], document.DocumentDate},
		{labels["classification"], document.Classification},
	}
	var content strings.Builder
	for _, row := range rows {
		if strings.TrimSpace(row.value) == "" {
			continue
		}
		fmt.Fprintf(
			&content,
			"  \\noindent\\makebox[34mm][l]{{\\color{documentationaccent}\\bfseries %s}}"+
				"\\hspace{4mm}%s\\par\\vspace{1mm}\n",
			latexEscape(row.label),
			latexEscape(row.value),
		)
	}
	if content.Len() == 0 {
		return ""
	}
	return fmt.Sprintf(`
\par\vspace{18mm}
\begingroup
\setlength{\fboxsep}{4mm}
\noindent\colorbox{documentationplannedbackground}{%%
  \parbox{147mm}{%%
  \fontsize{10}{14}\selectfont
%s}}
\endgroup
`, content.String())
}

func latexEscape(value string) string {
	replacer := strings.NewReplacer(
		`\`, `\textbackslash{}`,
		`{`, `\{`,
		`}`, `\}`,
		`#`, `\#`,
		`$`, `\$`,
		`%`, `\%`,
		`&`, `\&`,
		`_`, `\_`,
		`^`, `\textasciicircum{}`,
		`~`, `\textasciitilde{}`,
	)
	return replacer.Replace(value)
}
