---
name: esoul-project-lifecycle
description: Run an eSoul client project from first client materials to agent-ready work. Bootstrap or retrofit the repository, ingest podklady and legacy evidence, keep the question register, glossary, ADRs, project guidelines, design brief and plan with slices, set up quality gates, batch slices into GitHub issue + Freelo pairs, audit completeness, and fold every client session back into the docs. Use when starting a new eSoul project, onboarding an existing one to the eSoul standard, after a client meeting or client answers, when writing an ADR or a plan, or when checking a project's conformance. Stack-agnostic, with profiles for common eSoul stacks (Laravel, Medusa/Nuxt, Astro) and a full or light process tier. Depends on esoul-tasking for issue and task writes and hands implementation to esoul-workflow. Does not implement features.
---

# eSoul project lifecycle

eSoul keeps AI-built projects at high quality by deciding everything *before* an agent writes
code: client evidence, vocabulary, decisions, design and a sliced plan live in the repository,
and every work item is a prepared issue that points back to them. This skill owns that
preparation and its upkeep. It ends when a slice exists as a ready issue with UAT; from there,
`esoul-workflow` implements one issue at a time.

## 1. Load context

1. Read applicable `AGENTS.md`, `CLAUDE.md`, root `CONTEXT.md`, `GLOSSARY.md`, `docs/adr/index.md`
   and `docs/plan/README.md` (or `docs/plan.md`) when present. Repository rules override this
   skill unless they contradict an approved company rule in section 4; report such conflicts.
2. Resolve the **project profile** from `CONTEXT.md › ## Project profile`: stack, archetype,
   process tier (`full` or `light`), environments, UAT dimensions. When it is missing, propose
   one (see [tiers.md](references/tiers.md)), get confirmation, and write it.
3. Read the stack profile for the recorded stack: [laravel](references/stacks/laravel.md),
   [medusa-nuxt](references/stacks/medusa-nuxt.md), [astro](references/stacks/astro.md). These
   are common eSoul stacks, not a closed list. For any other stack, follow
   [new-stack.md](references/stacks/new-stack.md).
4. Find facts yourself (repository, `gh`, Freelo, podklady). Ask the user only for decisions.

## 2. Pick the mode

Pick one mode, say which in one line, and read only the references it names.

| Mode | When | References |
|---|---|---|
| `bootstrap` | New project, empty or skeleton repository | [bootstrap](references/bootstrap.md), [tiers](references/tiers.md), stack profile |
| `retrofit` | Existing project brought to the standard | [retrofit](references/retrofit.md), [audit](references/audit.md) |
| `intake` | New client files, exports, legacy dumps | [podklady-and-legacy](references/podklady-and-legacy.md), [questions-and-client](references/questions-and-client.md) |
| `client-update` | After a meeting, written answers, design feedback | [questions-and-client](references/questions-and-client.md), then whatever it touches |
| `glossary` | New or disputed domain term | [glossary](references/glossary.md) |
| `adr` | A decision with real alternatives | [adr](references/adr.md) |
| `guidelines` | Engineering rules for the stack or project | [guidelines](references/guidelines.md), stack profile |
| `design` | Design brief, Pencil, mockup review rounds | [design](references/design.md) |
| `plan` | Phases, gates, scope, slices, risks | [plan-and-slices](references/plan-and-slices.md) |
| `handover` | Prepare the codebase so agents can start | [dev-handover](references/dev-handover.md), stack profile |
| `tasking` | Turn ready slices into issue + Freelo pairs | [tasking-batch](references/tasking-batch.md) |
| `audit` | Read-only conformance and completeness check | [audit](references/audit.md) |
| `launch` | Light tier, or any public website, before go-live | [launch](references/launch.md) |

## 3. Phases and gates

The full tier runs these phases in order; the light tier runs the reduced set in
[tiers.md](references/tiers.md). A gate is a human approval by the approver named in the table
(the project lead or CTO when none is named), recorded in the PR that closes the phase. Do not start a later phase before its gate, except
`client-update`, which may reopen any phase.

