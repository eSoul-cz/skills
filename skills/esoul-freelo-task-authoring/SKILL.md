---
name: esoul-freelo-task-authoring
description: Prepare, refine, preview, and create one or more well-specified eSoul tasks in a single confirmed Freelo project. Use when a user asks to add, create, specify, split, or revise an eSoul Freelo task; turn a feature, bug, technical change, spike, data task, documentation task, or LTT into Freelo work; or avoid a duplicate while authoring a new task. Inspect the active codebase and existing Freelo work, interview only as needed, and require explicit approval before every Freelo write.
---

# eSoul Freelo task authoring

Create implementation-ready eSoul tasks without taking over their later lifecycle. Work over
exactly one confirmed Freelo project per run. This file is the core; read a reference only
when the step needs it. Skills already loaded in this session are not loaded again.

## Companion and context

Use the `freelo` skill core for commands (its task authoring recipe covers create,
description, labels, estimate, relations and read-back). Prefer available Freelo MCP tools;
otherwise the authenticated `freelo` CLI with `--agent`. Never call the API with `curl`.

Use applicable `AGENTS.md` content already in context; do not read it again. Read only the
convention sections you need (`## Freelo`, `## Tasking convention`) from root `CONTEXT.md`,
falling back to `GLOSSARY.md`, by section. Look up domain terms in `GLOSSARY.md` when the task
uses them; never read the whole glossary up front. Repository instructions are authoritative.

## 1. Confirm the project

Use an explicitly named project, else the `## Freelo` mapping in `CONTEXT.md` (or the
`GLOSSARY.md` fallback), else infer a candidate and ask the user to confirm it. After an
inferred confirmation, record the mapping as in
[references/project-mapping.md](references/project-mapping.md). Never author tasks for more
than one Freelo project in a run.

## 2. Evidence before questions

- Inspect the codebase for real modules, domain terms, files, routes and patterns before
  asking anything answerable locally.
- Load the project's tasklists, workers, and the task labels actually used there.
- Search for duplicates and related work before every preview: by outcome, domain terms,
  module and file names, in Czech and English, active and finished tasks. Not by title only.
- Write in Czech; keep established programming terms (migrace, commandy, requesty); give
  domain concepts as `chovatel (Breeder)` when code uses an English name.
- Never copy secrets, credentials, production personal data or raw sensitive datasets.

Skip the interview when the request is complete. Otherwise ask one question at a time with a
recommended answer, as in [references/interview.md](references/interview.md).

## 3. Shape the task

- **Title:** `<Context>: <Actionable result>`, infinitive, colon not dash; categories are
  labels, not prefixes (a repository convention may define otherwise).
- **Description:** the done state must be clear; short narrative for simple work, optional
  sections (`Cíl`, `Technický kontext`, `Rozsah`, `Mimo rozsah`, `Akceptační kritéria`,
  `Závislosti`, `Ověření`, `Podklady`) for complex work. Self-contained, except in an
  `esoul-tasking` `github-freelo` run, where the issue owns the specification and Freelo has a
  short summary with the issue link first. Preview as Markdown, store sanitized HTML, links
  with `target="_blank" rel="noopener"`. Details: [references/task-content.md](references/task-content.md).
- **Subtasks** are real implementation steps of one result, never lifecycle steps. Separate
  tasks for independently deliverable parts.
- **Estimate:** human time (briefing, checking, review, UAT, fixes) in 15-minute steps, with
  confidence; propose a split above 4 hours. A repository convention may define another unit.

## 4. Metadata

Resolve tasklists by name in the confirmed project. `To Do` only with complete description,
assignee, approved estimate and no blockers; otherwise `Backlog`; `LTT` (or `Project
Management`) only after explicit confirmation. Never create directly in later states.
Never invent an assignee, estimate or due date. At least one label per task, only labels
already used in the project, by UUID; never create a label.

Relations and duplicates (relation names, refining existing tasks by state):
[references/duplicates.md](references/duplicates.md). Never create a complete duplicate.

## 5. Preview and approve

Before any write, show one preview (grouped by task): project and tasklist with rationale,
exact title and description, subtasks, labels, estimate and confidence, assignee and due
date, duplicate-search results and relations, unverified assumptions. The user may approve
all or selected tasks. Approval covers the exact preview only; any material change needs a
new preview. Silence or approval of an earlier draft is not approval.

## 6. Write and verify

1. Create prerequisites first; create each task, then description and metadata.
2. Create approved subtasks; apply labels by UUID; set the estimate; create relations.
3. Read back every created or modified task (tasklist, content, subtasks, labels, estimate,
   assignee, due date, relations) and return clickable links.

Writes are not atomic. On partial failure stop dependent writes, read the actual state,
report what succeeded and what remains, and ask before changed operations. Do not move tasks
through later states, track time, or manage their lifecycle.
