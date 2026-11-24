---
name: esoul-testing
description: 'Use when running or writing tests in an eSoul project: "run the tests", a red test or failing CI, a regression test for a bug fix, test-first work, choosing which checks run when. Builds on upstream `tdd` and `diagnosing-bugs`; adds run levels, receipts (run each check once) and the eSoul testing rules.'
---

# eSoul testing

What a test contains and how many a change gets: `docs/project_guidelines/testing.md`. The commands: `docs/project_guidelines/tools.md`. This skill decides **when** checks run, **how often**, and how to write tests with the upstream skills. Repository conventions override it.

## Guideline sections to read, by situation

| Situation | `docs/project_guidelines/testing.md` › |
|---|---|
| Deciding how many tests a behaviour gets | How much to test |
| Scaffolding tests (migration, backfill, import, ETL rules, exploration) | Temporary tests |
| A suite or a PR that adds test time | Suite time budget (measure it as below) |
| `sandbox`, `quarantine`, `db-engine` | Test groups |
| A test that fails and passes on the same tree | Flaky tests |
| Bug fix | Regression tests, and `workflow.md` › Fixing a bug |
| Behaviour change without a test | Every behaviour change carries a test (`No test:` line) |
| Final run before the PR | Testing workflow |
| Mutation testing, where the project has the `package/mutation-testing` layer | Mutation testing: a diagnostic, never a gate and never in the pull request; a run is waiting, not work (`esoul-task-work` › `references/freelo.md`) |

Measuring the 30 seconds: the project's `phpunit.xml` writes `.ci/junit/phpunit.xml` (`<logging><junit outputFile=".ci/junit/phpunit.xml"/></logging>`; the template has it), the `PHP Tests` stage publishes it, and Jenkins shows the per-test times on the build's Test Result page. Locally, run the full suite before and after the change and sum the test cases of the report: `grep -o '<testcase [^>]*' .ci/junit/phpunit.xml | grep -o ' time="[0-9.]*"' | awk -F'"' '{s+=$2} END{print s " s"}'`. A project without the report gets the `<logging>` line first.

## Writing tests: the upstream `tdd` skill

Use the installed `tdd` skill (layer upstream-core) for the red → green loop. eSoul additions:

- Agree the seams in the Clarify round of `esoul-workflow` (M, L) instead of a separate confirmation step. The guideline floor (tier-2 success, authorization and validation-keys tests, and the regression test of a bug fix) needs no seam confirmation; tests beyond the floor sit at agreed seams only.
- Persisted state, dispatched events and status are observable behaviour at a seam. A feature test is a scenario with several assertions (`testing.md` › Keeping the integration run short); the upstream "one logical assertion per test" applies to unit tests.
- Unit tests first and fold into an existing feature test; how many tests follow `testing.md` › How much to test.
- Look up domain terms in `GLOSSARY.md` for test names; never read it whole.
- Record a receipt for each passing run (below).

Not installed: ask the user to run `npx @esoul-cz/skills install upstream-core`, or follow these additions and `testing.md` alone.

## Red tests and bugs: the upstream `diagnosing-bugs` skill

Use the installed `diagnosing-bugs` skill for a failing test, a reported bug or a flaky result. eSoul additions:

- Redact secrets and personal data before showing a command, output or captured artifact (`<REDACTED>`); keep credentials in the environment, not in what you show.
- Production is read-only (`security-and-data.md` › Production access): temporary instrumentation there needs the owner's approval for that specific change.
- The upstream human-in-the-loop script needs a shared terminal (PTY). Without one, print the steps for the user and ask them to paste back the captured values.
- Fix the cause, not the symptom (`workflow.md` › Fixing a bug). The regression test fails on the cause; run it once against the unfixed code and say so in the PR. Without a reachable seam the PR carries `No test: behaviour no seam can reach`.

Not installed: same fallback as above.

## Run levels

| Level | When | What runs | Who |
|---|---|---|---|
| **L0 edit** | while changing code | the stack's formatter on changed files; the one test file or filter of the behaviour being changed | the author |
| **L1 slice** | a slice is done, before its commit | the test directories of the touched area and the project's static analysis (`tools.md`) | the author |
| **L2 revision** | once per tree that will be pushed | the whole suite, static analysis, lint, typecheck, build | the orchestrator, through a test-runner subagent when the harness offers one (`esoul-model-routing`), otherwise yourself with only failures printed |
| **L3 CI** | every push | the same read-only commands as L2 | Jenkins |
| **L4 scheduled** | nightly, weekly or before a release | groups `db-engine` (production engine), `sandbox`, `quarantine`, E2E and UAT sweeps | Jenkins schedule or a dedicated session |

A check moves to a later level only when an earlier one cannot see the defect. Workers stop at L1 and report; the orchestrator runs L2 once for the slice or stack. Done when every check of the level has a receipt for the current tree.

## Skip what the change cannot affect

| Change touches only | Run |
|---|---|
| Markdown, ADRs, `docs/` outside generated documentation | nothing; the project's documentation checks if it has them |
| Tests | those tests (L1), then L2 |
| Frontend | the frontend checks and unit tests; backend tests only when a route, page prop, request or shared type changed |
| Backend | the backend checks; frontend checks only when a shared contract changed |
| Lock files, dependency manifests, `Dockerfile`, CI | everything, including the build |

When in doubt, run it: an unnecessary local run costs a minute, a red build costs a rebuild.

## Run each check once

- **Receipts.** Record every L1 and L2 check as in `esoul-workflow` › Verify (format and tree command there). A receipt for the current tree is never run again, in `gitmoji-commit` or `esoul-review`.
- **After a failure**, rerun the failing test alone, then the area (L1). The whole suite runs again once, on the tree that will be pushed.
- **After review fixes**, rerun what the fixes can affect, then the full suite once, and push all fixes together: every push is a full build.
- **One full suite at a time per worktree.** When the machine runs the optional test-queue (github.com/eSoul-cz/test-queue), `[testq]` lines are queue state, not failures; run long suites in the background and never start a second copy.
- **CI is watched in the background.** Read a failing log through a test-runner subagent when available; reproduce the failure locally before pushing the fix.

## Brief lines

Into an implementer brief:

```text
Tests: write the behavioural test first where the brief names a seam. While working run only
<test file or filter> (L0) and before reporting <test directories of the touched area> (L1).
Do not run the full suite; the orchestrator runs it once. Without a test, give the reason as
one line "No test: …" in Open points.
```

Into a test-runner brief:

```text
L2 for tree <tree12>: run <commands from tools.md> from <worktree>. A receipt per command;
on failure the failing test names and the first error only.
```
