# Bootstrap (P0)

Goal: a repository where agents and people find every rule in the same place and CI is green
before any feature code exists. Indcom and VONO did this in one scaffold commit; follow the
same order.

## Steps

1. **Confirm inputs.** Client and project name, GitHub repository, Freelo project, stack,
   archetype, tier, lead owners for `CODEOWNERS`, staging and production URLs (or `TBD`).
   Resolve the Freelo project through `esoul-freelo-task-authoring` so its `## Freelo` block is
   written in its standard form.
2. **Skeleton.** Create the framework skeleton per the stack profile. Commit it alone
   (`:tada: [infra] scaffold`). `README.md` covers operations only (requirements, setup,
   commands, troubleshooting) and links `AGENTS.md` and `CONTRIBUTING.md`. Astro projects add
   the sections *Odchylky od návrhu* and *Naměřeno* that their guidelines refer to.
3. **Root rules.** Copy missing files from `assets/templates/root/`:
   `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `GLOSSARY.md` (full tier), `CONTRIBUTING.md`,
   `CODEOWNERS`, `.coderabbit.yaml`, `.github/ISSUE_TEMPLATE/{task,bug,config}.yml`,
   `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml`.
4. **Docs tree.** Full tier: `assets/templates/docs/` → `docs/` (podklady, legacy when a
   previous system exists, adr, plan, agents, project_guidelines common + stack, data-model).
   Light tier: `assets/templates/light/docs/` → `docs/`, `assets/templates/docs/agents/` →
   `docs/agents/`, `assets/templates/light/.github/PULL_REQUEST_TEMPLATE.md` instead of the
   full one, plus the guideline files.
   Guidelines are flat: copy `common/*` and the stack's files side by side into
   `docs/project_guidelines/`, then delete the `index.md` entries and optional blocks for other
   stacks.
   In the light tier, adapt the root files' and guidelines' links: `docs/adr/` →
   `docs/rozhodnuti.md`, `docs/plan/README.md` → `docs/plan.md`, `docs/podklady/` →
   `docs/obsah-*.md` and `assets/`; drop `GLOSSARY.md` links until a domain appears, and drop
   the UAT field from the issue templates (acceptance is on the preview). Also rewrite the
   full-tier sentences that do not apply: in `AGENTS.md` and the Definition of Done in
   `CONTRIBUTING.md`, „Run the issue's UAT scenario“ becomes „accepted on the preview“; in
   `CONTRIBUTING.md` „Každá práce je pár“ follows the recorded tasking mode (`freelo-only` allows
   tasks without issues); references to `docs/plan/seznam-slices.md` point to `docs/plan.md`;
   in `code-review.md` the reviewer reads the task's acceptance instead of `## UAT`. In
   `docs/agents/issue-tracker.md`, `freelo-only` projects replace the GitHub pairing with Freelo
   tasks only and drop the milestone and slice-table rules; `docs/agents/domain.md` points to
   `docs/rozhodnuti.md` instead of ADRs and drops `GLOSSARY.md` until it exists. The conformance
   script's `broken-link` warning lists every link still to adapt.
5. **Fill placeholders.** Replace every `{{…}}`. Unknown values become `TBD` plus a question in
   the register, never a guess. Remove optional blocks that do not apply. Skip files that do
   not apply instead of leaving them half-filled: `docs/legacy/` without a previous system,
   `obsah-stary-web.md` without an old website. Per-item templates (`_poznamka.md`,
   `_odpovedi-klienta.md`, `legacy/_template.md`, `adr/0000-template.md`) stay in the project
   as they are; they contain no placeholders.
6. **Profile and conventions.** Fill `CONTEXT.md › Project profile`. Let `esoul-tasking` record
   `## Tasking convention` (`github-freelo` for full, either mode for light) and let
   `gitmoji-commit` confirm `## Commit convention` with the project's scope list.
7. **Git LFS and data.** `.gitattributes` for `assets/**`, `*.pen`, design images, office files
   and dumps. Client data goes to `assets/`, never to ignored folders.
8. **Skills.** Pin stack skills and the eSoul skills the repository needs with
   `npx skills@<pinned> add …`, commit `skills-lock.json` and `.agents/skills/`, symlink
   `.claude/skills/<name>` to them for Claude Code. List them in `AGENTS.md › Agent skills`.
9. **Quality gates.** Jenkinsfile and local check command from the stack profile. Run them on
   the empty scaffold; they must pass, or be explicitly skipped by a condition that switches
   them on automatically once code exists (VONO skips PHPStan while `app/` has no PHP).
10. **Repository settings** (needs approval, show the exact `gh api` calls first): squash merge
    only, default to PR title, delete branch on merge; ruleset on `main` with required check
    `Jenkins`, one approval, dismiss stale approvals, no bypass for `esoul-cz-user`; labels
    `frontend`, `backend`, `data-migration`, `infrastructure`, `documentation`, `integration`,
    `bug`, `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.
11. **Documentation tooling** (full tier, when client PDFs are expected): hand over to
    `esoul-maintain-application-documentation`.
12. **Verify.** Run `node <skill>/scripts/conformance.mjs <repo> --github <owner/repo>`. Fix
    errors, explain remaining warnings in the PR.

Open the bootstrap as one PR, split by intention into commits. Its description lists the
profile, what was skipped and why, and the B0 gate approver.

## Placeholders

Templates use `{{UPPER_SNAKE_CASE}}`. Common ones:

| Placeholder | Meaning |
|---|---|
| `{{PROJECT_NAME}}` | Human project name used in docs headings |
| `{{CLIENT_NAME}}` | Client's legal or trading name |
| `{{GITHUB_REPO}}` | `owner/name` |
| `{{FREELO_PROJECT_NAME}}`, `{{FREELO_PROJECT_ID}}` | Freelo project |
| `{{STACK}}`, `{{ARCHETYPE}}`, `{{PROCESS_TIER}}`, `{{STACK_PROFILE}}` | Project profile |
| `{{STAGING_URL}}`, `{{PRODUCTION_URL}}` | Environments, `TBD` until known |
| `{{UAT_EXTRA_DIMENSIONS}}` | Extra UAT context fields, comma-led |
| `{{TASKING_MODE}}` | `github-freelo` or `freelo-only` |
| `{{FREELO_TASKLISTS}}`, `{{FREELO_LABELS}}` | Tasklists with IDs, e.g. Backlog `123` · To Do `124` · …; Freelo category labels with UUIDs mapped to GitHub labels |
| `{{PROJECT_SUMMARY}}` | One to three English paragraphs for `AGENTS.md › What this project is` |
| `{{UI_LANGUAGES}}` | User-facing languages, e.g. `Czech` or `cs (default), en, de` |
| `{{COMMIT_SCOPES}}` | Allowed commit scopes, each in backticks |
| `{{UAT_DIMENSION_LINES}}` | UAT dimensions as `**Dimenze:**` lines inside the issue forms (8-space indent); delete when none |
| `{{CHECK_COMMAND}}`, `{{MUTATION_COMMAND}}` | Local all-checks and mutation commands from the stack profile |
| `{{STACK_AGENT_RULES}}`, `{{STACK_GENERATED_BLOCK}}` | Stack bullets for `AGENTS.md`; generated block (e.g. Laravel Boost) or empty |
| `{{DOD_STACK_ITEMS}}` | Extra Definition of Done lines from the stack profile, or delete the line |
| `{{DESIGN_PEN_PATH}}` | Path to the `.pen` file |
| `{{LEAD_OWNERS}}` | GitHub handles for contract files |
| `{{DEPENDABOT_ECOSYSTEM}}`, `{{FRAMEWORK_PACKAGE}}` | Dependabot ecosystem (repeat per ecosystem); framework whose majors are ignored |
| `{{DATE}}` | ISO date of the change |

Individual templates may define more; search for `{{` after copying and resolve all of them.
