---
name: esoul-docs
description: Use to create, refresh or verify application documentation - user guides and developer/operator guides as evidence-backed Markdown, with a documentation specification, screenshot manifest and redaction, and correctness and completeness review. Owns client-facing application guides as PDF (optional `docs/documentation` tool and its CI stage). Not for DOCX/XLSX/PPTX business documents such as contracts, reports and offers (esoul-office-documents, esoul-offer-authoring).
---

# Application documentation

Produce Markdown guides that are backed by evidence in the repository and written for one named audience each. The Markdown is the deliverable; a PDF can be built from it at any moment (last section, only when the project builds PDFs).

Rules of the guidelines are not repeated here: `docs/project_guidelines/documentation.md` › Authoring rules, › Evidence is not a specification, › The `TBD` rule, › Generated documentation. Read them with this skill.

## Start every run

1. Select `create`, `refresh` or `verify`. Ask only when the request does not imply a mode.
2. Read [workflow.md](references/workflow.md): the shared policy (evidence, outlines, publication contract), then only the section of the selected mode (Create, Refresh or Verify).
3. Inspect the repository before asking what the code can answer.
4. Read `docs/documentation-spec.md`, `docs/documentation-decisions.md`, `docs/documentation.toml` (when present) and the guides in scope. Look up domain terms as `esoul-workflow` describes (the term, not the whole glossary); read the glossary in full only when authoring or reviewing terminology.

## Specification first

