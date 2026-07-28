---
name: esoul-maintain-application-documentation
description: Create, refresh, verify, review, and render application documentation as audience-specific Markdown and reproducible PDFs. Use for application user guides, developer or operator guides, documentation specifications, screenshot plans and redaction, documentation correctness or completeness reviews, branded client documents, and documentation CI integration. Supports create, refresh, and read-only verify modes.
---

# Maintain Application Documentation

Produce evidence-backed application documentation through a stable project command. This skill contains authoring guidance and starter documents; the Go, Lua, Docker, renderer, installer, and release implementation is distributed separately through public Scaleway images.

## Start Every Run

1. Read [workflow.md](references/workflow.md) completely.
2. Select `create`, `refresh`, or `verify`. Ask only when the request truly does not imply a mode.
3. Inspect the repository before asking questions that the codebase can answer.
4. Read existing `CONTEXT.md` or `CONTEXT-MAP.md`, documentation configuration, specification, decision log, guides, and project instructions.
5. Announce this skill and every other skill activated by the repository or task.

## Use Specification-First Authoring

For `create`, run `$grill-with-docs` when it is available and specify the documentation one question at a time. Otherwise, perform the same approval-gated interview directly. Maintain consistent domain language. Create `docs/documentation-spec.md` and `docs/documentation-decisions.md` from the bundled templates. Require explicit approval of the specification before substantial authoring or screenshot capture.

For `refresh`, reuse the approved specification. Propose reopening the interview when the requested change or discovered evidence changes audience, scope, terminology, source authority, information architecture, publication policy, or other specification assumptions. Start immediately only when the user explicitly requested refresh with grilling.

Implemented behavior is authoritative for current behavior. Record intended-versus-implemented mismatches and ask whether to omit them or publish clearly marked **Planned** content. Never present planned behavior as available.

## Prepare Project-Owned Files

Create missing files from `assets/project-templates/`, resolving that path relative to this `SKILL.md`. Never overwrite an existing project file. The templates cover:

- `docs/documentation-spec.md`
- `docs/documentation-decisions.md`
- `docs/user-guide/SCREENSHOTS.md`

The tooling bootstrap creates `docs/documentation.toml` when it is missing. Treat it as project-owned after creation.

Ensure these ignored paths unless project configuration explicitly commits PDFs:

```gitignore
/docs/.documentation-work/
/docs/pdf/
```

Do not copy executable files or renderer sources out of this skill. The installed skill is intentionally independent from the documentation tool distribution.

## Set Up and Use the Project Tool Interface

When `docs/documentation` is absent and the user requested documentation setup or rendering, confirm the absolute project root and run:

```bash
curl -fsSL https://raw.githubusercontent.com/eSoul-cz/documentation-skill/main/install.sh |
  sh -s -- /absolute/project/root
```

The bootstrap requires Docker, pulls the installer and renderer from the public Scaleway registry, installs the remote profile, creates a missing `docs/documentation.toml`, records the immutable renderer digest in local Git configuration, and runs `doctor`. It does not clone the tooling repository or install Go, Lua, Pandoc, or LaTeX on the host.

Do not run the bootstrap when tooling is already installed. Use the separately governed upgrade workflow for an existing managed installation.

When `docs/documentation` exists, use only its stable commands:

```bash
docs/documentation doctor
docs/documentation validate
docs/documentation build
docs/documentation render
docs/documentation redact docs/.documentation-work/redaction-plan.json
docs/documentation version
```

Read [pdf-pipeline.md](references/pdf-pipeline.md) before configuring or invoking the PDF pipeline.

If Docker is unavailable or setup was not requested, continue non-rendering authoring work when safe and report that project tooling is required before validation or PDF work. Do not assume this skill lives inside a tooling checkout, search its parent directories for source code, or reconstruct the renderer from the reference documents.

Run `doctor` before changing an installed tool profile or diagnosing a hosted renderer. It checks managed-file drift, configuration compatibility, Docker and registry readiness, and the independently supplied remote-image allowlist.

## Author Portable Markdown

Use one H1 per source file, relative links, descriptive image alt text, ordinary Markdown tables, fenced code, footnotes, GitHub alert callouts, Mermaid fences, `$...$` inline math, and `$$...$$` display math. Math commands are restricted to the allow list documented in [pdf-pipeline.md](references/pdf-pipeline.md); any other command or remaining backslash causes a hard build failure. Use a blockquote beginning with bold `Planned` for approved planned-content callouts.

Keep raw LaTeX and renderer directives out of authored pages. Configure layout exceptions and templates in `docs/documentation.toml`. Select `pdf.theme = "esoul"` for eSoul-branded client deliverables and retain `default` for neutral or project-owned presentation unless the approved specification says otherwise. Put licensed client fonts in a project-owned directory listed by `pdf.font_dirs`, and reference their internal family names through `pdf.theme_overrides`.

Default to separate user and developer or operator guides, but let the approved specification adapt their chapters. Keep planning, decisions, review records, and screenshot manifests outside PDF source lists.

## Handle Screenshots Safely

Read [screenshots.md](references/screenshots.md) before capturing, inspecting, redacting, promoting, or deleting screenshots. Raw captures must remain under the ignored `docs/.documentation-work/raw-screenshots/`. Every published screenshot requires a tracked `docs/user-guide/SCREENSHOTS.md` entry and user approval. Never capture production by default.

## Review and Publish

Read [review.md](references/review.md) completely before claiming publish-ready status. Prefer independent correctness and completeness passes. If independent agents are unavailable, perform both passes and disclose reduced independence. Resolve, evidence-reject, or obtain explicit user acceptance for every finding.

Run:

```bash
docs/documentation validate
docs/documentation build
```

Inspect every rendered PDF page. Use an installed PDF skill when available. Otherwise, inspect `docs/.documentation-work/rendered/` with image viewing tools. A publish-ready result requires structural validation, successful PDF builds, visual inspection, privacy and accessibility checks, plus the semantic review gate.

## Load Focused References

- Read [pdf-pipeline.md](references/pdf-pipeline.md) for configuration, commands, custom templates, math, version metadata, and remote-image mode.
- Read [jenkins.md](references/jenkins.md) only when the user requests CI integration.
