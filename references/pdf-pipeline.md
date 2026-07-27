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

`validate` requires Python 3.11+ but not Docker. `build`, `render`, and `redact` use Docker. `build` validates, renders every guide, runs PDF structural checks, extracts text, and renders every page to PNG under the work directory. Each build fully recreates its rendered-page and review-output directories so stale files and symlinks cannot survive between runs.

Validation and rendering share one structural Markdown parser module for images and links. It supports inline, reference, collapsed-reference, shortcut-reference, and raw HTML `img` image forms plus inline and reference-style links; paths in angle brackets; balanced or escaped parentheses; and LF or CRLF input. It ignores Markdown-looking examples inside code, comments, and raw HTML attributes. Local percent-encoded paths are decoded before filesystem resolution, URL-escaped anchors are normalized, malformed URLs become explicit validation errors, and non-Markdown file queries and fragments survive PDF rewriting.

Published images must be local project files. Validation and PDF normalization reject remote URLs, including protocol-relative targets, embedded data URIs, and HTML `srcset`; validation also rejects missing paths and paths that escape the project. Raw HTML `src` values are HTML-decoded exactly once. Raster images require a normalized project-relative screenshot-manifest entry and publication approval.

PDF-local anchors follow Pandoc identifiers: Unicode letters and diacritics are normalized and case-folded, underscores and periods are preserved, spaces become hyphens, and unsupported punctuation is removed.

## Configuration

Use the bundled `documentation.toml` template. Define ordered `sources` arrays in each `[[guides]]` block. Project-owned settings include branding, paths, language, paper, fonts, custom template/header, landscape source pages, documentation version, output tracking, privacy allowlists, and local/remote Docker mode.

Local mode builds the repository-local Dockerfile. Pandoc and Eisvogel come from the same pinned image stage so their versions remain compatible. The initial template uses `platform = "linux/amd64"` because that stage is not multi-architecture; Docker Desktop/OrbStack can emulate it on ARM hosts. Remote mode requires an immutable image reference such as `registry.example/docs@sha256:...` and an exact match in `DOCUMENTATION_REMOTE_RENDERER_IMAGE` supplied by trusted runtime configuration outside the repository. Standard Docker tooling owns registry authentication. A future multi-architecture image may select its native platform.

Renderer containers run without network access, with a read-only root filesystem and checkout, all capabilities dropped, `no-new-privileges`, bounded processes, and bounded disposable scratch mounts. Only dedicated configured output/work directories are writable; the project root and `.git` paths are rejected. Guide IDs accept only ASCII letters, digits, underscores, and hyphens, and every generated directory is constrained to its work root. Chromium's namespace sandbox is unavailable under Docker's default capability boundary, so the bundled Puppeteer configuration retains `--no-sandbox` inside this restricted outer container instead of broadening container privileges. Revisit this choice when the renderer runtime or container boundary changes.

## Markdown contract

Use GitHub-readable Markdown with Mermaid fences and TeX math delimiters. `$...$` and `$$...$$` render on GitHub and through Pandoc. Escape literal currency dollar signs where ambiguous. Treat full LaTeX examples as fenced code.

Authored pages cannot emit raw TeX or raw attributes. Rendering happens from an isolated staging directory containing only permitted generated inputs and local assets. A tokenized Lua filter creates the renderer-owned page-break and landscape blocks. Math accepts a small TeX command allowlist and rejects other control sequences, including TeX `^^` escapes.

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
