# {{PROJECT_NAME}} agent guidance

Work one prepared issue at a time, within its scope and acceptance criteria, and take the next
issue only after this one meets the Definition of Done in [CONTRIBUTING.md](CONTRIBUTING.md).
Humans start at [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md); everything here
applies to them too.

The documentation is the source of truth and should answer every scope and design question. Read
it in this order: [GLOSSARY.md](GLOSSARY.md) (the vocabulary), the decisions in
[docs/adr/index.md](docs/adr/index.md), this file and the engineering guides linked from
[docs/project_guidelines/index.md](docs/project_guidelines/index.md), the design, the delivery plan
in [docs/plan/README.md](docs/plan/README.md), and the client's material in
[docs/podklady/README.md](docs/podklady/README.md) and `docs/legacy/`. Project conventions (Freelo,
tasking, commits, languages, UAT dimensions) are in [CONTEXT.md](CONTEXT.md). Look the answer up
there before asking or choosing an approach of your own. Project rules take precedence over
generic framework, generated and skill examples.

- An `accepted` ADR is the target contract; a `proposed` one is not a specification, and the
  Records table in the ADR index is the only place to check which is which. Never weaken an
  accepted ADR to match the current code: record the difference as an implementation gap.
- Conflicts between sources get reported, not resolved silently.
- When a rule says the code does not follow it yet ("Target: … the code does not do this yet
  (#issue)"), the rule is the target: do not copy the gap into new code and do not fix it in
  passing outside its issue.
- Open questions are not yours to answer. A point the client has not decided lives in
  `docs/podklady/otevrene-otazky.md`; do not guess it from the podklady, the legacy system or your
  own reasoning, and do not phrase a guess as a decision. Split the dependent work out and ask.

## What this project is

{{PROJECT_SUMMARY}}

## Stack rules

The stack profile named in [CONTEXT.md](CONTEXT.md#project-profile) defines the architecture,
the quality gates and the deployment; the detail is in `docs/project_guidelines/`.

{{STACK_AGENT_RULES}}

## Rules that apply everywhere

- **Numbers and calculations come from `docs/podklady/`, never from your own reasoning.** If a
  source is ambiguous or wrong, the point goes to `docs/podklady/otevrene-otazky.md` and the
  client answers it. Do not invent a formula, do not "improve" one, and do not round anywhere the
  guidelines do not say. Where the client has a workbook, a parity test reproduces it.
- **Real client data never leaves `docs/podklady/` and `assets/`.** Names, contacts, amounts and
  other personal or business data from the client's material never appear in code, tests,
  fixtures, factories, seeders, issues or pull requests. The one exception is a parity fixture
  that the testing guideline allows: numbers and workbook cell references only, never names,
  contacts, project or company identifiers. Agents work only with anonymized dumps; never load,
  read or request a non-anonymized database export.
- **Client files and data belong in the tracked repository**, never in gitignored places
  (`storage/`, `tmp/`, Downloads): binaries in `assets/` through Git LFS, guides in `docs/`.
  The only exception is unanonymized legacy evidence, which stays in the gitignored `_reference/`.
- **Work labelled `data-migration`** (migrations, imports, data fixes, reports) changes only what
  its issue explicitly specifies, including an approved schema change. Anything beyond that in
  application code or the data model is not done in passing: write the proposed fix down and ask
  for a new issue/task pair.
- **A new domain term goes into [GLOSSARY.md](GLOSSARY.md) in the same pull request** that
  introduces it. No synonyms: one concept, one Czech term, one English identifier.
- **Do not write summary, report or analysis Markdown files.** Documentation goes into the places
  listed above or nowhere.
- **Do not add a dependency, a new top-level directory or a new architectural layer** without
  approval from the project maintainer.
- **Do not modify `GLOSSARY.md`, `CONTEXT.md`, ADRs, `docs/project_guidelines/` or this file**
  incidentally during unrelated work.
- Never commit secrets or personal data, and never point a command that writes at a production
  system or a client's production integration.

<!-- optional: projects with a Pencil design -->
## Design

- The design is `{{DESIGN_PEN_PATH}}`, stored in Git LFS. When the checkout holds only a small
  pointer file, run `git lfs pull --include="docs/design_pencil/**"` first.
- A `.pen` file is encrypted: read and change it only through the Pencil MCP tools while the
  pen.dev app is running. Never `Read` or `grep` it, and exclude it from searches
  (`git grep … -- ':!*.pen'`).
- The brief and any derived summary in `docs/design_pencil/` describe the screens; the `.pen`
  file wins on any conflict, and design tokens in code mirror it. Read a screen's section and
  its notes before implementing it.

## Verification

- Before calling work done, run `{{CHECK_COMMAND}}` and the other checks from
  [CONTRIBUTING.md](CONTRIBUTING.md) that the change needs, and fix every failure. Jenkins runs
  the same checks on every push.
- Add or update tests for behaviour and logic changes; a bug fix gets a regression test that
  fails without the fix. Tests never assert the text of an error message.
- Run the issue's UAT scenario and check it off before reporting the work as finished.

<!-- optional: stacks whose profile defines a mutation soft gate -->
## Mutation testing

Before opening a pull request that changes production code, run `{{MUTATION_COMMAND}}` and review
every escaped mutant on the lines you changed. Kill it with a behavioural test or state in the
pull request why it is acceptable. It is a local soft gate for test usefulness, not a CI check;
see [testing.md](docs/project_guidelines/testing.md). Delete temporary or exploratory tests before
this step. Do not kill a mutant that only changes error-message wording by asserting the text.

## Pull requests and merging

- Every change goes through a pull request; never push to `main`.
- Jenkins must pass and one human must approve; the `Jenkins` check and the approval are
  required on `main`. **Agents never merge** and never use a ruleset bypass, including the one
  the shared `esoul-cz-user` account may have. A person merges from a personal account with a
  squash merge.
- Finish a pull request with the `final-pr-review` skill: green CI, every valid review finding
  fixed, every rejected one answered with evidence.

## Language

Follow [CONTEXT.md](CONTEXT.md#languages). In short: code, identifiers, code comments, commit
messages, branch names, ADRs and developer documentation are in English; issues, pull request
descriptions, the plan, the podklady notes and comments in team-read configuration
(`.github/*`, `.coderabbit.yaml`, `Jenkinsfile`) are in Czech; user-facing text follows the
project's languages.

## Agent skills

### Workflow

- `esoul-workflow` is the entry point for any non-trivial work: it sizes the task, loads this
  context and routes to the skills below.
- `esoul-tasking` authors issue/task pairs (or Freelo-only tasks) under the convention in
  [CONTEXT.md](CONTEXT.md#tasking-convention), always after an approved preview.
- `gitmoji-commit` creates commits under the convention in
  [CONTEXT.md](CONTEXT.md#commit-convention).
- `final-pr-review` opens or updates the pull request and drives it to green CI and approval;
  it does not merge.
- `esoul-project-lifecycle` keeps the project documentation (podklady, questions, glossary, ADRs,
  guidelines, plan and slices) and audits conformance; use it after a client session or when an
  ADR or the plan changes.
- `esoul-maintain-application-documentation` creates and verifies the user and operator
  documentation.

Vendored and project skills live in `.agents/skills/`. Read the relevant one before working in its
domain rather than after getting stuck; this file and the guidelines take precedence over them.

### Issue tracker

GitHub issues in `{{GITHUB_REPO}}`, each paired with a Freelo task in project
`{{FREELO_PROJECT_ID}}` through `esoul-tasking`. See
[docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context: root `GLOSSARY.md` plus `docs/adr/`. See
[docs/agents/domain.md](docs/agents/domain.md).

<!-- Generated stack guidance (for example Laravel Boost `<laravel-boost-guidelines>`) goes below.
     It is regenerated by its tool and never edited by hand; project rules above win. -->
{{STACK_GENERATED_BLOCK}}
