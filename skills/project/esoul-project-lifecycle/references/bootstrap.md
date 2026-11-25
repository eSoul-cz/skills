# Bootstrap (P0)

Goal: a repository where agents and people find every rule in the same place and CI is green
before any feature code exists. Do it in one scaffold commit and follow the order below. The
rules themselves come from the guidelines installer; this skill adds only the lifecycle
documents.

## Steps

1. **Confirm inputs.** Client and project name, GitHub repository, Freelo project, stack,
   archetype, tier, repository kind (client or internal, asked, never assumed), staging and
   production URLs (or `TBD`), original site URL (or `—`), the template variant closest to the
   stack (the chooser table "Choosing a variant" in the
   [app-templates README](https://github.com/eSoul-cz/app-templates#choosing-a-variant): kind of
   project, LSR or Laravel, Astro static, SSR or CMS; [root-files.md](root-files.md)). Resolve the Freelo project through
   `esoul-task-create` so its `## Freelo` block is written in its standard form.
2. **Skeleton.** For a covered stack, create the project from the published template variant
   closest to the stack: `composer create-project esoul-cz/template-<variant>:dev-main <dir>`
   (the variants are published as `dev-main` only, so Composer needs the version; Laravel
   variants also: `laravel new <dir> --using=esoul-cz/template-<variant>`), then `git init`.
   Adopt the template ([checklist below](#adopt-the-template)), then commit it alone, in the
   developer's commit standard (for example `:tada: [infra] Scaffold the project` in the
   recommended Gitmoji format). Other stacks: the skeleton per the stack profile
   (`references/stacks/`). A site with a CMS (`astro-cms`) is three repositories, each created
   from its own template (`template-laravel-cms`, `template-astro-cms-frontend`, and the thin
   root `template-astro-cms`); the root's `bin/add-submodules` then adds the other two as
   submodules ([stacks/astro.md](stacks/astro.md)). Each repository goes through the steps of
   this list; the platform items of the infrastructure checklist (Jenkins job, manifest,
   secrets) are needed once for the backend and once for the frontend, as the root builds and
   deploys nothing. `README.md` covers operations only (requirements, setup, commands,
   troubleshooting).
3. **Root files.** Follow [root-files.md](root-files.md): the template's common files (a
   template-born project has them already: verify, do not copy; otherwise only the missing
   ones), the issue forms from `assets/templates/root/.github/ISSUE_TEMPLATE/`
   (`task`, `bug`, `question`), then fill `CONTEXT.md` from
   `assets/templates/root/CONTEXT-sections.md`.
4. **Lifecycle docs.** Copy only the lifecycle documents, into missing files only.
   Full tier: `assets/templates/docs/` → `docs/` (podklady, legacy when a previous system
   exists, adr, plan, data-model). Light tier: `assets/templates/light/docs/` → `docs/`, plus
   `docs/nasazeni.md` from the skill `esoul-website-launch`. In the light tier drop the UAT field
   from the issue forms (acceptance is on the preview) and point the issue form's slice header at
   `docs/plan.md`.
5. **Guidelines.** Every template variant ships `esoul-guidelines.json`, `esoul-guidelines.lock`,
   `docs/project_guidelines/` and the managed block of `AGENTS.md`, rendered at build time: verify
   them with the skill `esoul-guidelines` (`esoul-guidelines check`, review the layers, `sync
   --dry-run`) and run `init` only for a project that lacks them (then: install the command,
   `init`, review the layers, `sync`; without PHP in the project the command comes from the
   machine, see the skill's "Without PHP in the project"). Light projects take the same layers as
   full ones, with no rewriting of links in the rendered files. Then append the project part
   (`assets/templates/root/AGENTS.md`) **below** the managed block of `AGENTS.md`.
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
    the layers `core`, `dev` and `upstream-core` (and `esoul-jenkins-libraries`, when the project has a `Jenkinsfile` and you can read that private repository) into the project and commits nothing. Commit
    `skills-lock.json` and `.agents/skills/` (the developer commits; propose it in the bootstrap PR),
    and make sure `.claude/skills/<name>` links to them for Claude Code. Add stack skills
    and further layers (for example `npx @esoul-cz/skills install project`) only when the
    repository needs them. List the skills in the project part of `AGENTS.md`.
11. **Quality gates.** `Jenkinsfile` and the local check command from the stack profile and the
    guidelines' `tools.md`, plus `esoul-guidelines check` (skill `esoul-guidelines`). Run
    them on the empty scaffold; they must pass, or be explicitly skipped by a condition that
    switches them on automatically once code exists (for example PHPStan while `app/` has no PHP).
12. **Repository settings** (needs approval, show the exact `gh api` calls first). Squash merge
    is a repository setting, not a guideline rule: allow squash merging only, with the PR title
    as the commit title, and delete the branch on merge
    (`gh api -X PATCH repos/<owner>/<repo> -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY -F delete_branch_on_merge=true`).
    Then the ruleset on `main` (required check `Jenkins`, one approval, dismiss stale approvals,
    no bypass for `esoul-cz-user`; `workflow.md` › Pull requests) and the label set of
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

A new project follows the guidelines closely: a deviation is a recorded exception with the owner's
approval and an ADR, never a silent local rule (skill `esoul-guidelines` › Project exceptions).

## Adopt the template

A project created from a template still carries the template's placeholders and names. Before the
scaffold commit (step 2) go through the list; `conformance.mjs` reports every `replace-with-`
leftover as `template-leftover`.

1. **`Jenkinsfile`:** replace every `replace-with-…` value: `image` (the release image name,
   lowercase letters, digits, `_`, `.`, `-`) and, in `astro-ssr`, `stack`, `SITE_URL` and
   `buildArgs`; in `astro-cms-frontend` the `example-project-*` names, URLs and credential ids.
   Add `stack: '<komodo stack>'` only after the manifest exists (infrastructure items 4 and 5
   below); without it nothing is deployed.
2. **Names:** `OTEL_SERVICE_NAME=replace-with-app-name` in `.env.example` (Laravel variants),
   `APP_NAME`, the README title and its first sentence, and the `composer.json` `name` and
   `description` (the template's `esoul-cz/template-<variant>`; `license` is already
   `proprietary`).
3. **Locks:** the template ships no lock files. Run `pnpm install` and, in a PHP variant,
   `composer install` once and commit `composer.lock` and `pnpm-lock.yaml`; the Docker image
   build fails without them.
4. **Stays as it is:** `.esoul/template.json` (the update flow of `esoul-project-update` reads
   it), `.esoul/template-LICENSE`, the rendered `docs/project_guidelines/` and
   `esoul-guidelines.lock`, and the `## Getting started` section of `CONTEXT.md` and the README.
5. **Check:** `grep -rn 'replace-with-' --exclude-dir=vendor --exclude-dir=node_modules .`
   finds nothing, then `conformance.mjs` (step 14).

## New project infrastructure

The checklist for everything a new project needs outside its own repository. Each item names who
does it; every write outside the repository needs the person's approval after showing the exact
call. Order matters: the repository before the first push, the Jenkins job before the ruleset
(a required check that never reports blocks every merge), the manifest before the `Jenkinsfile`
deploy rule.

**Agent, with approval**

1. **GitHub repository** in `eSoul-cz` (`gh repo create eSoul-cz/<name> --private`; show the
   command first). The first push of the scaffold commit to the empty default branch is the one
   direct push the person approves; everything after goes through PRs.
2. **Freelo project** with its tasklists and labels: from the standard project template
   (Freelo `create_project_from_template`, or the CLI), or `create_project` plus the tasklists of
   `esoul-task-create`. Then `esoul-task-create` writes `## Freelo` in `CONTEXT.md`.
3. **Repository settings** (step 12): squash-only merge and labels now; the ruleset with the
   required `Jenkins` check only after the Jenkins job below reports on a PR.
4. **Manifest PR to `eSoul-cz/esoul-infrastructure`:** `apps/<client>/<name>.yaml` (shape per
   stack: `laravel-fpm`, `lsr-roadrunner`, `static-release`, `static-image` for a CMS frontend's `FROM scratch` image; `domains`, `image`, `mariadb`, `env`,
   `secrets`), `make render`, review `build/`; see `apps/README.md` › "A new app, step by step".
   The agent opens the PR and never runs `make apply`.
5. **Stack name in the `Jenkinsfile`** (the deploy rule of the pipeline call), a project PR after
   the manifest is merged.

**A person must do (the agent lists these in the bootstrap PR and asks)**

6. **Jenkins job** for the repository, unless the organisation folder discovers it by itself:
   check whether the `Jenkins` check reports on the first PR; if not, ask devops to add a
   multibranch job. Pipeline credentials (registry, GitHub, Komodo) are global; a project-specific
   one (for example the export token of a CMS frontend) is added by devops. Runbook:
   `docs/jenkins-new-repository.md` in `eSoul-cz/esoul-infrastructure`.
7. **Secrets:** the values behind the manifest's `secrets` go into the app's item in 1Password
   (a check-mode run of `apps-apply.yml` lists the missing ones); never into the repository, a PR
   or the chat (`security-and-data.md` › Secrets).
8. **DNS and buckets** for every domain of the manifest (pointing at the load balancer), then
   devops runs `make check` and `make apply`, deploys through Jenkins, and applies once more to
   install the site.
9. **Gate B0** approval and the merge of the bootstrap PR.

Done when the repository, the Freelo project, the Jenkins check and the manifest exist, and the
PR names each item a person still owes.

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
| `{{SMALL_ADMIN_KINDS}}` | Only when the owner decided it: the kinds of small administrative work that need no issue (the whole bullet is dropped otherwise) |
| `{{DATE}}` | ISO date of the change |
| `{{LEGACY_SYSTEM}}`, `{{LEGACY_SNAPSHOT_DATE}}` | Name and snapshot date of the previous system |

Individual templates may define more; search for `{{` after copying and resolve all of them.