For `create`, specify the documentation in an approval-gated interview: use the installed `grilling` skill (layer upstream-core) and ask rounds of independent questions, not one question at a time; without it, run the same rounds yourself. Investigate discoverable answers instead of asking. Create `docs/documentation-spec.md` and `docs/documentation-decisions.md` from `assets/project-templates/` (resolved relative to this `SKILL.md`; never overwrite an existing project file). Take the language of each guide from `CONTEXT.md` (language per place: user guides and client-facing material in the project's language, developer/operator guide, specification and decision record in English) and write it into the specification per guide.

Done when the specification is approved by the user; no substantial authoring or screenshot capture starts before that.

For `refresh`, reuse the approved specification. Propose reopening the interview when the change or the evidence alters audience, scope, terminology, source authority, information architecture or publication policy. Start immediately only when the user asked for refresh with grilling.

Implemented behaviour is authoritative for current behaviour. Record every intended-versus-implemented mismatch and ask whether to omit it or publish it as clearly marked **Planned** content; never present planned behaviour as available.

The decision record (`docs/documentation-decisions.md`) is the documentation's own register (evidence conflicts, attestations, review exceptions); name it under sources of truth in `CONTEXT.md` when you create it.

## Author portable Markdown

- One H1 per source file, relative links, descriptive image alt text, ordinary Markdown tables, fenced code, footnotes, GitHub alert callouts, Mermaid fences.
- Each Mermaid fence is immediately preceded by `<!-- diagram-alt: ... -->`, a concise text alternative of the flow.
- Math: `$...$` inline and `$$...$$` display with basic commands (fractions, roots, sums, Greek letters, `\text`, `\mathrm`, `\operatorname`). A command outside the PDF renderer's allow list is an error: `docs/documentation validate` names the file and the command (`unsafe TeX math command \x`), and the PDF build fails on it. Rewrite the formula with basic commands or put it in a fenced code block.
- Planned content: a blockquote starting with bold `Planned`.
- No raw LaTeX or renderer directives in authored pages; layout belongs in `docs/documentation.toml`.
- Separate user and developer/operator guides by default; the approved specification may adapt chapters. Keep planning, decisions, review records and screenshot manifests out of PDF source lists.

## Screenshots and redaction

Read [screenshots.md](references/screenshots.md) before capturing, inspecting, redacting, promoting or deleting a screenshot. Raw captures stay in the ignored `raw-screenshots/` under the configured `work_dir` (`docs/.documentation-work/raw-screenshots/` by default; `docs/.documentation-work/` is always gitignored). Every published screenshot has an entry in `docs/user-guide/SCREENSHOTS.md` and the user's approval. Capture from a local or explicitly approved non-production environment; production only with the owner's approval (`docs/project_guidelines/security-and-data.md` › Production access).

## Verify

Without the PDF tool, check by hand: every relative link and image path resolves, one H1 per file, alt text on every image, a diagram alternative on every Mermaid fence, no credentials, tokens or personal data (`docs/project_guidelines/documentation.md` › Authoring rules). With `docs/documentation` installed, `docs/documentation validate` runs these checks mechanically (see the PDF section). Verify mode changes no tracked file; report findings in the chat.

## Review and publish

Read [review.md](references/review.md) completely before calling a guide publish-ready. Run its correctness, completeness and privacy-and-accessibility passes with fresh-context reviewers when the harness offers subagents (see `esoul-model-routing`, optional helpers layer, for the reviewer brief); otherwise do the passes yourself one after the other and say that independence was reduced. Close every finding with the finding states of `docs/project_guidelines/code-review.md` › Finding states.

The gates for "publish-ready" are the Publication contract in [workflow.md](references/workflow.md). Done when every gate in it that applies to this project is ticked and the result is reported.

## PDF output (only when the project builds PDFs)

Skip this section when the project publishes Markdown only. The PDFs are build artifacts, reproducible from the Markdown, and are never committed (`docs/project_guidelines/documentation.md` › Generated documentation).

**Ignore rules.** Read `output_dir` and `work_dir` from `docs/documentation.toml` (defaults `docs/pdf` and `docs/.documentation-work`) and keep both ignored:

```gitignore
/docs/.documentation-work/
/docs/pdf/
```

A PDF that Git already tracks stays tracked after the ignore rule: propose removing it from the index as the guideline says, as its own commit. `commit_pdf_outputs` in `docs/documentation.toml` stays `false` (the default; `true` only prints a notice).

**Install.** When `docs/documentation` is absent and setup or rendering was requested, or when previewing an upgrade, follow [setup.md](references/setup.md): the first install adds a committed wrapper, managed files and a renderer image pin, so it counts as a new dependency and needs the maintainer's approval, linked in the pull request (`docs/project_guidelines/workflow.md` › Repository rules); an upgrade needs only the user's confirmation of the previewed plan. Treat `docs/documentation` as the only interface; without it, continue non-rendering work and report that project tooling is required before validation or PDF work. The tool distribution (Go, Lua, Docker, renderer, installer) is separate from this skill and is not reconstructed from these documents.

**Commands.** `docs/documentation doctor | validate | build | render | version`, and `docs/documentation redact <plan.json>` for screenshots. Run `doctor` before changing an installed tool profile or diagnosing a hosted renderer. Run `validate` and `build` through a test runner subagent when the harness offers one, which returns the verdict and failures only; otherwise run them yourself and keep only the failures.

**Theme, language and templates.** `pdf.theme = "esoul"` for eSoul-branded client deliverables, `default` for neutral presentation unless the approved specification says otherwise. Set `language` on each `[[guides]]` block to the language the specification names for that guide (`primary_language` is the default for guides without one). Licensed client fonts go in a project-owned directory listed by `pdf.font_dirs`. Read [pdf-pipeline.md](references/pdf-pipeline.md) only when changing the PDF configuration, theme, templates or math.

**Visual inspection.** Inspect every rendered page, but not in the main session: when the harness offers subagents, delegate the page-by-page inspection of the page images in `rendered/` inside `work_dir` to a fresh-context reviewer, briefed to return only a defect list with page numbers, and open only the reported pages; otherwise inspect the pages yourself. Structural validation, successful builds, visual inspection and the privacy and accessibility checks are PDF gates of the Publication contract.

**CI.** Read [jenkins.md](references/jenkins.md) only when the user asks for CI integration.
