---
name: esoul-workflow
description: Default operating workflow for eSoul work on web applications (PHP/Laravel/Symfony, frontend), WordPress sites, and data analyses. Use at the start of any non-trivial eSoul task (build, change, fix, debug, review, analyse, or plan work) to size the task, load repository context, route each step to the owning skill or reference, and finish with verified, committed, reviewed output without repeating checks.
---

# eSoul workflow

The single entry point for eSoul work. It decides *how much process* a task needs and *which skill* owns each step. It does not repeat what those skills say: when a step names a skill, invoke that skill and follow it.

## 1. Load context before touching anything

1. Use the repository context that is already loaded; do not read it again. The harness loads `CLAUDE.md` (and the `AGENTS.md` and memory files it imports or injects) at session start and after every compaction, and files you already read in this session are still in context. Read only what is missing, and only the part you need:
   - a convention (tasking, commits, Freelo, project profile): the section, not the file. This line prints the whole section from `CONTEXT.md`, or from `GLOSSARY.md` when `CONTEXT.md` lacks it; every eSoul skill uses the same line:
     `for f in CONTEXT.md GLOSSARY.md; do awk -v h='## Tasking convention' '$0==h{p=1;s=$0 ORS;next} /^## /{p=0} p{s=s $0 ORS; if(NF)n=1} END{if(n)printf "%s",s; exit !n}' "$f" 2>/dev/null && break; done`;
   - domain vocabulary: look up the specific term in `GLOSSARY.md` or the context named in `GLOSSARY-MAP.md` (legacy `CONTEXT.md` or `CONTEXT-MAP.md`) when the task uses it, never the whole glossary up front;
   - decisions: `docs/adr/index.md`, then only the ADRs for the area being touched.
   Repository conventions always override this skill. Every skill below follows the same context budget.
2. Identify the work type and read exactly one reference:
   - Web application or frontend: [references/web.md](references/web.md)
   - WordPress site: [references/wordpress.md](references/wordpress.md)
   - Data analysis, report, or spreadsheet: [references/data-analysis.md](references/data-analysis.md)
3. Navigate code efficiently, in this order of preference:
   - `codegraph_explore` MCP tool when available: one call returns the relevant source, call paths and blast radius. Prefer it over chains of Grep/Read for "how does X work", "where is X used", and "what breaks if I change X".
   - `codegraph explore "<query>"` CLI when a `.codegraph/` directory exists but the MCP tool is absent (typical for sub-agents).
   - Otherwise Grep/Glob, then Read only the files that matter.
   CodeGraph results stay resident in context. In long sessions, ask narrow questions rather than surveying whole areas repeatedly.
   For searches across more than a few files, start the `esoul-skills:scout` agent (Haiku) with a self-contained brief; for audits, `esoul-skills:reviewer` (Sonnet). Not Explore: it runs on this session's model. Never fork the current conversation: a fork inherits the whole context and runs on this session's model.
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

### Who does the work

This session is the orchestrator: it decides, writes briefs, and reviews. Mechanical work goes to the worker roles in `esoul-model-routing`, so its raw output never grows this context and it runs on a cheaper model:

| Size | Who does what |
|---|---|
| **S** | Do it directly; suggest a `sonnet` session for a run of S tasks. Delegation would cost as much as the work. |
| **M, L, Bug** | Settle decisions here, then brief `esoul-skills:implementer` (Sonnet) per slice; `esoul-skills:test-runner` (Haiku) runs the checks; review the diff and receipts here. After two failed worker attempts, take over or escalate. |
| **Any** | Searches → `scout`; test, build and lint runs → `test-runner`; commits, `gh` queries and approved tracker writes → `ops`; review lenses → `reviewer`, or `critical-reviewer` for authorization, money, migrations or destructive data scripts, personal data, concurrency. |

Keep the session small: one task per session, `/clear` or a handoff between tasks, no whole logs or dumps in context, independent tool calls batched in one message. Effort `medium` is the default for this session; raise it to `high` for clarifying and planning, `xhigh` for L or security-sensitive work. The full rules, the Zeron specifics and the usage report are in `esoul-model-routing`.

## 3. Run the flow

### Clarify (M, L)

- Settle open decisions before writing code, as in [references/grilling.md](references/grilling.md): ask the whole frontier of open decisions in one numbered round, each with a recommended answer worded so that "yes" accepts it.
- Stop when nothing is silently assumed and the user confirms. For M tasks, one round is usually enough; do not interrogate an S task.
- For logic or UI whose shape is unclear, build a throwaway prototype ([references/prototype.md](references/prototype.md)) or, for a design the client reviews, an eSoul mockup (`esoul-mockup-authoring`) before production code.

### Create or update the task (M, L, when the user wants it tracked)

- Use `esoul-tasking`, which resolves the repository tasking convention (`freelo-only` or `github-freelo`) and requires approval before every remote write.
- If the Matt Pocock plugin is installed, do not use its `to-spec`, `to-tickets`, `triage`, `wayfinder` or `setup-matt-pocock-skills` unless the repository is explicitly configured for them. eSoul tracks work in Freelo, and the setup skill renames `CONTEXT.md`, which holds eSoul conventions. The parts eSoul uses are adapted in this skill's references.

### Project-level work

Use `esoul-project-lifecycle` instead of this flow when the task is about the project rather than one change: starting or retrofitting a project, processing client materials or a client meeting, writing or changing an ADR, planning phases and slices, preparing the codebase for agents, creating issues from the plan, launch readiness, or auditing conformance. It owns everything up to a prepared issue; implementation comes back here.

