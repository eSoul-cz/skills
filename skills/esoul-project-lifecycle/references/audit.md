# Audit (P9, `audit`) — read-only

Audit never writes. It produces a report the user can turn into pairs or a `client-update` PR.

## 1. Automated conformance

Run it first, through `esoul-skills:test-runner` (Haiku), which returns only the verdict and the
failures:

```bash
node <skill>/scripts/conformance.mjs <repo-root> [--tier full|light] [--github owner/repo] [--json]
```

It checks required files per tier, `CONTEXT.md` sections, leftover `{{…}}` placeholders,
ADR index ↔ frontmatter consistency and duplicate numbers, slice IDs and their issues, issue
titles with category prefixes, issues without a category label, UAT or Freelo link, and the
repository's merge and ruleset settings. Exit code 1 means errors.

## 2. Completeness review (judgement)

Hand the cross-checks to `esoul-skills:reviewer` (Sonnet) with a brief that names the table
below, the repository paths and the conformance result, and asks for verifiable findings with
evidence. The session judges the findings and writes the report. Cross-check, citing evidence
for every finding:

| Check | Pass when |
|---|---|
| Podklady → plan | Every requirement in the podklady maps to a slice or an explicit exclusion in `rozsah.md` |
| Questions | Every open question names what it blocks; nothing blocked is `ready-for-agent` |
| ADRs → code | Accepted ADRs' Implementation status matches the code; gaps have issues or say "No issue" |
| Plan → GitHub | Every slice has a pair; every open issue maps to a slice or is a follow-up of one |
| GitHub → Freelo | Titles identical, reciprocal links, labels on both sides, estimates present for To Do |
| Freelo states | No finished work left in Backlog or Code review; Done tasks are finished |
| Glossary | Terms used in recent issues and code exist in `GLOSSARY.md`; no `_Avoid_` words |
| Guidelines → checks | Every MUST rule has a check, or is listed as manual review |
| Staleness | Plan status date, „Hotovo.“ markers and phase table reflect reality |
| Data safety | No real personal data in tests, fixtures, issues or PRs |

## 3. Report

Group findings as Errors (rule broken), Drift (documents disagree) and Suggestions. For each:
evidence, the rule, and the proposed fix as a pair or as part of a docs PR. Do not open
issues or edit files from the audit itself.
