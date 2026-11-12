# Stack profile: Laravel

Laravel application with a CQRS core and an Inertia frontend. Generalized from `indcom_eshop`,
`vono-iis` and `plemenna_kniha`; those repositories are illustrations, not templates to copy.

## When this profile applies

- `composer.json` requires `laravel/framework`; usually also `esoul-cz/laravel-cqrs`,
  `inertiajs/inertia-laravel`, `laravel/wayfinder`.
- `artisan`, `phpstan.neon`, `pint.json`, `infection.json5` at the root; `resources/js` with Vue 3
  (Indcom, SCHOK) or React 19 (VONO), Tailwind 4, shadcn.
- Admin either custom Inertia screens or Filament (Indcom); e-commerce core may be Lunar.
- Database MariaDB or MySQL in production. Whether tests may use SQLite is an ADR, not a default.
- Process tier is almost always `full`. A Laravel/Filament backend that only feeds a static site
  (headless CMS for Astro C) may run `light` if it has no domain logic beyond content.

## Bootstrap specifics

On top of the common root and docs templates:

1. Skeleton: Laravel 13 on PHP 8.5, `esoul-cz/laravel-cqrs`, Inertia v3 + chosen UI framework,
   Wayfinder, Tailwind 4, shadcn. Pin versions in `composer.lock` / `pnpm-lock.yaml`; pnpm version
   in `package.json › packageManager`.
2. Dev tooling (`require-dev`): `larastan/larastan`, `phpstan/phpstan` (level 10,
   `bleedingEdge.neon`), `phpstan/phpstan-phpunit`, `phpstan/extension-installer`,
   `laravel/pint`, `phpunit/phpunit` 13 + `brianium/paratest`, `infection/infection`,
   `laravel/boost`, `barryvdh/laravel-ide-helper`, `barryvdh/laravel-debugbar`.
3. Composer scripts copied verbatim in shape: `test`, `test:coverage`, `stan`/`phpstan`, `cs`,
   `pint`, `mutation:coverage`, `mutation`, `mutation:full` (see Quality gates).
4. Frontend scripts: `eslint`, `format:check`, `tsc` (+ `tsc:strict` with a strict tsconfig),
   `test` (Vitest), `build`; structure scripts in `scripts/*.mjs` with `node --test` self-tests.
5. Docker: `docker/production/Dockerfile` (targets `app`, optionally `worker`, `ssr`),
   `docker-compose.yml` for local development; tests that need the database run in the container.
6. Agent context:
   - **Laravel Boost** (`laravel/boost`): run `php artisan boost:install`, keep the generated
     `<laravel-boost-guidelines>` block in `AGENTS.md` untouched; project rules live above it and in
     `.ai/guidelines/`. MCP server: `php artisan boost:mcp` (in the container when database tools
     are needed). Decide in `tools.md` whether `boost.json` / `.mcp.json` are committed or ignored.
   - Vendored skills in `.agents/skills/` with `.claude/skills/<name>` committed symlinks, pinned
     in `skills-lock.json`, added only with
     `LC_ALL=en_US.UTF-8 npx skills@1.7.2 add <owner/repo> --skill <name> --agent claude-code codex -y`.
     Typical set: Boost-managed `laravel-best-practices`, `wayfinder-development`,
     `inertia-vue-development` or `inertia-react-development`, `tailwindcss-development`,
     `testing-best-practices`; from `eSoul-cz/skills`: `gitmoji-commit`,
     `esoul-maintain-application-documentation`, and `jenkins` from its `esoul-awesome-picks`
     plugin.
   - MCP: Laravel Boost, Pencil (`.pen` design only through MCP), `codegraph` when the repository
     is indexed (`.codegraph/`).
7. `Jenkinsfile` from the shared libraries `dockerHelpers`, `testing`, `deploy` with
   `GIT_LFS_SKIP_SMUDGE = '1'` and `SKIP_DEPLOY = 'true'` until a Komodo stack exists.

## Guideline templates to copy

Copy into `docs/project_guidelines/`:

- `assets/templates/docs/project_guidelines/common/`: `index.md`, `code-review.md`, `testing.md`,
  `documentation.md`, `domain.md`, `security-and-data.md`.
