---
name: esoul-maintain-application-documentation
description: Create, refresh, verify, review, and render application documentation as audience-specific Markdown and reproducible PDFs. Use for application user guides, developer/operator guides, documentation specifications, screenshot plans and redaction, documentation correctness/completeness reviews, project-local PDF tooling, or documentation CI integration. Supports create, refresh, and read-only verify modes.
---

# Maintain Application Documentation

Produce evidence-backed documentation for software applications and install a standardized, locally runnable PDF toolchain.

## Start every run

1. Read [workflow.md](references/workflow.md) completely.
2. Select `create`, `refresh`, or `verify`. Ask only when the request truly does not imply a mode.
3. Inspect the repository before asking questions that the codebase can answer.
4. Read existing `CONTEXT.md` or `CONTEXT-MAP.md`, documentation configuration, specification, decision log, guides, and project instructions.
5. Announce this skill and every other skill activated by the repository or task.

## Use specification-first authoring

For `create`, run `$grill-with-docs` to specify the documentation one question at a time. Maintain domain language through its domain-modeling workflow. Create `docs/documentation-spec.md` and `docs/documentation-decisions.md` from the bundled templates. Require explicit approval of the specification before substantial authoring or screenshot capture.

For `refresh`, reuse the approved specification. Propose reopening `$grill-with-docs` when the requested change or discovered evidence changes audience, scope, terminology, source authority, information architecture, publication policy, or other specification assumptions. Start immediately only when the user explicitly requested refresh with grilling.

Implemented behavior is authoritative for current behavior. Record intended-versus-implemented mismatches and ask whether to omit them or publish clearly marked **Planned** content. Never present planned behavior as available.

## Install project-local tools

After specification approval, run:

```bash
scripts/install_project_tools /absolute/project/root
```

Resolve the command path relative to this skill directory. It builds and runs the static Go installer in Docker, so the host needs neither Python nor Go. Use `--check` to detect drift and `--upgrade` only with explicit approval. Never overwrite locally modified managed files silently.

After a hosted renderer digest has been published and configured in `docs/documentation.toml`, add `--remote` to install only the runtime wrapper, version marker, default header, and manifest. Use `--upgrade --remote` to migrate a clean local-profile installation; the installer retires the project-local Docker build sources. Use `--upgrade --local` to restore the complete build context. Keep the default local profile when a published digest is unavailable or an auditable project-local fallback is required.

Create project-owned files from `assets/project-templates/`; do not overwrite existing files. Ensure these ignored paths unless project configuration explicitly commits PDFs:

```gitignore
/docs/.documentation-work/
/docs/pdf/
```

## Author portable Markdown

Use one H1 per source file, relative links, descriptive image alt text, ordinary Markdown tables, fenced code, footnotes, GitHub alert callouts, Mermaid fences, `$...$` inline math, and `$$...$$` display math. Math commands are restricted to the allowlist documented in [pdf-pipeline.md](references/pdf-pipeline.md); any other command or remaining backslash causes a hard build failure. Use a blockquote beginning with bold `Planned` for approved planned-content callouts. Keep raw LaTeX and renderer directives out of authored pages. Configure layout exceptions and templates in `docs/documentation.toml`. Select `pdf.theme = "esoul"` for eSoul-branded client deliverables and retain `default` for neutral or project-owned presentation unless the approved specification says otherwise.

Default to separate user and developer/operator guides, but let the approved specification adapt their chapters. Keep planning, decisions, review records, and screenshot manifests outside PDF source lists.

## Handle screenshots safely

Read [screenshots.md](references/screenshots.md) before capturing, inspecting, redacting, promoting, or deleting screenshots. Raw captures must remain under the ignored `docs/.documentation-work/raw-screenshots/`. Every published screenshot requires a tracked `docs/user-guide/SCREENSHOTS.md` entry and user approval. Never capture production by default.

## Review and publish

Read [review.md](references/review.md) completely before claiming publish-ready status. Prefer two independent sub-agents: one for correctness and one for completeness. If sub-agents are unavailable, perform both passes and disclose reduced independence. Resolve, evidence-reject, or obtain explicit user acceptance for every finding.

Run:

```bash
docs/documentation validate
docs/documentation build
```

Inspect every rendered PDF page. Use an installed PDF skill when available. Otherwise inspect `docs/.documentation-work/rendered/` with image viewing tools. A publish-ready result requires structural validation, successful PDF builds, visual inspection, privacy and accessibility checks, plus the semantic review gate.

## Load focused references

- Read [pdf-pipeline.md](references/pdf-pipeline.md) for configuration, commands, custom templates, math, version metadata, and remote-image mode.
- Read [jenkins.md](references/jenkins.md) only when the user requests CI integration.
- Read [hosted-image-plan.md](references/hosted-image-plan.md) only when planning or implementing the future hosted renderer image.
