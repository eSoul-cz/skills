# eSoul Freelo working rules

What the official `freelo` skill (layer `upstream-core`; command syntax, output, entity links,
confirm-before-destructive) does not know. Look commands up with `freelo skill show` or
`freelo <group> --help`; this file carries none beyond the name table below.

## Tools and cost

- Tool order: the Freelo MCP tools (`mcp__freelo_*`) when mounted, otherwise the `freelo` CLI
  with `--agent`; use `freelo api <method> <path>` only where the CLI has no command. Recipes name both.

  | Operation | CLI | MCP tool |
  |---|---|---|
  | Move a task to a tasklist | `freelo tasks move <task-id> --tasklist <id>` | `move_task` |
  | Set the worker | `freelo tasks edit <task-id> --worker <user-id>` | `update_task` (`worker_id`) |
  | Finish / reopen | `freelo tasks finish <task-id>` / `tasks activate` | `finish_task` / `activate_task` |
  | Add / edit a work report | `freelo reports create\|edit --task <id> --minutes <n> --note "…"` | `manage_work_reports` (`create`, `update`) |
  | Find the user | `freelo users list` | `get_users` |
  | List tasks of a tasklist | `freelo tasks list --project <id> --tasklist <id>` | `get_tasks` |

- Every CLI request costs about 2.4 s. Read project, tasklist and label IDs from `## Freelo` in
  `CONTEXT.md` before listing anything, and reuse what the session already fetched.
- `freelo labels list` returns project labels, not task labels. Task-label UUIDs live in
  `## Freelo`; a missing one is collected from existing tasks (`freelo api get
  "/all-tasks?projects_ids[]=<project-id>&p=<page>"` → `labels[].uuid`, or `get_task_labels`).
  Add labels by UUID; a label created by name makes a duplicate.
- A deletion has no `freelo tasks delete`; it is `freelo api delete /task/<id>` (MCP:
  `delete_task`). Name the target and ask first for any delete, for `invoices mark-invoiced`
  (irreversible, freezes the work reports) and for `workers invite` / `workers remove` (invite
  sends e-mail).
- Read back after every write: the response of a create carries less than the detail.

## States and estimates

- Tasklists, in order: `Backlog`, `To Do`, `In progress`, `Code review`, `Testing`, `Done`, plus
  `LTT` for recurring work. A project may omit `Testing`. New work starts in `Backlog`.
- `To Do` means ready to pick up: a complete description with acceptance criteria, an approved
  estimate and no open blocker (an open `question` issue counts as one). It needs no assignee: an
  unassigned task in `To Do` is ready for anyone, and whoever picks it up assigns themselves
  (`esoul-task-work` › Pick up the task). A task that is not ready stays in `Backlog`.
- The estimate is the person's time on the task (briefing the agent, checking its work, review,
  UAT, fixes), in 15-minute steps, with a split proposed above 4 hours. Agent time is not
  estimated. It is the same measure a work report records: the person's active time on the task,
  measured from the session when one exists. A project may define another unit in `CONTEXT.md`.

## Work reports

A work report is the person's active time on the task, measured from the session when one
exists, and never waiting. On an overloaded machine one hour of work shows as five elapsed; the
client would pay for the processor queue. This holds for every `freelo reports create` and
`edit` (MCP `manage_work_reports`), including the report added when a task moves to `Code review`.

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

1. A session transcript is the accurate source. The script reads the three layouts, recognised
   per record: Claude Code (`~/.claude/projects/<project>/<session>.jsonl`), omp
   (`~/.omp/agent/sessions/<project>/<session>.jsonl`) and Codex
   (`~/.codex/sessions/<year>/<month>/<day>/rollout-*.jsonl`).

   ```bash
   node scripts/work-report-minutes.mjs <transcript.jsonl> [--from <ISO time>] [--to <ISO time>] [--json]
   ```

   (path relative to this skill's folder). `--from` is the start of work on the task, `--to`
   the moment of the report. It sums the gaps between records: a gap that ends in a test,
   build, install or waiting-loop result (`until`, `sleep`, `Monitor`, a `wait` on a shell job,
   `[testq] waiting`) longer than one minute does not count; subagent work (`Agent`, `Task`,
   `Skill`, `Workflow`, Codex `wait_agent`, an omp `wait` that returns `[task]` jobs) counts in
   full; any other gap counts at most 5 minutes. It prints the active minutes, the value
   rounded to 5 minutes and the waiting left out. A session that served several tasks needs
   `--from` and `--to` per task.
2. Without a transcript, or from another agent, build a timeline from the branch reflog
   (`git reflog show <branch> --date=format:%H:%M`), commit times, test-log modification times
   and Freelo moves, and sum only the active stretches.
3. Spot-check the transcript number against the commit times. The script cannot see waiting
   inside one long ordinary-looking command (a wait command it does not recognise, a long
   download); where the timeline shows such a stretch, redo the number with step 2.
4. Round to 5 minutes. The note says what was done and that the time is active work without
   waiting for tests; add the PR link when one exists, otherwise the issue or branch, and the PR
   link at the next edit.
5. The final summary states the reported minutes and how long the waiting took, so the user can
   adjust the report.

Minutes the user set or changed explicitly, and retrospective estimates they entered, are never
recalculated.
