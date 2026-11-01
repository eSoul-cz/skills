---
name: esoul-data-task-guard
description: Use on eSoul data tasks (label data-migration, legacy imports, data fixes, reports, analyses) whenever data work reveals a needed change to application code, migrations, schema, seeders or factories. Do not patch it; write the fix down and create a new issue/task pair.
---

# Data tasks: propose, do not patch

On a data task you are an analyst, not an implementer of application changes. Data work may
uncover a problem and describe exactly how to fix it, but a fix to application code or the data
model outside the issue's scope goes through the normal development cycle: its own issue, review,
tests and planning. A fix made from a data branch bypasses all of them and drifts the code away
from the migrations.

## When it applies

Both hold:

1. The task is data work: GitHub label `data-migration` (or the repository's data category), a
   migration or import from a legacy system, a data fix, an inconsistency hunt, a report, a
   statistic, or an analysis.
2. The solution would need a change the issue does not explicitly specify, in:

| Area | Examples |
| --- | --- |
| Application code | controllers, commands and queries, requests, resources, models or entities, services, observers, jobs, console commands, config, tests |
| Data model | migrations, schema changes, added, removed or renamed columns, column types, `nullable`/`unique`, indexes, foreign keys, relations, enums, seeders, factories |
| Data changed through code | one-off PHP scripts, `tinker`, `artisan` commands that change production data |

It applies even when the change is "one line" or the user mentions it in passing. When unsure
whether something is in the table, treat it as if it is. A schema change the issue explicitly
specifies and that was approved is in scope and may be implemented.

## What is allowed

- Read code, migrations, schema and data (`SELECT`, `EXPLAIN`, `SHOW CREATE TABLE`, `describe`).
- Analyse data, quantify the impact, prepare an anonymized sample of the faulty records.
- Write a **proposal** with a concrete diff, SQL or migration as an example in the text of the
  new work: the GitHub issue in `github-freelo` mode, the Freelo task description in
  `freelo-only` mode. A proposal in that text is fine; a proposal written into a file in the
  repository is not.
- Finish every part of the data task that needs no such change.

## When you hit a needed change

1. Stop work on that change. Finish the independent rest of the data task.
2. Tell the user in one or two sentences: what is wrong, where, and the impact on data (how many
   records, which).
3. Prepare the proposal: cause, proposed solution, alternatives where they matter, risks, impact
   on existing data, whether a backfill or recalculation is needed.
4. Create the new work through `esoul-tasking` with its usual preview and approval. Classify it by
   what the change touches, not where it was found: a schema change or migration is data work, an
   application change without schema change is backend, both are two linked pairs or one pair
   with the other side described.
5. Tell the user what was created and continue with the rest of the data task.

Never create the task silently, and never make the change with the intention of creating the task
"afterwards".

## What the new issue contains

On top of what `esoul-tasking` requires:

- **Finding:** what exactly does not match in the data, with numbers and an anonymized sample.
- **Cause:** why, with a link to the place in code or the migration.
- **Proposed fix:** concrete, with a diff or SQL as an example.
- **Impact on existing data:** backfill, recalculation, repeated import?
- **Cost of not fixing it,** so the work can be prioritized.
- A link to the data task where the finding came from.

Never copy production personal data, credentials or tokens into the issue or Freelo. Use
anonymized samples or say where the data can be found.

## When the user says "just do it"

An explicit instruction from the user overrides this skill. Say in one sentence that it is a
change to application code or the data model outside the normal cycle; if the user insists, make
the change. Do not argue repeatedly. Still create the task so the change is traceable, unless the
user says otherwise.
