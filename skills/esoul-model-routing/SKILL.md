---
name: esoul-model-routing
description: Choose the model, effort and delegation for an eSoul task so the weekly usage limit buys the most good output. Use when starting a task under esoul-workflow, when delegating to a subagent or a Zeron child chat, when the user asks to make work cheaper, faster or more thorough, or when usage runs out too fast. Covers the orchestrator and worker roles (the esoul-skills plugin agents), effort defaults, the context budget, the model lineup and how to measure usage.
---

# eSoul model routing

Put the right model, effort and context behind each piece of eSoul work. The expensive model orchestrates, decides and reviews; cheaper models do the reading, running and typing.

## Where usage goes

Every request re-reads the whole conversation. Prompt caching makes that re-read cost a tenth of fresh input, but in long sessions it still dominates: measured on eSoul sessions, about three quarters of the main session's cost was re-reading context and under a tenth was output. Cost per session grows faster than its length, because each step re-reads everything before it.

So the order of levers is:

1. **Context size and number of steps in the main session** (biggest).
2. **The model of the work that is delegated.**
3. **Effort** (smallest, but free to change).

Subagent tokens count toward the same plan limits as the main conversation; delegation saves usage because workers run on cheaper models with small fresh contexts, not because their work is free.

## What this skill can and cannot do

- It cannot switch the model of the turn already running. It can recommend the session model and effort (the person sets them), and it picks the model and effort of every subagent or child chat it starts.
- When a task clearly wants a different session model, say so in one line instead of pretending to have switched.

## Roles

The orchestrator is the main session. In Claude Code the `esoul-skills` plugin ships the worker roles as agents with their model and effort fixed in frontmatter, so routing does not depend on remembering a `model` parameter. The plugin's SessionStart hook injects these rules into every session, and a PreToolUse guard blocks Explore, forks, and general-purpose or Plan agents without a `model` (planning belongs to the orchestrator; if you delegate it, pass `sonnet`) (set `ESOUL_AGENT_GUARD=off` to disable it). Start them with `subagent_type: "esoul-skills:<role>"`. Where these agents are not installed (or in another harness), start a fresh general-purpose subagent with the same model and effort and paste the role's rules into the brief.

| Role | Model · effort | Does |
|---|---|---|
| Orchestrator (main session) | `opus` · `medium`; `high` while clarifying or planning M; `xhigh` for L, security-sensitive work, or a bug that resisted | Sizing, decisions, briefs, reviewing diffs and findings, final judgement, anything the user talks to |
| `esoul-skills:scout` | `haiku` · `medium` | Read-only search, inventories, "where/how is X", facts from logs and exports. Use it instead of Explore, which runs on the main session's model. |
| `esoul-skills:test-runner` | `haiku` · `low` | Runs tests, builds, linters, sweep scripts; returns receipts and failures only |
| `esoul-skills:implementer` | `sonnet` · `medium` | Builds a specified change with tests; fixes failures and findings with a clear cause |
| `esoul-skills:reviewer` | `sonnet` · `medium` | Review lenses, catalogue and documentation audits |
| `esoul-skills:critical-reviewer` | `opus` · `high` | Correctness and security on changes touching authorization, money, migrations or destructive data scripts, personal data or concurrency |
| `esoul-skills:uat-runner` | `sonnet` · `medium` | Executes UAT chapters in the browser and records results |
| `esoul-skills:ops` | `haiku` · `low` | Commits, `gh`/git queries, Freelo reads and already-approved writes, work reports |

Never use a fork (an Agent call that copies this conversation): it always runs on the main session's model and carries the whole context.

## When to delegate

- **Size S** (one obvious change, three files or fewer): do it directly; a brief and a diff review would cost as much as the work. Better still, run the whole session on `sonnet`.
- **Size M and L:** the orchestrator settles decisions and writes the brief; `implementer` builds; `test-runner` verifies; the orchestrator reviews the diff and the receipts. Send fixes back to the same implementer (SendMessage) so it keeps its context.
- **Any search over more than a few files, any verification run, any log or export:** delegate, so the raw output never enters the main context.
- **Escalate, never loop:** after two failed attempts on a worker model, the orchestrator takes over or raises the model. Do not try a third time on the same model.
- Independent workers start in one message so they run in parallel. Do not start subagents for work that needs this conversation's shared context more than it needs isolation; that is where multi-agent work wastes tokens.

### Brief

A worker knows only its brief. Write it like a ticket: goal; acceptance criteria; files and areas; decisions already made (and by whom); boundaries (what not to touch); the verification command; the answer format and length. A one-line brief produces duplicated or misdirected work.

## Context budget for the main session

