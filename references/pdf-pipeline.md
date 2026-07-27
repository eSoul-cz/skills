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
docs/documentation version
```

All four operational commands use Docker; the host needs only a POSIX shell, Docker, and optionally Git for ignore-rule and revision checks. The shell wrapper reads only the small set of scalar TOML values required to select/build the renderer image and mount its dedicated writable directories. The Go binary owns configuration, Markdown, publication-policy, build, render, and redaction behavior inside the image. `validate` runs with the entire checkout read-only. `build`, `render`, and `redact` additionally mount only the configured PDF and work directories read-write.

The multi-stage Dockerfile compiles the container renderer as a static Go binary and Merman as a native Rust binary. The final image contains those binaries, the checked-in Lua filters, Pandoc/Eisvogel, XeLaTeX, ImageMagick, librsvg, Poppler, and the configured fonts; it does not expose a Python interpreter and does not contain Node.js, Chromium, Puppeteer, npm, Cargo, either compiler toolchain, or the Go/Rust source trees. `build` validates, renders every guide, runs PDF structural checks, extracts text, and renders every page to PNG under the work directory. Each build fully recreates its rendered-page and review-output directories so stale files and symlinks cannot survive between runs.

Validation and rendering share Pandoc's Markdown reader. The Go validator inspects Pandoc JSON ASTs for structural links, images, headings, and anchors, while source-text policy checks cover Mermaid alternatives, raw LaTeX, likely secrets, and privacy-sensitive addresses. A checked-in source Lua filter then normalizes local images and links, renders Mermaid blocks, and converts semantic callouts. The Go renderer combines the filtered ASTs and a final Lua filter emits only trusted renderer-owned LaTeX. The pipeline supports inline, reference, collapsed-reference, shortcut-reference, and raw HTML `img` image forms plus inline and reference-style links; paths in angle brackets; balanced or escaped parentheses; and LF or CRLF input. Local percent-encoded paths are decoded before filesystem resolution, remote and embedded images are rejected again during rendering, and non-Markdown file queries and fragments survive PDF rewriting.

Published images must be local project files. Validation and PDF normalization reject remote URLs, including protocol-relative targets, embedded data URIs, and HTML `srcset`; validation also rejects missing paths and paths that escape the project. Raw HTML `src` values are HTML-decoded exactly once. Raster images require a normalized project-relative screenshot-manifest entry and publication approval.

PDF-local anchors follow Pandoc identifiers: Unicode letters and diacritics are normalized and case-folded, underscores and periods are preserved, spaces become hyphens, and unsupported punctuation is removed.

## Configuration

Use the bundled `documentation.toml` template. Define ordered `sources` arrays in each `[[guides]]` block. Project-owned settings include branding, paths, language, paper, fonts, custom template/header, landscape source pages, documentation version, output tracking, privacy allowlists, and local/remote Docker mode.

Local mode builds the repository-local multi-stage Dockerfile. One stage downloads the pinned Go module graph and compiles the renderer with `CGO_ENABLED=0`; another uses the pinned Rust toolchain to compile the pinned Merman CLI; the final runtime receives only the compiled binaries and required runtime assets. Merman performs browserless Mermaid parsing, layout, and tightly fitted vector-PDF rendering, while the Lua filter preserves the existing Mermaid-fence authoring contract and text-alternative requirement. Producing PDF directly keeps diagram geometry and labels vector and avoids relying on downstream SVG support for HTML `foreignObject` labels. Pandoc and Eisvogel come from the same pinned image stage so their versions remain compatible. The initial template uses `platform = "linux/amd64"` because that stage is not multi-architecture; Docker Desktop/OrbStack can emulate it on ARM hosts. Remote mode requires an immutable image reference such as `registry.example/docs@sha256:...` and an exact match in `DOCUMENTATION_REMOTE_RENDERER_IMAGE` supplied by trusted runtime configuration outside the repository. Standard Docker tooling owns registry authentication. A future multi-architecture image may select its native platform.

Renderer containers run without network access, with a read-only root filesystem and checkout, all capabilities dropped, `no-new-privileges`, bounded processes, and bounded disposable scratch mounts. Only dedicated configured output/work directories are writable; the project root and `.git` paths are rejected. Guide IDs accept only ASCII letters, digits, underscores, and hyphens, and every generated directory is constrained to its work root. Merman needs no browser sandbox exception because it parses, lays out, and renders diagrams inside its native process.

## Markdown contract

Use GitHub-readable Markdown with footnotes, GitHub alert callouts, Mermaid fences, and TeX math delimiters. `$...$` and `$$...$$` render on GitHub and through Pandoc. Standard `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION` alerts become labeled, page-breakable PDF boxes. Approved planned content uses a blockquote whose first inline is bold `Planned`; the source remains readable in ordinary Markdown and becomes a labeled `Planned` PDF box. Escape literal currency dollar signs where ambiguous. Treat full LaTeX examples as fenced code. Merman is an independent compatibility implementation rather than Mermaid itself; before adopting a new diagram family or advanced syntax, add it to the renderer fixtures and verify its PDF output with the pinned version.

Authored pages cannot emit raw TeX or raw attributes. Rendering happens from an isolated staging directory containing only permitted generated ASTs, metadata, normalized images, diagrams, and internal maps. Tokenized Lua filters create the renderer-owned page-break, landscape, and callout blocks. Math accepts a small TeX command allowlist and rejects other control sequences, including TeX `^^` escapes. Callouts always retain visible text labels and must not rely on color alone; the current `tcolorbox` dependency is only partially compatible with tagged PDF, so do not infer PDF/UA conformance from these boxes.

## Branding and templates

The configurable default supports product and guide titles, subtitle/revision metadata, logo, accent color, paper size, headers/footers, copyright/contact text, and fonts available in the image. A project may select a fully custom Pandoc/LaTeX template. Custom templates are project-owned, excluded from managed upgrades, and subject to the same build and visual gates.

## Revisions and versions

Each build records UTC generation time, Git commit, and latest reachable tag when available. An optional documentation version uses approval-gated semantic versioning:

- Patch: corrections, clarifications, screenshots, or formatting.
- Minor: new workflows, features, roles, or substantial chapters.
- Major: materially incompatible audience or scope changes.

## Accessibility and privacy

Mechanical validation checks basic heading structure, image alt text, descriptive links, local paths, likely secrets, and real-looking emails. These checks are incomplete; semantic review still assesses context, non-color-only meaning, table comprehension, diagram contrast, and sensitive operational data. Do not claim PDF/UA conformance without a future proven validator.

## Tool upgrades

The installer records a semantic tool version and SHA-256 checksums for managed files. `--check` reports drift and compares versions without calling a newer installed version an available update. `--upgrade` requires explicit invocation, aborts when managed files were locally modified, and refuses to downgrade a project whose managed version is newer than the bundle. Preserve project configuration, sources, specifications, decisions, and approved assets.