| Phase | Output | Gate |
|---|---|---|
| P0 Bootstrap | Repository rules, templates, CONTEXT profile, CI green on the empty scaffold | B0 |
| P1 Podklady and legacy | `docs/podklady/` notes, `docs/legacy/`, files in `assets/` via LFS | — |
| P2 Questions and workshop | `otevrene-otazky.md`, questionnaire, dated answer transcripts | — |
| P3 Glossary and ADRs | `GLOSSARY.md`, ADRs as `proposed` | — |
| P4 Accepted decisions | ADRs `accepted`, project guidelines, `docs/data-model.md` | B1 |
| P5 Design | Brief, `.pen`, mockup bundle, client review rounds | B2 (client) |
| P6 Plan | Phases, gates, scope, slice list, risks | B3 (client + CTO) |
| P7 Development handover | Tooling, architecture or structure checks, parity fixtures, reference module, CI green | B4 |
| P8 Tasking | Issue + Freelo pairs, milestones, `blocked_by` | — |
| P9 Completeness audit | Plan ↔ issues ↔ Freelo ↔ podklady ↔ ADR report resolved | B5: issues become `ready-for-agent` |

One exception is allowed: the project lead may approve tasking (P8) for a phase before B4, for
example to make a retrofit visible as pairs. Record that approval in the PR that updates the
slice table; the issues stay out of `ready-for-agent` until B5.

Gates B0–B5 are eSoul's readiness gates. The plan's delivery gates `G0`, `G1`, … are the
milestones agreed with the client; `G0` (ready for development) is reached at B5.

## 4. Company rules this skill enforces

These were approved for every eSoul project. Templates in `assets/templates/` already follow them.

- **Titles** of issue, Freelo task and PR are identical: `Kontext: Akční výsledek`. No `[FE]`,
  `[BE]`, `[DATA]` prefix and no slice ID in the title. Category is a label on both sides.
  The slice ID goes into the issue header line and the first line of the Freelo description.
- **Estimates** in Freelo are human time (briefing the agent, checking, review, UAT, fixes) in
  15-minute steps. Propose a split above 4 h. Actual time is logged as Freelo work reports.
- **CONTEXT.md** holds project conventions; **GLOSSARY.md** holds domain language only.
- **ADRs** are English, `docs/adr/NNNN-english-slug.md`, with Implementation status and gaps.
- **UAT** in the issue: `## UAT` with Role, Předpoklad and the project's UAT dimensions, then
  `1. [ ] akce → očekávaný výsledek`. Concrete values, no SQL or shell.
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

## 5. Guardrails

- Every documentation change goes through a PR. `CODEOWNERS` protects CONTEXT, GLOSSARY, ADRs,
  guidelines, AGENTS, CONTRIBUTING and `.github/`.
- Every issue, Freelo task, issue dependency and update of an existing pair goes through
  `esoul-tasking` with an approved preview and read-back. This skill writes remote state
  directly only for: GitHub milestones and labels, repository merge settings and rulesets, and
  closing issues the client cancelled as „not planned“ with a comment citing the ADR. Each such
  write needs a preview of the exact `gh` calls and explicit approval, then a read-back.
- A missing fact is written as `TBD` and becomes a question in the register. Never invent
  client answers, formulas, prices, legal or tax rules. Open client questions are not the
  agent's to answer.
- Never weaken an accepted ADR to match code. Change it by dated note or supersession.
- Numbers and calculations come only from podklady. Where the client works in spreadsheets,
  pin them with parity tests.
- Real client data lives only in `assets/` (Git LFS) and `docs/podklady/`, never in code, tests,
  fixtures, issues or PRs. Agents work only with anonymized dumps.
- Identifiers (`Q-nn` questions, `ADR-NNNN`, slices such as `F1-17`, gates `G1`, risks `R-nn`,
  client inputs `K-nn`, light-tier decisions `D-nn`, documentation decisions `DOC-NNNN`) are
  never renumbered or reused.
- Template placeholders are `{{UPPER_SNAKE_CASE}}`. None may remain in a project; `audit` fails on
  them.
- Copy templates only into missing files. Never overwrite an existing project file; propose a
  diff instead.

## 6. Companion skills

| Need | Skill |
|---|---|
| Issue and Freelo writes | `esoul-tasking` (requires `esoul-freelo-task-authoring`, `freelo`) |
| Implementation of one issue | `esoul-workflow` |
| Commits | `gitmoji-commit` |
| PR review loop | `final-pr-review` |
| Mockup bundles and review | `esoul-mockup-authoring` |
| Application guides and PDFs | `esoul-maintain-application-documentation` |
| Decision interviews | `grilling`, `domain-modeling` when installed |

If a required companion is missing, stop and give the install command:
`npx skills@1.7.2 add eSoul-cz/skills --skill <name> --agent <agent> --yes`.

## 7. Finish every run

Report in this order: mode and phase; files changed and the PR link; questions added or closed;
ADRs added or changed with status; slices or issues affected; what is still blocked and by
which question or gate; the next gate and who approves it.
