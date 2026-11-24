---
name: esoul-task-work
description: Work an eSoul tracked task from pick-up to close. Use when starting work on a GitHub issue or Freelo task (assignee, assigned-task check, In progress), when opening its PR (Code review move, work report), when closing it after merge (Testing, Done, finish), or for the start-of-session sweep of merged-but-unmoved tasks. Creating tasks is esoul-task-create.
---

# eSoul task work

The development side of tasking: the state of the task follows the state of the work. Moves
and assignee writes on the task this session works on are mechanical status updates; they need
no approved preview, and every one is listed in the final summary. Content writes (title,
description, estimate, new tasks, substantive comments) need an approved preview: use
`esoul-task-create` when it is installed; otherwise show the exact text and wait for approval.

## 0. Tracker, tools, assignee

1. Tracker: use applicable `AGENTS.md` content already in context. Read only the `## Tracker`,
   `## Freelo` (project, tasklist IDs, label UUIDs) and `## Tasking convention` (mode
   `freelo-only` or `github-freelo`) sections of root `CONTEXT.md`, once per session.
2. Tools: the Freelo MCP tools when mounted, otherwise the `freelo` CLI with `--agent`; GitHub
   through `gh`. For command syntax use the official `freelo` skill (layer `upstream-core`;
   when it is not installed, ask the user to run `npx @esoul-cz/skills install upstream-core`,
   or read `freelo <group> --help`). eSoul rules on top of it: [references/freelo.md](references/freelo.md).
3. Delegation: send tracker writes to a cheap subagent with the exact command when the harness
   offers one, asking for compact fields back (IDs, titles, states, URLs); otherwise run them
   yourself.
4. Assignee: the person the session works for: `gh api user --jq .login` on GitHub, the
   matching user of `freelo users list --agent` on Freelo. When the user named someone else, use
   that person. When the Freelo user cannot be matched, ask once.

Done when you know the mode, the Freelo project and tasklist IDs and the assignee.

## 1. Pick up the task

1. Find the issue or task. When none exists, the change first needs one
   (`docs/project_guidelines/workflow.md` › Tasking): create it through `esoul-task-create`; for
   small administrative work the user decides whether it goes without one, and you ask.
2. The task has acceptance criteria and no open blocker; otherwise it is not ready, so tell
   the user.
3. **Assigned-task guard.** When the Freelo worker or the GitHub assignee is someone other than
   the assignee from step 0, stop, tell the user and leave the assignment alone.
4. Create the branch as `docs/project_guidelines/workflow.md` › Branches says, then write the
   start moves of the table below.

Done when the assignee is set on both sides and the task is in `In progress`.

## 2. The moves

| When | GitHub issue (`github-freelo`) | Freelo task |
|---|---|---|
| Work starts | `gh issue edit N --add-assignee <login>` | set the worker to the Freelo user id; move to the `In progress` tasklist |
| PR opened | - | move to `Code review`; add the work report |
| Review finds defects | - | move back to `In progress` |
| After merge | the issue closes with the PR | move to `Testing`; where the project has no testing step, move to `Done` and finish the task |

- Tasklist IDs come from `## Freelo`; a Freelo task keeps its worker through every move.
- A task already in `In progress` with the right worker needs no write.
- Merged work never stays in `Backlog` or `To Do`.
- UAT tick-off and the final `Done` after `Testing` stay with the user (or the `esoul-uat`
  skill when installed).

## 3. Open the PR

Open it as `docs/project_guidelines/workflow.md` › Pull requests say (title, template, issue
link). `github-freelo`: `Closes #N` in the body; `freelo-only`: the Freelo task URL in the
body. When `gitmoji-commit` is installed it writes the commits and the commit-format title;
otherwise follow `docs/project_guidelines/workflow.md` › Commits.

Then move the task to `Code review` and add the work report with the PR link in its note
([references/freelo.md](references/freelo.md) › Work reports). A review that sends the task
back moves it to `In progress`; the time of that review round is reported when the task next
goes to `Code review`.

Done when the PR links the task, the task is in `Code review` and the report exists.

## 4. Close after merge

The author merges as a human; an agent merges only with the owner's explicit authorisation
recorded in the PR (`docs/project_guidelines/workflow.md` › Pull requests). After the merge
apply the after-merge move and read the task back.

Done when the issue is closed, the task sits in `Testing` or `Done`, and the final summary
lists every write of this skill.

## 5. Start-of-session sweep

Once at the start of a session in a repository with a Freelo mapping, catch up tasks whose
work merged without a move; hand it to a cheap subagent in one pass when the harness offers
one, asking for a compact list.

1. List the tasks in `Code review` and `In progress` of the project.
2. For each, find the linked PR or issue (`gh`): merged, or closed as completed by a merged PR?
3. If yes, apply the after-merge move. Set the PR author's Freelo user as worker only when the
   task has none; never overwrite a different worker.
4. Leave tasks without a merged PR alone. An issue closed as not planned, or closed without a
   PR, is only reported.

The sweep is not starting work, so the assigned-task guard does not apply. Done when every move
and every reported case is in the final summary.
