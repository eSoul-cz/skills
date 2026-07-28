# PDF Pipeline

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
  pdf/                           # generated, ignored by default
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

All four operational commands use Docker; the host needs only a POSIX shell, Docker, and optionally Git for ignore-rule and revision checks. The shell wrapper reads only the small set of scalar TOML values required to select/build the renderer image and mount its dedicated writable directories. The Go binary owns configuration, Markdown, publication-policy, build, render, and redaction behavior inside the image. `validate` runs with the entire checkout read-only. `build`, `render`, and `redact` additionally mount only the configured PDF and work directories read-write.

The multi-stage Dockerfile compiles the container renderer as a static Go binary and Merman as a native Rust binary. The final image contains those binaries, the checked-in Lua filters, Pandoc/Eisvogel, XeLaTeX, ImageMagick, librsvg, Poppler, the configured fonts, and the package-managed runtime dependencies required by that toolchain; it does not contain project Python scripts, Node.js, Chromium, Puppeteer, npm, Cargo, either compiler toolchain, or the Go/Rust source trees. `build` validates, renders every guide, runs PDF structural checks, extracts text, and renders every page to PNG under the work directory. Each build fully recreates its rendered-page and review-output directories so stale files and symlinks cannot survive between runs.

Validation and rendering share Pandoc's Markdown reader. The Go validator inspects Pandoc JSON ASTs for structural links, images, headings, and anchors, while source-text policy checks cover Mermaid alternatives, raw LaTeX, likely secrets, and privacy-sensitive addresses. A checked-in source Lua filter then normalizes local images and links, renders Mermaid blocks, and converts semantic callouts. The Go renderer combines the filtered ASTs and a final Lua filter emits only trusted renderer-owned LaTeX. The pipeline supports inline, reference, collapsed-reference, shortcut-reference, and raw HTML `img` image forms plus inline and reference-style links; paths in angle brackets; balanced or escaped parentheses; and LF or CRLF input. Local percent-encoded paths are decoded before filesystem resolution, remote and embedded images are rejected again during rendering, and non-Markdown file queries and fragments survive PDF rewriting.

Published images must be local project files. Validation and PDF normalization reject remote URLs, including protocol-relative targets, embedded data URIs, and HTML `srcset`; validation also rejects missing paths and paths that escape the project. Raw HTML `src` values are HTML-decoded exactly once. Raster images require a normalized project-relative screenshot-manifest entry and publication approval.

PDF-local anchors follow Pandoc identifiers: Unicode letters and diacritics are normalized and case-folded, underscores and periods are preserved, spaces become hyphens, and unsupported punctuation is removed.

## Configuration

Use the bundled `documentation.toml` template. Define ordered `sources` arrays in each `[[guides]]` block. Project-owned settings include branding, paths, language, theme, custom template/header, landscape source pages, documentation version, output tracking, privacy allowlists, and local/remote Docker mode.

`pdf.theme` selects a built-in preset:

- `default` preserves the existing neutral Noto Sans layout.
- `esoul` uses the eSoul client-document design: Poppins body text, Syne headings, grayscale semantic colors and callouts, the compact eSoul title page, client-aware header and publisher footer chrome, and vector logos.

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

Font directories are resolved relative to the project root, may contain nested directories, and must contain at least one supported font. Missing directories, files used in place of directories, empty font directories, and symbolic-link escapes fail validation. The renderer generates a guide-local Fontconfig file in the work directory and exposes it only to XeLaTeX; the checkout and font files remain read-only in both local and hosted modes. Font family names come from font metadata rather than filenames, so inspect unfamiliar files with `fc-scan` when configuration and filenames differ. Commit only fonts whose redistribution licence permits inclusion in the project.

For eSoul client documents, `[project].name` and `[project].logo` define the optional client identity. The eSoul publisher mark remains on the title page and its compact wordmark remains in the footer. When configured, the client logo appears prominently at the upper right of the title page and replaces the eSoul mark in running-page headers; without a client logo, the eSoul header mark remains as the fallback. Each guide may add `document_version`, `document_date`, and `classification`; populated values appear in a compact metadata panel below the document title. All fields are optional, guide-level versions take precedence over the top-level `documentation_version`, and absent values do not leave empty labels or placeholder panels. Metadata labels are English by default and Czech when `primary_language` is `cs` or starts with `cs-`.

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

Local mode builds the repository-local multi-stage Dockerfile. One stage downloads the pinned Go module graph, runs the Go tests and vet checks, and compiles the renderer with `CGO_ENABLED=0`; another uses the pinned Rust toolchain to compile the pinned Merman CLI; the final runtime receives only the compiled binaries and required runtime assets. The build is native on linux/amd64 and linux/arm64 and executes the end-to-end renderer smoke fixture before producing the final stage. Merman performs browserless Mermaid parsing, layout, and tightly fitted vector-PDF rendering, while the Lua filter preserves the existing Mermaid-fence authoring contract and text-alternative requirement. The filter emits a semantic Pandoc figure whose `diagram-alt` text is both the image alternative and the visible, sequentially numbered caption. Producing PDF directly keeps diagram geometry and labels vector and avoids relying on downstream SVG support for HTML `foreignObject` labels. Pandoc is sourced from its pinned multi-architecture core image, while the architecture-independent Eisvogel template is copied from its pinned image. Remote mode requires an immutable image reference such as `registry.example/docs@sha256:...` and an exact match in `DOCUMENTATION_REMOTE_RENDERER_IMAGE` supplied by trusted runtime configuration outside the repository. Standard Docker tooling owns registry authentication.

