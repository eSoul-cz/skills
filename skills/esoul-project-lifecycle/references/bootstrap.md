# Bootstrap (P0)

Goal: a repository where agents and people find every rule in the same place and CI is green
before any feature code exists. Indcom and VONO did this in one scaffold commit; follow the
same order. The rules themselves come from the guidelines installer; this skill adds only the
lifecycle documents.

## Steps

1. **Confirm inputs.** Client and project name, GitHub repository, Freelo project, stack,
   archetype, tier, repository kind (client or internal, asked, never assumed), staging and
   production URLs (or `TBD`), original site URL (or `—`), the template variant closest to the
   stack ([root-files.md](root-files.md)). Resolve the Freelo project through
   `esoul-freelo-task-authoring` so its `## Freelo` block is written in its standard form.
2. **Skeleton.** Create the framework skeleton per the stack profile (`references/stacks/`; the
   published `template-<variant>` repositories are the skeletons for the covered stacks).
   Commit it alone (`:tada: [infra] Scaffold`). `README.md` covers operations only (requirements,
   setup, commands, troubleshooting). Astro projects add the sections *Odchylky od návrhu* and
   *Naměřeno* that their guidelines refer to.
3. **Root files.** Follow [root-files.md](root-files.md): the template's common files (only the
   missing ones), the issue templates from `assets/templates/root/.github/ISSUE_TEMPLATE/`, then
   fill `CONTEXT.md` from `assets/templates/root/CONTEXT-sections.md`.
4. **Lifecycle docs.** Copy only the lifecycle documents, into missing files only.
   Full tier: `assets/templates/docs/` → `docs/` (podklady, legacy when a previous system exists,
   adr, plan, agents, data-model). Light tier: `assets/templates/light/docs/` → `docs/` and
   `assets/templates/docs/agents/` → `docs/agents/`. In the light tier drop the UAT field from the
   issue templates (acceptance is on the preview), point the issue template's slice header at
   `docs/plan.md`, and in `docs/agents/issue-tracker.md` replace the GitHub pairing by Freelo
   tasks only when the tasking mode is `freelo-only` (and drop the milestone and slice-table
   rules); `docs/agents/domain.md` names `docs/rozhodnuti.md` instead of ADRs.
5. **Guidelines.** Run the `guidelines` mode ([guidelines.md](guidelines.md)): install the
   command, `init`, review the layers, `sync`. Light projects take the same layers as full ones,
   with no rewriting of links in the rendered files. Then append the project part
   (`assets/templates/root/AGENTS.md`) **below** the managed block of `AGENTS.md`.
6. **Fill placeholders.** Replace every `{{…}}` of the copied assets. Unknown values become
   `TBD` plus a `question` issue, never a guess. Remove optional blocks that do not apply. Skip
   files that do not apply instead of leaving them half-filled: `docs/legacy/` without a
   previous system, `obsah-stary-web.md` without an old website. Per-item templates
   (`_poznamka.md`, `_odpovedi-klienta.md`, `legacy/_template.md`, `adr/0000-template.md`) stay in
   the project as they are; they contain no placeholders.
7. **Profile and conventions.** `CONTEXT.md › Project profile` was written in step 3. Let
   `esoul-tasking` confirm `## Tasking convention` (`github-freelo` for full, either mode for
   light) and `gitmoji-commit` confirm `## Commit convention` with the project's scope list. In
   the light tier `## Sources of truth` names `docs/rozhodnuti.md` as the decision register.
8. **Git LFS and data.** Extend the template's `.gitattributes` for `assets/**`, `*.pen`, design
   images, office files and dumps. Client data goes to `assets/`; a local, never-committed folder
   for non-anonymised legacy evidence follows [podklady-and-legacy.md](podklady-and-legacy.md).
9. **Case-study snapshot.** With an original site, capture "před" and commit it alone, as
   [case-study.md](case-study.md) describes, and run `ai-readiness.mjs` on the original site into
   `assets/case-study/pred/<date>/ai-readiness` (report only). Without one, skip.
   **AI readiness.** For a public website, copy `assets/templates/docs/ai-readiness.md` →
   `docs/ai-readiness.md` (both tiers; the light tier takes this one file from the full tree) and
   keep the AI slices `AI-01`…`AI-06` in the plan (delete `AI-06` unless `eshop`; delete all for a
   project without a public site). The first tasking batch includes them
   ([ai-readiness.md](ai-readiness.md)).
10. **Skills.** Pin stack skills and the eSoul skills the repository needs with
    `npx skills@<pinned> add …`, commit `skills-lock.json` and `.agents/skills/`, symlink
    `.claude/skills/<name>` to them for Claude Code. List them in the project part of `AGENTS.md`.
11. **Quality gates.** `Jenkinsfile` and the local check command from the stack profile and the
    guidelines' `tools.md`, plus `esoul-guidelines check` ([guidelines.md](guidelines.md)). Run
    them on the empty scaffold; they must pass, or be explicitly skipped by a condition that
    switches them on automatically once code exists (VONO skips PHPStan while `app/` has no PHP).
12. **Repository settings** (needs approval, show the exact `gh api` calls first): squash merge
    only, default to PR title, delete branch on merge; ruleset on `main` with required check
    `Jenkins`, one approval, dismiss stale approvals, no bypass for `esoul-cz-user`; labels
    `frontend`, `backend`, `data-migration`, `infrastructure`, `documentation`, `integration`,
    `bug`, `question`, `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
    `wontfix`.
13. **Documentation tooling** (full tier, when client PDFs are expected): hand over to
    `esoul-maintain-application-documentation`.
14. **Verify.** Run `esoul-guidelines check` and
    `node <skill>/scripts/conformance.mjs <repo> --github <owner/repo>`. Fix errors, explain
    remaining warnings in the PR.

Open the bootstrap as one PR, split by intention into commits. Its description lists the
profile, what was skipped and why, and the B0 gate approver.

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
| `{{TASKING_MODE}}` | `github-freelo` or `freelo-only` |
| `{{FREELO_TASKLISTS}}`, `{{FREELO_LABELS}}` | Tasklists with IDs, e.g. Backlog `123` · To Do `124` · …; Freelo category labels with UUIDs mapped to GitHub labels |
| `{{PROJECT_SUMMARY}}` | One to three English paragraphs for the project part of `AGENTS.md` |
| `{{UI_LANGUAGES}}`, `{{DEFAULT_LOCALE}}` | User-facing languages, e.g. `cs (default), en, de`; the default one |
| `{{BUSINESS_TIME_ZONE}}` | IANA zone for dates a person sees, e.g. `Europe/Prague` |
| `{{PR_LANGUAGE}}` | Language of pull request descriptions: Czech or English |
| `{{COMMIT_SCOPES}}` | Allowed commit scopes, each in backticks |
| `{{DATE}}` | ISO date of the change |
| `{{LEGACY_SYSTEM}}`, `{{LEGACY_SNAPSHOT_DATE}}` | Name and snapshot date of the previous system |

Individual templates may define more; search for `{{` after copying and resolve all of them.
