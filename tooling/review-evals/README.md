# Review eval set

Maintainer-only. The regression set that scores `esoul-review` (skill `skills/dev/esoul-review`) and its reviewer subagents. The installed skill does not read this folder.

## The gate

Run the eval before shipping a change to any of: the briefs, checklists or risk trigger (`review-passes.md`), the `code-review.md` pointer's eSoul additions, the scope filters (`review-scope.mjs`), the reviewer role briefs or models (`esoul-model-routing`). Write the result into the pull request that makes the change (the run record below). Keep the change when recall on bug cases does not drop and harmful findings on clean cases do not rise; otherwise drop or rework it.

There is no runner script; the gate is a maintainer rule and the run is manual.

## Cases are anonymous

This repository is public, so the cases name no client, repository or system. Each case holds a generic stand-in for the intent, the defect and the file path.

The real data (repository, base and head SHA, the real path and line, the fix and who confirmed it) is kept by the maintainers in a private mapping outside this repository, keyed by the case `id`. A run needs both: the case here and its mapping entry. Do not add repository names, SHAs, fix links, client paths, client names or business terms to a case.

## Case format

One JSON file per case in `cases/`, named `<id>.json`:

```json
{
  "id": "bug-03-total-ignores-discount",
  "kind": "bug",
  "repository": "private/laravel-shop",
  "intent": "<one sentence: what the change meant to do>",
  "expected": [
    { "path": "app/Orders/Total.php", "line": 42, "defect": "Total ignores the discount for B2B customers.", "blocking": true }
  ]
}
```

| Field | Rule |
| --- | --- |
| `id` | `bug-NN-<slug>` or `clean-NN-<slug>` (lowercase, digits, hyphens); the key of the private mapping |
| `kind` | `bug` or `clean` |
| `repository` | `private/<stack>`, a stack label such as `laravel-shop`; never a real repository |
| `intent` | One generic sentence, used as the contract of the run |
| `expected` | Defects the reviewer must find; non-empty for `bug`, empty for `clean`. Each has `path`, `line` (positive integer), `defect`, `blocking` (boolean) |

`test_review_evals.mjs` in `tooling/scripts/` checks this schema and that no case carries `base`, `head`, `fix` or `confirmedBy`.

- `bug` cases come from reverts, hotfixes, incidents and blocking findings a human caught after the AI review missed them. An engineer who knows the code confirms the defect and its location before the case is added.
- `clean` cases are merged changes that caused no revert or incident for at least a month; they measure false positives.
- Keep roughly one clean case for every two bug cases. The set grows by one case per incident and is never pruned because a case is hard.

## Running it

1. For each case, look up its mapping entry, check out the `head` in a temporary worktree outside the client repository, and run Path A in report mode with `--type committed --base <base>` and the case's `intent` as the contract. Never post anything.
2. Score each bug case: **caught** when a finding points at an expected location (same file, within about 10 lines) and describes the same defect; a blocking expected defect counts only when reported as blocking.
3. Score each clean case: count blocking findings, and findings whose proposed fix would make the code worse (harmful).
4. Record per run, in the pull request: date, skill version, models, recall on bug cases, blocking and harmful findings on clean cases, review rounds or tokens if known.
