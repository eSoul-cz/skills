# Project guidelines - Tools

| Area | Tool | Version / source |
|---|---|---|
| Runtime | PHP | {{PHP_VERSION}} |
| Framework | Laravel | {{LARAVEL_VERSION}} (exact version in `composer.lock`) |
| Commands and queries | `esoul-cz/laravel-cqrs` | see [cqrs.md](cqrs.md) |
| User interface | Inertia, {{FRONTEND_FRAMEWORK}}, TypeScript, Tailwind CSS 4, shadcn, Wayfinder | see [frontend.md](frontend.md) |
| Database | {{DATABASE}} (Docker, production), {{TEST_DATABASE}} (tests) | {{DATABASE_ADR}} |
| PHP quality | Pint, Larastan (PHPStan level 10 with `bleedingEdge`), PHPUnit with Paratest, Infection | `pint.json`, `phpstan.neon`, `phpunit.xml`, `infection.json5` |
| Frontend quality | ESLint, Prettier, TypeScript, Vitest, structure scripts | `eslint.config.js`, `.prettierrc`, `tsconfig*.json`, `vitest.config.ts`, `scripts/` |
| Node package manager | pnpm | pinned in `package.json` `packageManager` |
| Runtime and delivery | Docker, Jenkins, Komodo | see [deployment.md](deployment.md) |
| Agent tooling | Laravel Boost (guidelines, skills, MCP), skills in `.agents/skills` | `AGENTS.md`, `.ai/guidelines/`, `skills-lock.json` |

`composer.json`, `package.json` and their lockfiles are authoritative for installed versions.
Use documentation that matches the installed majors (Laravel, PHPUnit, Inertia, Tailwind), even
when a skill links to a newer one; check the installed source before concluding that a feature
does not exist. Adding or upgrading a dependency needs the maintainer's approval.

## Where tools run

The application runs only in the Docker stack ([deployment.md](deployment.md)). Application
commands (migrations, seeders, generators, Tinker) run in the container:

```bash
docker compose exec laravel php artisan <command>
```

Lint, static analysis and formatting MAY run on the host (PHP, Composer, Node and pnpm
installed) or in the container.

<!-- optional: tests on the production database engine (keep exactly one of the two blocks) -->
**PHP tests run in the `laravel` container**: they need {{TEST_DATABASE}}, which resolves only on
the Compose network (`.env.testing`). The unit suite needs no database and also runs on the host.
Coverage and mutation testing need the container's coverage driver.

<!-- optional: tests on in-memory SQLite -->
PHP tests run on the host or in the container on SQLite `:memory:` (`phpunit.xml`) and never need
the database service.

## Read-only verification

Run these before pushing. They never rewrite tracked files, and CI runs the same ones.

### PHP

```bash
composer stan   # PHPStan level 10 with bleedingEdge over app/ and tests/
composer cs     # pint --test
composer test   # PHPUnit in parallel (Paratest), Xdebug off
```

### Frontend

```bash
pnpm eslint
pnpm format:check
pnpm tsc
pnpm test
pnpm build
pnpm frontend:check   # all of the above plus the structure and page-path checks, with a summary
```

### Before a pull request

```bash
composer mutation     # Infection on the app/ lines changed against main (local soft gate)
```

## Static analysis

- PHPStan runs at **level 10** with `bleedingEdge` and Larastan; `phpstan/phpstan-phpunit` covers
  the tests. The baseline stays empty: a new error is fixed, not baselined.
- An ignore is the narrowest possible (one identifier, one path) with a comment explaining why.
- When the tree has no PHP yet, CI MAY skip PHPStan by a condition that switches it on
  automatically once code exists.

## Formatting and autofixes

```bash
vendor/bin/pint --dirty --format agent   # PHP files changed in the working tree
composer pint                            # the whole PHP tree
pnpm eslint:fix
pnpm format:fix
```

- `pint.json` is the PHP formatting contract: the Laravel preset plus the project rules declared
  there, including `declare(strict_types=1)`.
- Mutating commands are explicit developer actions. Run them deliberately, review the diff, then
  rerun the read-only checks. CI uses only the read-only commands.

## Mutation testing

Infection mutates `app/` and reruns the tests that cover each mutated line
([testing.md](testing.md#mutation-testing)). It runs locally only, never in CI, and never fails
on a score.

```bash
composer mutation                                    # app/ lines changed against local main
composer mutation -- --git-diff-base=<parent-branch> # stacked branch
composer mutation:full -- --filter=app/Path/File.php # every mutant in one file
```

- The commands collect coverage first (`composer mutation:coverage`, needs a coverage driver),
  then run mutants without Xdebug, executing only the covering tests. Keep local `main` current.
- When a change touches tests only, run `mutation:full` with `--filter` on the files those tests
  exercise.
- Reports are in `build/infection/` (`infection.log` lists each escaped mutant with its diff and
  covering tests). Covered Code MSI is a trend indicator, not a target.
- `infection.json5` skips mutants that can only change error wording (custom `messages()`,
  exception message constructors), each by the narrowest rule with a comment. Every other mutator
  stays enabled.

## Tool caches

PHPStan, PHPUnit, Pint, ESLint, Prettier and Vitest keep their caches in the gitignored `tmp/`
directory, which Jenkins persists between builds. Delete `tmp/` if a cached result looks stale.

## Code generators

- Commands, queries and handlers: `make:cqrs-command`, `make:cqrs-query`, always with `--handler`
  and `--return` ([cqrs.md](cqrs.md#creating-commands-and-queries)).
- Everything else Laravel generates (`make:model`, `make:migration`, `make:policy`,
  `make:request`, `make:test`) is moved into its layer and module before committing
  ([architecture.md](architecture.md)).
- Wayfinder route and action modules are generated by the Vite plugin during `pnpm dev` and
  `pnpm build`; run `php artisan wayfinder:generate --with-form` when the plugin is unavailable.
  Generated files are never edited.

## Laravel Boost

- The Boost block in `AGENTS.md` (between `<laravel-boost-guidelines>` tags) is **generated** from
  `.ai/guidelines/` and the installed packages. Never edit it by hand.
- Skills live in `.agents/skills/` and are committed; `.claude/skills/<name>` links to them.
- `boost.json` and `.mcp.json` are gitignored: every developer runs
  `php artisan boost:install` once after cloning. `php artisan boost:update` refreshes the
  guidelines and skills; commit the result only when updating them was the point of the work.
- Boost registers its commands only with `APP_ENV=local` or `APP_DEBUG=true`, so a fresh checkout
  needs its `.env` first. Its database tools need the database reachable, so the MCP server runs
  in the container (`docker compose exec -T laravel php artisan boost:mcp`).

## PHP conventions

- When chaining from a newly instantiated class, write `new Foo()->bar()`.
- Long-running queue workers do not clear `once()` between jobs; keep job-dependent memoization
  on job-local objects.

<!-- optional: application documentation rendered to PDF -->
## Documentation checks

```bash
docs/documentation validate
docs/documentation build
```

The build requires Docker; PDFs are written to the gitignored `docs/pdf/`
([documentation.md](documentation.md#generated-documentation)).
