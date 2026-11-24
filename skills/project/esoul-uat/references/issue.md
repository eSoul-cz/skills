# Issue mode: one issue's `## UAT`

Runs the `## UAT` block of one issue or task and reports. No catalogue, no run folder and no
`## Project profile` are needed; the work being checked is the unit. Use it after a change is
built (before or after merge, on a writable test, staging or preview instance), and for the
`Testing` step of `esoul-task-work`. The block's format is `esoul-task-create` ›
`references/uat.md`.

## 1. Read the block

1. Take the issue or task the user names, or the one linked from the branch or PR
   (`gh issue view <n>` or the `freelo` skill). Read its `## UAT` section: role, precondition, the
   dimension lines, the numbered steps with their `→` results.
2. Without a `## UAT` section, stop: tell the user the issue has none and offer to write it
   through `esoul-task-create` (approved preview), or to take acceptance criteria as steps only
   when the user says so. The block is the contract; do not invent steps.
3. `Bez uživatelsky viditelného dopadu` or a purely technical check: not browser work. Report that
   the check is technical and name who runs it.

## 2. Context, degraded where it is missing

Read what exists and say in the report what was missing; none of it stops the run except the
target.

| Source | When missing |
|---|---|
| `CONTEXT.md › ## Project profile` | Continue: the product type and UAT dimensions come from the block itself, no design comparison, no device sweep, one device (desktop unless the block names another). Say "no `## Project profile`: block read as written" in the report and offer `esoul-project-lifecycle` to write it. |
| `docs/testing/uat/environment.md` | Ask the user for the instance URL, whether it is writable and which account to use for the block's role. Record the answer only in the report. |
| `docs/testing/uat/` catalogue | Not needed. When a scenario of the catalogue covers the block's flow, name its ID in the report; do not run the catalogue. |
| `## Tasking convention` | Needed only to create a bug (below); ask then. |

Target rules are the ones of `SKILL.md` § 4: a step that writes or deletes runs only on an
instance marked writable (`environment.md`, or the user's word in this conversation for the
issue run); production is read-only and each run needs approval; an unknown URL is a stop.
Credentials and the browser: [access](access.md), [chrome](chrome.md). Accounts are test accounts.

## 3. Run the steps

1. Record the build under test (commit, version endpoint or footer; `neznámý` when none).
2. Log in as the block's role in a fresh tab, reach the precondition (`blocked` with the reason
   when it cannot be reached), then do each step as written and compare the page with the `→`
   result: exact texts, values, states, URLs. One reload on a mismatch, no more retries.
3. A negative step ("another customer's order is not shown") is a step like any other.
4. Statuses are those of [execution](execution.md): `pass` only when every expected result was
   seen, `fail` with the step number and the actual result, `blocked` with the reason. Never
   `pass` from reading code. Stop after 3 consecutive `blocked` steps with the same cause.
5. Screenshots go next to the result in the conversation, not into the repository (a run folder
   is a catalogue run's artefact); keep them out of the context when the harness offers a
   subagent for the browser work.

## 4. Report and hand back

Report in this order: the issue (link), environment and build, the role and device, each step with
`pass`/`fail`/`blocked` and the actual result for any other status, what was missing from the
context (above), and the verdict: **the block passes**, **fails at step N**, or **blocked on
<what>**.

- Ticking the boxes in the issue body, or posting the result as a comment, is a write to GitHub or
  Freelo: show the exact text and wait for approval (`esoul-task-create` preview rule). Offer it;
  never do it unasked.
- A failed step means the issue's work is not done: tell the user (during `esoul-task-work` the
  task goes back to `In progress`). A defect outside the issue's scope is triaged as in
  [bugs](bugs.md) and becomes a bug only through `esoul-task-create` with an approved preview.
- When the user later wants the flow in the catalogue, that is `plan` mode, not this one.

Done when every step has a status with its actual result, the build is named and the user has the
verdict.
