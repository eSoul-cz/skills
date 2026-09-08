---
name: esoul-freelo-task-authoring
description: Prepare, refine, preview, and create one or more well-specified eSoul tasks in a single confirmed Freelo project. Use when a user asks to add, create, specify, split, or revise an eSoul Freelo task; turn a feature, bug, technical change, spike, data task, documentation task, or LTT into Freelo work; or avoid a duplicate while authoring a new task. Inspect the active codebase and existing Freelo work, interview only as needed, and require explicit approval before every Freelo write.
---

# eSoul Freelo task authoring

Create implementation-ready eSoul tasks without taking over their later lifecycle. Work over exactly one confirmed Freelo project per run.

## Required companion workflow

Load and follow the `freelo` skill before using Freelo. Prefer the available Freelo MCP tools; use the authenticated `freelo` CLI with `--agent` only when MCP lacks the required read or write. Never call the Freelo API directly with `curl`.

Read all applicable `AGENTS.md` files and the active repository's `CONTEXT.md` before analyzing the task. Treat repository instructions as authoritative for implementation and verification conventions.

## 1. Confirm the project first

Resolve the Freelo project before task analysis or Freelo duplicate search:

1. Use an explicitly named project without asking again.
2. Otherwise prefer a clear Freelo mapping in the active repository's `CONTEXT.md`.
3. Otherwise infer a candidate from the request, active codebase, repository name, and existing context.
4. When inference was required, ask the user to confirm the project and wait. State that confirmation will record the mapping in `CONTEXT.md`.

After the first inferred-project confirmation, add or update this compact block near the beginning of `CONTEXT.md`:

```md
## Freelo

- Projekt: <project name>
- Project ID: <numeric id>
- URL: https://app.freelo.io/project/<numeric id>
```

The same confirmation authorizes only this standardized context edit. Report the edit before continuing; do not include it later in the task preview. If `CONTEXT.md` contains a conflicting mapping, stop and resolve the conflict with the user.

Never author tasks for multiple Freelo projects in one run. Ask the user to handle another project in a separate run.

## 2. Build evidence before asking questions

Inspect the relevant codebase before asking anything answerable locally. Locate real modules, domain terms, classes, files, routes, tests, commands, documentation, and established patterns. Use concrete code names only when they improve orientation; do not turn the task into an unnecessarily prescriptive implementation recipe.

Load the confirmed Freelo project's:

- tasklists and valid workers;
- active and finished tasks;
- comments, subtasks, attachments, estimates, and labels on relevant candidates;
- labels demonstrably available and used in that project.

Search for duplicates and related work before every preview. Search by outcome, domain vocabulary, module, class names, file names, and alternate Czech/English terms. Include active and finished work. Do not rely on title equality alone.

Derive the project's vocabulary from `CONTEXT.md`, code, and existing tasks. Write primarily in Czech. Preserve established programming terms and eSoul czenglish such as `string`, `unique`, migrace, commandy, and requesty. When a domain concept has a normal Czech name and an English code equivalent, introduce both, for example `chovatel (Breeder)`. Use only the English term when no reliable Czech term is available.

Never copy secrets, credentials, tokens, production personal data, or sensitive raw datasets into Freelo. Use anonymized examples, safe references, or a description of the source location. Stop when the task cannot be specified safely.

## 3. Interview adaptively

Skip the interview when the request is simple or already complete. Otherwise ask exactly one question at a time, wait for the answer, and include a recommended answer. Resolve decision dependencies in order. Do not ask questions answerable from the codebase, repository instructions, `CONTEXT.md`, or Freelo.

Continue until the following are clear enough for the task type:

- intended outcome and reason;
- scope and meaningful exclusions;
- completion conditions and verification;
- module, when useful;
- dependencies and related tasks;
- suitable split into tasks and checklist subtasks;
- tasklist, labels, estimate, assignee, and due date.

Infer an internal task archetype and tailor the questions:

