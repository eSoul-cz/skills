---
name: esoul-project-lifecycle
description: Run an eSoul client project from first client materials to agent-ready work - bootstrap or retrofit the repository, ingest podklady and legacy evidence, keep questions, glossary, ADRs, guidelines, design brief and a sliced plan, batch slices into issue + Freelo pairs, and audit conformance. Use when starting or onboarding an eSoul project, after a client meeting or answers, when writing an ADR or a plan, or when checking a project's conformance. Does not implement features.
---

# eSoul project lifecycle

eSoul keeps AI-built projects at high quality by deciding everything *before* an agent writes
code: client evidence, vocabulary, decisions, design and a sliced plan live in the repository,
and every work item is a prepared issue that points back to them. This skill owns that
preparation and its upkeep. It ends when a slice exists as a ready issue with UAT; from there,
`esoul-workflow` implements one issue at a time.

## 1. Load context

1. Use repository instructions already in context (`CLAUDE.md`, `AGENTS.md`, earlier reads);
   do not read them again. Read the root `CONTEXT.md` conventions you need by section. Read
   `docs/adr/index.md` only in `adr`, `guidelines`, `plan`, `tasking`, `audit` and `retrofit`
   modes, and `docs/plan/README.md` (or `docs/plan.md`) only in `plan`, `tasking`, `audit`,
   `retrofit` and `client-update` modes, when present. Read
   `GLOSSARY.md` in full only in `glossary`, `audit` and `retrofit` modes; otherwise look up
   terms on demand. Repository rules override this skill unless they contradict an approved
   company rule in section 4; report such conflicts.
2. Resolve the **project profile** from `CONTEXT.md › ## Project profile`: stack, archetype,
   process tier (`full` or `light`), environments, UAT dimensions. When it is missing, propose
   one (see [tiers.md](references/tiers.md)), get confirmation, and write it.
3. Read the stack profile for the recorded stack only in the modes whose row below lists
   "stack profile" (`bootstrap`, `guidelines`, `handover`): [laravel](references/stacks/laravel.md),
   [medusa-nuxt](references/stacks/medusa-nuxt.md), [astro](references/stacks/astro.md). These
   are common eSoul stacks, not a closed list. For any other stack, follow
   [new-stack.md](references/stacks/new-stack.md).
4. Find facts yourself (repository, `gh`, Freelo, podklady). Ask the user only for decisions.
   In an orchestrated session, bulk reading goes to `esoul-skills:scout` and Freelo or `gh`
   reads and approved writes to `esoul-skills:ops`, as each mode's reference says; the session
   keeps decisions and previews.

## 2. Pick the mode

Pick one mode, say which in one line, and read only the references it names.

| Mode | When | References |
|---|---|---|
| `bootstrap` | New project, empty or skeleton repository | [bootstrap](references/bootstrap.md), [tiers](references/tiers.md), stack profile |
| `retrofit` | Existing project brought to the standard | [retrofit](references/retrofit.md), [audit](references/audit.md) |
| `intake` | New client files, exports, legacy dumps | [podklady-and-legacy](references/podklady-and-legacy.md), [questions-and-client](references/questions-and-client.md) |
| `client-update` | After a meeting, written answers, design feedback | [questions-and-client](references/questions-and-client.md), then whatever it touches |
| `glossary` | New or disputed domain term | [glossary](references/glossary.md), [domain-modeling](references/domain-modeling.md) |
| `adr` | A decision with real alternatives | [adr](references/adr.md), [domain-modeling](references/domain-modeling.md) |
| `guidelines` | Engineering rules for the stack or project | [guidelines](references/guidelines.md), stack profile |
| `design` | Design brief, Pencil, mockup review rounds | [design](references/design.md) |
| `plan` | Phases, gates, scope, slices, risks | [plan-and-slices](references/plan-and-slices.md), [company-rules](references/company-rules.md) |
| `handover` | Prepare the codebase so agents can start | [dev-handover](references/dev-handover.md), stack profile |
| `tasking` | Turn ready slices into issue + Freelo pairs | [tasking-batch](references/tasking-batch.md), [company-rules](references/company-rules.md) |
| `audit` | Read-only conformance and completeness check | [audit](references/audit.md), [company-rules](references/company-rules.md) |
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

Approved for every eSoul project; templates already follow them. Full wording in
[company-rules.md](references/company-rules.md), which the `tasking`, `plan` and `audit`
modes load. One line per rule and its owner:

- Titles of issue, Freelo task and PR are identical, no prefix, no slice ID: `esoul-tasking`.
- Freelo estimates are human time; work reports count active work only: `esoul-freelo-task-authoring`, `freelo`.
- CONTEXT.md holds conventions and the `## Freelo` cache; GLOSSARY.md holds domain language only.
- ADRs are English, with Implementation status and gaps: [adr.md](references/adr.md).
- UAT in the issue uses the `## UAT` format: `esoul-tasking`.
- Dependencies: GitHub `blocked_by` is the source of truth, mirrored in Freelo: `esoul-tasking`.
- Merging: squash, `Jenkins` check, one human approval, no bypass; agents never merge.
- Freelo states: Backlog, To Do, In progress, Code review, Testing, Done; recurring work in `LTT`.
- PR finishing: `final-pr-review`.
- Process tiers: `full` for applications, `light` for websites: [tiers.md](references/tiers.md).
- Astro checks: mandatory Jenkins `Checks` stage; Lighthouse and axe before launch: [astro](references/stacks/astro.md).

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
| Decision interviews | [domain-modeling](references/domain-modeling.md) here; rounds of questions as in `esoul-workflow` › references/grilling.md |

If a required companion is missing, stop and give the install command for the whole chain
(the installer does not resolve dependencies), replacing `codex` with the user's agent:
`npx skills@1.7.2 add eSoul-cz/skills --skill esoul-project-lifecycle esoul-tasking
esoul-freelo-task-authoring freelo --agent codex --yes`.

## 7. Finish every run

Report in this order: mode and phase; files changed and the PR link; questions added or closed;
ADRs added or changed with status; slices or issues affected; what is still blocked and by
which question or gate; the next gate and who approves it.
