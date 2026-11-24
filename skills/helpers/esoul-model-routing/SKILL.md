---
name: esoul-model-routing
description: Pick model, effort and delegation for eSoul work and keep usage low. Use when delegating to a subagent or a Zeron child chat, when work should be cheaper or faster, or when usage runs out too fast. Holds the worker roles by job, brief contents, the context budget and the usage report; works with or without the optional worker agents. Human setup (models, settings, Zeron, Codex) is in references/setup.md.
---

# eSoul model routing

Put the right model, effort and context behind each piece of work: the strongest model orchestrates, decides and reviews; cheaper models do the reading, running and typing.

## Where usage goes

Every request re-reads the whole conversation. Prompt caching makes that re-read cost a tenth of fresh input, but in long sessions it still dominates; the usage report below shows the share for your own sessions. Cost per session grows faster than its length, because each step re-reads everything before it. The levers, biggest first:

1. **Context size and number of steps in the main session.**
2. **The model of the delegated work.**
3. **Effort** (smallest, but free to change).

Subagent tokens count toward the same plan limits as the main conversation; delegation saves usage because workers run on cheaper models with small fresh contexts, not because their work is free.

## What this skill can and cannot do

- It cannot switch the model of the turn already running. The person sets the session model and effort; say in one line when a task clearly wants another one.
- It picks the model and effort of every subagent or child chat it starts.

## Roles by job

The orchestrator is the main session: sizing, decisions, briefs, reviewing diffs and findings, final judgement, and everything the user talks to. Run it on the strongest model at `medium` effort; `high` while clarifying or planning M work, `xhigh` for L, security-sensitive work or a bug that resisted.

| Role | Job |
|---|---|
| scout | Read-only search, inventories, "where/how is X", facts from logs and exports |
| test-runner | Runs tests, builds, linters, sweep scripts; returns receipts and failures only |
| implementer | Builds a specified change with tests; fixes failures and findings with a clear cause |
| reviewer | One axis or lens of `esoul-review`, catalogue and documentation audits |
| critical-reviewer | The same on changes touching authorization, money, migrations or destructive data scripts, personal data or concurrency |
| uat-runner | Executes UAT chapters in the browser and records results |
| ops | Commits, `gh`/git queries, Freelo reads and already-approved writes, work reports |

`references/roles.md` holds, per role, the brief to give the worker, its recommended model alias and effort, and the plugin agent name where one exists. Rule of thumb behind it: the cheapest model (`haiku`) reads, runs and does chores; the middle one (`sonnet`) builds, reviews and runs UAT; the strongest (`opus`) orchestrates and reviews risky changes. Relative input price, `haiku` = 1: `sonnet` about 20, `opus` about 40, `fable` about 100 (check the provider's price list; the usage report holds the weights it uses).

**Start a worker** with the first option the harness offers:

1. The optional worker agent of that role, when installed (their names are in `references/roles.md`); the model and effort are pinned in the agent.
2. A generic subagent with an explicit model and effort from `references/roles.md`, whose prompt begins with the role's brief.
3. No subagents available: do the step yourself, following the role's brief.

Start every subagent with a self-contained brief and an explicit model: a fork copies the whole conversation and runs on the session model.

## When to delegate

- **Size S** (one obvious change, three files or fewer): do it directly; a brief and a diff review cost as much as the work.
- **Size M and L:** the orchestrator settles decisions and writes the brief; an implementer builds; a test-runner verifies; the orchestrator reviews the diff and the receipts. Send fixes back to the same implementer where the harness can continue a subagent (Claude Code: `SendMessage`), so it keeps its context.
- **Any search over more than a few files, any verification run, any log or export:** delegate, so the raw output never enters the main context.
- **Escalate, never loop:** after two failed attempts on a worker model, the orchestrator takes over or raises the model.
- Independent workers start in one message so they run in parallel. Keep work in the main session when it needs this conversation's shared context more than it needs isolation.
- **Child chats** (where the harness offers them, such as Zeron's `create_chat`): full sessions with their own model and effort, for long independent work the person wants to see or steer (one plan slice per chat, UAT chapters in parallel). Subagents are for short jobs that return a summary. For a chat on a GitHub issue or Freelo task pass the title `#<issue number> <issue title>` (Freelo-only: `Freelo <task id> <task title>`), about 60 characters.

### Brief

A worker knows only its brief. Write it like a ticket: goal; acceptance criteria; files and areas; decisions already made (and by whom); boundaries (what not to touch); the verification command; the answer format and length. The brief is ready when a worker could finish without asking you anything; a one-line brief produces duplicated or misdirected work.

## Context budget for the main session

- **One task, one session.** Between unrelated tasks start fresh (`/clear` in Claude Code); when work continues elsewhere, write a handoff first (the installed `handoff` skill, or a short file with goal, state and next step).
- **Compact early.** Recommend `autoCompactWindow` around 250K to the person (references/setup.md). Keep plans and decisions in files, not only in the conversation, so compaction loses nothing important.
- **1M context only by exception:** the window costs nothing, but every request re-reads what fills it, so a 900K request costs about 3.5 times a 250K one, on every turn. Use it for one short session that must hold a large input at once and cannot split it; prefer handing the large input to a subagent, which reads it once and returns a summary.
- **Keep large outputs out:** read files with offset and limit or through a scout; keep whole logs, `gh ... --json` dumps, test output and browser snapshots out of the main session.
- **Fewer steps:** batch independent tool calls in one message, chain related shell commands in one call, and wait with the harness's background or monitor facility (or `esoul-review`'s `wait-pr.mjs` when that skill is installed), not with `sleep` loops.
- **Keep the cache warm:** keep the session model, MCP servers and `CLAUDE.md` unchanged during a task; each change re-reads the whole history uncached.

## Measure

The usage report lives in the eSoul skills repository, `tooling/scripts/usage-report.mjs`; run it from a checkout of that repository (it reads local transcripts only and takes a minute or two):

```bash
node tooling/scripts/usage-report.mjs --days 7
```

Run it before and after a change in habits. It shows the share of usage per model in main sessions and subagents, how much of the main session's cost comes from requests above 300K context, and which model each subagent type ran on. Pass `--agents <dir>` when the agent definitions are elsewhere; without them the routing check is skipped.

Done when you can name the share of main-session cost above 300K context (the target is most cost below 200K) and whether any subagent type is flagged `check routing`. A flag means a subagent ran on a model other than the one its definition pins: configured models have been ignored intermittently, so report it to the person before trusting the savings.

## Human setup

Models, `settings.json`, Zeron, Codex and the optional plugin hooks are set up by the person: `references/setup.md`.

## Reporting

When this skill informs a choice, say it in one line, for example:

```text
Model: sonnet session · S fix in one module; Opus would be overkill.
Delegation: implementer builds slice 2, test-runner verifies; I review the diff.
```
