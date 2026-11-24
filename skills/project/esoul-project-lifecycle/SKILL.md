---
name: esoul-project-lifecycle
description: Use when starting, onboarding or auditing an eSoul client project, after a client meeting or answers, or when writing an ADR, glossary term, design brief or plan - bootstrap or retrofit the repository, ingest podklady and legacy evidence, keep question issues, ADRs and the sliced plan true, batch slices into issue + Freelo pairs, check conformance. Prepares work for `esoul-workflow`; does not implement features.
---

# eSoul project lifecycle

eSoul keeps AI-built projects at high quality by deciding everything *before* an agent writes
code: client evidence, vocabulary, decisions, design and a sliced plan live in the repository,
and every work item is a prepared issue that points back to them. This skill owns that
preparation and its upkeep. It ends when a slice exists as a ready issue with UAT; from there,
`esoul-workflow` implements one issue at a time.

## 1. Load context

1. Use repository instructions already in context (`CLAUDE.md`, `AGENTS.md`, earlier reads);
   do not read them again. The project's guidelines (`docs/project_guidelines/`) and its root
   `CONTEXT.md` override this skill; report a conflict instead of choosing. Read the `CONTEXT.md`
   sections you need. Read `docs/adr/index.md` and `docs/plan/README.md` (or `docs/plan.md`) when
   the mode touches decisions or the plan, and `GLOSSARY.md` in full only in `glossary`, `audit`
   and `retrofit`; otherwise look terms up on demand.
2. Resolve the **project profile** from `CONTEXT.md › ## Project profile`: stack, archetype,
   process tier (`full` or `light`), environments, UAT dimensions. When it is missing, propose
   one (see [tiers.md](references/tiers.md)), get confirmation, and write it.
3. Read the stack profile for the recorded stack only in the modes whose row below lists
   "stack profile" (`bootstrap`, `handover`): [laravel](references/stacks/laravel.md),
   [lunar](references/stacks/lunar.md), [lsr](references/stacks/lsr.md),
   [astro](references/stacks/astro.md). These are the common eSoul stacks, not a closed list.
   For any other stack, follow [new-stack.md](references/stacks/new-stack.md). The scripts
   (`scripts/*.mjs`) need Node 22 or newer.
4. Find facts yourself (repository, `gh`, Freelo, podklady). Ask the user only for decisions.
   Bulk reading goes to a read-only explorer, and Freelo or `gh` reads and approved writes to an
   ops helper, when the harness offers subagents (role briefs: `esoul-model-routing`); otherwise
   do these steps yourself, as each mode's reference says. The session keeps decisions and
   previews.

## 2. Pick the mode

Pick one mode, say which in one line, and read only the references it names.

| Mode | When | References |
|---|---|---|
| `bootstrap` | New project, empty or skeleton repository | [bootstrap](references/bootstrap.md), [root-files](references/root-files.md), [labels](references/labels.md), skill `esoul-guidelines`, stack profile; [tiers](references/tiers.md) only when the profile is missing |
| `retrofit` | Existing project brought to the standard | [retrofit](references/retrofit.md), [root-files](references/root-files.md), [audit](references/audit.md), skill `esoul-guidelines` |
| `intake` | New client files, exports, legacy dumps | [podklady-and-legacy](references/podklady-and-legacy.md), [questions-and-client](references/questions-and-client.md) |
| `client-update` | After a meeting, written answers, design feedback | [questions-and-client](references/questions-and-client.md), then whatever it touches |
| `glossary` | New or disputed domain term | [glossary](references/glossary.md) (with the installed `domain-modeling` skill) |
| `adr` | A decision with real alternatives | [adr](references/adr.md) (with the installed `domain-modeling` skill) |
| `design` | Design brief, Pencil, mockup review rounds | [design](references/design.md) |
| `plan` | Phases, gates, scope, slices, risks | [plan-and-slices](references/plan-and-slices.md) |
| `handover` | Prepare the codebase so agents can start | [dev-handover](references/dev-handover.md), stack profile |
| `tasking` | Turn ready slices into issue + Freelo pairs | [tasking-batch](references/tasking-batch.md), [labels](references/labels.md) |
| `audit` | Read-only conformance and completeness check | [audit](references/audit.md), [labels](references/labels.md) |

Not modes of this skill: the go-live of a public website and its case-study snapshots
(`esoul-website-launch`), the non-functional checks of a website at any time (Lighthouse, axe,
link prefetch, security headers, AI readiness: `esoul-quality-gates`), the guidelines installer
(`esoul-guidelines`) and the update of a template-born project (`esoul-project-update`).

## 3. Phases and gates

The full tier runs these phases in order; the light tier runs the reduced set in
[tiers.md](references/tiers.md). A gate is a human approval by the approver named in the table
(the project lead or CTO when none is named), recorded in the PR that closes the phase. Do not start a later phase before its gate, except
`client-update`, which may reopen any phase.

| Phase | Output | Gate |
|---|---|---|
| P0 Bootstrap | Root files, guidelines installed and checked, templates, CONTEXT profile, CI green on the empty scaffold, case-study snapshot of the original site (`esoul-website-launch`) | B0 |
| P1 Podklady and legacy | `docs/podklady/` notes, `docs/legacy/`, files in `assets/` via LFS | — |
| P2 Questions and workshop | Open `question` issues, a questionnaire generated from them, dated answer transcripts | — |
| P3 Glossary and ADRs | `GLOSSARY.md`, ADRs as `proposed` | — |
| P4 Accepted decisions | ADRs `accepted`, project-specific guideline files, `docs/data-model.md` | B1 |
| P5 Design | Brief, `.pen`, mockup bundle, client review rounds | B2 (client) |
| P6 Plan | Phases, gates, scope, slice list, risks | B3 (client + CTO) |
| P7 Development handover | Tooling, architecture or structure checks, parity fixtures, reference module, CI green | B4 |
| P8 Tasking | Issue + Freelo pairs, milestones, `blocked_by` | — |
| P9 Completeness audit | Plan ↔ issues ↔ Freelo ↔ podklady ↔ ADR report resolved | B5: issues become `ready-for-agent` ([labels](references/labels.md)) |