### Plan (L only)

- In projects with `docs/plan/`, plan through `esoul-project-lifecycle` (`plan` mode) so slices land in the slice table.
- Write the plan as vertical, independently shippable slices (tracer bullets), each with its own acceptance check.
- Create one task per slice via `esoul-tasking`, then execute slices one at a time as M tasks.
- When a session runs long or work must continue elsewhere, write a handoff as in [references/handoff.md](references/handoff.md).

### Build (S, M)

- Work in vertical slices: one behavior end to end, verified, before the next.
- Test-first at seams agreed with the user ([references/tdd.md](references/tdd.md)) when the project has a test suite and the logic is non-trivial (domain rules, calculations, parsers, pricing, permissions). Skip ceremony for markup, copy, and styling changes; verify those visually instead.
- When the shape of an interface is in question (where a seam goes, whether a class earns its place, how an integration is faked), use [references/design-principles.md](references/design-principles.md) after the stack profile and project guidelines.
- Keep changes minimal and in the style of the surrounding code. No drive-by refactors; note them for later instead.
- Never commit secrets, raw database exports, or `.env*` files. Redact secrets in anything you show.

### Diagnose (Bug)

- Follow [references/diagnosing-bugs.md](references/diagnosing-bugs.md). Its core rule: build a fast, deterministic command that goes red on the reported symptom *before* forming hypotheses, then rank 3 to 5 falsifiable hypotheses, change one variable at a time, and tag temporary debug logs with a unique prefix so they can be removed with one grep.
- Finish with a regression test at a seam that reproduces the real bug pattern, or state explicitly that no such seam exists.

### Verify (always)

Do not claim done without evidence. Run what applies and report the actual results:

- Type checks, linters, and formatters the repository defines.
- The single affected test file while iterating; the full suite once at the end. Outside S tasks, run them through `esoul-skills:test-runner` so only receipts and failures come back.
- When the machine runs `test-queue`, test, E2E and build commands wait in a shared queue: run long suites in the background and read `[testq]` lines as queue state, not failures.
- For UI: load the page in a browser (Playwright or the available browser tool) at desktop 1440px and mobile 390px, check the console for errors, and look at the result.
- For acceptance of a whole module or release, use `esoul-uat`: it runs the project's UAT scenarios across roles and devices, checks layout and design, and files approved bugs.
- For data: the checks in references/data-analysis.md.

If something could not be verified, say what and why.

**Verification receipt.** Run each check once per state of the code. After every check, record one line in the conversation (never in the repository):

```text
receipt · tree <tree12> · <command> → <pass | fail: short result>
```

`tree` is the Git tree of the whole worktree, tracked and untracked files included, computed without touching the real index:

```bash
d=$(mktemp -d); GIT_INDEX_FILE="$d/index" git read-tree HEAD && GIT_INDEX_FILE="$d/index" git add -A && GIT_INDEX_FILE="$d/index" git write-tree; rm -rf "$d"
```

It does not change when the verified files are committed (it equals the new commit's `HEAD^{tree}`), so `gitmoji-commit`, `pre-pr-review` and `final-pr-review` reuse a receipt with the same tree instead of running the check again. Re-run only what a later change can affect, and run the full suite once on the tree that will be pushed. Receipts cover checks of file content (tests, linters, builds). Checks of the index or of staging, such as `git diff --cached --check`, are not receipted and always run.

### Review (M, L)

- One local review per revision. A diff revision gets at most one local review; later passes review only the delta `git diff <last reviewed head>..HEAD`, unless the delta is large or touches a risk trigger (authorization, money, migrations or destructive data scripts, personal data, concurrency). When the PR will be finished through `final-pr-review`, its pre-push pass (CodeRabbit CLI, or `pre-pr-review` as fallback) is the review: do not also run `code-review`. `pre-pr-review`'s tests-and-contract lens already checks the change against the issue.
- Run `code-review` (when installed) against the branch base only when no PR follows, or when the user asks for it. Fix valid findings.
- Run `pre-pr-review` directly only when the PR will not be finished through `final-pr-review`, or when the user asks for a local review.
- For documentation changes, use `esoul-maintain-application-documentation` in verify mode.

### Commit and ship

- Commit with `gitmoji-commit` (one intention per commit, repository convention first).
- Finish PRs with `final-pr-review` (CI green, CodeRabbit findings resolved). Never merge, deploy, or push to protected branches unless separately asked.

## 4. Guardrails

- Production is read-only by default: no writes to production databases, servers, or live sites without explicit instruction for that specific action.
- Every write to Freelo, GitHub issues, or other shared systems needs an approved preview first.
- Destructive commands (reset, drop, force-push, bulk delete, search-replace on a database) need a backup or a dry run and explicit confirmation.
- Prefer the repository's own scripts (Makefile, composer/npm scripts, `scripts/`) over ad-hoc commands.
- Project data (client files, dumps, media, backups) goes to tracked `assets/` via Git LFS, never to `storage/` or other ignored folders: `esoul-project-data`.
- On a data task (label `data-migration`, imports, data fixes, reports), never change application code or the data model beyond what the issue specifies; propose the change as new work instead: `esoul-data-task-guard`.

## 5. Definition of done

Report briefly, in this order:

1. What changed and why (one or two sentences).
2. Verification evidence: commands run and their outcome, screenshots or checks for UI, sanity checks for data.
3. Anything not verified, assumptions made, and follow-ups worth a task.
4. Commit(s) and PR link when applicable.
