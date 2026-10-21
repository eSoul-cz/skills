# Project guidelines - Architecture

{{PROJECT_NAME}} is a pnpm monorepo with a Medusa 2 backend and a Nuxt storefront. Medusa owns
the commerce data; project features extend it through Medusa's extension points and never patch
it ({{COMMERCE_CORE_ADR}}).

| Part | Technology | Where | Decision |
|---|---|---|---|
| Commerce core and API | Medusa {{MEDUSA_VERSION}} | `apps/backend` | {{COMMERCE_CORE_ADR}} |
| Admin | Medusa Admin at `/app`, project pages and widgets in React + `@medusajs/ui` | `apps/backend/src/admin` | [admin.md](admin.md) |
| Storefront | Nuxt {{NUXT_VERSION}}, Vue 3, Pinia, Tailwind CSS 4, SSR | `apps/storefront` | [frontend.md](frontend.md) |
| Shared types | `{{PACKAGE_SCOPE}}/shared-types` | `packages/shared-types` | see below |
| Local infrastructure | PostgreSQL, Redis and the services the project needs | `docker-compose.yml` | [deployment.md](deployment.md) |

## Medusa owns the commerce data

- Medusa's code and models MUST NOT be patched, forked or extended with columns.
- Medusa owns products, variants, categories, prices, regions, sales channels, stock, carts,
  promotions, orders, customers, payments, fulfillment and taxes. Project code MUST NOT create
  parallel tables for them.
- A project route MUST NOT occupy a path of Medusa's own API.
- Every customization is registered in this repository (`medusa-config.ts`, `src/**`) and covered
  by a test of its observable behaviour.

| Need | Extension point | Where |
|---|---|---|
| Own data and its operations | Module (`Module()`, `MedusaService`) | `src/modules/<name>` |
| A payment or fulfillment method | Module provider | `src/modules/<name>/services/` |
| A relation across modules | Module link (`defineLink`) | `src/links/` |
| A multi-step or cross-module operation | Workflow ([workflows.md](workflows.md)) | `src/workflows/` |
| A Medusa operation whose event matters | Medusa core workflow | `@medusajs/medusa/core-flows` |
| HTTP endpoint | API route | `src/api/**/route.ts`, `src/api/middlewares.ts` |
| Reaction to an event | Subscriber | `src/subscribers/` |
| Scheduled work | Scheduled job | `src/jobs/` |
| Admin screens | Admin SDK pages and widgets ([admin.md](admin.md)) | `src/admin/{routes,widgets}` |
| One-time data fix on deploy | Migration script | `src/migration-scripts/` |
| Seeds and maintenance | `medusa exec` script | `src/scripts/` |

## Backend layers

Paths are relative to `apps/backend/src`.

```text
route (api/)  ─┐
subscriber     ├──>  workflow (workflows/)  ──>  module service (modules/<name>/)
job (jobs/)   ─┘          │                             │
       │                  └── Medusa core workflows     └── own models, migrations
       └── Query, links, core module services               (no other module's data)
```

A caller (route, subscriber or job) receives the request, event or schedule, assembles the data
it needs and either calls one module service or runs a workflow. Modules sit at the bottom and
know only themselves.

### Modules

- A feature that owns data lives in its own module: kebab-case directory, `models/`,
  `migrations/`, `service.ts` and an `index.ts` exporting `<NAME>_MODULE`. New module keys are
  snake_case. `pnpm structure` checks this shape.
- A module MUST NOT import from another module anything but types (`import type`) and the
  `*_MODULE` key, and MUST NOT import from `api/`, `workflows/` or `subscribers/`. The project
  lint rule `{{ESLINT_PLUGIN}}/module-boundaries` enforces it.
- A module MAY import pure helpers from `lib/`. It MUST NOT call a helper that needs the
  application container, and it MUST NOT resolve Query or another module's service from its own
  container.
- Logic that touches one module's data belongs in that module's service. Helpers without data
  belong in `lib/`.

### Callers

- Routes, subscribers and jobs are thin: identify the actor or event, validate input, assemble
  cross-module data, call a module service or a workflow, shape the result.
- Code that combines data from several modules, including every Query, runs in a caller or in a
  workflow step, which passes the result to the module.
- Side effects of an order or payment run in subscribers on emitted events, never in a route or
  in the checkout ([workflows.md](workflows.md)).
- The customer is taken from `req.auth_context.actor_id`, never from the body or query.

### Typed container resolution

- A project module service is resolved with its type and key:
  `container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)`.
- A Medusa module is resolved through `Modules.*` with its interface from
  `@medusajs/framework/types` (`container.resolve<IOrderModuleService>(Modules.ORDER)`); Query,
  the link service and the logger through `ContainerRegistrationKeys`. No ad-hoc casts.

### Links and metadata

- A relation between a Medusa entity and a project model, or between two modules, MUST be a
  module link in `links/`, never a foreign key into another module's table.
- Every link is either **written** (created and dismissed by the code that owns the relation,
  inside a workflow step with compensation) or **read-only** (`readOnly: true` over an existing id
  column).
- `metadata` on a Medusa entity MAY hold only small values nothing queries. Every key has one
  writer, a type, a constant next to the owning code and validation where it enters. Data that
  needs relations, indexes or admin editing gets a model in a module.

### Migrations

- Change a model, then run `npx medusa db:generate <module_key>` in `apps/backend`; commit the
  migration and the updated snapshot together. A migration merged to `main` MUST NOT be edited.
- The pull request updates [docs/data-model.md](../data-model.md) in the same change.

## Storefront layers

Paths are relative to `apps/storefront`.

```text
page (app/pages/) ──> store (app/stores/) or composable (app/composables/)
        │                              │
        └──────── useAsyncData ────────┴──> useMedusa() / medusaFetch() ──> Medusa /store
```

- The storefront reaches Medusa only through the SDK wrapper `useMedusa()` and, for custom
  `/store/*` routes, `medusaFetch()`. There is no backend-for-frontend; `server/` holds only what
  must be rendered by Nuxt itself (sitemap source, `robots.txt`).
- Per-visitor state (cart, customer, region) lives in Pinia stores, never in module-level
  variables, which the server shares between requests.
- Medusa calls used by several pages or touching shared state sit in a composable or a store
  action. A page MAY call the SDK directly inside `useAsyncData` for data only it shows.

## Shared types

- `{{PACKAGE_SCOPE}}/shared-types` is the contract for shapes both the backend and the storefront
  use: responses of custom routes, error codes, locales, currencies.
- Medusa's own shapes come from `@medusajs/types` (`HttpTypes.StoreProduct`, …) and are never
  redeclared.

## Where things live

| What | Where |
|---|---|
| Medusa configuration, module registration | `apps/backend/medusa-config.ts` |
| Modules, links, workflows | `apps/backend/src/{modules,links,workflows}/` |
| Store and Admin API routes, middlewares | `apps/backend/src/api/` |
| Subscribers, jobs, helpers | `apps/backend/src/{subscribers,jobs,lib}/` |
| Admin pages and widgets | `apps/backend/src/admin/` |
| Backend HTTP integration tests | `apps/backend/integration-tests/` |
| Storefront app, translations, tests | `apps/storefront/{app,i18n,tests,e2e}/` |
| Project lint rules, structure and check scripts | `tooling/eslint-rules/`, `scripts/` |
