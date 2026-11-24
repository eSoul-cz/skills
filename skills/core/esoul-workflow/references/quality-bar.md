# Agent self-check before review

Paste this list into every implementer brief and name the sections that apply. Answer each applicable line in the report with evidence; review starts only after that. The rules themselves live in the guidelines (`docs/project_guidelines/<file>.md`); this list holds only the questions.

1. Intentions in the diff: list them. More than one means split, or name why they cannot be separated. `workflow.md` › Pull requests.
2. Every rule the UI shows (a deadline, a permission, a hidden control): where does the server enforce it? `code-review.md` › Default Critical findings.
3. A bug fix: the root cause in one sentence and where it is fixed; a workaround has a follow-up issue. `workflow.md` › Fixing a bug.
4. A new condition or helper: which existing one did you search for? `code-review.md` › Default Major findings.
5. A new or changed query: tiebreaker, `NULL` order, one-row joins, counts from affected rows. `architecture.md` › Queries that stay correct on real data.
6. Schema changes: only in migrations. `architecture.md` › Schema changes only in migrations.
7. An update endpoint: a field not sent versus a field cleared. `requests-and-validation.md` › Partial updates: not sent or cleared.
8. A composable with module-level state: says so, and its tests reset it. `frontend.md` › Composables with module-level state.
9. New or changed comments: English, a brief non-obvious why. `documentation.md` › Code comments.
10. A behaviour change: a test that fails without it, or the `No test:` line. `testing.md` › Every behaviour change carries a test.
11. A transformation, ETL or data-fix rule: proven with a temporary test and a fixture of the offending rows, not committed. `testing.md` › Temporary tests.
12. Risk: what this change can break and what you did not do go into the PR template section "Risks and what I did not do".
