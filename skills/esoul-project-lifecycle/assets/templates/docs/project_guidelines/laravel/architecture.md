# Project guidelines - Architecture

The application is a Laravel monolith with business operations as commands and queries
(`esoul-cz/laravel-cqrs`), an Inertia frontend and one database.

| Part | Technology | Where | Decision |
|---|---|---|---|
| User interface | Inertia + {{FRONTEND_FRAMEWORK}} + TypeScript + Tailwind CSS 4 + shadcn | `resources/js`, `App\Infrastructure\Http` | [frontend.md](frontend.md) |
| Business operations | Commands and queries via `esoul-cz/laravel-cqrs` | `App\Domain\CQRS` | {{ARCHITECTURE_ADR}}, [cqrs.md](cqrs.md) |
| Business rules and calculations | Framework-free value objects, enums, domain services | `App\Domain\<Module>` | {{ARCHITECTURE_ADR}} |
| Database | {{DATABASE}} in production, {{TEST_DATABASE}} in tests | `database/` | {{DATABASE_ADR}} |
| Runtime | Docker images built by Jenkins, deployed by Komodo | `docker/`, `Jenkinsfile` | [deployment.md](deployment.md) |

<!-- optional: separate admin panel -->
The admin is {{ADMIN_TECHNOLOGY}} in {{ADMIN_LOCATION}} ({{ADMIN_ADR}}). It is a separate user
interface: the frontend rules do not apply to it, and its custom actions that perform a business
operation dispatch the corresponding command instead of reimplementing it.

## Layers

### `App\Domain\<Module>` — the framework-free core

- Contains value objects (money, quantities, rates), enums, domain services and calculators, and
  the typed domain exceptions (`App\Domain\Exception`) that report a broken business rule.
- MUST NOT reference `Illuminate\Database`, an Eloquent model, a facade, the container, the
  request or the session. It takes plain values and returns plain values, so every rule and
  formula is unit-tested without a database.
- Value objects used by several modules live in `App\Domain\ValueObjects`; everything else lives
  in the module that owns it.

### `App\Domain\CQRS` — commands, queries and their handlers

- Commands in `App\Domain\CQRS\Command\<Module>`, queries in `App\Domain\CQRS\Query\<Module>`,
  each next to its handler ([cqrs.md](cqrs.md)).
- Handlers MAY read and write the Eloquent models in `App\Infrastructure\Models`. **They are the
  single place a business operation touches persistence**, and they own the transaction and the
  locks.
- Handlers delegate every calculation and business rule to the framework-free core. They load,
  call, persist and map; they do not compute.

### `App\Application`

- `App\Application\Dto\<Module>` — the DTOs queries return; what pages and exporters receive.
- `App\Application\Event\<Module>` — events a module raises for others, readonly, carrying ids.
- `App\Application\Contract` — interfaces the infrastructure implements (external clients,
  storage, exporters, the change history recorder). The container binds the implementation.
- Contains no business rule and no persistence, and never references a vendor SDK class.

### `App\Infrastructure`

- Eloquent models, controllers, form requests, policies, middleware, casts, external clients
  (`App\Infrastructure\Integration\<System>`), exporters, console commands, jobs, listeners and
  service providers.
- Contains no business rule. Controllers, console commands, listeners and jobs dispatch commands
  and execute queries.
- **Controllers stay thin**: authorize through the policy, validate in a form request, dispatch
  one command or execute the queries the page needs, return the response. Nothing else.

### Dependency direction

- The framework-free core depends on nothing in the application.
- CQRS handlers depend on the core, on `App\Application` and on the models in
  `App\Infrastructure\Models`. They never depend on controllers, requests or the session.
- `App\Infrastructure` depends on the commands, queries and DTOs. Models MAY use domain enums and
  value objects through casts.
- `App\Domain` MUST NOT reference `App\Infrastructure\Integration`. Domain code talks to the
  contract; the container binds the implementation.
- A repository interface MUST NOT be introduced unless a second implementation actually exists.
  A handler uses the Eloquent model directly.

<!-- optional: layer rules enforced by architecture tests -->
The boundary between `App\Domain\CQRS` (which touches Eloquent) and the rest of `App\Domain`
(which must not) runs through the middle of a layer and is enforced by architecture tests in
`tests/Unit/Architecture`, a named exception in [testing.md](testing.md#named-exceptions)
({{ARCHITECTURE_ADR}}).

## Modules

Module boundaries are namespaces inside the layers, not separate packages. Each module owns its
data and exposes behaviour through its commands and queries; other modules ask, they do not reach
in.

| Module | Owns |
|---|---|
| `{{MODULE_NAME}}` | {{MODULE_OWNS}} |
| `Integration\<System>` | One namespace per external system |

### Dependency rules

- A module MUST NOT read another module's Eloquent model. Cross-module reads execute the owning
  module's query. Reaching into another module's model is `High` in review even when it works.
- A module MUST NOT write another module's data. It dispatches that module's command.

<!-- optional: project-specific dependency rules -->
- {{MODULE_DEPENDENCY_RULE}}

## Persistence

- Migrations are forward-only. A deployed migration is never edited; a mistake is corrected by a
  new migration. A migration MUST be safe to run while the previous release still serves traffic:
  add first, remove in a later release.
- Every table scoped to a tenant, customer, sales channel or legal entity carries that scope
  explicitly. A query that can return another scope's data is a bug, not a filter to add later.
- A yes/no fact SHOULD be stored as a nullable timestamp of when it became true (`archived_at`,
  not `is_archived`). A plain boolean remains fine where the moment carries no meaning.
- A column with more than two values SHOULD be a database-native enum mapped to a PHP backed enum
  through a cast. Values the client manages as data (types, tags, categories) are tables, not
  enums.
- Money columns hold integer minor units (`BIGINT`); exact decimals are `DECIMAL` with the scale
  the source material uses. `FLOAT` and `DOUBLE` are never used for money or quantities.
- Translatable content is stored in JSON columns keyed by locale, one row per entity, never a
  second row per language.

## Money

The principles are in [domain.md](domain.md#money). On this stack:

- An amount is a project value object (`App\Domain\ValueObjects\Money`: integer minor units and a
  currency, arithmetic only within one currency), mapped to a `BIGINT` column by a cast.
- Exact decimals (rates, coefficients, percentages) are `BcMath\Number` or decimal strings
  computed with bcmath. `float()` is never called on money input, and PHP `round()` is never used
  on money.
- Rounding happens once per chain, with an explicit `RoundingMode`, inside the framework-free
  core.
- Numbers are formatted on the server by one formatter (`ext-intl`) per kind (money, quantity,
  date, percentage); the frontend renders the string it receives.
