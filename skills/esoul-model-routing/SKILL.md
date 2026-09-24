---
name: esoul-model-routing
description: Choose and set the right Claude model and effort level for an eSoul task, to balance cost and quality. Use when deciding which model to run, when the user asks to make work cheaper, faster or more thorough, when picking a model for a subagent, or when starting a task under esoul-workflow. Covers the current model lineup (Fable, Opus, Sonnet, Haiku) and the Claude Code aliases.
---

# eSoul model routing

Guidance for putting the right Claude model and effort behind each eSoul task. Cheaper models on simple work, stronger models where a mistake is expensive.

## What this skill can and cannot do

- It **cannot** hot-swap the model of the turn already running. The model for a turn is fixed when the turn starts, chosen by the user or by configuration.
- It **can**: recommend which model and effort to set, tell the user the exact command to set it, and choose the `model:` for a subagent that this skill dispatches (a subagent runs on its own model). So "route" here means *advise and set*, not silently switch mid-turn.
- When a task clearly wants a different model than the one running, say so in one line and let the user switch, rather than pretending to have switched.

## Current models (verify with the docs when unsure)

As of June 2026, newest to lightest. Prices are per million tokens (input / output).

| Model | Claude Code alias | API id | Price in/out | Use for |
|---|---|---|---|---|
| Fable 5.1 | `fable` | `claude-fable-5-1` | $10 / $50 | The hardest, longest, most autonomous jobs; when Opus at high effort still falls short. |
| Opus 5.5 | `opus` | `claude-opus-5-5` | $4 / $20 | Default for real engineering and knowledge work; long-running agentic coding. |
| Sonnet 5 | `sonnet` | `claude-sonnet-5` | $2 / $10 | Everyday coding, writing and analysis; the versatile middle. |
| Haiku 4.5 | `haiku` | `claude-haiku-4-5` | $1 / $5 | Fast, cheap, simple: lookups, extraction, formatting, small mechanical edits. |

Notes:
- Opus 5.5 is the account default and is already strong; do not reach for Fable by reflex. Fable costs about 2.5x Opus per token.
- `best` resolves to `fable` where available, otherwise `opus`. It is the safe alias for a shared team: colleagues with Fable get it, those without fall back to Opus automatically, one instruction for everyone.
- Availability differs per person and per org. Fable is a paid model that some eSoul colleagues have and others do not. Never assume a model is available; if a set model is refused, fall back to the next one down and say so.

## Choosing a model

Map to the task size from `esoul-workflow` when it is in play.

| Task | Model | Why |
|---|---|---|
| Typo, rename, format, lint fix, copy tweak, single obvious line | `haiku` | Trivial and mechanical; speed and cost win. |
| Small bug fix, one focused function, add a test, config change (workflow size S) | `sonnet` | Real but contained; Sonnet handles it well. |
| A feature, multi-file change, new endpoint, migration, a WordPress/Laravel change with real logic (size M) | `opus` | Reasoning across files; the default for eSoul dev. |
| System or domain design, security-sensitive work, a large refactor, a gnarly bug you have already failed once with a lighter model (size L, or Bug that resisted) | `best` (Fable, else Opus) | Sustained reasoning; the cost of a mistake is high. |
| Data analysis: profiling and cleaning | `sonnet` | Mechanical, high volume of tokens. |
| Data analysis: interpretation, method choice, the write-up | `opus` | Judgement and correctness matter. |

Escalate, do not de-escalate silently: if a lighter model is going in circles, stop and recommend stepping up rather than burning more turns.

## Choosing effort (on the model that supports it)

Effort tunes how much the model thinks. It is separate from the model and often the cheaper lever.

- `low`: short, scoped, latency-sensitive work.
- `medium`: cost-sensitive work; the Opus 5.5 default.
- `high`: the balanced default for most models.
- `xhigh` / `max`: deep reasoning for the hardest problems, at higher cost; `max` is a one-off.

Reach for lower effort on a strong model before jumping to Fable: Opus at `high` or `xhigh` is often enough and cheaper than Fable.

## How to set it (Claude Code, terminal or VS Code)

The person sets these; state the command, do not claim to have run it.

Model for the current session:

```text
/model opus            # or: sonnet, haiku, fable, best, default
```

At startup, or as a saved default:

```bash
claude --model opus
```

```json
// ~/.claude/settings.json
{ "model": "opus" }
```

Effort:

```text
/effort high           # or: low, medium, xhigh, max
```

Useful aliases: `opusplan` (Opus while planning, Sonnet to execute), `sonnet[1m]` / `opus[1m]` (1M-token context for very large inputs), `default` (revert to the account default).

## Model for a subagent

A subagent runs on its own model, set in its frontmatter. This is the one place a skill genuinely picks the model for work it launches.

```markdown
---
model: haiku      # or sonnet / opus / fable / best / inherit
---
```

- `inherit` (the default) uses the parent session's model.
- Put cheap, parallel, mechanical fan-out work (search, extraction, first-pass review) on `haiku` or `sonnet`; keep synthesis and final judgement on the parent model.

## When the model is not available

If a chosen model is refused (not on the person's plan, or restricted by the org), Claude Code falls back to the newest permitted model and warns. In that case take the next model down from the table, tell the person which model actually ran, and continue rather than failing.

## Reporting

When this skill informs a choice, note it in one short line so the person sees the reasoning and the cost trade-off, for example:

```text
Model: sonnet · effort high — contained bug fix in one module; Opus would be overkill.
Model: best (Fable where available) · security-sensitive refactor; correctness outweighs cost.
```

Do not add banners, dashboards or metrics tables; one line is enough.
