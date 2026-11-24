---
name: esoul-quality-gates
description: Use to check the non-functional quality of a public website or the public part of an eSoul application at any time, not only before launch - Lighthouse and performance budgets, axe accessibility, link prefetch, security headers and the AI-readiness checker (slices AI-01 to AI-06, docs/ai-readiness.md). Reports what fails and what a failing gate blocks. Not the go-live procedure (esoul-website-launch).
compatibility: Node.js 22+; Playwright, Lighthouse and Google Chrome from ~/.cache/esoul-uat for the browser gates.
---

# eSoul quality gates

A public eSoul site has to be fast, accessible, secure to browse and readable by search engines,
AI assistants and agents. This skill holds the checks for that, the scripts that run them and the
rule for what a failing gate does. It owns no project rules: the guidelines
(`docs/project_guidelines/`: `public-website.md`, the stack's `tools.md`, `deployment.md` and
`frontend.md`) own what the site must do; the gates verify it. Where no guideline carries a number
yet, the eSoul default stated here applies.

## Scope

Public pages of a `website`, `website-admin` or `eshop`, and the public part of an `application`
(landing, marketing, public catalogue). Screens behind a login are out of scope. The product type
is in `CONTEXT.md › Project profile`.

## Pick the gate

| Need | Gate | Run | Details |
|---|---|---|---|
| Speed and best practices on mobile | Lighthouse budgets | `scripts/lighthouse-gate.mjs` | [gates.md](references/gates.md#lighthouse) |
| Accessibility | axe, keyboard, reduced motion | the project's Playwright spec, or a one-off script | [gates.md](references/gates.md#axe) |
| Faster navigation | link prefetch | browser network panel | [gates.md](references/gates.md#link-prefetch) |
| Safe responses | security headers | `curl -sI` against the stack's header list | [gates.md](references/gates.md#security-headers) |
| Found and read by crawlers and AI assistants | AI readiness | `scripts/ai-readiness.mjs` | [ai-readiness.md](references/ai-readiness.md) |

`web.mjs` in `scripts/` holds the helpers the scripts share; the case-study script of
`esoul-website-launch` imports it too. The scripts are read-only: they write only the report
folder given by `--out`. Install what is missing with the command that `<script> --check` prints.

## When to run

- **Any time on a preview or production**, as a self-check while building and when a slice touches
  markup, assets, headers or deployment. Run the gate that matches the change, not all of them.
- **In CI** where the project has it: Lighthouse budgets and axe in the Playwright suite belong
  in the pipeline once the project has a deployable preview; the Astro `Checks` stage already runs
  the console-error and SEO specs.
- **Before launch** every gate is mandatory: `esoul-website-launch` orders them (staging before the
  switch, production right after it). Reports go to `assets/<gate>/<YYYY-MM-DD>/`, for example
  `assets/lighthouse/<YYYY-MM-DD>/` and `assets/ai-readiness/<YYYY-MM-DD>/`, and the result to the
  run log or the launch checklist.

## What a failing gate does

1. **Before launch it blocks the go-live.** The only way past a failing gate is a deviation approved
   by the project lead (not the implementer) with its reason: for AI readiness a row in the
   Exceptions table of `docs/ai-readiness.md`; for the others a decision in the project's decision
   register (ADR, or `docs/rozhodnuti.md` in the light tier) and a note under the launch checklist.
2. **At any other time it reports.** List the failing checks with their pages and numbers, say which
   gate blocks launch, and propose the fix; open an issue for it through `esoul-task-create` when the
   user approves.
3. **Fix the cause, not the gate.** Do not lower a budget, widen an exception or drop a page from
   the sample to turn a gate green. A changed number needs a recorded decision; a script option
   (`--budget`) carries it.

## Run it

Gate runs are mechanical: hand each to a cheap helper when the harness offers one (name the job,
the command and the report folder; it returns the summary, the failing checks and the report path),
otherwise run it yourself. The decision about a failure stays with the session.

## Done when

Every gate that applies has run on the environment in question, its report is in the report folder,
the result (numbers, `must x/y`) is recorded where the project keeps it, and each failure is fixed,
approved as a deviation with a reason, or reported with a proposed issue.
