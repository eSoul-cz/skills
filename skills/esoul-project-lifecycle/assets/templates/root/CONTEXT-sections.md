<!--
Text that bootstrap writes into the project's `CONTEXT.md`. The file itself comes from the
`common` layer of `eSoul-cz/template-<variant>` (references/root-files.md) with the guideline
headings and `TBD`; replace each `TBD` section with the block below, keep the template's
`## Commit convention`, and add `## Freelo` after `## Tracker`. Delete this comment, the
alternatives that do not apply and every placeholder before committing.
-->

## Project profile

<!-- Stack: laravel | astro | lsr | lunar | other:<name>. Archetype (astro only): A-static |
     B-admin | C-headless, otherwise `—`. Product type: application | eshop | website-admin |
     website. Original site: URL of the site being replaced, or `—`. Process tier: full | light.
     Design: .pen path, Figma URL, or `—`. -->
- Stack: `{{STACK}}`
- Archetype: `{{ARCHETYPE}}`
- Product type: `{{PRODUCT_TYPE}}`
- Original site: {{ORIGINAL_SITE}}
- Process tier: `{{PROCESS_TIER}}`
- Stack profile: `{{STACK_PROFILE}}`
- Environments: staging {{STAGING_URL}}, production {{PRODUCTION_URL}}
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

Task labels: the category labels in *Tasking convention* below. Add any other label the project
uses here with its UUID the first time a task needs it, so later runs need not look it up
(`esoul-freelo-task-authoring` › project mapping). Never create labels.

## Tasking convention

Use the `esoul-tasking` skill for task authoring.

- Mode: `{{TASKING_MODE}}`

<!-- github-freelo mode; in freelo-only mode keep only the Freelo list, title, label, estimate
     and relation rules -->
Additional project rules:

- GitHub repository: `{{GITHUB_REPO}}` (private). The issue holds the full specification and the
  UAT; the Freelo task holds the management summary, the estimate and the time reports.
- Default Freelo task list: **Backlog** (IDs in *Freelo* above). The other lists are `To Do`,
  `In progress`, `Code review`, `Testing`, `Done` and `LTT` for recurring work. A task goes to
  `To Do` only with a complete description, an assignee, an approved estimate and no open blocker.
- Task lifecycle: whoever starts the work (agent for the user, or developer) assigns themselves on
  the issue and as Freelo worker and moves the task to `In progress`; the open PR moves it to
  `Code review`, the merge to `Testing` (or `Done` without a testing step). Agents do these
  status moves without a preview. Nobody starts work on a task assigned to someone else; stop
  and ask instead of reassigning.
- These rules override the defaults of `esoul-freelo-task-authoring` where they differ:
  estimates are human time in 15-minute steps (split above 4 h), relations are never replaced by
  temporary comments, and recurring work goes to `LTT`.
- Titles are `Context: Action result`, identical on the issue and the Freelo task, with no
  category prefix and no slice ID; the PR title wraps the same message in the commit format.
  <!-- Keep one. New project: -->
  The title is English; descriptions and Freelo text are Czech.
  <!-- Existing project with Czech history: -->
  Tracker titles stay Czech; the PR title is an English commit-style title of the same result
  that links the issue.
- The slice ID goes into the issue header line
  (`**Slice:** F1-17 · **Fáze:** F1 (brána G1) · **Rozsah:** S`) and into the first line of the
  Freelo description. A slice of category `pm` is a Freelo task only.
- Work categories are labels on both sides. Apply exactly one GitHub category label: `frontend`,
  `backend`, `data-migration`, `infrastructure` or `documentation`; work on an external system
  additionally gets `integration`, a defect additionally gets `bug`. The label `data-migration`
  triggers the data rule in [AGENTS.md](AGENTS.md). Open questions carry the label `question`.
- Freelo labels are added by UUID, never created: {{FREELO_LABELS}}
- Every issue sits in the GitHub milestone of its phase.
- Dependencies are native GitHub issue dependencies (`blocked_by`), the source of truth; the
  Freelo relation mirrors them. No temporary "create the relation manually" comments.
- Every user-facing UAT scenario states the dimensions from *Project profile* with concrete
  values. Technical work states `**Role:** vývojář eSoul` or „Bez uživatelsky viditelného dopadu“
  with a technical check.
- Work depending on a `proposed` ADR or an open `question` issue says so explicitly and links it.
- The Freelo estimate is human time (briefing the agent, checking, review, UAT, fixes) in
  multiples of 15 minutes; propose a split above 4 h. Actual time is the Freelo work reports.

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
  `docs/project_guidelines/`, issue and PR templates and other developer documentation.
- Czech: issue and Freelo text (issues MAY be English), `docs/podklady/`, `docs/plan/`,
  `docs/legacy/`, design briefs. Pull request descriptions: {{PR_LANGUAGE}}.
- `GLOSSARY.md`: English canonical term with the Czech term next to it.

## Sources of truth

Read and apply sources in this order; a higher source wins over a lower one (guidelines
`domain.md`, Reading order and authority). Keep the list of the project's tier:

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

If two sources conflict, report the conflict instead of silently choosing one.