- `assets/templates/docs/project_guidelines/laravel/`: `architecture.md` (Domain / Application /
  Infrastructure layers and dependency direction), `cqrs.md`, `requests-and-validation.md`,
  `frontend.md`, `tools.md`, `deployment.md`.

Add project-specific files only when the domain needs them (VONO `calculations.md`,
`money-and-localization.md`; Indcom `imports.md`, `integrations.md`, `legacy-database.md`).

## Quality gates

Local, read-only (as in VONO `tools.md`):

```bash
composer stan          # ./vendor/bin/phpstan --memory-limit=1G analyse (level 10)
composer cs            # ./vendor/bin/pint --parallel --cache-file=tmp/pint.cache --test
composer test          # php artisan test --parallel (VONO) or ./vendor/bin/paratest (Indcom, SCHOK)
pnpm eslint
pnpm format:check
pnpm tsc
pnpm test              # vitest run (VONO: pnpm test:node)
pnpm build
```

Local soft gate, **not** in CI: `composer mutation` — Infection on changed lines only
(`--git-diff-lines --git-diff-base=main --ignore-msi-with-no-mutations`), review escaped mutants
before opening the PR. `composer mutation:full` for whole-codebase runs.

Jenkins (CI-required, status check `Jenkins`), stage `Testing`:

| Stage | Command |
|---|---|
| Prepare | `composer install --no-interaction --prefer-dist --no-progress --optimize-autoloader`, then `cp .env.example .env && php artisan key:generate --ansi && php artisan config:clear && php artisan wayfinder:generate` |
| PHP Tests | `fullPhpTest(phpstanCommand: './vendor/bin/phpstan analyse --memory-limit=1G', ...)` — PHPStan, Pint, PHPUnit |
| Dependency audit | `composer audit --locked --abandoned=report --format=plain \|\| true` (report), `composer audit --locked --abandoned=ignore --ignore-severity=low --ignore-severity=medium --ignore-severity=high` (fails on critical) |
| JS tests | `fullNodeTest(eslintCommand: 'pnpm run eslint --quiet', prettierCommand: 'pnpm run format:check', typecheck: true, testCommand: 'pnpm run test --maxWorkers=1 --testTimeout=10000', additionalTests: [...])` |
| JS additional | `pnpm audit --audit-level critical`, `pnpm run test:frontend-check`, `pnpm run test:inertia-page-paths`, `pnpm run frontend:structure`, `pnpm run frontend:inertia-page-paths`, `pnpm run build` with `WAYFINDER_TYPES_PREGENERATED=true` |
| Test Docker Build | PR only (`changeRequest()`): `docker build --file docker/production/Dockerfile --target app ...` (+ `worker`, `ssr` and an SSR smoke script when present) |
| Deploy production | `main` only: `dockerBuildMultiArch` + `deployKomodoStack` when `SKIP_DEPLOY` is `false` |

Database in CI: Indcom and SCHOK run `DB_CONNECTION=sqlite DB_DATABASE=:memory:`; VONO starts a
`mysql:8.4` sidecar on a per-build Docker network because its ADR forbids SQLite. Choose by ADR.
On an empty scaffold, guard PHPStan (`if find app -name '*.php' | grep -q .; then ...; fi`) and
start the database stage only once `database/migrations/*.php` exists (VONO pattern).

## Development handover checklist

Gate B4 is green only when all of these hold on `main`:

- [ ] Jenkins green on the empty scaffold, required check `Jenkins` in the ruleset.
- [ ] PHPStan level 10 + bleedingEdge, Pint, PHPUnit, ESLint, Prettier, `tsc`, Vitest, build all
      pass; `composer mutation` runs locally.
- [ ] Architecture tests guard layer direction from the first commit
      (`tests/Unit/Architecture/LayerDependencyTest.php`), plus a detection test proving each
      rule fires. Both are listed under *Named exceptions* in `testing.md`, decided by this stack
      profile, so the general exclusion of architecture tests does not apply to them.
