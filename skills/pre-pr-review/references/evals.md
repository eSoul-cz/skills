# Measuring the reviewer

Detail for "Measuring the reviewer" in `pre-pr-review`. Two measurements: an eval set that a change to the reviewer must pass, and the dispositions of real findings, which show how much of the reviewer's output is noise.

## Regression eval set

Every revert, hotfix, or incident caused by a merged change becomes one case. The set grows by one case per incident and is never pruned because a case is hard.

### Case format

One JSON file per case in `tooling/review-evals/cases/` of this repository. It stores references only: never client code, data, or credentials.

```json
{
  "id": "orders-total-discount-2026-10",
  "kind": "bug",
  "repository": "eSoul-cz/<repo>",
  "base": "<full SHA the bug-introducing PR was based on>",
  "head": "<full SHA of that PR's head>",
  "intent": "<one sentence: what the PR meant to do>",
  "expected": [
    { "path": "app/Orders/Total.php", "line": 42, "defect": "Total ignores the discount for B2B customers.", "blocking": true }
  ],
  "fix": "<SHA or PR of the fix-forward or revert>",
  "confirmedBy": "<who knows the code and confirmed the defect and its location>"
}
```

- `kind: "bug"` cases come from reverts, hotfixes, incidents, and blocking findings a human reviewer caught after the AI review missed them. An engineer who knows the code confirms the defect and where it lived before the case is added.
- `kind: "clean"` cases are merged changes that caused no revert or incident for at least a month. `expected` is empty. They measure false positives.
- Keep roughly one clean case for every two bug cases.

### Running it

Run the eval for every change to `pre-pr-review` lenses, briefs, filters, or depth rules, to the `reviewer` or `critical-reviewer` agents, or to their models:

1. For each case, check out `head` in a temporary worktree outside the client repository and run `pre-pr-review` in report mode with `--type committed --base <base>` and the case's `intent` as the contract. Never post anything.
2. Score each bug case: **caught** when a finding points at an `expected` location (same file, within about 10 lines) and describes the same defect; a blocking expected defect counts only when it is reported as blocking.
3. Score each clean case: count blocking findings, and findings whose proposed fix would make the code worse (harmful).
4. Record per run: date, skill version, models, recall on bug cases, blocking findings and harmful findings on clean cases, review rounds or tokens if known.

Keep a change when recall does not drop and harmful findings do not rise; otherwise drop or rework it. Write the result into the PR that changes the reviewer.

## Disposition tally

`final-pr-review` already records each finding's disposition in its ledger. Its completion report adds one line per reviewer (CodeRabbit, `pre-pr-review`, humans):

```text
Findings · <reviewer>: <n> fixed · <n> rejected as wrong · <n> intentional · <n> did not matter · rounds to pass <n>
```

- **fixed**: a valid finding that led to a change.
- **rejected as wrong**: the claim was false (the code handles the case, the line does not do that).
- **intentional**: the behavior was correct by design; the reviewer lacked the intent.
- **did not matter**: true but not worth a change.

A high share of "wrong" points to the lenses or the verification step; "intentional" points to a missing contract (issue, ADR, `code-review.md` "What failure looks like"); "did not matter" points to the nit filter. Recurring "wrong" or "did not matter" findings of one kind become a rule in the project's `code-review.md` or a filter here.
