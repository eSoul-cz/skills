# Bootstrap (P0)

Goal: a repository where agents and people find every rule in the same place and CI is green
before any feature code exists. Do it in one scaffold commit and follow the order below. The
rules themselves come from the guidelines installer; this skill adds only the lifecycle
documents.

## Steps

1. **Confirm inputs.** Client and project name, GitHub repository, Freelo project, stack,
   archetype, tier, repository kind (client or internal, asked, never assumed), staging and
   production URLs (or `TBD`), original site URL (or `—`), the template variant closest to the
   stack ([root-files.md](root-files.md)). Resolve the Freelo project through
   `esoul-task-create` so its `## Freelo` block is written in its standard form.
2. **Skeleton.** Create the framework skeleton per the stack profile (`references/stacks/`; the
   published `template-<variant>` repositories are the skeletons for the covered stacks).
   Commit it alone, in the project's commit format (for example `:tada: [infra] Scaffold the
   project` in the recommended Gitmoji format). `README.md` covers operations only
   (requirements, setup, commands, troubleshooting).
3. **Root files.** Follow [root-files.md](root-files.md): the template's common files (only the
   missing ones), the issue forms from `assets/templates/root/.github/ISSUE_TEMPLATE/`
   (`task`, `bug`, `question`), then fill `CONTEXT.md` from
   `assets/templates/root/CONTEXT-sections.md`.
4. **Lifecycle docs.** Copy only the lifecycle documents, into missing files only.
   Full tier: `assets/templates/docs/` → `docs/` (podklady, legacy when a previous system
   exists, adr, plan, data-model). Light tier: `assets/templates/light/docs/` → `docs/`, plus
   `docs/nasazeni.md` from the skill `esoul-website-launch`. In the light tier drop the UAT field
   from the issue forms (acceptance is on the preview) and point the issue form's slice header at
   `docs/plan.md`.
5. **Guidelines.** Run the skill `esoul-guidelines`: install the command, `init`, review the
   layers, `sync`. Light projects take the same layers as full ones, with no rewriting of links
   in the rendered files. Then append the project part (`assets/templates/root/AGENTS.md`)
   **below** the managed block of `AGENTS.md`.
6. **Fill placeholders.** Replace every `{{…}}` of the copied assets. Unknown values become
   `TBD` plus a `question` issue, never a guess. Remove optional blocks that do not apply. Skip
   files that do not apply instead of leaving them half-filled: `docs/legacy/` without a
   previous system, `obsah-stary-web.md` without an old website. Per-item templates
   (`_poznamka.md`, `_odpovedi-klienta.md`, `legacy/_template.md`, `adr/0000-template.md`) stay in
   the project as they are; they contain no placeholders.
7. **Profile and conventions.** `CONTEXT.md › Project profile` was written in step 3. Let
   `esoul-task-create` confirm `## Tasking convention` (`github-freelo` for full, either mode for
   light) and, when installed, `gitmoji-commit` confirm `## Commit convention` with the
   project's scope list. In the light tier `## Sources of truth` names `docs/rozhodnuti.md` as the
   decision register.
8. **Git LFS and data.** Extend the template's `.gitattributes` for `assets/**`, `*.pen`, design
   images, office files and dumps. Client data goes to `assets/`; a local, never-committed folder
   for non-anonymised legacy evidence follows [podklady-and-legacy.md](podklady-and-legacy.md).
9. **Public website.** With an original site, capture the "před" snapshot and commit it alone
   (skill `esoul-website-launch`, case study), and take the baseline AI-readiness report of the
   original site (skill `esoul-quality-gates`). For a public website copy the project's
   `docs/ai-readiness.md` from `esoul-quality-gates` (both tiers) and keep the AI slices
   `AI-01`…`AI-06` in the plan (delete `AI-06` unless `eshop`; delete all for a project without
   a public site); the first tasking batch includes them. Without an original site or a public
   website, skip.
10. **Skills.** Set up the project's skills with `npx @esoul-cz/skills project init`: it installs
    the layers `core`, `dev` and `upstream-core` into the project and commits nothing. Commit
    `skills-lock.json` and `.agents/skills/` (the developer commits; propose it in the bootstrap PR),
    and make sure `.claude/skills/<name>` links to them for Claude Code. Add stack skills
    and further layers (for example `npx @esoul-cz/skills install project`) only when the
    repository needs them. List the skills in the project part of `AGENTS.md`.