- **Feature:** capture who benefits, why, expected behavior, roles, domain rules, boundaries, and observable completion.
- **Bug:** capture observed and expected behavior, reproduction conditions, affected role/data/environment, evidence, and regression coverage. Put an unreproduced or materially underspecified bug in `Backlog` as diagnosis rather than implementation-ready work.
- **Technical improvement/refactoring:** capture the concrete problem, intended quality outcome, compatibility constraints, and proof that behavior remains correct.
- **Testing:** name the behavior and scenarios being proven rather than merely saying "add tests".
- **Data/import:** capture source, expected shape, transformations, validation, failure handling, repeatability, and safe verification.
- **Spike:** define the question, boundaries, timebox, and output: findings, compared options, recommendation, and risks. Do not include production implementation unless explicitly requested.
- **Documentation:** define audience, scope, source of truth, and required verification.
- **LTT / Project Management:** recognize recurring or continuous work that lacks a one-sprint result, but never classify it as LTT without explicit user confirmation.

Ask about an optional module when code or existing tasks suggest one but the user did not identify it.

## 4. Shape the task

### Title

Use a concise, actionable result. Prefer an infinitive. When context materially aids scanning, prefer the specific application module, or otherwise a useful one-word context, and use exactly:

```text
<Context>: <Actionable result>
```

Use a colon, not a dash. Omit the prefix when no useful context is clear. Represent work categories such as frontend, backend, or data with existing task labels, not category prefixes.

### Description

Optimize for a typical programmer's understanding, not maximum technical density. Use a short narrative for simple work and optional sections for complex work. Select only useful sections:

- `Cíl`: the result and why it matters;
- `Technický kontext`: verified code locations and current behavior;
- `Rozsah`: included behavior and artifacts;
- `Mimo rozsah`: tempting but excluded work;
- `Akceptační kritéria`: observable completion conditions;
- `Závislosti`: linked Freelo tasks and unblock conditions;
- `Ověření`: relevant automated and manual checks;
- `Podklady`: a compact list of source issues, documents, designs, or files.

Always make the exact done state clear. For complex tasks, list acceptance criteria as observable outcomes. Tests prove the criteria; they do not replace them.

Embed important source links naturally in sentences. A `Podklady` section may repeat the same links for scanning. Keep task descriptions self-contained except when `esoul-tasking` is orchestrating an explicitly resolved `github-freelo` run: then its paired GitHub issue owns the detailed specification and verification, while Freelo contains the outcome, scope summary, observable done conditions, and an issue link in the first paragraph. Require the paired workflow's preview, reciprocal links, and read-back verification. In all other cases, including direct use of this skill and `freelo-only` mode, never substitute an external issue or document for a self-contained task description.

Show the preview as Markdown. Write simple sanitized HTML to Freelo using paragraphs, lists, links, and inline code; avoid decorative tables or complex markup.

### Tasks versus subtasks

Use subtasks as real implementation/checklist steps contributing to one parent result, such as entity, migration, request changes, tests, or documentation. Never add lifecycle steps such as code review, moving to Testing, or moving to Done.

Create a separate top-level task when a part can be delivered independently, needs a different due date or assignee, carries its own dependencies/discussion/acceptance criteria, or represents a separate domain or technical result. A larger smart subtask is acceptable when it must remain owned by one person and is inseparable from the parent result.

Prefer one assignee for a task. When multiple people are genuinely required, assign independently owned smart subtasks or split top-level tasks. Keep one accountable parent owner when appropriate.

Fit each ordinary parent task into one one-week sprint. Estimate implementation, tests, ordinary local fixes, and required documentation in whole hours. State estimate confidence in the preview. When a task exceeds 20 hours, actively propose a split; allow an approved exception when cohesion warrants it. Keep estimates on the parent by default. Estimate a subtask only when it is unusually substantial.

## 5. Choose metadata

