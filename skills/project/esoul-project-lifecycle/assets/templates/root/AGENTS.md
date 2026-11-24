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

- **Numbers and calculations come from `docs/podklady/` or a recorded decision, never from your
  own reasoning** (`docs/project_guidelines/domain.md` › Open points and conflicts). If a source
  is ambiguous or wrong, the point becomes an issue labelled `question` and the client answers
  it. Do not invent a formula, do not "improve" one, and do not round anywhere the guidelines do
  not say.
- **Open questions are not yours to answer.** A point the client has not decided is an open issue
  labelled `question`; do not guess it from the podklady, the legacy system or your own reasoning.
  Split the dependent work out and ask.
<!-- optional: projects with a Pencil design -->
- **Design.** The design is `{{DESIGN_PEN_PATH}}`, stored in Git LFS (`git lfs pull
  --include="docs/design_pencil/**"` when the checkout holds a pointer). A `.pen` file is
  encrypted: read and change it only through the Pencil MCP tools; never `Read` or `grep` it and
  exclude it from searches (`git grep … -- ':!*.pen'`). The `.pen` wins over any summary of it.

## Agent skills

`esoul-workflow` is the entry point for non-trivial work: it sizes the task and routes to the
others. `npx @esoul-cz/skills project init` installs the layers `core`, `dev` and `upstream-core`
into the project; they are committed with `skills-lock.json` in `.agents/skills/<name>/SKILL.md`:

- work: `esoul-workflow`, `esoul-task-work` (pick up and move tasks), `esoul-review`,
  `esoul-testing`, `esoul-guidelines`;
- documentation: `esoul-docs`.

The `project` layer (`npx @esoul-cz/skills install project`) is a user-global install for the
people who set up and manage projects, and `project init` does not install it; the same holds for
`helpers` (`gitmoji-commit`, commits under [CONTEXT.md](CONTEXT.md#commit-convention)):

- task and project preparation: `esoul-task-create` (issue and Freelo pairs under
  [CONTEXT.md](CONTEXT.md#tasking-convention), after an approved preview),
  `esoul-project-lifecycle` (podklady, questions, glossary, ADRs, plan, conformance),
  `esoul-project-update` (template updates).

When one is missing, say so instead of doing its work by hand. Read the relevant skill before
working in its domain. This file and the guidelines take precedence over the skills.

Ignore these upstream skills if they are installed: the tracker set (`to-spec`, `to-tickets`,
`triage`, `wayfinder`, `implement-spec`), `setup-matt-pocock-skills`, `pr` and
`git-guardrails-claude-code`. Grilling is rounds of independent questions each with a recommended
answer (`esoul-workflow`, `references/upstream.md`), not one question at a time.