- [ ] Schema identifier test (`tests/Feature/Architecture/DatabaseIdentifierLengthTest.php`,
      see [Schema identifier test](#schema-identifier-test)) with its detection test, listed
      under *Named exceptions* in `testing.md` like the layer test.
- [ ] Frontend structure checks (`frontend:structure`, `frontend:inertia-page-paths`) with tests.
- [ ] One reference module implemented end to end (command, query, handler, request, page, tests)
      that agents copy — Indcom used `Numbering`.
- [ ] Where the client calculates in workbooks: JSON fixtures in `tests/Fixtures/Workbooks/` and
      parity tests per calculation that `markTestIncomplete` with the slice and issue until the
      implementing agent fills them in (VONO `*ParityTest.php` + `AssertsWorkbookParity`).
- [ ] Anonymized database dump or seeders available; agents never get a real dump.
- [ ] `docs/project_guidelines/` filled, Boost block regenerated, `skills-lock.json` current.

## Schema identifier test

MariaDB and MySQL reject identifiers longer than 64 characters. Laravel builds index and foreign
key names from the table and column names (`<table>_<columns>_foreign`), and SQLite accepts any
length, so the migration passes the suite and fails on production, often half-applied. Three
eSoul projects shipped this bug in autumn 2026 (plemenna_kniha, indcom_eshop,
forecom-tw-to-abra). Add the test to new Laravel projects and to existing ones during a retrofit
or audit.

The test swaps in a blueprint that records every table, column, index and key name while
`migrate:fresh` runs, so it sees the names the migrations really use, explicit or generated, on
whichever engine the suite uses. Reading the finished schema does not work: SQLite keeps no
foreign key names, and rebuilding them from the columns flags keys that have an explicit short
name.

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Architecture;

use ArrayObject;
use Closure;
use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * MariaDB and MySQL reject identifiers longer than 64 characters; SQLite accepts them. Laravel
 * generates index and foreign key names from the table and column names, so a migration can
 * pass the suite and fail on production. The test records every name the migrations really
 * use (explicit or generated) while they run, on whichever engine the suite uses. Fix a hit by
 * passing a short name to index(), unique(), foreign() or constrained(indexName: ...).
 */
final class DatabaseIdentifierLengthTest extends TestCase
{
    private const int MAX_LENGTH = 64;

    #[Test]
    public function every_identifier_the_migrations_create_fits_mariadb(): void
    {
        $names = $this->recordIdentifiers();

        self::assertSame(0, Artisan::call('migrate:fresh'));

        self::assertSame([], $this->tooLong($names), 'Identifiers longer than 64 characters.');
    }

    #[Test]
    public function the_check_detects_a_generated_name_that_is_too_long(): void
    {
        $names = $this->recordIdentifiers();
        $table = 'identifier_length_probe_with_a_long_table_name';

        try {
            Schema::create($table, static function (Blueprint $blueprint): void {
                $blueprint->string('a_rather_long_column_name_for_the_probe')->index();
            });
        } catch (QueryException) {
            // MariaDB and MySQL reject the index themselves; the name was recorded before.
        } finally {
            Schema::dropIfExists($table);
        }

        self::assertNotSame([], $this->tooLong($names));
    }

    /**
     * Swaps in a blueprint that records the table, column, index and key names it creates.
     *
     * @return ArrayObject<int, array{string, string}>
     */
    private function recordIdentifiers(): ArrayObject
    {
        /** @var ArrayObject<int, array{string, string}> $names */
        $names = new ArrayObject();

        $this->app->bind(Blueprint::class, static function (mixed $app, array $parameters) use ($names): Blueprint {
            $connection = $parameters['connection'] ?? null;
            $table = $parameters['table'] ?? null;
            $callback = $parameters['callback'] ?? null;
            if ( ! $connection instanceof Connection || ! is_string($table) || ($callback !== null && ! $callback instanceof Closure)) {
                throw new LogicException('Unexpected Blueprint constructor parameters.');
            }

            $blueprint = new class($connection, $table, $callback) extends Blueprint
            {
                /** @var ArrayObject<int, array{string, string}>|null */
                public ?ArrayObject $names = null;

                public function build(): void
                {
                    $statements = $this->toSql();
                    $table = $this->getTable();
                    $this->record($table, $table);
                    foreach ($this->getAddedColumns() as $column) {
                        $this->record($table, $column->get('name'));
                    }
                    foreach ($this->getCommands() as $command) {
                        $name = $command->get('name');
                        // MariaDB and MySQL ignore the primary key name; it is always PRIMARY.
                        if ( ! is_string($name) || $name === 'primary' || str_starts_with($name, 'drop')) {
                            continue;
                        }
                        $this->record($table, $command->get('index'));
                        $this->record($table, $command->get('to'));
                    }
                    foreach ($statements as $statement) {
                        if (is_string($statement)) {
                            $this->connection->statement($statement);
                        }
                    }
                }

                private function record(string $table, mixed $identifier): void
                {
                    if (is_string($identifier)) {
                        $this->names?->append([$table, $identifier]);
                    }
                }
            };
            $blueprint->names = $names;

            return $blueprint;
        });

        return $names;
    }

    /**
     * @param  ArrayObject<int, array{string, string}>  $names
     * @return list<string>
     */
    private function tooLong(ArrayObject $names): array
    {
        $tooLong = [];
        foreach ($names as [$table, $identifier]) {
            if (mb_strlen($identifier) > self::MAX_LENGTH) {
                $tooLong[] = sprintf('%s: %s (%d)', $table, $identifier, mb_strlen($identifier));
            }
        }

        return array_values(array_unique($tooLong));
    }
}
```

The blueprint constructor matches Laravel 12 and newer, which resolve `Blueprint` from the
container with the connection, table and callback. A project that loads a schema dump
(`database/schema/*.sql`) before migrating records only the migrations after the dump; check the
dump's names once by hand.

## Typical ADR topics

- Application architecture, layers and CQRS (`esoul-cz/laravel-cqrs`); where state machines live.
- Database engine and decimal precision; SQLite in tests or not.
- Money representation, currencies, VAT, rounding; exchange rates.
- Admin approach (Filament vs custom Inertia); frontend framework (Vue vs React).
- System of record and integration transport (ERP, idempotence, outbox), queue broker and
  process topology (queue workers, scheduler). Each external integration sits behind a port with
  two adapters, the real driver and a fake driver for tests (`esoul-workflow` ›
  references/design-principles.md).
- Authentication, roles and authorization; legal entity or tenant scope.
- Search (Scout, engine), URLs and redirects, SEO head and SSR, page cache. A public part follows [ai-readiness.md](../ai-readiness.md) (slices AI-01…AI-06, launch gate).
- Imports and legacy migration (one-off vs repeatable), exports and file formats.
- Calculation parity with source workbooks; audit trail and change history.
- Deployment and runtime (Docker targets, Komodo stack, storage buckets).

## Pitfalls seen in eSoul projects

- Tests on SQLite while production is MariaDB/MySQL silently test different decimal and collation
  behaviour (VONO ADR-0012 moved CI to MySQL). Decide early; switching later is costly.
- Migrations that pass on SQLite and fail on MariaDB/MySQL: generated index or foreign key names
  over 64 characters (guarded by the [schema identifier test](#schema-identifier-test)), a
  `timestamp()` column without `nullable()` or a default under strict mode (error 1067), and
  `ONLY_FULL_GROUP_BY` rejecting a SELECT expression that differs from the GROUP BY one.
- PHPStan fails with "no files to analyse" on an empty `app/` — guard it instead of disabling it.
- Editing the generated Boost block in `AGENTS.md` by hand; it is overwritten by `boost:update`.
- Wayfinder routes not generated before the frontend build or typecheck in CI
  (`php artisan wayfinder:generate`, `WAYFINDER_TYPES_PREGENERATED=true`).
- LFS-heavy `assets/` and `docs/design_pencil/` cloned by Jenkins: set `GIT_LFS_SKIP_SMUDGE=1` and
  keep `docs/` out of the Docker build context (`.dockerignore`).
- Project-local tasking skills drifting from `CONTEXT.md` (Indcom, SCHOK): replace them with
  `## Tasking convention` in `CONTEXT.md`.
- Issue titles with `[FE]/[BE]/[DATA]` prefixes or slice IDs; category belongs in labels (company rule: titles).
- SCHOK grew 40+ ADRs without an index table or `Implementation status`; retrofit adds both
  without renaming existing files.
- Infection run on the whole codebase in CI is too slow; keep it a local diff-only soft gate.
- Data tasks (`data-migration` label) changing PHP code or the data model directly instead of
  proposing an issue.