Resolve tasklist IDs by name in the confirmed project; never hardcode IDs from another project.

- Choose `To Do` when the task is complete, unblocked, and available for anyone to take. Assignee and due date may both be empty.
- Also choose `To Do` when the task has a clear assignee and due date and is unblocked.
- Require a whole-hour parent estimate for every `To Do` task.
- Choose `Backlog` for preparation, missing decisions, blockers, or other work not ready to start. Its estimate may be absent.
- Choose `Project Management` only after explicit LTT confirmation. Do not require an estimate unless the user explicitly sets a budget.
- Never create directly in `In progress`, `Code review`, `Testing`, or `Done` as part of ordinary authoring.

If only an assignee or only a due date is known, ask for the other when it matters. The task may still enter `To Do` under the complete/unblocked/free-pick rule. Never invent either value.

Apply at least one label to every created task. Use only labels already available and demonstrably used in the target project, preserving exact name, case, UUID, and color. Never suggest or create a new label. Ask when no existing label can be selected reliably.

## 6. Handle related work and duplicates

Prefer native Freelo task relations when the currently available MCP/CLI explicitly supports creating them. Otherwise add temporary reciprocal comments so a person can create the native relation manually and delete the comments in the UI.

Use Freelo's exact relationship names:

- `Souvisí s` on both tasks;
- `Je duplikát` on both tasks;
- `Je blokován` on the dependent task and `Blokuje` on the prerequisite task.

Include the other task's clickable Freelo URL in each comment. Preview all reciprocal comments before writing them.

Never create a complete duplicate. Show the existing task and propose a safe refinement when appropriate:

- `Backlog`: propose merging or expanding its description, subtasks, labels, and estimate.
- `To Do`: allow a proposed refinement, then re-check readiness, estimate, assignee, due date, and blockers.
- `In progress`: do not expand scope without explicit approval; keep a small clarification there or create separately linked substantial work.
- `Code review` or `Testing`: keep only corrections required by the approved scope; create newly discovered scope as a separate related task.
- `Done`: do not reopen or rewrite automatically; create a separate related change.
- `Project Management`: add to the same confirmed LTT only when it is truly continuing work; otherwise create separately.

Updating an existing task is allowed only as the approved duplicate-prevention exception. Do not otherwise manage task lifecycle or implementation state.

## 7. Preview and approve

Before any Freelo write, show one complete preview grouped by task when several tasks are proposed. Include:

- confirmed project and target tasklist with rationale;
- exact title and description;
- subtasks and any exceptional subtask assignees/estimates;
- existing labels;
- whole-hour estimate and confidence;
- assignee and due date;
- duplicate-search results and proposed relations;
- every reciprocal comment to be added to another task;
- unverified assumptions.

Allow the user to approve the entire same-project batch or explicitly selected tasks. Create only the approved items.

Treat approval as authorization for the exact preview only. Any material change to project, tasklist, title, description, scope, subtasks, relations, labels, estimate, assignee, or due date invalidates approval. Show a revised preview and ask again. Never infer approval from silence or from approval of an earlier draft.

## 8. Write and verify

After approval:

1. Create prerequisites before dependent tasks when ordering matters.
2. Create each parent, then set its full description and metadata.
3. Create approved subtasks and assign or estimate exceptional smart subtasks only as previewed.
4. Apply labels by existing UUID where possible.
5. Create native relations or approved reciprocal fallback comments.
6. Read back every created or modified task and verify tasklist, content, subtasks, labels, estimate, assignee, due date, and relations/comments.
7. Return clickable links for every created or modified Freelo entity on first mention.

Freelo writes are not atomic. On partial failure, do not delete, roll back, or recreate a parent automatically. Stop dependent writes, read the actual state, report exactly what succeeded and what remains, and offer a safe completion plan requiring fresh approval for any changed operations.

Do not move tasks through `In progress`, `Code review`, `Testing`, or `Done`, track work, or otherwise manage their later lifecycle.
