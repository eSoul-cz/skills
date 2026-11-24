# Audit (P9, `audit`) — read-only

Audit never writes. It produces a report the user can turn into pairs or a `client-update` PR.

## 1. Automated checks

Run both first, through a test runner subagent when the harness offers one (otherwise yourself), which returns only the verdict and the
failures.

**Guidelines.** The project has `esoul-guidelines.json`, `esoul-guidelines.lock` and
`docs/project_guidelines/index.md`, and `esoul-guidelines check` exits 0. The command is
read-only: exit 1 means drift (a managed block was edited) or outdated content. Obtain the command
with the skill `esoul-guidelines`; report a missing installer as an Error, never install it from an audit.

**Conformance.**

```bash
node <skill>/scripts/conformance.mjs <repo-root> [--tier full|light] [--github owner/repo] [--json]
```

It checks required files per tier (including the guideline config, lock and index),
`CONTEXT.md` sections (Project profile, Tracker, Tasking convention, Commit convention),
leftover `{{…}}` placeholders, ADR index ↔ frontmatter consistency and duplicate numbers, slice IDs
and their issues, issue titles with category prefixes, AI-readiness inputs (`ai-readiness-doc`,
`ai-readiness-slices` for website, website-admin and eshop), work items without a category label,
UAT or Freelo link, `question` issues without the sections of `question.yml` (they are register
entries, exempt from the work-item checks: [labels.md](labels.md)), the repository's merge and
ruleset settings, and the
case-study inputs (`Original site` in the profile; a `assets/case-study/pred/*/manifest.json`
when it is a URL). Exit code 1 means errors.

For an audit of a live public site, also run the AI-readiness check against production (skill
`esoul-quality-gates`, through a test runner when the harness offers one) and report failed
`must` checks as Errors.

## 2. Completeness review (judgement)

Hand the cross-checks to a fresh-context reviewer subagent when the harness offers one (otherwise do them yourself) with a brief that names the table
below, the repository paths and the results of both automated checks, and asks for verifiable
findings with evidence. The session judges the findings and writes the report. Cross-check,
citing evidence for every finding:

| Check | Pass when |
|---|---|
| Podklady → plan | Every requirement in the podklady maps to a slice or an explicit exclusion in `rozsah.md` |
| Questions | Every open `question` issue (`gh issue list --label question --state open`) names what it blocks; nothing blocked is `ready-for-agent` ([labels.md](labels.md)) |
| ADRs → code | Accepted ADRs' Implementation status matches the code; gaps have issues or say "No issue" |
| Plan → GitHub | Every slice has a pair; every open issue maps to a slice or is a follow-up of one |
| GitHub → Freelo | Titles identical, reciprocal links, labels on both sides, estimates present for To Do |
| Freelo states | No finished work left in Backlog or Code review; Done tasks are finished |
| Glossary | Terms used in recent issues and code exist in `GLOSSARY.md`; no `_Avoid_` words |
| Guidelines → checks | Every MUST rule of the project's own guideline files has a check, or is listed as manual review |
| Staleness | Plan status date, „Hotovo.“ markers and phase table reflect reality |
| Data safety | No real personal data in tests, fixtures, issues or PRs |
| Checks → CI | The commands in `README.md`, `AGENTS.md`, `CLAUDE.md` and `tools.md` match what the `Jenkinsfile` runs; framework versions named there match `composer.json`/`package.json`; `esoul-guidelines check` runs in CI |
| Agent rules → testing | `AGENTS.md`/`CLAUDE.md` say nothing about tests that contradicts `testing.md` |
| Suite → testing.md | The suite, its CI stage and its test groups meet the MUST and SHOULD rules of `testing.md`; every deviation is a named exception in the project's guidelines or an ADR |
| CI cost | Push builds run only the read-only checks of `tools.md`; every deviation in the `Jenkinsfile` (serial runners, extra stages) is justified there |

## 3. Report

Group findings as Errors (rule broken), Drift (documents disagree) and Suggestions. For each:
evidence, the rule, and the proposed fix as a pair or as part of a docs PR. Do not open
issues or edit files from the audit itself.
