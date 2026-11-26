# Stack profile: Laravel

Laravel application with a CQRS core. The rules live in the guideline layer `framework/laravel`
(`architecture.md`, `cqrs.md`, `requests-and-validation.md`, `frontend.md`, `tools.md`,
`testing.md`, `deployment.md`) plus the package layers the project selects (`package/laravel-inertia`,
`package/inertia-vue` or, on React, `package/laravel-inertia-react`, `package/filament`,
`package/mutation-testing`, `package/test-evidence`),
rendered into the project's `docs/project_guidelines/`. This profile holds only what bootstrap,
handover and the pitfalls add. Shops built on Lunar use [lunar.md](lunar.md).

## When this profile applies

- `composer.json` requires `laravel/framework`; usually also `esoul-cz/laravel-cqrs` and
  `inertiajs/inertia-laravel`.
- `artisan`, `phpstan.neon`, `pint.json` at the root; `resources/js` with the project's Inertia
  frontend (Vue or React).
- Admin either custom Inertia screens or Filament.
- Process tier is almost always `full`. A Laravel/Filament backend that only feeds a static site
  (headless CMS for Astro `C-headless`) may run `light` if it has no domain logic beyond content.

## Bootstrap specifics

On top of the root files and the docs tree ([bootstrap.md](../bootstrap.md)):

1. Start from the published template variant closest to the project (`laravel-inertia`,
   `laravel-inertia-filament`, `laravel-filament`, `laravel-cms`) with `composer create-project
   esoul-cz/template-<variant>:dev-main <dir>` ([bootstrap.md](../bootstrap.md) step 2 and the
   adoption checklist; [root-files.md](../root-files.md) for reading a `template-<variant>`
   repository). It carries
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
     `npx skills add <owner/repo> --skill <name> --agent claude-code codex --yes` (the pinned form is in the README).
     Typical set: the Boost-managed `laravel-best-practices`, `wayfinder-development`,
     `inertia-vue-development` or `inertia-react-development`, `tailwindcss-development`,
     `testing-best-practices`. The eSoul skills come from `npx @esoul-cz/skills project init`
     (layers `core`, `dev`, `upstream-core`, including `esoul-docs`); add `gitmoji-commit` with
     `npx @esoul-cz/skills install helpers`.
   - MCP: Laravel Boost, Pencil (`.pen` design only through MCP), `codegraph` when the repository
     is indexed.
4. The `Jenkinsfile` is already one call of `laravelPipeline` (skill `esoul-jenkins-libraries`):
   set `image` ([bootstrap.md](../bootstrap.md#adopt-the-template)) and add `stack: '<komodo
   stack>'` only once the manifest exists; without `stack` nothing is deployed, and the pipeline
   sets the LFS checkout variable itself. PHPStan on an empty `app/` is in `tools.md` › Known
   pitfalls.
5. Lock files: the template ships none. Run `composer install` and `pnpm install` once and
   commit `composer.lock` and `pnpm-lock.yaml` before the first Docker build, which fails without
   them (the same step as in [lsr.md](lsr.md)).

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
      that agents copy.
- [ ] Where the client calculates in workbooks: JSON fixtures in `tests/Fixtures/Workbooks/` and
      parity tests per calculation that `markTestIncomplete` with the slice and issue until the
      implementing agent fills them in (a `*ParityTest.php` per calculation with a shared assertion trait).
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
- Search, URLs and redirects, SEO head and SSR, page cache. A public part follows the guideline
  `public-website.md` and the AI-readiness slices (skill `esoul-quality-gates`).
- Imports and legacy migration (one-off vs repeatable), exports and file formats.
- Calculation parity with source workbooks; audit trail and change history.
- Deployment and runtime (Docker targets, Komodo stack, storage buckets).

## Pitfalls

The stack pitfalls are guideline rules: `docs/project_guidelines/tools.md` › Known pitfalls
(strict-mode migrations, PHPStan on an empty `app/`, Boost block), `architecture.md` › Migrations,
`deployment.md` (LFS and the Docker build context) and the Inertia `tools.md` (Wayfinder in CI).
Two are about project preparation and stay here:

- Project-local tasking skills drifting from `CONTEXT.md`: replace them with
  `## Tasking convention` in `CONTEXT.md`.
- A project that grew 40+ ADRs without an index table or `Implementation status`: retrofit adds
  both without renaming existing files.
