# PDF Pipeline

What an author or reviewer needs to configure and use the PDF tool. How the renderer image, filters and installer work inside is documented for tool maintainers in the `eSoul-cz/skills` repository (`tooling/MAINTAINERS.md`); it is not needed to author documentation and is not reconstructed from this skill.

## Project layout

```text
docs/
  documentation                 # stable Bash command
  documentation.toml            # project-owned configuration
  documentation-spec.md         # approved authoring contract
  documentation-decisions.md    # evidence and decision record
  .documentation-tools/         # versioned managed tooling
  .documentation-work/          # ignored intermediates and raw captures
  user-guide/                    # authored Markdown
  developer-guide/               # authored Markdown
  pdf/                           # generated, always ignored, never committed
```

Preserve compatible existing layouts by configuring actual paths. Never relocate existing docs without approval.

## Commands

```bash
docs/documentation validate
docs/documentation build
docs/documentation render
docs/documentation redact docs/.documentation-work/redaction-plan.json
docs/documentation doctor
docs/documentation version
```

`validate`, `build`, `render` and `redact` need a POSIX shell and Docker on the host (Git is optional, for ignore-rule and revision checks); `doctor` and `version` start without Docker, and `doctor` reports a missing Docker as a diagnostic. `validate` runs with the whole checkout read-only; `build`, `render` and `redact` write only to the configured PDF and work directories. `build` validates, renders every guide, runs structural PDF checks, extracts text and renders every page to PNG under the work directory (`rendered/`); each build recreates those directories, so stale files cannot survive.

`validate` checks, among others: the configuration, source files, links and anchors, image paths and alt text, Mermaid text alternatives, raw LaTeX, likely secrets and personal emails, math commands, the Git ignore rules and the screenshot manifest.

Published images must be local project files. Validation rejects remote URLs (including protocol-relative targets), embedded data URIs, HTML `srcset`, missing paths and paths that escape the project. Raster images need a normalized project-relative screenshot-manifest entry and publication approval. Inline, reference and raw HTML `img` image forms and inline and reference links work; local percent-encoded paths are decoded. PDF-local anchors follow Pandoc identifiers (Unicode letters normalized and case-folded, underscores and periods kept, spaces to hyphens, other punctuation removed).

## Configuration

Use the project-owned `documentation.toml`; the tooling bootstrap creates it only when it is missing and never replaces an existing configuration. Define ordered `sources` arrays in each `[[guides]]` block. Project-owned settings include branding, paths, language, theme, custom template/header, landscape source pages, documentation version, privacy allowlists, and local/remote Docker mode.

`primary_language` is the default language of every guide; `language` on a `[[guides]]` block overrides it for that guide (a language tag such as `cs` or `en-GB`), so a Czech user guide and an English developer guide can share one configuration. It sets the PDF `lang` metadata and the cover labels.

`pdf.mode` is `remote` (the installer default: a digest-pinned public renderer image, trusted through `DOCUMENTATION_REMOTE_RENDERER_IMAGE` or the local Git setting the bootstrap writes; CI setup is in [jenkins.md](jenkins.md)) or `local` (builds the project-local Dockerfile; renderer development and emergency recovery only).

`pdf.theme` selects a built-in preset:

- `default` preserves the existing neutral Noto Sans layout.
- `esoul` uses the eSoul client-document design for client-facing application guides: Poppins body text, Syne headings, grayscale semantic colors and callouts, the compact eSoul title page, client-aware header and publisher footer chrome, and vector logos.

The optional `[pdf.theme_overrides]` table accepts six-digit hexadecimal semantic colors, `a4` or `letter` paper, main/heading/monospace fonts, a font size from `6pt` through `20pt`, and a positive `mm`, `cm`, `in`, or `pt` margin. In the eSoul preset, `margin` controls the side margins while the branded header/footer retain their verified vertical geometry. Existing flat `paper_size`, `main_font`, `mono_font`, and `accent_color` keys remain supported and take precedence over the selected preset and typed overrides so upgrades do not silently alter established documents. A configured custom template or header remains project-owned and is applied after the generated theme preamble.

Projects may load fonts without rebuilding or extending the renderer image. Add `.otf`, `.ttf`, `.otc`, or `.ttc` files under a project-owned directory, list that directory in `pdf.font_dirs`, and use the font's internal family name in `main_font`, `heading_font`, or `mono_font`:

```toml
[pdf]
theme = "default"
font_dirs = ["docs/fonts"]

[pdf.theme_overrides]
main_font = "Client Sans"
heading_font = "Client Display"
mono_font = "Client Mono"
```

Font directories are resolved relative to the project root, may contain nested directories, and must contain at least one supported font. Missing directories, files used in place of directories, empty font directories, and symbolic-link escapes fail validation. The checkout and font files stay read-only. Font family names come from font metadata rather than filenames, so inspect unfamiliar files with `fc-scan` when configuration and filenames differ. Commit only fonts whose redistribution licence permits inclusion in the project.

