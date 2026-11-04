# Task lifecycle

Applies to both tasking conventions: `freelo-only` (Freelo task only) and `github-freelo` (issue plus paired Freelo task). The Freelo project and tasklist IDs are in the repository `## Freelo` section of `CONTEXT.md` (or the project tasking skill); read only that section.

These writes concern the task this session works on. They are mechanical status updates and need no approved preview, but list them in the final summary. Content writes (title, description, estimate, new tasks, substantive comments) still need approval (`esoul-tasking`).

## Who is the assignee

The person the session works for: the authenticated `gh` user for GitHub (`gh api user --jq .login`), the matching Freelo user for Freelo (`freelo users list --agent`). If the user named someone else, use that person. If the Freelo user cannot be matched, ask once.

## Moves

| When | GitHub issue (`github-freelo`) | Freelo task |
|---|---|---|
| Work starts (before or at branch creation) | `gh issue edit N --add-assignee <login>` | `freelo tasks edit <id> --worker <user id> --agent`; `freelo tasks move <id> --tasklist <In progress id> --agent` |
| PR opened | - | move to `Code review`; add the work report (`freelo` skill, `references/work-reports.md`) |
| Review finds defects | - | move back to `In progress` |
| After merge | issue closes with the PR | move to `Testing`; where the project has no testing step, move to `Done` and `freelo tasks finish <id> --agent` |

- The task keeps its worker through every move.
- Never leave a task with merged work in `Backlog` or `To Do`.
- A task already in `In progress` with the right worker needs no write.
- **Assigned-task guard (hard rule):** never start work on a task whose Freelo worker or GitHub issue assignee is someone other than the person the session works for. Stop, tell the user, and do not reassign.
- In an orchestrated session the orchestrator may send these writes to `esoul-skills:ops` with the exact command; `ops` runs them without a preview.
- UAT tick-off and the final `Done` after `Testing` stay with the user or `esoul-uat`.

## Start-of-session sweep

Once at the start of a session in a repository with a Freelo mapping, catch up tasks whose work merged without a status move. Delegate it to `esoul-skills:ops` in one pass and have it return a compact list.

1. List the tasks in `Code review` and `In progress` of the project (tasklist IDs from `CONTEXT.md`).
2. For each, find the linked PR or issue (`gh`): is the PR merged, or the issue closed as completed by a merged PR?
3. If yes, move the task per the after-merge rule (`Testing`, or `Done` and finish where there is no testing step). Set the PR author's Freelo user as worker only when the task has none; never overwrite an existing different worker.
4. Leave tasks without a merged PR alone. An issue closed as not planned, or closed without a PR, is only reported, not moved.

The sweep is not starting work, so the assigned-task guard does not apply to it. List every move and every reported case in the final summary.
