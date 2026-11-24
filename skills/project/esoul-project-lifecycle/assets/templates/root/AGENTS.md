<!--
Project part of `AGENTS.md`. Append it BELOW the managed block that `esoul-guidelines sync`
writes (references/root-files.md); never put it inside the block. English. Delete this comment,
the sections that do not apply and every placeholder.
-->

## What this project is

{{PROJECT_SUMMARY}}

## Where things are

Work one prepared issue at a time. The stack and the engineering rules are the guideline layers in
`esoul-guidelines.json`, rendered in [docs/project_guidelines/](docs/project_guidelines/index.md).
Read the sources in the order of [CONTEXT.md](CONTEXT.md#sources-of-truth) and look an answer up
there before asking or choosing an approach of your own. Project rules take precedence over generic
framework, generated and skill examples. Conflicts between sources are reported, not resolved
silently.

## Rules for this project

- **Numbers and calculations come from `docs/podklady/`, never from your own reasoning.** If a
  source is ambiguous or wrong, the point becomes an issue labelled `question` and the client
  answers it. Do not invent a formula, do not "improve" one, and do not round anywhere the
  guidelines do not say. Where the client has a workbook, a parity test reproduces it.
- **Open questions are not yours to answer.** A point the client has not decided is an open issue
  labelled `question`; do not guess it from the podklady, the legacy system or your own reasoning.
  Split the dependent work out and ask.
- **Work labelled `data-migration`** (migrations, imports, data fixes, reports) changes only what
  its issue specifies. Anything beyond that in application code or the data model is not done in
  passing: write the proposed fix down and ask for a new issue.
- **A new domain term goes into [GLOSSARY.md](GLOSSARY.md) in the same pull request** that
  introduces it: one concept, one Czech term, one English identifier.
<!-- optional: projects with a Pencil design -->
- **Design.** The design is `{{DESIGN_PEN_PATH}}`, stored in Git LFS (`git lfs pull
  --include="docs/design_pencil/**"` when the checkout holds a pointer). A `.pen` file is
  encrypted: read and change it only through the Pencil MCP tools; never `Read` or `grep` it and
  exclude it from searches (`git grep … -- ':!*.pen'`). The `.pen` wins over any summary of it.

## Agent skills

- `esoul-workflow` is the entry point for non-trivial work: it sizes the task and routes to the
  skills below.
- `esoul-task-create` authors issue and Freelo task pairs under
  [CONTEXT.md](CONTEXT.md#tasking-convention), after an approved preview; `esoul-task-work`
  picks up and moves tasks.
- `gitmoji-commit` writes commits under [CONTEXT.md](CONTEXT.md#commit-convention).
- `esoul-review` reviews a change before the pull request and drives the pull request to green CI
  and approval; it does not merge.
- `esoul-project-lifecycle` keeps the project documentation (podklady, questions, glossary, ADRs,
  plan and slices) and audits conformance; use it after a client session or when an ADR or the
  plan changes.
- `esoul-docs` creates and verifies user and operator documentation.

Project and vendored skills live in `.agents/skills/`; read the relevant one before working in its
domain. This file and the guidelines take precedence over them.

Ignore these upstream skills if they are installed: the tracker set (`to-spec`, `to-tickets`,
`triage`, `wayfinder`, `implement-spec`), `setup-matt-pocock-skills`, `pr` and
`git-guardrails-claude-code`. Grilling is rounds of independent questions each with a recommended
answer (`esoul-workflow`, `references/grilling.md`), not one question at a time.

Issue tracker, triage labels and domain docs: [docs/agents/](docs/agents/issue-tracker.md).
