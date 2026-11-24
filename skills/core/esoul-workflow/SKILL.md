---
name: esoul-workflow
description: Entry point for any non-trivial eSoul task (build, fix, review, analysis, plan) - size it, load repository context, route each step to the owning skill, verify once, commit and review. Also for WordPress sites and data analyses.
---

# eSoul workflow

Decides *how much process* a task needs and *which skill* owns each step. When a step names a skill, invoke it and follow it; this file does not repeat what those skills say. A named skill that is not installed: do the step by hand from the guideline it points to, or ask the user to install its layer. Repository conventions override this skill.

## 1. Load context before touching anything

1. Use the context already loaded (`CLAUDE.md`, `AGENTS.md`, memory, files read this session); read only what is missing, and only the part you need:
   - a convention (tasking, commits, tracker, Freelo, project profile): the section, not the file. This prints a section from `CONTEXT.md`, or from `GLOSSARY.md` when `CONTEXT.md` lacks it, and nothing when absent (change `h=`; every eSoul skill uses this line):
     `for f in CONTEXT.md GLOSSARY.md; do awk -v h='## Tasking convention' '$0==h{p=1;s=$0 ORS;next} /^## /{p=0} p{s=s $0 ORS; if(NF)n=1} END{if(n)printf "%s",s; exit !n}' "$f" 2>/dev/null && break; done`
   - guidelines: `docs/project_guidelines/<file>.md`, only the file of the area you touch (`esoul-guidelines` explains sync and check);
   - domain vocabulary: the term in `GLOSSARY.md`, or in the context named by `GLOSSARY-MAP.md` (older repositories kept the glossary in `CONTEXT.md` / `CONTEXT-MAP.md`); never the whole glossary;
   - decisions: `docs/adr/index.md`, then only the ADRs of the area.
2. Read exactly one reference for the work type: web application or frontend [references/web.md](references/web.md); WordPress [references/wordpress.md](references/wordpress.md); data analysis, report, spreadsheet [references/data-analysis.md](references/data-analysis.md).
3. Navigate code with `codegraph_explore` when available (one call returns source, call paths and blast radius), else `codegraph explore "<query>"` when `.codegraph/` exists, else Grep/Glob and Read of the files that matter. For a search across more than a few files, give a read-only explorer subagent a self-contained brief when the harness offers subagents.
4. Find facts yourself; ask the user only for decisions.

Done when you can name the stack, the tracker convention and the guideline files of the area.

## 2. Size the task

Pick the smallest size that fits and say which in one line. Escalate as soon as a hidden decision appears; never de-escalate silently.

| Size | Signals | Flow |
|---|---|---|
| **S** | One obvious change, a few files, no design choice, no new dependency | Context → issue or task → change → verify → commit → PR |
| **M** | A feature or change with a real decision, new UI, schema or API change, unclear acceptance | Clarify → task → build in slices → verify → review → commit → PR |
| **L** | More than one session, several modules, unknown unknowns | Plan, split into tasks, run each as M |
| **Bug** | Broken, failing, throwing or slow | Diagnose → task → fix with regression test → verify → commit → PR |
| **Analysis** | A question to answer from data | [references/data-analysis.md](references/data-analysis.md) end to end |

**Who does the work.** This session decides, writes briefs and reviews. S: do it directly. M, L, Bug: delegate by job (implementation slices, searches, test runs, commits and `gh` queries, review lenses) per `esoul-model-routing` when installed; otherwise do the step yourself, or use a generic subagent when the harness offers one. After two failed delegated attempts, take over. Keep the session small: one task per session, no whole logs in context, independent tool calls batched.

## 3. Run the flow

**Clarify (M, L).** Settle decisions before code with the upstream `grilling` skill ([references/upstream.md](references/upstream.md)): the whole frontier in one numbered round, each with a recommended answer. Agree the test seams in this round. For unclear logic or UI, prototype (`prototype`), or for a client-reviewed design use `esoul-mockup-authoring`. Done when nothing is silently assumed and the user confirms.

**Task (every size).** Every change starts from an issue or task with an outcome and acceptance criteria (`docs/project_guidelines/workflow.md` › Tasking). None exists: create it with `esoul-task-create`. Small admin work (dependency updates, `Jenkinsfile`) goes without one when `CONTEXT.md › ## Tasking convention` records that standing decision for its kind; otherwise only when the user says so, and you ask every time. Pick up the task, assignee, status moves and the branch (`workflow.md` › Branches) with `esoul-task-work`; never start work on a task assigned to someone else. Done when the task exists with acceptance criteria, you are its assignee and the branch is created.

**Project-level work.** Starting or retrofitting a project, client materials, ADRs, phases and slices, conformance: `esoul-project-lifecycle`. Updating an existing project (guidelines version, skills lock, retired skill names; or a template-born project to the latest template): `esoul-project-update`. They own everything up to a prepared issue; implementation comes back here.

**Plan (L).** In projects with `docs/plan/` plan through `esoul-project-lifecycle`. Write vertical, independently shippable slices, one task per slice, then run each as M. Write a handoff (`handoff`) when work must continue in another session. Done when every slice has a task and an acceptance check.

