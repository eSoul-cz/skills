# Documentation tool: maintainer guide

The documentation tool is what the `esoul-docs` skill calls when a project builds PDFs: the `docs/documentation` command, a Go renderer in a Docker image, and an installer. This is the one document for how the tool works inside, how to change it and how to release it. Users of the tool read the skill (`skills/dev/esoul-docs`), not this file. Release notes live in [CHANGELOG.md](CHANGELOG.md).

## Layout

| Path | What it is |
|---|---|
| `tooling/project-tools/docs/documentation` | The Bash wrapper installed into projects as `docs/documentation` (the stable interface). |
| `tooling/project-tools/docs/.documentation-tools/` | Managed tooling installed into projects: `VERSION` (placeholder `0.0.0`, stamped from the tag), `pdf/` with the Dockerfile, the Go renderer (`cmd/documentation-renderer/`: `main.go`, `validation.go`, `math.go`, `theme.go`, `fonts.go`), Lua filters (`filters/source.lua`, `filters/render.lua`), `header.tex`, themes, bundled eSoul fonts and the smoke fixtures (`testdata/smoke/`). |
| `tooling/project-templates/docs/documentation.toml` | The starter configuration; created in a project only when missing, never overwritten. |
| `tooling/install-project-tools/` | The Go installer (managed-file manifest, profiles, upgrade plan and apply, rollback) and its Dockerfile. |
| `tooling/scripts/` | `test_tooling_version`, `test_bootstrap_manifest`, `test_documentation_wrapper`, `test_renderer_smoke`, `test_bootstrap_install`; `tooling_version`, `install_project_tools` (developer wrapper with `--check`, `--upgrade`, `--local`, `--remote`) and `upgrade_project_tools` (project migration). |
| `install.sh` (repository root) | The bootstrap that users run; resolves a release and pulls the digest-pinned installer. |

## How the renderer works

**Wrapper and renderer.** The wrapper needs a POSIX shell and Docker on the host (Git is optional, for ignore-rule and revision checks). It reads only the few scalar TOML values it needs to pick or build the renderer image and to mount the dedicated writable directories. The Go binary inside the image owns configuration, Markdown, publication policy, build, render and redaction. `validate` runs with the whole checkout read-only; `build`, `render` and `redact` mount only the configured PDF and work directories read-write. `doctor` and `version` run on the host without Docker; `doctor` reports a missing Docker as a diagnostic.

**Image.** The multi-stage Dockerfile compiles the renderer as a static Go binary (`CGO_ENABLED=0`, after `go test` and `go vet`) and the pinned Merman CLI as a native Rust binary. The final image holds those binaries, the Lua filters, Pandoc and Eisvogel, XeLaTeX, ImageMagick, librsvg, Poppler, the bundled fonts and the runtime packages of that toolchain. It holds no project scripts, Node.js, Chromium, Puppeteer, npm, Cargo, compiler toolchain or source trees. Pandoc comes from its pinned multi-architecture core image; the architecture-independent Eisvogel template comes from its pinned image. The build is native on linux/amd64 and linux/arm64 and runs the smoke fixture before producing the final stage.

**Pipeline.** `build` validates, renders every guide, runs structural PDF checks, extracts text and renders every page to PNG under the work directory; each build recreates its rendered-page and review-output directories, so stale files and symlinks cannot survive. Validation and rendering share Pandoc's Markdown reader. The validator inspects Pandoc JSON ASTs for links, images, headings, anchors and math, and runs source-text checks for Mermaid alternatives, raw LaTeX, likely secrets and privacy-sensitive addresses. The source Lua filter normalizes local images and links, renders Mermaid blocks and converts callouts; the Go renderer combines the filtered ASTs and a final Lua filter (`render.lua`) emits only trusted renderer-owned LaTeX. Supported: inline, reference, collapsed-reference, shortcut-reference and raw HTML `img` image forms; inline and reference links; angle-bracket paths; balanced or escaped parentheses; LF and CRLF input. Local percent-encoded paths are decoded before filesystem resolution, remote and embedded images are rejected again during rendering, and queries and fragments of non-Markdown links survive. Raw HTML `src` values are HTML-decoded exactly once. PDF-local anchors follow Pandoc identifiers (Unicode letters normalized and case-folded, underscores and periods kept, spaces to hyphens, other punctuation removed).

**Isolation.** Renderer containers run without network, with a read-only root filesystem and checkout, all capabilities dropped, `no-new-privileges`, bounded processes and bounded scratch mounts. Only the dedicated output and work directories are writable; the project root and `.git` are rejected. Guide IDs accept only ASCII letters, digits, underscores and hyphens, and every generated directory is constrained to its work root. Authored pages cannot emit raw TeX or raw attributes: rendering happens from a staging directory with only permitted generated ASTs, metadata, normalized images, diagrams and internal maps, and tokenized Lua filters create the renderer-owned page-break, landscape and callout blocks.

