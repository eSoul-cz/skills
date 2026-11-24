# Stack profile: Laravel

Laravel application with a CQRS core. The rules live in the guideline layer `framework/laravel`
(`architecture.md`, `cqrs.md`, `requests-and-validation.md`, `frontend.md`, `tools.md`,
`testing.md`, `deployment.md`) plus the package layers the project selects (`package/laravel-inertia`,
`package/inertia-vue`, `package/filament`, `package/mutation-testing`, `package/test-evidence`),
rendered into the project's `docs/project_guidelines/`. This profile holds only what bootstrap,
handover and the pitfalls add. Shops built on Lunar use [lunar.md](lunar.md).

## When this profile applies

- `composer.json` requires `laravel/framework`; usually also `esoul-cz/laravel-cqrs` and
  `inertiajs/inertia-laravel`.
- `artisan`, `phpstan.neon`, `pint.json` at the root; `resources/js` with Vue 3 (Indcom, SCHOK) or
  React 19 (VONO).
- Admin either custom Inertia screens or Filament (Indcom).
- Process tier is almost always `full`. A Laravel/Filament backend that only feeds a static site
  (headless CMS for Astro `C-headless`) may run `light` if it has no domain logic beyond content.

## Bootstrap specifics

On top of the root files and the docs tree ([bootstrap.md](../bootstrap.md)):

1. Start from the published template variant closest to the project (`laravel-inertia`,
   `laravel-inertia-filament`, `laravel-filament`, `laravel-cms`; see
   [root-files.md](../root-files.md) for reading a `template-<variant>` repository). It carries
   the skeleton, the composer and pnpm scripts, Docker, the `Jenkinsfile` on the shared libraries
   and the schema identifier test; do not rebuild them by hand. Versions are the `Versions` table
   of `tools.md`, the one place to change them.
2. `esoul-guidelines init` detects `laravel/framework` and the packages above; confirm the layers
   and add `package/mutation-testing` or `package/test-evidence` when the project uses them
   (skill `esoul-guidelines`). The `post-update-cmd` entry runs `esoul-guidelines sync`
   after `boost:update`.
3. Agent context:
   - **Laravel Boost** (`laravel/boost`): `php artisan boost:install`; the generated
     `<laravel-boost-guidelines>` block in `AGENTS.md` stays untouched (`tools.md › Laravel Boost`).
   - Vendored skills in `.agents/skills/` with `.claude/skills/<name>` committed symlinks, pinned
     in `skills-lock.json`, added only with
     `LC_ALL=en_US.UTF-8 npx skills@1.7.2 add <owner/repo> --skill <name> --agent claude-code codex -y`.
     Typical set: the Boost-managed `laravel-best-practices`, `wayfinder-development`,
     `inertia-vue-development` or `inertia-react-development`, `tailwindcss-development`,
     `testing-best-practices`. The eSoul skills come from `npx @esoul-cz/skills project init`
     (layers `core`, `dev`, `upstream-core`, including `esoul-docs`); add `gitmoji-commit` with
     `npx @esoul-cz/skills install helpers`.
   - MCP: Laravel Boost, Pencil (`.pen` design only through MCP), `codegraph` when the repository
     is indexed.
4. `Jenkinsfile` from the shared libraries with `GIT_LFS_SKIP_SMUDGE = '1'` and
   `SKIP_DEPLOY = 'true'` until a Komodo stack exists. On an empty scaffold, guard PHPStan
   (`if find app -name '*.php' | grep -q .; then ...; fi`) and start the database stage only once
   `database/migrations/*.php` exists (VONO pattern).

## Development handover checklist

Gate B4 is green only when all of these hold on `main`:

- [ ] Jenkins green on the empty scaffold, required check `Jenkins` in the ruleset; the checks
      are those of `tools.md` plus `esoul-guidelines check`.
- [ ] Architecture tests guard layer direction from the first commit
      (`tests/Unit/Architecture/LayerDependencyTest.php`), plus a detection test proving each
      rule fires; both are the named exceptions `testing.md` lists.
- [ ] The schema identifier test (`tests/Feature/Architecture/DatabaseIdentifierLengthTest.php`)
      is present with its detection test. New projects have it from the template; for an existing
      project copy it from `template-laravel-inertia` during a retrofit or audit.
- [ ] Frontend structure checks (`frontend:structure`, `frontend:inertia-page-paths`) with tests,
      where the project has an Inertia frontend.
- [ ] One reference module implemented end to end (command, query, handler, request, page, tests)
      that agents copy; Indcom used `Numbering`.
- [ ] Where the client calculates in workbooks: JSON fixtures in `tests/Fixtures/Workbooks/` and
      parity tests per calculation that `markTestIncomplete` with the slice and issue until the
      implementing agent fills them in (VONO `*ParityTest.php` + `AssertsWorkbookParity`).
- [ ] Anonymized database dump or seeders available; agents never get a real dump by default.
- [ ] Project-specific guideline files written, the Boost block regenerated, `skills-lock.json`
      current.

## Typical ADR topics

- Application architecture, layers and CQRS (`esoul-cz/laravel-cqrs`); where state machines live.
- Database engine and decimal precision; the project's tier-1 flows list (`testing.md`).
- Money representation, currencies, VAT, rounding; exchange rates.
- Admin approach (Filament vs custom Inertia); frontend framework (Vue vs React).
- System of record and integration transport (ERP, idempotence, outbox), queue broker and
  process topology (queue workers, scheduler). Each external integration sits behind a port with
  two adapters, the real driver and a fake driver for tests (`esoul-workflow` ›
  references/design-principles.md).
- Authentication, roles and authorization; legal entity or tenant scope.
- Search, URLs and redirects, SEO head and SSR, page cache. A public part follows
  [ai-readiness.md](../ai-readiness.md) (slices AI-01…AI-06, launch gate).
- Imports and legacy migration (one-off vs repeatable), exports and file formats.
- Calculation parity with source workbooks; audit trail and change history.
- Deployment and runtime (Docker targets, Komodo stack, storage buckets).

## Pitfalls seen in eSoul projects

- Migrations that pass on SQLite and fail on MariaDB/MySQL: generated index or foreign key names
  over 64 characters (guarded by the schema identifier test), a `timestamp()` column without
  `nullable()` or a default under strict mode (error 1067), and `ONLY_FULL_GROUP_BY` rejecting a
  SELECT expression that differs from the GROUP BY one. Three eSoul projects shipped the name
  bug in autumn 2026.
- PHPStan fails with "no files to analyse" on an empty `app/`: guard it instead of disabling it.
- Editing the generated Boost block in `AGENTS.md` by hand; it is overwritten by `boost:update`.
- Wayfinder routes not generated before the frontend build or typecheck in CI
  (`php artisan wayfinder:generate`, `WAYFINDER_TYPES_PREGENERATED=true`).
- LFS-heavy `assets/` and `docs/design_pencil/` cloned by Jenkins: set `GIT_LFS_SKIP_SMUDGE=1` and
  keep `docs/` out of the Docker build context (`.dockerignore`).
- Project-local tasking skills drifting from `CONTEXT.md` (Indcom, SCHOK): replace them with
  `## Tasking convention` in `CONTEXT.md`.
- Issue titles with `[FE]/[BE]/[DATA]` prefixes or slice IDs; category belongs in labels (company
  rule: titles).
- SCHOK grew 40+ ADRs without an index table or `Implementation status`; retrofit adds both
  without renaming existing files.
- Data tasks (`data-migration` label) changing PHP code or the data model directly instead of
  proposing an issue.