For eSoul client documents, `[project].name` and `[project].logo` define the optional client identity. The eSoul publisher mark remains on the title page and its compact wordmark remains in the footer. When configured, the client logo appears prominently at the upper right of the title page and replaces the eSoul mark in running-page headers; without a client logo, the eSoul header mark remains as the fallback. Each guide may add `document_version`, `document_date`, and `classification`; populated values appear in a compact metadata panel below the document title. All fields are optional, guide-level versions take precedence over the top-level `documentation_version`, and absent values do not leave empty labels or placeholder panels. Metadata labels are English by default and Czech when the guide's language is `cs` or starts with `cs-`.

```toml
[project]
name = "Northstar Systems"
logo = "docs/assets/northstar-logo.svg"

[[guides]]
id = "client-guide"
title = "Client & Operations Guide"
output = "client-guide.pdf"
document_version = "1.4"
document_date = "28 July 2026"
classification = "Client Confidential"
```

Client logos must be project-local SVG, PDF, PNG, or JPEG files. SVG input is converted to vector PDF; other supported formats retain their original representation. Prefer vector marks for client-facing PDFs. Cover metadata is limited to a single line and 80 characters per value.

Each guide may set `cross_document_links` and `invalid_links` to `"error"` (the default) or `"notice"`. Cross-document policy applies to Markdown files that exist in the project but are not included in that guide's `sources`; invalid-link policy applies to missing local targets and broken Markdown anchors. Notice mode reports the issue and keeps the link label in the PDF. `link_notice_style` selects `plain`, `parentheses`, or `footnote` output, while `link_notice_paths` selects the authored `original` target or a normalized `project-relative` path. Malformed targets and project escapes remain errors regardless of these settings.

## Markdown contract

Use GitHub-readable Markdown with footnotes, GitHub alert callouts, Mermaid fences, and TeX math delimiters. Standard Pandoc footnote syntax supports inline content, repeated references, multiple paragraphs, links, emphasis, code, and Unicode text; keep each definition in the same guide as its reference. `$...$` and `$$...$$` render on GitHub and through Pandoc. Standard `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION` alerts become labeled, page-breakable PDF boxes using the selected theme's semantic colors. Approved planned content uses a blockquote whose first inline is bold `Planned`; the source remains readable in ordinary Markdown and becomes a labeled `Planned` PDF box. Escape literal currency dollar signs where ambiguous. Treat full LaTeX examples as fenced code. Inline code and code blocks keep any Unicode text, including Czech and other non-Latin-1 letters; code blocks wrap long lines, and fenced blocks with a language are syntax highlighted without line numbers. Arrows, box drawing, geometric shapes, and check marks that the theme fonts lack come from DejaVu Sans (text) or DejaVu Sans Mono (code). Emoji have no font in the renderer: write statuses and warnings as text.

Authored pages cannot emit raw TeX or raw attributes. Math accepts a small allow list of TeX commands (basic commands such as fractions, roots, sums, Greek letters, `\text`, `\mathrm`, `\operatorname`) and rejects every other command and control sequence; `validate` reports the file and the command. Callouts always retain visible text labels and must not rely on color alone; the current `tcolorbox` dependency is only partially compatible with tagged PDF, so do not infer PDF/UA conformance from these boxes.

Mermaid diagrams are rendered by Merman, an independent compatibility implementation rather than Mermaid itself: when a guide uses an unusual diagram type or advanced syntax, check the rendered page.

## Branding and templates

The configurable default supports product and guide titles, subtitle/revision metadata, logo, semantic colors, paper size, margins, headers/footers, copyright/contact text, fonts available in the image, and project-local fonts declared through `pdf.font_dirs`. The eSoul preset carries publisher identity separately from the optional client identity, uses the project logo on the title page and running-page headers, and embeds its licensed Poppins and Syne fonts plus vector publisher marks from the renderer image. A project may select a fully custom Pandoc/LaTeX template. Custom templates are project-owned, excluded from managed upgrades, and subject to the same build and visual gates.

## Revisions and versions

Each build records UTC generation time, Git commit, and latest reachable tag when available. `documentation_version` in `docs/documentation.toml` is optional; the bump rule (patch, minor, major, approval-gated) is in [workflow.md](workflow.md) (Refresh).

## Accessibility and privacy

Mechanical validation checks basic heading structure, image alt text, descriptive links, local paths, likely secrets, and real-looking emails. These checks are incomplete; semantic review still assesses context, non-color-only meaning, table comprehension, diagram contrast, and sensitive operational data. Do not claim PDF/UA conformance without a future proven validator.

## Tool lifecycle

The documentation tool distribution is separate from this skill. Treat `docs/documentation` as the stable project interface and project-owned `docs/documentation.toml` as the configuration boundary. Do not depend on the skill installation path for renderer binaries, Lua filters, Dockerfiles, release data, or upgrade scripts.

Run `docs/documentation doctor` before changing profiles or diagnosing a hosted renderer; it reports the installed version and profile, managed-file drift, configuration validity, the configured renderer digest, Docker and registry readiness and legacy theme settings. Git tags and their GitHub Release manifests are authoritative for installation and upgrades.

Tool installation and managed upgrades are explicit operations performed through the separately distributed tooling ([setup.md](setup.md)). Preserve project configuration, sources, specifications, decisions, and approved assets. Never replace locally modified managed files without a reviewed plan and explicit approval.
