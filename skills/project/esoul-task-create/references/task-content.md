# Task content in detail

### Title

Use a concise, actionable result. When context materially aids scanning, prefer the specific application module, or otherwise a useful one-word context, and use exactly:

```text
<Context>: <Actionable result>
```

Use a colon, not a dash. Omit the prefix when no useful context is clear. Represent work categories such as frontend, backend, or data with existing task labels, never with prefixes such as `[FE]`, and never put a slice or phase identifier in the title (guidelines `general/workflow.md` › Tasking).

Language of the title (descriptions and Freelo text stay Czech):

- **New project:** English imperative (`Checkout: Add delivery selection`) on the issue and the Freelo task; the pull request title is the same result and action wording in the commit standard the project or developer uses.
- **Existing Czech project:** the issue and the Freelo task keep Czech titles (infinitive, `Objednávka: Přidat výběr dopravy`). The pull request title is an English, descriptive title of the same result linked to them with `Closes #<issue>` (in the recommended Gitmoji format `:sparkles: [checkout] Add delivery selection`).
- **Which one:** `Title language` in `CONTEXT.md` › `## Tasking convention`; without it, the language of the project's existing issue and task titles. When that does not decide, ask once and record the answer there ([convention.md](convention.md)).

The pull request title and the commit standard are `docs/project_guidelines/workflow.md` › Pull requests and › Commits; the recommended Gitmoji format is written by `gitmoji-commit` when it is installed and no other standard is recorded. In `freelo-only` mode the pull request links the Freelo task URL instead of an issue.

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

Estimate human time as `esoul-task-work` › `references/freelo.md` (States and estimates) defines it. Agent time is not estimated; actual human time is logged as Freelo work reports. State estimate confidence in the preview. When a task exceeds 4 hours of human time, actively propose a split; allow an approved exception when cohesion warrants it. Keep estimates on the parent by default. Estimate a subtask only when it is unusually substantial. A repository convention in `CONTEXT.md` may define a different estimate unit; follow it and show it in the preview.
