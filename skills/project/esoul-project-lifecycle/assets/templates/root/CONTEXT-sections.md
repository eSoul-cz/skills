<!--
Text that bootstrap writes into the project's `CONTEXT.md`. The file itself comes from the
`common` layer of `eSoul-cz/template-<variant>` (references/root-files.md) with the guideline
headings and `TBD`; replace each `TBD` section with the block below, keep the template's
`## Getting started` and `## Commit convention`, and add `## Freelo` after `## Tracker`. Delete this comment, the
alternatives that do not apply and every placeholder before committing.
-->

## Project profile

<!-- Stack: laravel | astro | lsr | lunar | other:<name>. Archetype (astro only): A-static |
     B-admin | C-headless, otherwise `—`. Product type: application | eshop | website-admin |
     website. Original site: URL of the site being replaced, or `—`. Process tier: full | light.
     Ruleset bypass: none | owner (the shared account keeps a bypass, asked in bootstrap step 12).
     Design: .pen path, Figma URL, or `—`. -->
- Stack: `{{STACK}}`
- Archetype: `{{ARCHETYPE}}`
- Product type: `{{PRODUCT_TYPE}}`
- Original site: {{ORIGINAL_SITE}}
- Process tier: `{{PROCESS_TIER}}`
- Stack profile: `{{STACK_PROFILE}}`
- Environments: staging {{STAGING_URL}}, production {{PRODUCTION_URL}}
- Ruleset bypass: `{{RULESET_BYPASS}}`
- UAT dimensions: Role, Předpoklad{{UAT_EXTRA_DIMENSIONS}}
- Design: {{DESIGN_SOURCE}}

## Tracker

Work is tracked as GitHub issues in `{{GITHUB_REPO}}`, each paired with a Freelo task in the
project named in `## Freelo` below, which also holds the cache of tasklist IDs and label UUIDs.
Open questions are issues labelled `question`. The tasking rules are in `## Tasking convention`.

## Freelo

- Projekt: {{FREELO_PROJECT_NAME}}
- Project ID: {{FREELO_PROJECT_ID}}
- URL: https://app.freelo.io/project/{{FREELO_PROJECT_ID}}
- Tasklisty: {{FREELO_TASKLISTS}}

Task labels: the category labels the project uses, with their UUIDs. Add any other label here the
first time a task needs it, so later runs need not look it up (`esoul-task-create` › project
mapping). Never create labels.

## Tasking convention

Use the `esoul-task-create` skill for task authoring.

- Mode: `{{TASKING_MODE}}`
- Title language: `{{TITLE_LANGUAGE}}`

<!-- github-freelo mode; in freelo-only mode drop the GitHub lines. -->
Project specifics (titles, estimates, `## UAT`, dependencies and Freelo states follow
`docs/project_guidelines/workflow.md` › Tasking and the skills `esoul-task-create` and
`esoul-task-work`):

- GitHub repository: `{{GITHUB_REPO}}`. The issue holds the full specification and the UAT; the
  Freelo task holds the management summary, the estimate and the time reports. A slice of
  category `pm` is a Freelo task only.
- The slice ID goes into the issue header line
  (`**Slice:** F1-17 · **Fáze:** F1 (brána G1) · **Rozsah:** S`) and into the first line of the
  Freelo description, never into the title. Every issue sits in the GitHub milestone of its phase.
- Every issue carries exactly one category label from the repository's label set
  (`gh label list`), plus `integration` or `bug` where they apply; open questions carry
  `question`. Freelo labels are added by UUID, never created: {{FREELO_LABELS}}
- Every user-facing UAT scenario states the dimensions from *Project profile* with concrete
  values. Technical work states `**Role:** vývojář eSoul` or „Bez uživatelsky viditelného dopadu“
  with a technical check.
- Work depending on a `proposed` ADR or an open `question` issue says so explicitly and links it.
<!-- Only when the owner has decided it (esoul-task-create › references/convention.md › Standing
     decisions); never write it unasked. Otherwise omit the line: agents ask each time. -->
- Small admin work without an issue: allowed for {{SMALL_ADMIN_KINDS}} (for example dependency updates, Jenkinsfile changes).

## Commit convention

<!-- Keep the template's block and add this line after it: -->
Context comes from this list: {{COMMIT_SCOPES}}; `deps` is reserved for Renovate.

## Business time zone

{{BUSINESS_TIME_ZONE}}

## Locales

User-facing text: {{UI_LANGUAGES}}. The default locale is {{DEFAULT_LOCALE}}.

## Language per place

The language matrix is in the guidelines (`workflow.md`, Repository rules). Project specifics:

- English: code, identifiers, code comments, commit messages, branch names, `AGENTS.md`, ADRs,
  the light-tier decision register `docs/rozhodnuti.md`, `docs/project_guidelines/`, issue and PR
  templates (form text) and other developer documentation.
- Czech: issue and Freelo text (issues MAY be English), `docs/podklady/`, `docs/plan/`
  (`docs/plan.md` in the light tier), `docs/legacy/`, design briefs and the light-tier
  documents the client reads (`sitemap-a-meta.md`, `obsah-*.md`, `design-log.md`). Pull request
  descriptions: {{PR_LANGUAGE}}.
- Czech tokens inside the English issue forms are the format `esoul-task-create` and the plan
  expect: the header line `**Slice:** · **Fáze:** · **Rozsah:**` and `mimo plán`; the UAT fields
  `Role`, `Předpoklad` and the dimensions, `vývojář eSoul`, „Bez uživatelsky viditelného
  dopadu“; the sections of a `question` issue (Otázka, Proč na tom záleží, Možnosti,
  Doporučení, Blokuje, Co platí do odpovědi).
- `GLOSSARY.md`: English canonical term with the Czech term next to it.

## Sources of truth

Read and apply sources in this order (guidelines `domain.md`, Reading order and authority).
Keep the list of the project's tier:

<!-- full tier -->
1. [GLOSSARY.md](GLOSSARY.md) — the domain language.
2. `accepted` ADRs in [docs/adr/](docs/adr/index.md) — the target contracts; the index is the
   status source of truth.
3. [AGENTS.md](AGENTS.md) and [docs/project_guidelines/](docs/project_guidelines/index.md) — the
   engineering rules.
4. The design in `docs/design_pencil/`.
5. The plan in [docs/plan/](docs/plan/README.md) and the issue.
6. [docs/podklady/](docs/podklady/README.md) and `docs/legacy/` — evidence of how the client
   works today; they create no requirement on their own.

<!-- light tier -->
1. [GLOSSARY.md](GLOSSARY.md) — the domain language (empty until a domain appears).
2. [docs/rozhodnuti.md](docs/rozhodnuti.md) — the decision register (entries `D-nn`); it ranks
   with ADRs, and this file is the project's decision register.
3. [AGENTS.md](AGENTS.md) and [docs/project_guidelines/](docs/project_guidelines/index.md) — the
   engineering rules.
4. The design in `docs/design_pencil/` and [docs/design-log.md](docs/design-log.md).
5. The plan in [docs/plan.md](docs/plan.md) and the issue or task.
6. [docs/obsah-stary-web.md](docs/obsah-stary-web.md) and the files in `assets/` — evidence;
   they create no requirement on their own.
