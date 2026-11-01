# Company rules this skill enforces

These were approved for every eSoul project. Templates in `assets/templates/` already follow
them. Load this file in the `tasking`, `plan` and `audit` modes, or whenever a rule is in
doubt. Each rule has one owning skill that holds its details; this list names the rule and the
owner and does not repeat the details beyond what the lifecycle needs.

- **Titles** of issue, Freelo task and PR are identical: `Kontext: Akční výsledek`. No `[FE]`,
  `[BE]`, `[DATA]` prefix and no slice ID in the title. Category is a label on both sides.
  The slice ID goes into the issue header line and the first line of the Freelo description.
  Owner: `esoul-tasking`.
- **Estimates** in Freelo are human time in 15-minute steps; split above 4 h. Owner:
  `esoul-freelo-task-authoring`. Actual time is logged as Freelo work reports of active work
  only (`freelo` › work reports).
- **CONTEXT.md** holds project conventions, including the `## Freelo` cache of tasklist IDs and
  label UUIDs; **GLOSSARY.md** holds domain language only.
- **ADRs** are English, `docs/adr/NNNN-english-slug.md`, with Implementation status and gaps.
- **UAT** in the issue: the `## UAT` format owned by `esoul-tasking` (Role, Předpoklad, the
  project's UAT dimensions, one checkbox per step).
- **Dependencies**: GitHub native `blocked_by` is the source of truth, mirrored as a Freelo
  relation. No temporary "create this relation manually" comments.
- **Merging**: squash merge, required `Jenkins` check and one human approval on `main`, no
  bypass for the shared `esoul-cz-user` account. Agents never merge.
- **Freelo states**: Backlog → To Do (description, assignee, approved estimate) → In progress
  (branch exists) → Code review (PR open, CI green) → Testing (merged and on staging or preview)
  → Done and finished (UAT ticked). Recurring work goes to `LTT`.
- **PR finishing** uses `final-pr-review`.
- **Process tiers**: `full` for applications, `light` for websites; recorded in the project
  profile. Light replaces ADRs with `docs/rozhodnuti.md`, the plan with a page table and UAT
  with acceptance on the preview plus the launch checklist.
- **Astro checks**: a Jenkins `Checks` stage is mandatory (`astro check`, `tsc`, lint and format
  check, build, Playwright smoke of every route at 1440 and 390 px failing on console errors,
  with SEO assertions). Lighthouse budgets and axe are
  mandatory before launch.