11. **Quality gates.** `Jenkinsfile` and the local check command from the stack profile and the
    guidelines' `tools.md`, plus `esoul-guidelines check` (skill `esoul-guidelines`). Run
    them on the empty scaffold; they must pass, or be explicitly skipped by a condition that
    switches them on automatically once code exists (for example PHPStan while `app/` has no PHP).
12. **Repository settings** (needs approval, show the exact `gh api` calls first): the merge and
    ruleset settings of the guideline `workflow.md` › Pull requests (squash merge only, default
    to PR title, delete branch on merge; ruleset on `main` with required check `Jenkins`, one
    approval, dismiss stale approvals, no bypass for `esoul-cz-user`), and the label set of
    [labels.md](labels.md).
13. **Documentation tooling** (full tier, when client PDFs are expected): hand over to
    `esoul-docs` (its PDF section).
14. **Verify.** Run `esoul-guidelines check` and
    `node <skill>/scripts/conformance.mjs <repo> --github <owner/repo>`. Fix errors, explain
    remaining warnings in the PR.

Done when the verify step shows no error, `Jenkins` is green on the empty scaffold, and the
tier's lifecycle files, the issue forms and the label set exist.

Deliver the bootstrap as the project's workflow guideline says (a PR in client repositories),
split by intention into commits. The description lists the profile, what was skipped and why,
and the B0 gate approver.

## Placeholders

Templates use `{{UPPER_SNAKE_CASE}}`. Common ones:

| Placeholder | Meaning |
|---|---|
| `{{PROJECT_NAME}}`, `{{CLIENT_NAME}}` | Human project name used in docs headings; client's legal or trading name |
| `{{GITHUB_REPO}}` | `owner/name` |
| `{{FREELO_PROJECT_NAME}}`, `{{FREELO_PROJECT_ID}}` | Freelo project |
| `{{STACK}}`, `{{ARCHETYPE}}`, `{{PRODUCT_TYPE}}`, `{{PROCESS_TIER}}`, `{{STACK_PROFILE}}` | Project profile |
| `{{STAGING_URL}}`, `{{PRODUCTION_URL}}` | Environments, `TBD` until known |
| `{{ORIGINAL_SITE}}`, `{{OLD_SITE_URL}}` | URL of the site being replaced, or `—` |
| `{{DESIGN_SOURCE}}`, `{{DESIGN_PEN_PATH}}` | Design source (`.pen` path, Figma URL or `—`); path to the `.pen` file |
| `{{UAT_EXTRA_DIMENSIONS}}` | Extra UAT context fields, comma-led |
| `{{UAT_DIMENSION_LINES}}` | UAT dimensions as `**Dimenze:**` lines inside the issue forms (8-space indent); delete when none |
| `{{TASKING_MODE}}`, `{{TITLE_LANGUAGE}}` | `github-freelo` or `freelo-only`; `english` for a new project, `czech` for an existing Czech one |
| `{{FREELO_TASKLISTS}}`, `{{FREELO_LABELS}}` | Tasklists with IDs, e.g. Backlog `123` · To Do `124` · …; Freelo category labels with UUIDs mapped to GitHub labels |
| `{{PROJECT_SUMMARY}}` | One to three English paragraphs for the project part of `AGENTS.md` |
| `{{UI_LANGUAGES}}`, `{{DEFAULT_LOCALE}}` | User-facing languages, e.g. `cs (default), en, de`; the default one |
| `{{BUSINESS_TIME_ZONE}}` | IANA zone for dates a person sees, e.g. `Europe/Prague` |
| `{{PR_LANGUAGE}}` | Language of pull request descriptions: Czech or English |
| `{{COMMIT_SCOPES}}` | Allowed commit scopes, each in backticks |
| `{{DATE}}` | ISO date of the change |
| `{{LEGACY_SYSTEM}}`, `{{LEGACY_SNAPSHOT_DATE}}` | Name and snapshot date of the previous system |

Individual templates may define more; search for `{{` after copying and resolve all of them.
