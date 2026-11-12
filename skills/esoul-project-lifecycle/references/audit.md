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
titles with category prefixes, issues without a category label, UAT or Freelo link, the
repository's merge and ruleset settings, and the case-study inputs (`Original site` in the
profile; a `assets/case-study/pred/*/manifest.json` when it is a URL). Exit code 1 means errors.

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
| Checks → CI | The commands in `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` and `tools.md` match what the `Jenkinsfile` runs; framework versions named there match `composer.json`/`package.json` |
| Agent rules → testing | `AGENTS.md`/`CLAUDE.md` say nothing about tests that contradicts `testing.md` (asking before the full suite, never deleting tests, other run rules) |
| Suite → testing.md | No committed tests of an excluded kind (performance, migration and schema, data-definition, tests reading local data files) unless named exceptions; every architecture test is a named exception |
| Test groups | `phpunit.xml` (or the stack equivalent) excludes `sandbox` and `quarantine`; every quarantined test links an open issue; `db-engine` tests exist where queries depend on the production engine |
| CI cost | Push builds run only the read-only checks of `tools.md` (no scheduled groups, no mutation); the release-image test build is limited to image inputs; serial runners (`--maxWorkers=1`) are justified in the `Jenkinsfile` |

## 3. Report

Group findings as Errors (rule broken), Drift (documents disagree) and Suggestions. For each:
evidence, the rule, and the proposed fix as a pair or as part of a docs PR. Do not open
issues or edit files from the audit itself.