- **One task, one session.** `/clear` between unrelated tasks; when work continues elsewhere, write a handoff (`esoul-workflow` references/handoff.md) and start fresh.
- **Auto-compact early:** keep `autoCompactWindow` for the main models around 250K (see Settings). It also caps 1M-context sessions (`[1m]` models, Zeron's 1M option). Keep plans and decisions in files, not only in the conversation, so compaction loses nothing important.
- **1M context only by exception:** the window costs nothing, but every request re-reads what fills it, so a 900K request costs about 3.5 times a 250K one, on every turn. Raise the cap (`/autocompact 1m`) for one short session that must hold a large input at once and cannot split it, and end it when done. Prefer giving the large input to a subagent, which reads it once and returns a summary. Never make it the default, and never use it just to avoid compaction in a long interactive session.
- **Keep large outputs out:** read files with offset and limit or through `scout`; never paste whole logs, `gh ... --json` dumps, test output or browser snapshots into the main session.
- **Fewer steps:** batch independent tool calls in one message, chain related shell commands in one call, and wait with the harness's background or Monitor facility or a bundled waiter (`final-pr-review`'s `wait-pr.mjs`), never with `sleep` loops.
- **Keep the cache warm:** do not switch the session model mid-task (each switch re-reads the whole history uncached, which is also why `opusplan` is not the default), and do not change MCP servers or `CLAUDE.md` mid-session.

## Models (verify with the docs when unsure)

As of October 2026. Prices are per million tokens (input / output).

| Model | Alias | API id | Price in/out | Default effort | Use for |
|---|---|---|---|---|---|
| Fable 5.1 | `fable` | `claude-fable-5-1` | $10 / $50 | `high` | The hardest, longest, most autonomous jobs when Opus at `xhigh` falls short |
| Opus 5.5 | `opus` | `claude-opus-5-5` | $4 / $20 | `medium` | Orchestration, design, review of risky changes |
| Sonnet 5.5 | `sonnet` | `claude-sonnet-5-5` | $2 / $10 | `medium` | Implementation, tests, reviews, UAT runs; whole S sessions |
| Haiku 5.5 | `haiku` | `claude-haiku-5-5` | $0.10 / $0.50 up to 100K prompt tokens, $0.50 / $2.50 above | `medium` | Search, running commands, extraction, chores |

- `best` resolves to `fable` where available, otherwise `opus`; use it in shared instructions so colleagues without Fable fall back automatically.
- Availability differs per person and org. If a model is refused, take the next one down and say which model actually ran.
- Effort tunes thinking, not the model: try Opus at `high` or `xhigh` before Fable.
- The advisor feature (`/advisor opus` on a Sonnet session) is experimental and each consultation re-reads the conversation uncached; try it for S and M work in short sessions only.

## Settings

The person's `~/.claude/settings.json` (the person sets it, or approves the change):

```json
{
  "model": "opus",
  "effortLevel": "medium",
  "modelSettings": {
    "claude-opus-5-5": { "effortLevel": "medium", "autoCompactWindow": 250000 },
    "claude-fable-5-1": { "effortLevel": "high", "autoCompactWindow": 250000 }
  },
  "env": { "CLAUDE_CODE_SUBAGENT_MODEL": "sonnet" },
  "permissions": { "deny": ["Agent(fork)"] }
}
```

- Never save `xhigh` as a model's default: every turn, including commits and lookups, then pays for the deepest reasoning. Raise it per session with `/effort xhigh`; `max` is a one-off.
- In user settings the top-level `effortLevel` no longer applies to Opus 5.5; set the model's `modelSettings` entry.
- `CLAUDE_CODE_SUBAGENT_MODEL` is only the fallback for subagents that name no model; plugin agent frontmatter and an explicit `model` win. Do not set `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` or `CLAUDE_CODE_EFFORT_LEVEL`: they override every role above.
- Session commands: `/model sonnet|opus|haiku|fable|best`, `/effort low|medium|high|xhigh|max`, `/autocompact 250k`.

## Zeron

Zeron chats run the Claude Code harness with the same plugins and settings, so the roles above work there too. Two Zeron specifics:

- **A chat's model and reasoning level set in Zeron override `settings.json`.** Keep Zeron's default for new chats at Opus 5.5 · `medium` and the title model on Haiku; raise the level per chat when the task needs it.
- **Child chats** (`create_chat`/`create_chats`, one level deep) are full sessions with their own model and effort. Use them for long, independent work the person wants to see or steer (one plan slice per chat on `claude-sonnet-5-5` · `medium`, UAT chapters in parallel); use subagents for short jobs that return a summary. Both count toward the same limit, except work delegated to a non-Claude harness such as Codex, which uses that provider's quota.

## Codex

The roles map to Codex custom agents of the same name, generated from `agents/` with the models `haiku` → `gpt-6-luna`, `sonnet` → `gpt-6.1-terra`, `opus` → `gpt-6.1-sol`. From a clone of this repo run `node codex/install.mjs` (agents into `~/.codex/agents`, rules into `~/.codex/AGENTS.md`) and merge `codex/config.toml` into `~/.codex/config.toml` by hand. Codex work counts against the OpenAI quota, not Claude's.

## Measure

Run the bundled report before and after a change in habits (it reads local transcripts only and takes a minute or two):

```bash
node <this skill>/scripts/usage-report.mjs --days 7
```

It shows the share of usage per model in main sessions and subagents, how much of the main session's cost comes from requests above 300K context, and which model each subagent type actually ran on. A plugin agent that ran on another model than its frontmatter names is flagged: subagent routing has had intermittent bugs where configured models were ignored, so check before trusting the savings.

## Reporting

When this skill informs a choice, say it in one line, for example:

```text
Model: sonnet session · S fix in one module; Opus would be overkill.
Delegation: implementer (sonnet) builds slice 2, test-runner verifies; I review the diff.
```
