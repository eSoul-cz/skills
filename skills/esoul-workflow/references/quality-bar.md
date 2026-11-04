# Quality bar for a change

Read this before building an M, L or Bug slice and again before handing the diff to review. Each
rule comes from defects that blind reviews of merged eSoul PRs found repeatedly in
agent-written code; the strongest human PRs in the same repositories did not have them. The
project's `AGENTS.md`, guidelines and ADRs take precedence.

## 1. One intention per PR

- A PR does one thing that its title can say in one line. Everything else found on the way (a
  `.gitignore` line, a stray rename, a fix in another domain, UAT counters, a refactor that
  "was nearby") goes to a follow-up task or a separate PR, never into this one.
- Budget: about 400 changed lines of production code, tests and generated files excluded. Over
  the budget, split into slices or a stacked PR (`final-pr-review`, references/stacks.md) unless
  the change cannot be shipped in parts; then say why in the PR description.
- Do not change existing defaults (default filter, tab, sort, page size) as a side effect. A
  changed default is its own decision and is named in the PR description.
- Before review, list the intentions in the diff. More than one means split, or name the reason
  they cannot be separated.

## 2. The server is the boundary

- Every rule the UI expresses (a deadline, a permission, a state that hides a button or a tab,
  a limit, a required field) is enforced on the server too: Form Request, policy, or domain
  check in the command handler. Hiding a control is presentation, not enforcement.
- The test for such a rule calls the endpoint or the handler and expects the rejection; a
  front-end test alone does not cover it.

## 3. Fix the cause, not the symptom

- For a bug, name the root cause in one sentence before changing code. Fix it where it lives.
- A workaround (an extra prop or parameter passed around, a special case in the caller) is
  allowed only when the cause cannot be fixed in this slice; then the PR says so and a
  follow-up task exists.
- The regression test fails on the cause, not only on the reported symptom.

## 4. One source of truth for a rule

- A condition that decides visibility, scoping, eligibility or status lives in one place (a
  query scope, a query object, a policy, an enum method, a composable) and every caller uses it.
  Two methods with the same branching, or the same component copied into each branch of a
  template, is duplication to remove before review.
- Before writing a helper, search for an existing one (`codegraph_explore` or Grep).

## 5. Queries that stay correct on real data

- Every sorted or paginated list ends its `ORDER BY` with a unique key (`id`) and decides where
  `NULL` values go. Without a tiebreaker pages overlap and skip rows.
- A correlated subquery or join on a mapping table must match at most one row: back it with a
  unique index, and remember that MySQL/MariaDB `_ci` collations compare case- and
  accent-insensitively.
- Counts reported back (imported, updated, skipped) come from affected rows, not from a
  precomputed total.
- Check-then-act on shared state uses a conditional update, a unique constraint or a lock.

## 6. Code belongs to its layer

- Schema changes (create, alter, drop tables or indexes) live in migrations, not in
  application handlers, jobs or controllers. A large data operation that needs a work table uses
  a temporary table or runs as a migration or an explicit artisan command with a lock.
- Partial updates distinguish "field not sent" from "field cleared" (`array_key_exists`,
  `$request->has`, `Optional`), so a user can empty a value.

## 7. Front-end state

- Do not name a prop like a local `computed` or variable; do not destructure props or copy
  `props.x` into a constant when the value must stay reactive (`toRef`, `computed`).
- A composable that holds module-level state says so, and its tests reset it.

## 8. Comments and text

- A code comment explains a non-obvious why in a few lines. Long rationale belongs in the PR
  description or an ADR, linked from a one-line comment.
- Comments and user-facing text follow the language of the surrounding code; Czech text keeps
  its diacritics.

## Self-check before review

Answer each line in the handoff to the reviewer or orchestrator, with evidence:

1. Intentions in the diff: <list>; production lines changed: <n>.
2. Rules the UI shows and where the server enforces each one.
3. For a bug: the root cause and where it is fixed.
4. New conditions or helpers, and the existing one searched for.
5. New or changed queries: tiebreaker, `NULL` order, uniqueness of joins.
6. Changed defaults, if any.
