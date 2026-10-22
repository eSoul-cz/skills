# {{PROJECT_NAME}} — project context

This file holds the project conventions. The domain language lives in [GLOSSARY.md](GLOSSARY.md).

## Project profile

<!-- Stack: laravel | medusa-nuxt | astro | other:<name>. Archetype (astro only): A-static |
     B-admin | C-headless, otherwise `—`. Product type: application | eshop | website-admin |
     website. Process tier: full | light. Design: .pen path, Figma URL, or `—`. -->
- Stack: `{{STACK}}`
- Archetype: `{{ARCHETYPE}}`
- Product type: `{{PRODUCT_TYPE}}`
- Process tier: `{{PROCESS_TIER}}`
- Stack profile: `{{STACK_PROFILE}}`
- Environments: staging {{STAGING_URL}}, production {{PRODUCTION_URL}}
- UAT dimensions: Role, Předpoklad{{UAT_EXTRA_DIMENSIONS}}
- Design: {{DESIGN_SOURCE}}

## Freelo

- Projekt: {{FREELO_PROJECT_NAME}}
- Project ID: {{FREELO_PROJECT_ID}}
- URL: https://app.freelo.io/project/{{FREELO_PROJECT_ID}}

## Tasking convention

Use the `esoul-tasking` skill for task authoring.

- Mode: `{{TASKING_MODE}}`

<!-- optional: github-freelo mode; in freelo-only mode keep only the Freelo list, title, label,
     estimate and relation rules -->
Additional project rules:

- GitHub repository: `{{GITHUB_REPO}}` (private). The issue holds the full specification and the
  UAT; the Freelo task holds the management summary, the estimate and the time reports.
- Default Freelo task list: **Backlog**, ID `{{FREELO_BACKLOG_ID}}`. The other lists are `To Do`,
  `In progress`, `Code review`, `Testing`, `Done` and `LTT` for recurring work. A task goes to
  `To Do` only with a complete description, an assignee, an approved estimate and no open blocker.
- These rules override the defaults of `esoul-freelo-task-authoring` where they differ:
  estimates are human time in 15-minute steps (split above 4 h), relations are never replaced by
  temporary comments, and recurring work goes to `LTT`.
- Titles follow `Kontext: Akční výsledek` in Czech and are identical on the issue, the Freelo task
  and the pull request. No category prefix and no slice ID in the title.
- The slice ID goes into the issue header line
  (`**Slice:** F1-17 · **Fáze:** F1 (brána G1) · **Rozsah:** S`) and into the first line of the
  Freelo description. A slice of category `pm` is a Freelo task only.
- Work categories are labels on both sides. Apply exactly one GitHub category label: `frontend`,
  `backend`, `data-migration`, `infrastructure` or `documentation`; work on an external system
  additionally gets `integration`, a defect additionally gets `bug`. The label `data-migration`
  triggers the data rule in [AGENTS.md](AGENTS.md).
- Freelo labels are added by UUID, never created: {{FREELO_LABELS}}
- Every issue sits in the GitHub milestone of its phase.
- Dependencies are native GitHub issue dependencies (`blocked_by`), the source of truth; the
  Freelo relation mirrors them. No temporary "create the relation manually" comments.
- Every user-facing UAT scenario states the dimensions from *Project profile* with concrete
  values. Technical work states `**Role:** vývojář eSoul` or „Bez uživatelsky viditelného dopadu“
  with a technical check.
- Work depending on a `proposed` ADR or an open question says so explicitly and links it.
- The Freelo estimate is human time (briefing the agent, checking, review, UAT, fixes) in
  multiples of 15 minutes; propose a split above 4 h. Actual time is the Freelo work reports.

## Commit convention

Use the `gitmoji-commit` skill for normal agent-authored commits.

```text
:emoji: [optional-context] imperative message

optional explanatory details
```

Use one Gitmoji shortcode per commit and split commits by intention. Context is optional and
comes from this list: {{COMMIT_SCOPES}}; `deps` is reserved for Dependabot. Keep the complete
subject line at 72 characters or fewer when practical.

## Languages

- English: code, identifiers, code comments, commit messages, branch names, `AGENTS.md`,
  ADRs, `docs/project_guidelines/` and other developer documentation.
- Czech: issues, pull request descriptions, Freelo tasks, `docs/podklady/`, `docs/plan/`,
  `docs/legacy/`, design briefs and comments in team-read configuration (`.github/*`,
  `.coderabbit.yaml`, `Jenkinsfile`).
- `GLOSSARY.md`: English canonical term with the Czech term next to it.
- User-facing text: {{UI_LANGUAGES}}.

## Sources of truth

Read and apply sources in this order; a higher source wins over a lower one:

1. [GLOSSARY.md](GLOSSARY.md) — the domain language.
2. `accepted` ADRs in [docs/adr/](docs/adr/index.md) — the target contracts; the index is the
   status source of truth.
3. [AGENTS.md](AGENTS.md) and [docs/project_guidelines/](docs/project_guidelines/index.md) — the
   engineering rules.
4. The design in `docs/design_pencil/`.
5. The plan in [docs/plan/](docs/plan/README.md) and the issue.
6. [docs/podklady/](docs/podklady/README.md) and `docs/legacy/` — evidence of how the client
   works today; they create no requirement on their own.

If two sources conflict, report the conflict instead of silently choosing one.
