# eSoul Freelo working rules

What the official `freelo` skill (layer `upstream-core`; command syntax, output, entity links,
confirm-before-destructive) does not know. Look commands up with `freelo skill show` or
`freelo <group> --help`; this file carries none.

## Tools and cost

- Tool order: Freelo MCP tools when mounted, otherwise the `freelo` CLI with `--agent`; use
  `freelo api <method> <path>` only where the CLI has no command.
- Every CLI request costs about 2.4 s. Read project, tasklist and label IDs from `## Freelo` in
  `CONTEXT.md` before listing anything, and reuse what the session already fetched.
- `freelo labels list` returns project labels, not task labels. Task-label UUIDs live in
  `## Freelo`; a missing one is collected from existing tasks (`freelo api get
  "/all-tasks?projects_ids[]=<project-id>&p=<page>"` → `labels[].uuid`). Add labels by UUID and
  never create one by name: that makes a duplicate.
- A deletion has no `freelo tasks delete`; it is `freelo api delete /task/<id>`. Name the target
  and ask first for any delete, for `invoices mark-invoiced` (irreversible, freezes the work
  reports) and for `workers invite` / `workers remove` (invite sends e-mail).
- Read back after every write: the response of a create carries less than the detail.

## States and estimates

- Tasklists, in order: `Backlog`, `To Do`, `In progress`, `Code review`, `Testing`, `Done`, plus
  `LTT` for recurring work. A project may omit `Testing`.
- A task is ready for `To Do` with a complete description, an assignee, an approved estimate and
  no open blocker; otherwise it stays in `Backlog`.
- The estimate is human time (briefing the agent, checking its work, review, UAT, fixes) in
  15-minute steps, with a split proposed above 4 hours. A project may define another unit in
  `CONTEXT.md`.

## Work reports

A work report records active work, never waiting. On an overloaded machine one hour of work
shows as five elapsed; the client would pay for the processor queue. This holds for every
`freelo reports create` and `edit`, including the report added when a task moves to
`Code review`.

Counts: reading the assignment, documentation and code; designing; writing code, tests and
documentation; changes after review; analysing test results and fixing failures; commits, PR
description, AI review and its findings, Freelo and comments; short environment steps that
unblock the work (starting Docker).

Does not count: waiting for lint, unit, integration or E2E tests, mutation testing, builds or CI
while nothing else on the task happens; waiting for `pnpm install` or a machine or session
restart; repeated runs that failed only on a timeout under load. When the machine runs the
optional test-queue (github.com/eSoul-cz/test-queue), `[testq]` lines are queue state and
waiting in it is not work. Work done on the task while tests run counts.

Review time (the author's handling of findings, the reviewer's own time) is work and is
reported when it happens.

Computing the minutes:

1. A Claude Code session transcript (`~/.claude/projects/<project>/<session>.jsonl`, one record
   per line with a `timestamp`) is the accurate source:

   ```bash
   node scripts/work-report-minutes.mjs <transcript.jsonl> [--from <ISO time>] [--to <ISO time>] [--json]
   ```

   (path relative to this skill's folder). `--from` is the start of work on the task, `--to`
   the moment of the report. It sums the gaps between records: a gap that ends in a test,
   build, install or waiting-loop result (`until`, `sleep`, `Monitor`, `[testq] waiting`)
   longer than one minute does not count; subagent work (`Agent`, `Task`, `Skill`, `Workflow`)
   counts in full; any other gap counts at most 5 minutes. It prints the active minutes, the
   value rounded to 5 minutes and the waiting left out.
2. Without a transcript, or from another agent (the script reads only that format), build a
   timeline from the branch reflog (`git reflog show <branch> --date=format:%H:%M`), commit
   times, test-log modification times and Freelo moves, and sum only the active stretches.
3. Spot-check the transcript number against the commit times; when it looks off (the script
   cannot see waiting inside one long ordinary-looking command), redo it with step 2.
4. Round to 5 minutes. The note says what was done and that the time is active work without
   waiting for tests; add the PR link when one exists, otherwise the issue or branch, and the PR
   link at the next edit.
5. The final summary states the reported minutes and how long the waiting took, so the user can
   adjust the report.

Minutes the user set or changed explicitly, and retrospective estimates they entered, are never
recalculated.