Renderer containers run without network access, with a read-only root filesystem and checkout, all capabilities dropped, `no-new-privileges`, bounded processes, and bounded disposable scratch mounts. Only dedicated configured output/work directories are writable; the project root and `.git` paths are rejected. Guide IDs accept only ASCII letters, digits, underscores, and hyphens, and every generated directory is constrained to its work root. Merman needs no browser sandbox exception because it parses, lays out, and renders diagrams inside its native process.

## Markdown contract

Use GitHub-readable Markdown with footnotes, GitHub alert callouts, Mermaid fences, and TeX math delimiters. Standard Pandoc footnote syntax supports inline content, repeated references, multiple paragraphs, links, emphasis, code, and Unicode text; keep each definition in the same guide as its reference. `$...$` and `$$...$$` render on GitHub and through Pandoc. Standard `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION` alerts become labeled, page-breakable PDF boxes using the selected theme's semantic colors. Approved planned content uses a blockquote whose first inline is bold `Planned`; the source remains readable in ordinary Markdown and becomes a labeled `Planned` PDF box. Escape literal currency dollar signs where ambiguous. Treat full LaTeX examples as fenced code. Merman is an independent compatibility implementation rather than Mermaid itself; before adopting a new diagram family or advanced syntax, add it to the renderer fixtures and verify its PDF output with the pinned version.

Authored pages cannot emit raw TeX or raw attributes. Rendering happens from an isolated staging directory containing only permitted generated ASTs, metadata, normalized images, diagrams, and internal maps. Tokenized Lua filters create the renderer-owned page-break, landscape, and callout blocks. Math accepts a small TeX command allowlist and rejects other control sequences, including TeX `^^` escapes. Callouts always retain visible text labels and must not rely on color alone; the current `tcolorbox` dependency is only partially compatible with tagged PDF, so do not infer PDF/UA conformance from these boxes.

## Branding and templates

The configurable default supports product and guide titles, subtitle/revision metadata, logo, semantic colors, paper size, margins, headers/footers, copyright/contact text, fonts available in the image, and project-local fonts declared through `pdf.font_dirs`. The eSoul preset carries publisher identity separately from the optional client identity, uses the project logo on the title page and running-page headers, and embeds its licensed Poppins and Syne fonts plus vector publisher marks from the renderer image. A project may select a fully custom Pandoc/LaTeX template. Custom templates are project-owned, excluded from managed upgrades, and subject to the same build and visual gates.

## Revisions and versions

Each build records UTC generation time, Git commit, and latest reachable tag when available. An optional documentation version uses approval-gated semantic versioning:

- Patch: corrections, clarifications, screenshots, or formatting.
- Minor: new workflows, features, roles, or substantial chapters.
- Major: materially incompatible audience or scope changes.

## Accessibility and privacy

Mechanical validation checks basic heading structure, image alt text, descriptive links, local paths, likely secrets, and real-looking emails. These checks are incomplete; semantic review still assesses context, non-color-only meaning, table comprehension, diagram contrast, and sensitive operational data. Do not claim PDF/UA conformance without a future proven validator.

## Tool upgrades

The Docker-built static Go installer records a semantic tool version, installation profile, and SHA-256 checksums for managed files. The host-side entrypoint needs only a POSIX shell and Docker. Bundled assets are always mounted read-only; `--check` also mounts the selected project read-only, while install and explicit upgrade mount only that project root read-write. `--check` reports drift and compares versions without calling a newer installed version an available update. `--upgrade` requires explicit invocation, aborts when managed files were locally modified, and refuses to downgrade a project whose managed version is newer than the bundle. Preserve project configuration, sources, specifications, decisions, and approved assets.

The installer retains its local-profile default for backwards compatibility, but normal project installations should use the explicit `--remote` profile. It installs only `docs/documentation`, the managed version and manifest, the release-catalog command and records, and the default PDF header. Before migrating with `--upgrade --remote`, resolve a cataloged release, configure `pdf.mode = "remote"`, and set `pdf.image` to its immutable digest; supply that same value independently as `DOCUMENTATION_REMOTE_RENDERER_IMAGE` when invoking the wrapper. Reserve `--upgrade --local` for renderer development or emergency recovery; an upgrade without either profile flag preserves an existing remote installation.

`docs/documentation doctor` is read-only. It reports the installed version/profile, managed-file drift, latest catalog release, configuration-schema compatibility, configured digest, Docker readiness, private-registry manifest access, legacy flat theme settings, and trusted allowlist status. A catalog match never authorizes execution by itself: remote validation and rendering continue to require an exact external `DOCUMENTATION_REMOTE_RENDERER_IMAGE` match.

Before releasing a bundled tool version, run `scripts/test_renderer_smoke`. It builds the Docker image and verifies the default and eSoul presets, populated and minimal client-title-page states, a project-local font absent from the runtime image, complex footnotes and link notices, semantic callouts and tables, embedded Poppins/Syne fonts, visible sequential Mermaid captions, and vector-only diagrams and combined PDFs. The same gate renders a dedicated showcase containing typography, lists, quotations, code, math, complex footnotes, every semantic callout, tables, project-local vector images, multiple Mermaid diagrams, and landscape content under both built-in themes.

The showcase is also the visual-regression contract. Reviewed 96 DPI baselines cover every page under `testdata/smoke/visual-baselines`; the smoke image rejects page-count or dimension changes and pages whose changed pixels exceed the documented antialiasing allowance. Treat baseline updates as reviewed release artifacts: inspect every page and commit the source change, replacement baseline, and rationale together.
