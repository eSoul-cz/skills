---
name: esoul-workflow
description: Default operating workflow for eSoul work on web applications (PHP/Laravel/Symfony, frontend), WordPress sites, and data analyses. Use at the start of any non-trivial eSoul task (build, change, fix, debug, review, analyse, or plan work) to size the task, load repository context, pick the right companion skill, and finish with verified, committed, reviewed output. Routes to gitmoji-commit, final-pr-review, esoul-tasking, esoul-mockup-authoring, esoul-maintain-application-documentation, and the Matt Pocock engineering skills (grilling, tdd, diagnosing-bugs, code-review, prototype, handoff) when installed.
---

# eSoul workflow

The single entry point for eSoul work. It decides *how much process* a task needs and *which skill* owns each step. It does not repeat what those skills say: when a step names a skill, invoke that skill and follow it.

## 1. Load context before touching anything

1. Read, in this order and only if present: applicable `AGENTS.md`, `CLAUDE.md`, root `CONTEXT.md`, then ADRs in the area being touched. Repository conventions always override this skill.
2. Identify the work type and read exactly one reference:
   - Web application or frontend: [references/web.md](references/web.md)
   - WordPress site: [references/wordpress.md](references/wordpress.md)
   - Data analysis, report, or spreadsheet: [references/data-analysis.md](references/data-analysis.md)
3. Navigate code efficiently, in this order of preference:
   - `codegraph_explore` MCP tool when available: one call returns the relevant source, call paths and blast radius. Prefer it over chains of Grep/Read for "how does X work", "where is X used", and "what breaks if I change X".
   - `codegraph explore "<query>"` CLI when a `.codegraph/` directory exists but the MCP tool is absent (typical for sub-agents).
   - Otherwise Grep/Glob, then Read only the files that matter.
   CodeGraph results stay resident in context. In long sessions, ask narrow questions rather than surveying whole areas repeatedly.
4. Find facts yourself. Ask the user only for decisions, never for things the repository, tools, or logs can answer.

## 2. Size the task

Pick the smallest size that fits, and say which size you picked in one line.

| Size | Signals | Flow |
|---|---|---|
| **S** | One obvious change, a few files, no design choice, no new dependency | Context → change → verify → commit |
| **M** | A feature or change with at least one real decision, new UI, schema or API change, or unclear acceptance | Clarify → (task) → build in slices → verify → review → commit → PR |
| **L** | More than one session of work, several modules, or unknown unknowns | Plan first, split into tasks, then run each task as M |
| **Bug** | Something is broken, failing, throwing, or slow | Diagnose → fix with regression test → verify → commit |
| **Analysis** | A question to answer from data | Follow references/data-analysis.md end to end |

Escalate the size as soon as a hidden decision appears. Never de-escalate silently.

When model or effort matters (a cheap mechanical job, or an expensive-to-get-wrong one), use the `esoul-model-routing` skill to pick the model and effort, then tell the user the command to set it.

## 3. Run the flow

### Clarify (M, L)

- Settle open decisions before writing code. When the `grilling` skill is installed, use it: ask the whole frontier of open decisions in one numbered round, each with a recommended answer. Otherwise ask the same way yourself.
- Stop when nothing is silently assumed and the user confirms. For M tasks, one round is usually enough; do not interrogate an S task.
- For UI whose shape is unclear, build a throwaway `prototype` (skill) or an eSoul mockup (`esoul-mockup-authoring`) before production code.

### Create or update the task (M, L, when the user wants it tracked)

- Use `esoul-tasking`, which resolves the repository tasking convention (`freelo-only` or `github-freelo`) and requires approval before every remote write.
- Do not use Matt Pocock's `to-spec`, `to-tickets`, `triage`, or `wayfinder` to publish work unless the repository has been explicitly configured for them. eSoul tracks work in Freelo, which those skills do not support.

### Plan (L only)

- Write the plan as vertical, independently shippable slices (tracer bullets), each with its own acceptance check.
- Create one task per slice via `esoul-tasking`, then execute slices one at a time as M tasks.
- When a session runs long or work must continue elsewhere, write a handoff (`handoff` skill if installed; otherwise a short Markdown note with goal, state, decisions, next step, and open risks).

### Build (S, M)

- Work in vertical slices: one behavior end to end, verified, before the next.
- Use `tdd` at seams agreed with the user when the project has a test suite and the logic is non-trivial (domain rules, calculations, parsers, pricing, permissions). Skip ceremony for markup, copy, and styling changes; verify those visually instead.
- Keep changes minimal and in the style of the surrounding code. No drive-by refactors; note them for later instead.
- Never commit secrets, raw database exports, or `.env*` files. Redact secrets in anything you show.

### Diagnose (Bug)

- Use `diagnosing-bugs` when installed. Its core rule applies regardless: build a fast, deterministic command that goes red on the reported symptom *before* forming hypotheses, then rank 3 to 5 falsifiable hypotheses, change one variable at a time, and tag temporary debug logs with a unique prefix so they can be removed with one grep.
- Finish with a regression test at a seam that reproduces the real bug pattern, or state explicitly that no such seam exists.

### Verify (always)

Do not claim done without evidence. Run what applies and report the actual results:

- Type checks, linters, and formatters the repository defines.
- The single affected test file while iterating; the full suite once at the end.
- For UI: load the page in a browser (Playwright or the available browser tool) at desktop 1440px and mobile 390px, check the console for errors, and look at the result.
- For data: the checks in references/data-analysis.md.

If something could not be verified, say what and why.

### Review (M, L)

- Run `code-review` (when installed) against the branch base: standards and spec, side by side. Fix valid findings.
- For documentation changes, use `esoul-maintain-application-documentation` in verify mode.

### Commit and ship

- Commit with `gitmoji-commit` (one intention per commit, repository convention first).
- Finish PRs with `final-pr-review` (CI green, CodeRabbit findings resolved). Never merge, deploy, or push to protected branches unless separately asked.

## 4. Guardrails

- Production is read-only by default: no writes to production databases, servers, or live sites without explicit instruction for that specific action.
- Every write to Freelo, GitHub issues, or other shared systems needs an approved preview first.
- Destructive commands (reset, drop, force-push, bulk delete, search-replace on a database) need a backup or a dry run and explicit confirmation.
- Prefer the repository's own scripts (Makefile, composer/npm scripts, `scripts/`) over ad-hoc commands.

## 5. Definition of done

Report briefly, in this order:

1. What changed and why (one or two sentences).
2. Verification evidence: commands run and their outcome, screenshots or checks for UI, sanity checks for data.
3. Anything not verified, assumptions made, and follow-ups worth a task.
4. Commit(s) and PR link when applicable.
