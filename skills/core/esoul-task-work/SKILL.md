---
name: esoul-task-work
description: Use when starting work on a GitHub issue or Freelo task (picking one up, assignee, In progress), when opening its PR (Code review move, work report), when closing it after merge (Testing, Done), or for the start-of-session sweep of merged-but-unmoved tasks. Keeps the task's state, assignee and work report in step with the work. Creating or revising tasks is esoul-task-create.
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
   or read `freelo <group> --help`). eSoul rules on top of it, with the CLI and MCP name of each
   operation used here: [references/freelo.md](references/freelo.md).
3. Delegation: send tracker writes to a cheap subagent with the exact command when the harness
   offers one, asking for compact fields back (IDs, titles, states, URLs); otherwise run them
   yourself.
4. Assignee: the person the session works for: `gh api user --jq .login` on GitHub, the
   matching user of `freelo users list --agent` on Freelo. When the user named someone else, use
   that person. When the Freelo user cannot be matched, ask once.

Done when you know the mode, the Freelo project and tasklist IDs and the assignee.

## 1. Pick up the task

1. Find the issue or task. When the user names none, list the `To Do` tasks of the project that
   have no worker or already have the assignee as worker and let the user choose; an unassigned
   `To Do` task is ready for anyone. When no task exists, the change first needs one
   (`docs/project_guidelines/workflow.md` › Tasking): create it through `esoul-task-create`. Small
   administrative work may go without one when `## Tasking convention` records that standing
   decision for its kind (for example dependency updates, `Jenkinsfile` changes); otherwise the
   user decides and you ask.
2. The task is ready: acceptance criteria, an estimate (Freelo), no open blocker, where an open
   `question` issue counts as a blocker ([references/freelo.md](references/freelo.md) › States
   and estimates). A task in `To Do` is ready by definition. A task the user names from `Backlog`
   may lack an estimate (`Backlog` allows it, `To Do` requires it): check the rest, ask the person
   for the estimate (their time, 15-minute steps) and set it through `esoul-task-create` before
   `In progress`; the person may say it follows after pick-up, which the final summary records.
   Anything else missing: tell the user.
   A hotfix (`docs/project_guidelines/workflow.md` › Hotfix) is the exception: the task may go
   straight to `In progress` from `Backlog` or from nothing, without an estimate, and may be
   created after the fix is pushed (before the PR merges) through `esoul-task-create`. Set the
   estimate and the work report once the fix is out and record both in the final summary.
3. **Assigned-task guard.** When the Freelo worker or the GitHub assignee is someone other than
   the assignee from step 0, stop, tell the user and leave the assignment alone. A task with no
   worker or assignee is not a conflict: step 4 assigns it.
4. Create the branch as `docs/project_guidelines/workflow.md` › Branches says, then write the
   start moves of the table below (assignee first, then the move).

Done when the assignee is set on both sides and the task is in `In progress`.

## 2. The moves

| When | GitHub issue (`github-freelo`) | Freelo task |
|---|---|---|
| Work starts | `gh issue edit N --add-assignee <login>` | set the worker to the Freelo user id (an unassigned task gets the assignee of step 0); move to the `In progress` tasklist |
| PR opened | - | move to `Code review`; add the work report |
| Review finds defects | - | move back to `In progress` |
| After merge | the issue closes with the PR | move to `Testing`; where the project has no testing step, move to `Done` and finish the task |

- Tasklist IDs come from `## Freelo`; a Freelo task keeps its worker through every move.
- A task already in `In progress` with the right worker needs no write.
- Merged work never stays in `Backlog` or `To Do`.
- UAT tick-off and the final `Done` after `Testing` stay with the user, or with the `esoul-uat`
  skill when installed: its `issue` mode runs the task's `## UAT` block and reports; ticking the
  boxes in the issue is then a write the user approves.

## 3. Open the PR

Open it as `docs/project_guidelines/workflow.md` › Pull requests say (title, template, issue
link). `github-freelo`: `Closes #N` in the body; `freelo-only`: the Freelo task URL in the
body.

**Title.** Derive it from the task title as `docs/project_guidelines/workflow.md` › Tasking and
› Pull requests say, and write it in the commit standard of the developer you work for.
Mapping into the recommended Gitmoji format: the context becomes the lowercase kebab-case
`[context]`, the result stays the message, `Order history: Add filter` →
`:sparkles: [order-history] Add filter`. The PR title is always English: when the tracker title is
Czech (a project that keeps Czech tracker titles), the PR title is an English, descriptive title of
the same result that links the issue (`workflow.md` › Tasking), never the Czech title.
`gitmoji-commit` writes the commits and this title when it is installed; a developer's or
repository's own standard is applied the same way (`workflow.md` › Commits).

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