One exception is allowed: the project lead may approve tasking (P8) for a phase before B4, for
example to make a retrofit visible as pairs. Record that approval in the PR that updates the
slice table; the issues stay out of `ready-for-agent` until B5.

Gates B0–B5 are eSoul's readiness gates. The plan's delivery gates `G0`, `G1`, … are the
milestones agreed with the client; `G0` (ready for development) is reached at B5.

## 4. Rules that live elsewhere

This skill holds no company rule of its own beyond its process: the process tiers
([tiers.md](references/tiers.md)), gates B0–B5 (above) and the label set
([labels.md](references/labels.md)). Every other rule lives in the guideline or skill named here.

| Topic | Owner |
|---|---|
| Issue first; titles; estimates; `## UAT`; dependencies; Freelo states | `docs/project_guidelines/workflow.md` › Tasking; `esoul-task-create` (creation), `esoul-task-work` (working rules) |
| Merging (squash, `Jenkins` check, one approval, no bypass; agents do not merge or approve without authorisation) and PR review | `workflow.md` › Pull requests; `esoul-review` |
| Commits and the PR title | `workflow.md` › Commits; `gitmoji-commit` (recommended format) |
| CONTEXT.md holds conventions, GLOSSARY.md domain language, ADR or guideline | `documentation.md` › Where a piece of knowledge belongs; `domain.md` |
| Astro `Checks` stage | the `framework/astro` guideline, `tools.md` |
| Public-website rules (crawling, preview gate, redirects) | `public-website.md`; the checks: `esoul-quality-gates` |

## 5. Guardrails

- Documentation changes follow the project's workflow guideline: a PR in client repositories;
  under `profile/internal` a direct push is allowed (ask whether the repository is internal,
  never assume). A change to a guideline rule is its own PR in `esoul-cz/guidelines`, never an
  edit inside a managed block.
- Every issue, Freelo task, issue dependency and update of an existing pair goes through
  `esoul-task-create` with an approved preview and read-back. This skill writes remote state
  directly only for: GitHub milestones and labels, repository merge settings and rulesets, and
  closing issues the client cancelled as „not planned“ or answered (`question` issues) with a
  comment citing the ADR or the place of the answer. Each such write needs a preview of the exact
  `gh` calls and explicit approval, then a read-back.
- A missing fact is written as `TBD` and becomes a `question` issue; open client questions are
  not the agent's to answer (`domain.md` › Open points and conflicts). Accepted ADRs change only
  by dated note or supersession ([adr.md](references/adr.md)).
- Numbers and calculations come only from the client's materials or a recorded decision, and a
  spreadsheet is pinned with parity tests: `domain.md` › Open points and conflicts. The materials
  are the podklady; an ambiguous or wrong source becomes a `question` issue.
- Source material without personal data lives in `assets/klient/` (Git LFS) and `docs/podklady/`;
  personal data and non-anonymised exports follow `security-and-data.md`, and a gitignored local
  folder (by convention `_reference/`) holds non-anonymised legacy evidence
  ([podklady-and-legacy.md](references/podklady-and-legacy.md)).
- Identifiers (`ADR-NNNN`, slices such as `F1-17`, gates `G1`, risks `R-nn`, client inputs
  `K-nn`, light-tier decisions `D-nn`) are never renumbered or reused. Questions are tracker
  issues and carry their issue number.
- Template placeholders are `{{UPPER_SNAKE_CASE}}`. None may remain in a project; `audit` fails on
  them.
- Copy templates only into missing files. Never overwrite an existing project file; propose a
  diff instead.

## 6. Companion skills

| Need | Skill |
|---|---|
| Issue and Freelo writes | `esoul-task-create` (project layer), with the official `freelo` skill (layer upstream-core) |
| Picking up and moving a task | `esoul-task-work` (core) |
| Implementation of one issue | `esoul-workflow` (core) |
| Guidelines installer and `check` | `esoul-guidelines` (core) |
| Commits | `gitmoji-commit` (helpers layer) |
| PR review loop | `esoul-review` (dev) |
| Template update of a project | `esoul-project-update`: carries a template-born project from the commit in `.esoul/template.json` to the latest template, and adopts one that has no record |
| Website go-live, case study | `esoul-website-launch` |
| Website quality checks | `esoul-quality-gates` |
| Data tasks and source-data placement | `esoul-data` |
| Mockup bundles and review | `esoul-mockup-authoring` |
| Application guides (PDF) | `esoul-docs` |
| The client questionnaire as `.docx` | `esoul-office-documents` (business layer) |
| Decision interviews | the installed `domain-modeling` and `grilling` skills (layer upstream-core), plus the eSoul additions in [glossary.md](references/glossary.md) and [adr.md](references/adr.md) |

If a companion is missing, tell the user which layer holds it (`npx @esoul-cz/skills layers` lists
them, `npx @esoul-cz/skills install <layer>` installs one) and do the part of the work that needs
no companion.

## 7. Finish every run

Report in this order: mode and phase; files changed and the PR link; questions added or closed;
ADRs added or changed with status; slices or issues affected; what is still blocked and by
which question or gate; the next gate and who approves it.
