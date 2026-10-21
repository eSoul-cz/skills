# Project guidelines - Admin

Staff manage the project's own data next to Medusa's products and orders in Medusa's admin at
`/app`. Project screens are pages and widgets of that admin, written in React with
`@medusajs/ui`, so they share its login, layout and look ({{ADMIN_ADR}}).

The admin is the only React code in the repository. The storefront rules in
[frontend.md](frontend.md) do not apply here, and none of the rules below apply to the
storefront. Paths are relative to `apps/backend/src`.

## Where admin code lives

```text
apps/backend/src/admin/
├── routes/<kebab-case>/page.tsx   # pages, each with defineRouteConfig({ label })
├── widgets/                       # widgets in Medusa screens
├── lib/api.ts                     # adminFetch: the only way screens call the API
├── lib/*.ts                       # pure helpers, unit-tested in lib/__tests__/
├── i18n/                          # admin translations under project keys
└── tsconfig.json
```

- React, `react-dom`, `react-router-dom`, `react-i18next`, `@tanstack/react-query`,
  `@medusajs/ui`, `@medusajs/icons` and `@medusajs/admin-sdk` MUST be imported only under
  `apps/backend/src/admin`. A lint rule rejects them elsewhere in the backend and in `packages/`;
  the storefront rejects React altogether.
- Admin code runs in the browser. It MUST NOT import server code: modules, services, workflows,
  container-dependent helpers, or anything that reads `process.env`. It MAY import types and the
  pure helpers in `admin/lib/`.
- The admin's React-related packages MUST stay on the versions `@medusajs/dashboard` and
  `@medusajs/framework` use; two copies break the router, React Query, translations or validation
  context ([tools.md](tools.md)).

## Pages and widgets

- A **page** shows the project's own data: `routes/<kebab-case>/page.tsx`, the component as the
  default export and `config = defineRouteConfig({ label })`. It appears in the sidebar at
  `/app/<kebab-case>`.
- A **widget** adds project data to a Medusa screen: `config = defineWidgetConfig({ zone })`,
  receiving the screen's entity through `DetailWidgetProps<…>`. Use a widget when the data belongs
  to a Medusa entity; use a page when it has no Medusa screen.
- Screens use `@medusajs/ui` components and the admin's layout, not custom CSS or another
  component kit. Confirmations and feedback use its prompt and toast, never `window.confirm` or
  `window.prompt`.
- Every screen shows a loading state, an empty state and an error state, and disables a submit
  action while it runs.

## Calling the API

- Screens call the project's `/admin/*` routes through `adminFetch` from `admin/lib/api.ts`,
  which sends the admin session cookie. Screens never call external systems or the database
  directly.
- Every admin route is protected by Medusa's admin authentication. A route that records who did
  something reads the user from `req.auth_context.actor_id`, never from the body.
- A project admin route MUST NOT take a path Medusa's own Admin API uses.
- Every admin route validates its body and query with a schema, and returns errors with a `type`
  and a `code`. Screens show a translated message chosen by the code, never the raw response.
- An admin route MUST NOT return a secret unmasked.

## Money in admin forms

- An amount field states its unit and currency in its label („Min. objednávka (Kč)“).
- Admin screens ask for amounts in base units (Kč, €), like Medusa's own price editor, and
  convert to minor-unit fields exactly once, through one tested helper per screen
  ([domain.md](domain.md#money)). A page never multiplies or divides by 100 inline.

## Texts and language

- Texts of project screens go through the admin i18n under project keys, in {{ADMIN_LOCALES}},
  read with `useTranslation()`. A new screen puts its texts there from the start.
- Admin texts use the glossary's terms. Identifiers stay English.

## Permissions and audit

- Every admin mutation that changes business data is written to the admin action log with the
  acting user.
- A new admin route names, in its pull request, the permission it needs.

<!-- optional: project RBAC -->
One middleware checks a `<resource>:<action>` permission on every `/admin/*` request, from a map
of route and method to permission. A route missing from the map is denied to everyone but the
owner ({{RBAC_ADR}}).

## Tests

- Conversion and parsing logic of a screen lives in a pure helper in `admin/lib/` with a unit
  test next to it.
- The behaviour behind a screen is tested at its admin route with an HTTP integration test, for
  an allowed and a refused administrator
  ([security-and-data.md](security-and-data.md#authorization-tests)). Admin screens themselves
  have no component tests.
