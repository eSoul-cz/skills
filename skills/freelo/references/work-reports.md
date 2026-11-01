# Work reports: count active work, not waiting

A work report says how much work a task cost. Waiting for an automatic check to finish is not
work: on an overloaded machine it turns one hour of work into five, and the client would pay for
the processor queue. This applies to every `freelo reports create` and `freelo reports edit`, to
reports added when a task moves to Code review, and to reviews of existing reports.

## What counts

- Reading the assignment, documentation and code; designing the solution.
- Writing code, tests and documentation; changes after review.
- Analysing test results and fixing failures, including comparing with `main` when something fails.
- Commits, PR description, AI review and handling its findings, Freelo and comments.
- Short environment interventions that unblock the work (starting Docker or a local database).

## What does not count

- Waiting for lint, unit, integration and E2E tests, mutation testing, builds or CI while nothing
  else on the task happens.
- Waiting in the `testq` queue, for `pnpm install`, or for a machine or session restart.
- Repeated test runs that failed only on a timeout under load.

Work done on the task while tests run (documentation, PR description) counts.

## How to compute the minutes

1. The most accurate source is the session transcript
   (`~/.claude/projects/<project>/<session>.jsonl`; every record has a `timestamp`). Run the
   bundled script, preferably through `esoul-skills:test-runner` so the transcript stays out of
   context:

   ```bash
   node <skill>/scripts/work-report-minutes.mjs <transcript.jsonl> [--from <ISO time>] [--to <ISO time>]
   ```

   `--from` is the start of work on the task, `--to` the moment of the report. It sums the gaps
   between records:
   - a gap inside a test, build, mutation or install run or a waiting loop (`until`, `sleep`,
     `Monitor`, `[testq] waiting`) longer than one minute does not count;
   - subagent work (`Agent`, `Skill`, `Workflow`) counts in full;
   - any other gap counts for at most 5 minutes (a longer pause is waiting).

   It prints the active minutes, the 5-minute rounded value to report and the waiting left out
   (`--json` for a machine-readable form). Spot-check it against the commit times when the
   result looks off; the script cannot see waiting that happened inside a long normal-looking
   command.
2. Without a transcript, build a timeline from the branch reflog
   (`git reflog show <branch> --date=format:%H:%M`), commit times, test log modification times
   (`ls -lT`) and Freelo moves, and sum only the active stretches.
3. Round to 5 minutes (the script already does).
4. In the report note, say what was done and that the time is active work without waiting for
   tests. Add the PR link when a PR exists; before that, link the issue or branch and add the PR
   link when the report is next edited.
5. In the final summary, tell the user the reported minutes and how long the waiting took, so
   they can adjust the report.

Values the user set or changed explicitly, and retrospective estimates they entered, are never
recalculated.

## Example

A backend issue: 284 minutes passed from In progress to the PR, most of it integration tests
under a machine load of 200+ and two machine restarts. Active work according to the transcript
was 60 minutes, and 60 were reported. Recomputing one month of agent reports the same way cut
them from 10,485 to 5,535 minutes.