**Build (S, M).** One behaviour end to end, verified, before the next. Hold M, L and Bug slices to [references/quality-bar.md](references/quality-bar.md): paste its self-check into each brief, name the sections that apply, and check the returned answers before review. Test-first at the agreed seams with `esoul-testing` (upstream `tdd`); markup, copy and styling are verified visually. Interface shape in question: `codebase-design`. Minimal changes in the style of the surrounding code; no drive-by refactors. Never commit secrets, raw database exports or `.env*`. Done when the slice is verified with receipts and the self-check is answered.

**Diagnose (Bug).** Use `diagnosing-bugs` with the additions in `esoul-testing`: redact secrets and personal data in anything you show; production stays read-only. Name the root cause in one sentence and fix it where it lives (`workflow.md` › Fixing a bug). Done when the regression test fails on the cause (or the PR says `No test: <reason>`). A defect that harms production now and cannot wait is a hotfix: the Task step is shortened as `workflow.md` › Hotfix says (task after the fix, no `Backlog`, estimate afterwards), never skipped; review and the green `Jenkins` check still apply. Where the project uses Gitmoji, the commit that fixes it is `:ambulance:` (`gitmoji-commit`).

**Verify (always).** Run what applies and report real results: the repository's type checks, linters and formatters; tests by run level (`esoul-testing` when installed; otherwise the affected tests while iterating, the touched area before a commit, the whole suite once per tree that will be pushed: `testing.md` › Testing workflow); UI in a browser at 1440px and 390px with the console checked (which browser: [references/web.md](references/web.md) › Verifying); module or release acceptance, or one issue's `## UAT` block (`issue` mode), with `esoul-uat`; data with [references/data-analysis.md](references/data-analysis.md). A behaviour change carries a test or the PR says `No test: <reason>`. When the machine runs the optional test-queue (github.com/eSoul-cz/test-queue), `[testq]` lines are queue state, not failures. Done when every applicable check has a receipt for the current tree; say what was not verified and why.

**Verification receipt.** Run each check once per state of the code and record one line in the conversation (never in the repository):

```text
receipt · tree <tree12> · <command> → <pass | fail: short result>
```

`tree` is the Git tree of the whole worktree, tracked and untracked files included, computed without touching the real index:

```bash
d=$(mktemp -d); GIT_INDEX_FILE="$d/index" git read-tree HEAD && GIT_INDEX_FILE="$d/index" git add -A && GIT_INDEX_FILE="$d/index" git write-tree; rm -rf "$d"
```

It equals the new commit's `HEAD^{tree}` after the verified files are committed, so `gitmoji-commit` and `esoul-review` reuse a receipt with the same tree. Re-run only what a later change can affect. Receipts cover checks of file content (tests, linters, builds); index checks such as `git diff --cached --check` always run.

**Review (M, L).** `esoul-review` Path B: it runs the local review (Path A) once before the push, then the PR loop with CodeRabbit. Path A alone only when the user asks for a review; "does this follow our guidelines?" is its standards-only run. One review per revision; later passes review only the delta unless it is large or touches authorization, money, migrations or destructive data scripts, personal data or concurrency. Documentation changes: `esoul-docs`. Done when no valid blocking finding is left on the current head and the delta is reviewed.

**Commit and ship (every size).** Commit when the user asked to commit or ship. Use `gitmoji-commit` when installed (recommended format, one intention per commit); otherwise the project's or developer's convention (`workflow.md` › Commits); messages are English and descriptive. Open the PR as `workflow.md` › Pull requests says (title, template with checks run and the `No test:` line, Deploy notes; the title mapping is in `esoul-task-work`). Never merge, approve, use a ruleset bypass, deploy or push to protected branches unless separately asked; merging, approving and a bypass need the owner's explicit authorisation for that PR or batch, recorded in the PR description. Done when the PR URL and its checks are listed.

## 4. Guardrails

- Production is read-only and production data is never written by an agent; data corrections ship as reviewed migrations or commands, never manual SQL (`docs/project_guidelines/security-and-data.md` › Production access). Trigger Jenkins jobs only when the owner asks; never deploy outside Jenkins.
- Every write to Freelo, GitHub issues or other shared systems needs an approved preview first. Exception: the mechanical task lifecycle writes of `esoul-task-work` for the task this session works on; report them in the final summary.
- Destructive commands (reset, drop, force-push, bulk delete, search-replace on a database) need a backup or a dry run and explicit confirmation.
- Prefer the repository's own scripts (Makefile, composer/npm scripts, `scripts/`) over ad-hoc commands.
- Project data, dumps and personal data: `esoul-data` (and `security-and-data.md` › Personal and client data). A data task changes no application code beyond its issue: `esoul-data`.

## 5. Definition of done

Report briefly, in this order: what changed and why; verification evidence (commands and outcome, screenshots for UI, sanity checks for data); what was not verified, assumptions and follow-ups worth a task; commit(s) and PR link.
