# Suite cleanup (retrofit step R5)

A procedure for bringing an existing test suite to the testing rules of the guidelines
(`docs/project_guidelines/testing.md` › How much to test, Keeping the integration run short, Suite
time budget). The rules are the guideline's; this file is only the order of work, the measuring and the
records. Distilled from the first cleanup, a Laravel/Lunar shop whose suite had doubled in ten days and
whose Jenkins stage had grown to about 40 minutes.

Use it when a suite is over its time budget or its tests break the tiers, and the owner wants it fixed.
It is optional in a retrofit (`esoul-project-lifecycle` › `references/retrofit.md` §3, step R5),
never done in passing inside a feature PR, and every wave is its own PR.

## 1. Decide with the owner

1. **Go or no go**, and the goal (usually the budget of the guideline: a test stage of 10 minutes).
2. **Tier-1 flows.** Propose the list from the code (orders, payments, prices and tax, invoices,
   integrations of record, authentication and authorization, irreversible data changes) and let the owner
   confirm it. Record it in an ADR ("Tier-1 flows for testing") and reference it from the project
   guidelines below the managed block. Name what is explicitly **not** tier 1 (for example a one-off
   data migration). Anything not listed is tier 2.
3. **Production-engine checks.** For every extra pipeline check that starts a second database or a
   multi-process test, decide: drop it (the usual answer; concurrency is proven by design and review) or
   keep only the tests that guard a **named damaging invariant**, in the `db-engine` group, runnable
   through a documented script and in the scheduled job. Record the decision in an ADR that amends the
   one that introduced the check.
4. **Exceptions to the testing rules** the project keeps (a rule it will not follow) are recorded
   exceptions, not silent habits: `esoul-guidelines` › Project exceptions.
5. **Project rules that caused the growth** (every handler tested with all paths, a mandatory mutation
   gate) are reconciled with the guideline first, as in retrofit R2; the guideline wins unless the owner
   names an exception.

## 2. Baseline

Measure before changing anything, with a protocol you can repeat unchanged:

- One full run with JUnit output, with the application's debugger and coverage extensions off, on a
  quiet machine, with a fixed process count. Write down the machine, PHP, PHPUnit and runner versions and
  whether opcache is on for CLI. If the cleanup also enables opcache, measure with and without it so the
  two effects are not mixed.
- Summarise the JUnit file: cases, methods, files, summed time, the median and the p90 per case, time by
  category (feature, unit, architecture, anything run as child processes), time by duration bucket,
  the cost of data-provider cases in feature tests, the slowest files (`per-file` table), and the
  number of query-count or eager-loading tests.
- Attribute the growth: which commits added the most test time (`git blame` on the squash commits), and
  which project rules or review habits drove it.
- Record the per-test cost of the layers: a bare `PHPUnit\Framework\TestCase`, the application test case
  (boot only), plus database reset, plus one factory `create()`, plus one request. It shows how much of
  the suite is boot and how much is preconditions.
- CI: the PHPUnit `Time:` of several builds of the default branch (one build varies up to 2× with agent
  load).

Keep the raw JUnit file and the summary in a dated folder **outside the repository** (or in the project's
`docs/` when the team wants it versioned), named with the date and commit. The re-measurement uses the
same commands.

## 3. Rules for the cleanup (what the waves apply)

Binding order: the owner's decisions of section 1, then the guideline, then the project's conventions that
do not contradict them (naming, attributes, factories).

- **Decision order per behaviour:** unit tests first; fold a feature check into the endpoint test of the
  surface instead of adding one; size what remains by tier (testing.md › How much to test).
- **Every rule variant dropped from a feature test gets a unit test** (no application, no database,
  mirroring the namespace). When the rule is reachable only through a full flow, extract a small unit
  from the production code that takes its inputs and keep the behaviour identical; the extraction is
  minimal and in the style of the surrounding code. Table-driven providers are fine in unit tests.
- **Regression tests** of fixed bugs stay in tier-1 areas (variants to unit tests where possible). In tier 2
  keep one only when it becomes a unit test or is cheap; otherwise delete it and list it.
- **Preconditions are built, not played through.** No cart pipeline, order placement, payment flow or other
  feature's command to create a starting state unless that flow is the behaviour under test; use factories,
  factory states or a builder helper that writes the rows. A helper that must call the framework's or a
  package's actions says so in its docblock and is used once per test class.
- **A matrix is one looping test** collecting violations; data providers in feature tests collapse.
- **Delete:** performance, query-count and eager-loading tests; tests of schema, casts, fillables,
  relations in isolation, factories, seeders, enum case lists or config values; tests that restate the
  implementation; duplicates; existence-only assertions; tests of a package's own behaviour (except a pin
  test for behaviour the project relies on); tests asserting user-facing error wording (assert keys).
- **Tier-1 coverage must not drop.** When unsure whether a behaviour is tier 1, treat it as tier 1 and note
  it in the ledger.
- Never change the expected value of a kept behaviour.

## 4. Waves

1. **Central changes first**, by one owner, before any area work: the shared base test class (a lazily
   refreshing database, the fake for derived data and its opt-in trait), the precondition builders that
   areas will use (documented in one place), shared factories. Area work never edits these; it reports
   the need.
2. **Areas.** Split the slowest files (from the baseline's per-file table) into areas of related files,
   each with a list file (path, baseline seconds, cases; slowest first). One owner per file: an agent
   edits only its list, the unit tests it creates and the production files it extracts a unit from.
3. **Per area, per file, slowest first:** identify the surface and its tier; decide keep (rewritten
   cheaper), merge into the surface's scenario, move a variant to a unit test, or delete with the rule that
   justifies it; rebuild preconditions; collapse providers and matrices; run the file and the new unit
   tests; keep them green.
4. **Measure** the area with one JUnit run before and one after, and report cases and summed seconds.
   Do not run the whole suite per area; run the area's path, the formatter on changed files and static
   analysis on changed production files.
5. **Ledger per area** (append-only, below), finished before the PR.
6. **One PR per wave or area**, small enough to review. The PR lists every deleted, merged and moved test
   with its reason, states which tier-1 behaviour each kept test covers, gives before and after cases and
   seconds, and carries the checks you ran locally with their results.

## 5. Ledger format

```
# <area>
Before: <cases> cases, <summed s> s | After: <cases> cases, <summed s> s

## Tier-1 coverage kept
- <flow>: <test file::method(s)>

## Deleted / merged / moved (one line per test method, or per file when the whole file goes)
| Test | Action (deleted / merged into X / moved to unit Y / rewritten) | Reason (rule) |

## Production extractions
| New unit | Extracted from | Unit test |

## Open questions / risks
```

## 6. Re-measure and report

After the last wave, repeat the baseline protocol on the same machine and compare with the baseline by
lever: removed files, the drop in feature data-provider minutes, the drop in the buckets over one second,
the child-process category, and the boot cost with and without opcache. Write the result next to the
baseline with a short comparison for the owner, and check the CI `Time:` of several builds. Done when the
CI test stage is within the budget, or the remaining distance is an issue with a plan.
