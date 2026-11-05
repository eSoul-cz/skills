# Test runs: what runs when

Which checks run at which step, so every change is proven once and nothing runs twice. What a
test contains and which tests belong in the suite is the project's `docs/project_guidelines/testing.md`;
the commands are its `tools.md`. This file decides only **when** and **how often**.

Why it matters: a local suite takes seconds to minutes, but every push starts a Jenkins build
that all eSoul projects share, and a red build costs a second one. The expensive resource is the
build, not the test run before it.

## The run levels

| Level | When | What runs | Who runs it |
|---|---|---|---|
| **L0 edit** | while changing code | the formatter on changed files (`pint --dirty`, `eslint --fix <file>`); the one test file or `--filter` of the behaviour being changed | the author (implementer), directly |
| **L1 slice** | a slice is done, before its commit | the test directories of the touched area (`tests/Feature/<Area>`, `tests/Unit/<Area>`, the `resources/js/<area>` Vitest files); static analysis of the project (cached, so cheap) | the author, or `test-runner` |
| **L2 revision** | once per tree that will be pushed | the whole suite, static analysis, lint, typecheck, build; mutation testing on the changed lines | the orchestrator through `esoul-skills:test-runner`, with receipts |
| **L3 CI** | every push | the same read-only commands as L2, nothing new | Jenkins |
| **L4 scheduled** | nightly or weekly job, or before a release | the `db-engine` group on the production database engine, the `sandbox` and `quarantine` groups, E2E and UAT sweeps; mutation testing stays local | Jenkins schedule or a dedicated session |

A check moves to a later level only when an earlier one cannot see the defect. Nothing from L4
runs on every push.

## Skip what the change cannot affect

| Change touches only | Run |
|---|---|
| Markdown, ADRs, `docs/` outside generated documentation | nothing; documentation checks if the project has them |
| Tests | those tests (L1), then L2 without mutation of `app/`; mutation with `--filter` on the files the tests exercise |
| Frontend (`resources/js`, styles) | the frontend checks and Vitest; PHP tests only when a page prop, route or request changed |
| Backend PHP | PHP checks; frontend checks only when Wayfinder routes, page props or shared types changed |
| `composer.lock`, `package.json`, `Dockerfile`, CI | everything, including the build |

When in doubt, run it: an unnecessary local run costs a minute, a red build costs a rebuild.

## Run each check once

- **Receipts.** Every L1 and L2 check records a receipt
  (`receipt · tree <tree12> · <command> → <result>`, see `esoul-workflow` Verify). A receipt for
  the current tree is never run again, in `gitmoji-commit`, `pre-pr-review` or `final-pr-review`.
- **After a failure, rerun the failure first.** Fix, rerun the failing test file alone, then the
  area (L1). The whole suite runs again only once, on the tree that will be pushed.
- **After review fixes**, rerun only what the fixes can affect, then the full suite once, and
  push all fixes together. Never push fix by fix: every push is a full build.
- **One full suite at a time per worktree.** A suite that waits in `test-queue` (`[testq]` lines)
  is waiting, not hanging; never start a second copy.
- **CI is watched in the background.** Read the failure log through `test-runner`; reproduce the
  failing test locally before pushing a fix, so the next build is the last one.
- **The author does not run the full suite.** An implementer stops at L1 and reports; the
  orchestrator runs L2 once for the whole slice or stack.

## Every behaviour change carries a test

A pull request that changes behaviour contains a test that fails without it, or one line in its
description: `Bez testu: <reason>` (markup or copy only, configuration, a data task verified by
its own checks, behaviour no seam can reach). Reviewers report a behaviour change with neither.
Documentation-only and dependency-only pull requests need no line.

## Tests that depend on the database engine

When the suite runs on SQLite but production runs MariaDB, MySQL or Postgres, SQLite hides some
defects: collations (`_ci` comparisons, uniqueness that differs in case), `NULL` ordering,
JSON functions, raw SQL, locking and strict mode. A test whose outcome depends on one of these is
marked with the group `db-engine` and also runs on the production engine at L4. A defect found
there gets a regression test in that group, never a SQLite-only workaround.

## Flaky tests

A test that fails and passes on the same tree is a defect, not bad luck.

- Do not retry the build until it is green, and do not add `sleep` or wider timeouts to hide it.
- Find the cause (clock, order dependence, shared state, parallel workers, real network). Fix it
  in the same pull request when it is yours.
- When the cause is not yours or not quick, move the test to the group `quarantine` (excluded
  from L2 and L3, run at L4), open an issue naming the test and the observed failure, and link
  the issue next to the group attribute. A quarantined test leaves quarantine within its issue,
  fixed or deleted.

## Brief lines

Copy into implementer briefs:

```text
Tests: write the behavioural test first where the brief names a seam. While working run only
<test file or --filter> (L0) and before reporting <area test directories> (L1). Do not run the
full suite or mutation testing; the orchestrator runs them once. If the change has no test,
give the reason as one line "Bez testu: …" in Open points.
```

Into `test-runner` briefs, name the level and ask for receipts:

```text
L2 for tree <tree12>: run <commands from tools.md> from <worktree>. Receipts for each command.
```