**Math.** `render.lua` accepts a small command allow list and rejects every other control sequence, including `^^` escapes. `validate` applies the same rules (`math.go`) so a bad formula fails with the file name instead of late in `build`. The list exists twice (`allowed_math_commands` in `render.lua`, `allowedMathCommands` in `math.go`); `TestMathAllowListMatchesRenderFilter` fails when they differ, so change both together.

**Mermaid.** Merman does browserless parsing, layout and tightly fitted vector-PDF rendering; the filter keeps the Mermaid-fence authoring contract and emits a Pandoc figure whose `diagram-alt` text is both the image alternative and the numbered caption. Producing PDF directly keeps diagrams vector and avoids relying on SVG `foreignObject` support. Merman is an independent compatibility implementation, not Mermaid: before supporting a new diagram family or syntax, add it to the smoke fixtures and check the PDF with the pinned version.

**Themes, fonts, language.** Theme presets and typed overrides are resolved in `theme.go`; the starter `documentation.toml` lists the keys. The renderer writes a guide-local Fontconfig file in the work directory and exposes it only to XeLaTeX; project font directories are validated (no missing or empty directories, no symlink escapes). Fonts the theme lacks (arrows, box drawing, check marks) come from DejaVu; emoji have no font. Each guide's `lang` metadata and the Czech cover labels follow the guide's `language`, which falls back to `primary_language` (`guideLanguage` in `main.go`). Callouts keep visible text labels; the `tcolorbox` dependency is only partly compatible with tagged PDF, so do not claim PDF/UA conformance.

**Local and remote mode.** Local mode builds the repository-local Dockerfile (renderer development and emergency recovery only). Remote mode, the normal installation target, needs an immutable image reference (`registry.example/docs@sha256:...`) and an exact trusted match from `DOCUMENTATION_REMOTE_RENDERER_IMAGE` or the untracked local Git setting `documentation.remoteRendererImage` written by the bootstrap. Docker tooling owns registry authentication.

**`commit_pdf_outputs`.** The default is `false`. `true` prints a notice and skips the "PDF output directory is not ignored" check; nothing else changes. Generated PDFs are build artifacts and are not committed (guideline `documentation.md`, Generated documentation).

## Profiles, installation and upgrade

Installation without an explicit version follows GitHub's latest published release; an explicit install or upgrade selects the matching semantic tag. The installer image holds the static installer, the starter configuration and only the remote managed-file profile; it excludes renderer source, local Docker build inputs, fonts, visual fixtures and release-discovery state. The renderer image keeps project configuration and authored documentation outside the runtime.

`tooling/scripts/upgrade_project_tools /absolute/project/root` previews migration to the latest release (`--to VERSION` selects a tag): it downloads that release's `release.env`, pulls the digest-pinned installer, reuses the installer's drift, collision, downgrade, profile and schema checks, mounts the project read-only and prints the exact `pdf.mode`, `pdf.image`, managed-file and `DOCUMENTATION_REMOTE_RENDERER_IMAGE` changes without applying them. `--apply` migrates managed files atomically and rewrites only `pdf.mode` and `pdf.image`; it validates manifest, checksums, retired-file set and configuration before committing and restores the previous state on any failure. It prints, but does not install, the `DOCUMENTATION_REMOTE_RENDERER_IMAGE` value. After commit it records the renderer digest in local Git configuration when available and runs `docs/documentation doctor`; a doctor failure returns nonzero but keeps the validated transaction (Docker, registry or network trouble must not cause consistent project files to be rewritten). The remote profile retires the project-local Dockerfile, Go source, Lua filters, dependency manifests, fixtures and old catalog files, and keeps the wrapper, version marker, default header and manifest.

## Tests

| Command | Covers | Needs |
|---|---|---|
| `go test ./... && go vet ./...` in `tooling/project-tools/docs/.documentation-tools/pdf` | Renderer: validation, math, language, redaction (the pixel test skips without ImageMagick), themes, fonts, packaging rules. | Go |
| `DOCUMENTATION_REPOSITORY_ROOT=<repository root> go test ./... && go vet ./...` in `tooling/install-project-tools` | Installer: install, upgrade, rollback, drift, remote plan and apply, doctor. | Go |
| `tooling/scripts/test_tooling_version`, `test_bootstrap_manifest`, `test_documentation_wrapper` | Version resolution, release-manifest bootstrap, wrapper behaviour with a fake Docker. | POSIX shell, Git |
| `tooling/scripts/test_renderer_smoke` | Docker build of the renderer image (runs the Go tests inside), all smoke configurations, visual regression. | Docker, network |
| `tooling/scripts/test_bootstrap_install` | Bootstrap against a local release fixture. | Docker, network |

Jenkins runs all of them in the `Verify tooling` stage. Docker builds of the renderer take about 13 minutes on a tag build.

## Changing the tool

