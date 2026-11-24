---
name: esoul-data
description: Use when saving, backing up or preparing project data (client files, media, SQL dumps, import files, exports) and on data tasks (label `data-migration`, legacy imports, data fixes, reports, analyses) whose work needs a change to application code, schema, seeders or factories. Places project data in tracked `assets/` and guides in `docs/`; proposes such a change as a new issue/task pair instead of making it.
---

# Project data and data tasks

Two parts: where project data lives, and what a data task may change. The data rules themselves (secrets, personal and client data, anonymised dumps, production access) are in `docs/project_guidelines/security-and-data.md` › Secrets, › Personal and client data, › Anonymized dumps for agents, › Production access; `docs/project_guidelines/workflow.md` › Repository rules lists what is never committed. Follow them; this skill adds the procedure.

## Where project data lives

Project data in `storage/`, `*.nosync` or another ad hoc gitignored folder exists on one computer only; a colleague cannot find it and it disappears with the disk. Track it instead:

| What | Where |
| --- | --- |
| Client source files without personal data (XLSX, DOCX, PDF, original photos) | `assets/klient/<topic>/…`, Git LFS (the layout is owned by `esoul-project-lifecycle`, podklady-and-legacy reference; follow the project's own layout when it differs) |
| Admin media without personal data; **anonymised** SQL dumps for transfer | `assets/…`, Git LFS |
| Processed files for an import (resized photos, caches) | `assets/…`, Git LFS |
| Guides, runbooks, procedures for colleagues | `docs/…`, linked from the README |
| Scripts and manifests (small text files) | next to the data or in `docs/` |

A backup or dump goes to `assets/` only when it is anonymised or free of personal data; otherwise it stays outside Git. Non-anonymised client material needed for the work may sit only in the one gitignored local folder named in `.gitignore`, by convention `_reference/`, never shared.

Steps:

1. Check that `.gitattributes` has the `assets/**` LFS rule (the project template ships it), then run `git lfs install --local` before the first commit.
2. Save straight to `assets/`, not to storage first. Point application configuration (media roots, script outputs) at `assets/` so the data does not drift apart.
3. Describe the contents in `assets/README.md` and the repository README: what is in `assets/` and why.
4. Before pushing, check the size (`du -sh assets`; LFS has a quota) and tell the user.

Done when the data is committed under `assets/` (or `docs/`), `assets/README.md` names it, the author has checked that it holds nothing personal beyond the recorded exceptions, and the size is reported to the user.

Outside the guidelines:

- Purely temporary intermediates (previews, contact sheets for a check) belong in the session scratchpad, not in the repository or storage.
- Runtime data on the server (volumes, databases) is not managed through Git; only a local copy or an anonymised dump meant for handover goes to `assets/`.

## Data tasks: propose, do not patch

On a data task you are an analyst, not an implementer of application changes. Data work may uncover a problem and describe exactly how to fix it, but a fix to application code or the data model outside the issue's scope goes through the normal development cycle: its own issue, review, tests and planning (`docs/project_guidelines/security-and-data.md` › Production access, last bullet). A fix made from a data branch bypasses all of them and drifts the code away from the migrations.

### When it applies

Both hold:

1. The task is data work: GitHub label `data-migration` (or the repository's data category), a migration or import from a legacy system, a data fix, an inconsistency hunt, a report, a statistic, or an analysis.
2. The solution would need a change the issue does not explicitly specify, in:

| Area | Examples |
| --- | --- |
| Application code | controllers, commands and queries, requests, resources, models or entities, services, observers, jobs, console commands, config, tests |
| Data model | migrations, schema changes, added, removed or renamed columns, column types, `nullable`/`unique`, indexes, foreign keys, relations, enums, seeders, factories |
| Data changed through code | one-off PHP scripts, `tinker`, `artisan` commands that change production data |

It applies even when the change is "one line" or the user mentions it in passing. When unsure whether something is in the table, treat it as if it is. A schema change the issue explicitly specifies and that was approved is in scope and may be implemented, and so is an importer, command or migration the issue names or specifies: build it with its tests. The table covers what the issue does not specify.

### What is allowed

- Read code, migrations, schema and data (`SELECT`, `EXPLAIN`, `SHOW CREATE TABLE`) under the data rules of `security-and-data.md`: ask the owner before reading production or sensitive data; a data fix reaches a real environment only as a reviewed migration or a command, which you propose as new work; nothing you read is exported into the repository, issues or PRs. The owner's approval to read production or sensitive data, and to write to a local database or environment for this task, is recorded as a comment in the data issue (who approved, what, when), like the "just do it" approval below; ask where it is, and when it is missing, ask the user to have the owner add it before you read or write.
- Analyse data, quantify the impact, prepare an anonymised sample of the faulty records.
- Write a **proposal** with a concrete diff, SQL or migration as an example in the text of the new work: the GitHub issue in `github-freelo` mode, the Freelo task description in `freelo-only` mode. A proposal in that text is fine; a proposal written into a file in the repository is not.
- Finish every part of the data task that needs no such change.

### When you hit a needed change

1. Stop work on that change. Finish the independent rest of the data task.
2. Tell the user in one or two sentences: what is wrong, where, and the impact on data (how many records, which).
3. Prepare the proposal: cause, proposed solution, alternatives where they matter, risks, impact on existing data, whether a backfill or recalculation is needed.
4. Create the new work with the `esoul-task-create` skill (project layer) and its usual preview and approval; when it is not installed, give the user the proposal text to file. Classify it by what the change touches, not where it was found: a schema change or migration is data work, an application change without schema change is backend; both are two linked pairs or one pair with the other side described.
5. Tell the user what was created and continue with the rest of the data task.

Never create the task silently, and never make the change with the intention of creating the task "afterwards". Done when the new issue/task pair exists (or the proposal text is handed over) and the data task continues without the change.

### What the new issue contains

On top of what `esoul-task-create` requires:

- **Finding:** what exactly does not match in the data, with numbers and, when needed, an anonymised sample (`security-and-data.md` › Personal and client data, anonymised sample of faulty records). Never copy original data; say where it can be found.
- **Cause:** why, with a link to the place in code or the migration.
- **Proposed fix:** concrete, with a diff or SQL as an example.
- **Impact on existing data:** backfill, recalculation, repeated import?
- **Cost of not fixing it,** so the work can be prioritized.
- A link to the data task where the finding came from.

### When the user says "just do it"

The user's word is not enough to change application code or the data model from a data task. The owner's approval must be written in the data issue (its description or a comment) before you change code; ask where it is written, and when it is missing, ask the user to have the owner add it (offer a one-sentence wording) or file the proposal as usual. With the approval in the issue, say in one sentence that the change is outside the normal cycle and make it; do not argue repeatedly. The approval is the trace: link it in the PR. It does not replace the owner's approval to read production or sensitive data.
