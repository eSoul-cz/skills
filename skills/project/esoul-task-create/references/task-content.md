# Task content in detail

### Title

The shape of the title, the category labels instead of prefixes and the ban on slice or phase identifiers are `docs/project_guidelines/workflow.md` › Tasking. What this skill adds is the choice of context: prefer the specific application module when it aids scanning, otherwise a useful one-word context, and omit the context when none is clear.

Language of the title (descriptions and Freelo text stay Czech):

- **New project:** English imperative on the issue and the Freelo task (`Checkout: Add delivery selection`).
- **Existing Czech project:** Czech titles on the issue and the Freelo task (infinitive, `Objednávka: Přidat výběr dopravy`).
- **Which one:** `Title language` in `CONTEXT.md` › `## Tasking convention`; without it, the language of the project's existing issue and task titles. When that does not decide, ask once and record the answer there ([convention.md](convention.md)).

The pull request title is derived from the task title when the PR is opened (`esoul-task-work` › Open the PR). In `freelo-only` mode the PR links the Freelo task URL instead of an issue.

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

Always make the exact done state clear. Every task or issue has acceptance criteria, as observable outcomes (one line suffices for simple work). Tests prove the criteria; they do not replace them.

Embed important source links naturally in sentences. A `Podklady` section may repeat the same links for scanning. Keep a task description self-contained in `freelo-only` mode and in any run outside an explicitly resolved `github-freelo` pair. In a `github-freelo` pair the GitHub issue owns the detailed specification and verification, while Freelo contains the outcome, scope summary, observable done conditions, and an issue link in the first paragraph; the pair's preview, reciprocal links, and read-back verification apply ([github-freelo.md](github-freelo.md)).

Show the preview as Markdown. Write simple sanitized HTML to Freelo using paragraphs, lists, links, and inline code; avoid decorative tables or complex markup. Give every link (`<a>`) `target="_blank" rel="noopener"` so it opens in a new tab.

### Tasks versus subtasks

Use subtasks as real implementation/checklist steps contributing to one parent result, such as entity, migration, request changes, tests, or documentation. Never add lifecycle steps such as code review, moving to Testing, or moving to Done.

Create a separate top-level task when a part can be delivered independently, needs a different due date or assignee, carries its own dependencies/discussion/acceptance criteria, or represents a separate domain or technical result. A larger smart subtask is acceptable when it must remain owned by one person and is inseparable from the parent result.

Prefer one assignee for a task. When multiple people are genuinely required, assign independently owned smart subtasks or split top-level tasks. Keep one accountable parent owner when appropriate.

Estimate as `esoul-task-work` › `references/freelo.md` (States and estimates) defines it: the person's time on the task in 15-minute steps; agent time is not estimated, and a work report later records the same measure (the person's active time). State estimate confidence in the preview. When a task exceeds 4 hours, actively propose a split; allow an approved exception when cohesion warrants it. Keep estimates on the parent by default. Estimate a subtask only when it is unusually substantial. A repository convention in `CONTEXT.md` may define a different estimate unit; follow it and show it in the preview.
