# Running UAT

## Before the run

1. Run `verify` when code changed since the catalogue's last update. Fix or mark stale
   scenarios first; a run over stale scenarios is noise.
2. Agree the run scope with the user in one message: environment, chapters, roles, devices,
   priorities (for example "part A, P1 and P2, desktop + mobile, design checks on"), and
   whether writing and deleting scenarios are allowed on this environment.
3. Check access ([access.md](access.md)) and the browser ([chrome.md](chrome.md)).
4. Record the build under test: the commit or version from the environment's version
   endpoint or footer. If none exists, write `neznámý` and say so in the report.
5. Create the run folder `docs/testing/uat/runs/<YYYY-MM-DD>-<env>[-<n>]/` and initialise
   `results.json`:

   ```bash
   node <skill>/scripts/uat.mjs init docs/testing/uat/scenarios <run-dir> \
     --env uat --base-url https://… --commit abc1234 --devices desktop,mobile \
     --chapters PRE,AUT,NAV --priority P1,P2
   ```

   `init` lists every scenario × device in scope as `not-run`.

## During the run

Work one chapter at a time, in catalogue order, starting with the `PRE` scenarios the
chapters depend on.

For each scenario and device:

1. Log in as the scenario's role in a fresh tab (log out first when the role changes).
2. Reach the precondition. When it cannot be reached, the result is `blocked` with the reason.
3. Do each step as written, then compare what you see with the expected result. Read the
   page, not your assumptions: exact texts, values, states, URLs.
4. On a mismatch: take a screenshot, note the URL, the actual result, console errors, and
   failed requests. Try once more after a reload to rule out a flaky load; do not retry more.
5. On the first visit of each URL on each device, run the layout audit (`design.md`) and
   record findings under `layout`.
6. Write the result immediately:

   ```bash
   node <skill>/scripts/uat.mjs record <run-dir> ZV-01 --device desktop --status fail \
     --step 2 --url https://…/animals/sheep --note "Tabulka obsahuje i cizí zvíře SK123." \
     --evidence screenshots/ZV-01-desktop-2.png
   ```

   `results.json` is the run's memory. A run can stop and resume at any time:
   `uat.mjs next <run-dir>` prints the next `not-run` item.

Statuses:

| Status | Meaning |
|---|---|
| `pass` | every expected result observed |
| `fail` | at least one expected result not observed; step number and actual result recorded |
| `deviation` | the result matches the scenario's `Dle kódu dnes` column of a documented deviation |
| `blocked` | could not be executed: missing access, data, precondition, or a failed earlier step |
| `skipped` | out of scope for this run, with the reason |
| `not-run` | not reached yet |

Never mark `pass` from reading code, from a similar earlier scenario, or because the page
"looks fine". Never change data outside what the scenario requires. When a step would do
something irreversible that the scenario does not describe, stop and ask.

### Keeping context small

Run each chapter as its own session or sub-agent when the run is long; pass it the chapter
file, the run directory, and the role accounts (by role code, not passwords). The parent
only reads `uat.mjs stats <run-dir>` between chapters. Use `esoul-model-routing` to choose a
cheaper model for mechanical chapters and a stronger one for analysing failures.

### Responsive sweep and design

After the functional chapters (or in parallel, since it only reads):

```bash
node <skill>/scripts/sweep.mjs --config docs/testing/uat/uat.config.json \
  --secrets ~/.config/esoul-uat/<repo>.<env>.env --run <run-dir> --devices tablet,mobile
```

It logs in per role, visits the configured routes on each device, saves screenshots, runs
the layout audit, and appends findings to `results.json`. Review every finding on its
screenshot before it becomes a bug. Then run the design comparison for `design-map.md`
rows (`design.md`).

## Report

```bash
node <skill>/scripts/uat.mjs report <run-dir>     # writes <run-dir>/report.md
```

The report contains the environment, build, scope, date and tester; totals and a table per
chapter and device; failed and blocked scenarios with the actual result and evidence links;
layout and design findings; and a list of proposed or created bugs. Re-run `report` after
bugs are created so links appear.

PDF: when the project has the documentation tooling (`docs/documentation`), add a guide
entry for the run report in `docs/documentation.toml` (or reuse a `uat-report` entry whose
sources point at the latest run) and run `docs/documentation build`. Without the tooling,
offer to install it through `esoul-maintain-application-documentation`; the Markdown report
remains the deliverable meanwhile.

Commit the run folder through a PR (`docs/testing/uat/runs/…`). Store screenshots the way
the repository stores images (plain Git objects render in issues; use Git LFS only when the
repository requires it). On environments with real client data, `runs/` stays local unless
redacted.

## Handing over to a human tester

When a person should check part of the run (deviations, blocked scenarios, subjective
design questions), list exactly those scenario IDs in the report under
`## K ručnímu ověření` with the reason for each. The rest needs no repeated clicking.