- A new configuration key: struct field in `main.go`, validation in `validation.go`, the commented starter in `project-templates/docs/documentation.toml`, a test, a line in [CHANGELOG.md](CHANGELOG.md), and, when authors must act on it, the skill's `references/pdf-pipeline.md`. Existing projects keep their own `documentation.toml`, so a template change reaches only new installs; a validation or renderer change reaches projects through the new image.
- User-visible messages stay short and say what to do. A rule that a guideline owns is pointed at, not restated.
- Changing `CONFIG_SCHEMA_VERSION` means a configuration migration: update `Jenkinsfile`, `install.sh` and `validation.go` together and add upgrade handling.
- Every user-visible change adds a bullet under `## Unreleased` in [CHANGELOG.md](CHANGELOG.md) in the same commit (guideline `documentation.md`, changelog rule).

## Release procedure

A release is a semantic Git tag `x.y.z` on a green master commit. The tag and its immutable GitHub Release are the durable authority; the signed `release.env` asset records the source commit, the required configuration schema, the immutable renderer and installer image digests and the URLs of their supply-chain artifacts. A `plugin-x.y.z` tag releases the agent plugin only and does not publish the tool.

**Release notes.** [CHANGELOG.md](CHANGELOG.md) is the single source. Keep a Changelog layout: `## Unreleased` on top, released versions as `## x.y.z - YYYY-MM-DD` below it, bullets under `### Added`, `### Changed`, `### Fixed`, `### Removed`. Jenkins reads the section of the tag version as the release notes (`UPGRADE_NOTES` in `release.env`) with `tooling/scripts/release_notes.mjs <x.y.z>`, which prints the section as the one printable-ASCII line of at most 1024 characters that the release metadata accepts and fails the tag build when the section is missing, empty, too long or not ASCII; the Jenkinsfile carries no release text. Run the script on the section before tagging. To release: rename `## Unreleased` to `## x.y.z - <date>`, add a fresh empty `## Unreleased`, commit, merge, then tag.

**Pipeline** (root `Jenkinsfile`, tag build on a general node with a 120-minute limit):

1. run the Docker-first renderer, visual-regression and bootstrap-installer tests;
2. require the semantic version to be an existing Git tag on the build commit before publication starts (`requireExistingTag: true`; push the tag before the tag build);
3. build native linux/amd64 and linux/arm64 images with BuildKit SPDX and maximum provenance attestations through the `dockerHelpers` shared library; the builds run the Go tests, vet and the complete smoke fixture;
4. publish or reuse an attested renderer and installer independently, so a retry can complete a partial release, tagged with the version and `latest` in the public `rg.fr-par.scw.cloud/esoul-internal-tools` registry (`documentation-tools`, `documentation-tools-installer`);
5. resolve both merged manifest digests, generate standalone SPDX, provenance and Trivy reports, sign and verify images and reports with Cosign, and publish the exact artifact set as a GitHub Release (`install.sh` with the injected tag, `release.env` with `CONFIG_SCHEMA_VERSION`);
6. archive the fingerprinted artifacts in Jenkins; the GitHub Release stays the public authority.

Supply-chain publication uses portable GitHub-hosted Sigstore bundles, so signatures do not depend on Scaleway supporting OCI Referrers. Jenkins needs the exact pinned Cosign, Syft, GitHub CLI and Trivy versions the `dockerHelpers` library requires, a repository-scoped GitHub release token and an encrypted Cosign key and password. Release publication is resumable: matching draft assets are verified and reused, incomplete drafts stay unpublished, and an already-published release is accepted only when tag, commit, images, checksums, public key and signatures match exactly. Open organizational task: a vulnerability-remediation policy for the Trivy reports.

**Version-bearing places** (checked, none edited by hand): `VERSION` stays `0.0.0` and is stamped from the tag (Jenkinsfile, installer Dockerfile); the marker `DOCUMENTATION_BOOTSTRAP_RELEASE_TAG=0.0.0` in `install.sh` is rewritten by Jenkins; `CONFIG_SCHEMA_VERSION` changes only with a schema change; the installer's expected-version check compares the bundled `VERSION` with `release.env`; test fixtures use arbitrary versions such as `0.6.0` and `0.6.1`. `tooling_version` fails when two semantic tags point at HEAD.

**Checklist**

1. `## Unreleased` in [CHANGELOG.md](CHANGELOG.md) describes every user-visible change since the last tag; rename it and open a new one.
2. `go test`, `go vet` and `gofmt -l` clean in both Go modules; the five scripts in `tooling/scripts` pass; the master build is green (it includes the Docker smoke build).
3. The pinned Go and Rust builder versions and the multi-architecture image digests were reviewed (`Dockerfile`).
4. Exactly one semantic tag on HEAD; push the tag, then run the tag build.
5. After the build: both images carry the version and `latest`; the GitHub Release has `install.sh` with the tag and `release.env` with the schema; Cosign signatures, SBOM and the Trivy report are attached.
6. Run `tooling/scripts/upgrade_project_tools <root>` (preview), then `--apply`, on one real project, then `docs/documentation doctor` and `docs/documentation validate`; check a changed warning or notice against its CHANGELOG entry.
7. Not part of a tool release: plugin version and `plugin-*` tags, skill text (the skill and the tool release independently; the skill's text is correct once the new image is installed).

`tooling/scripts/install_project_tools <root> --upgrade --local` is a renderer-development and emergency-recovery path only; local-versus-hosted output equivalence is not a release gate.
