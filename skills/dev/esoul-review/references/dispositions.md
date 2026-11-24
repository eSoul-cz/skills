# Disposition tally

Path B records each finding's disposition in its ledger. The completion report (step B7) adds one line per reviewer (CodeRabbit, the `esoul-review` fallback review, humans):

```text
Findings · <reviewer>: <n> fixed · <n> rejected as wrong · <n> intentional · <n> did not matter · rounds to pass <n>
```

- **fixed**: a valid finding that led to a change.
- **rejected as wrong**: the claim was false (the code handles the case, the line does not do that).
- **intentional**: the behavior was correct by design; the reviewer lacked the intent.
- **did not matter**: true but not worth a change.

A high share of "wrong" points to the briefs or the verification step; "intentional" points to a missing contract (issue, ADR, the project's default Critical findings in its `docs/project_guidelines/code-review.md`); "did not matter" points to the nit filter. Recurring "wrong" or "did not matter" findings of one kind become a rule in the project's guidelines or a filter here.
