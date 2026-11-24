# Batch tasking from slices (P8, `tasking`)

Every write goes through `esoul-task-create` (project layer; it needs the official `freelo` skill, layer upstream-core).
This reference only adds what a batch from the slice table needs.

## Before the batch

1. Gates B1–B4 are approved, or the project lead has approved early tasking for this phase as
   described in SKILL.md › Phases and gates. Issues created early stay `needs-info` or
   `needs-triage` until B5.
2. `CONTEXT.md` has `## Freelo`, `## Tasking convention` (`github-freelo` for the full tier) and
   `## Project profile › UAT dimensions`.
3. GitHub milestones exist for every phase, and the labels from the bootstrap exist. Creating
   missing ones is part of the preview.
4. Read every slice row. Reading its sources (ADR, guideline, podklad, design frame) and the
   code it touches goes to a cheap read-only explorer subagent when the harness offers one (otherwise you read it) with the slice rows in the brief,
   returning verified paths with `file:line` evidence. Unverified paths do not go into
   `Affected areas`.
5. Load [company-rules.md](company-rules.md) once for the batch.

## First batch and AI-ready slices

For `website`, `website-admin` and `eshop` projects (and `application` with a public part), the
first batch right after bootstrap includes the standard slices `AI-01`…`AI-06` (`AI-06` for
`eshop` only) from the plan, adapted to the stack, so their pairs exist from the start
([ai-readiness.md](ai-readiness.md)). Non-website projects have deleted them from the plan.

## Building each pair

- Title = the slice's Titulek. No category prefix, no slice ID.
- Issue header line: `**Slice:** F1-17 · **Fáze:** F1 (brána G1) · **Rozsah:** S`.
- Sections per `.github/ISSUE_TEMPLATE/task.yml` (English form labels, Czech content allowed):
  Context, Affected areas, What is needed, Out of scope, Acceptance criteria (technical, for the
  developer), `## UAT` (the format in `esoul-task-create`), Implementation notes, Dependencies,
  Links (ADR with status, plan section, design frames, Freelo), Contract check.
- Technical slices: `**Role:** vývojář eSoul` with verification through the pipeline or staging,
  or „Bez uživatelsky viditelného dopadu“ plus a concrete technical check.
- Labels: one category label (`frontend`, `backend`, `data-migration`, `infrastructure`,
  `documentation`) plus `integration` or `bug` when they apply. Triage at creation:
  `needs-triage`, or `needs-info` when it waits on a question or a proposed ADR. At gate B5,
  after the completeness audit, issues become `ready-for-agent`, or `ready-for-human` for work
  an agent cannot do (credentials, client calls, design).
- Milestone = the slice's phase.
- Freelo: first line `GitHub issue: <issue URL> · Slice F1-17 · Fáze F1 · Rozsah S`, then one or
  two sentences of outcome, `Hotovo, když:` ending with „UAT scénář v issue projde“. Category
  label and human-time estimate in 15-minute steps. Tasklist `Backlog`; `To Do` only when the
  task has an assignee, an approved estimate and no open blocker.
- `pm` slices become Freelo-only tasks with a self-contained description.

## Dependencies

Include every dependency in the `esoul-task-create` preview. It creates prerequisites first, writes
GitHub native `blocked_by` dependencies (the command and the database-id detail are in the
project's `docs/agents/issue-tracker.md`) and mirrors them as Freelo relations. A relation that
cannot be written is reported; no temporary comments.

## Batching

Preview in groups of at most 10 pairs, grouped by phase, so approval stays meaningful. After each
approved group: write and read back (an ops subagent runs the approved writes verbatim and
returns compact fields; without subagents you do it), then update the slice table's Issue column (also by the ops subagent, from the
read-back). One docs PR per phase is enough; add the Issue columns of every group of that
phase to it rather than opening a PR per group.
Finish with `audit` and a completeness review (P9): every slice has a pair, every pair maps to a
slice, every podklad requirement maps to a slice or an explicit exclusion.
