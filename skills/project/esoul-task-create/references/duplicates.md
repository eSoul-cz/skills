# Related work and duplicates

Write native Freelo task relations ([cli-recipe.md](cli-recipe.md)); a relation is never replaced by a temporary comment. When a relation cannot be written, keep the dependency in the description's `Závislosti` section with the other task's clickable URL and report the missing relation. In `github-freelo` mode the GitHub issue's native `blocked_by` dependency is the source of truth and the Freelo relation mirrors it.

Use Freelo's exact relationship names:

- `Souvisí s` on both tasks;
- `Je duplikát` on both tasks;
- `Je blokován` on the dependent task and `Blokuje` on the prerequisite task.

Preview every relation before writing it.

Never create a complete duplicate. Show the existing task and propose a safe refinement when appropriate:

- `Backlog`: propose merging or expanding its description, subtasks, labels, and estimate.
- `To Do`: allow a proposed refinement, then re-check readiness (complete, estimated, no blockers) and the due date.
- `In progress`: do not expand scope without explicit approval; keep a small clarification there or create separately linked substantial work.
- `Code review` or `Testing`: keep only corrections required by the approved scope; create newly discovered scope as a separate related task.
- `Done`: do not reopen or rewrite automatically; create a separate related change.
- `LTT` (or `Project Management`): add to the same confirmed LTT only when it is truly continuing work; otherwise create separately.

Updating an existing task is allowed only as the approved duplicate-prevention exception; lifecycle moves are `esoul-task-work`.
