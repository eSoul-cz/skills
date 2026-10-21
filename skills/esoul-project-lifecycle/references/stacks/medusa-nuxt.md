# Stack profile: Medusa + Nuxt

TypeScript e-commerce: Medusa v2 backend with an admin extension, Nuxt storefront, in one pnpm
monorepo. Generalized from `doglead_3.0` (a retrofit); the repository is an illustration, not a
template to copy.

## When this profile applies

- `pnpm-workspace.yaml` with `apps/backend` (`@medusajs/*`, `medusa-config.ts`) and
  `apps/storefront` (`nuxt`, `nuxt.config.ts`); shared code in `packages/*`.
- PostgreSQL 16 (Redis optional) in `docker-compose.yml`; no PHP.
- Admin screens are Medusa Admin extensions (React) in `apps/backend/src/admin/`.
- Process tier `full`. Any commerce project with orders, payments or integrations.

## Bootstrap specifics

On top of the common root and docs templates:

1. Workspace: Node pinned in `engines` (Doglead `^22.22.3 || ^24.15.0`), `packageManager`
   `pnpm@<version>`, `.npmrc` with `engine-strict=true`, `pnpm install --frozen-lockfile` in CI.
2. Backend: Medusa 2.x, project features as modules (`modules/<name>` with `models/`,
   `service.ts`, `migrations/`, `index.ts` exporting `<NAME>_MODULE`), cross-module operations as
   workflows with compensation, relations as module links in `links/`.
3. Storefront: Nuxt 4, Vue 3.5, Pinia stores for per-visitor state, Tailwind 4 `@theme` tokens from
   Pencil, Medusa access only through the JS SDK wrapper (`useMedusa()`).
4. Root scripts (names are the contract the CI and `check.mjs` call): `lint`, `lint:prune`,
   `format:check`, `structure`, `skills:check`, `typecheck`, `test:unit`, `test:tooling`,
   `test:integration`, `test:e2e`, `test:db:up`, `test:db:down`, `mutation`, `mutation:full`,
   `check`.
5. Tooling scripts in `scripts/*.mjs`, each with a `node --test` self-test:
   `check.mjs` (runs all local checks, PASS/FAIL summary), `structure-check.mjs` (module shape,
   test file names, naming), `skills-lock-check.mjs`, `mutation.mjs` (Stryker on changed lines).
6. ESLint flat config with project rules in `tooling/eslint-rules/`; existing violations live in
   `eslint-suppressions.json` (ratchet: new code never adds suppressions or `eslint-disable`).
7. Agent context:
   - Vendored skills in `.agents/skills/` with `.claude/skills/<name>` committed symlinks, pinned
     in `skills-lock.json`, verified in CI by `pnpm skills:check`. Add or update only with
     `LC_ALL=en_US.UTF-8 npx skills@1.7.2 add <owner/repo> --skill <name> --agent claude-code codex -y`
     or `... npx skills@1.7.2 update`; raise the pinned CLI version together with the check.
   - Typical set: `building-with-medusa`, `building-admin-dashboard-customizations`, `db-generate`
     (`medusajs/medusa-agent-skills`); `vue-best-practices`, `vue-debug-guides`,
     `vue-testing-best-practices` (`vuejs-ai/skills`); `gitmoji-commit`,
     `esoul-maintain-application-documentation` (`eSoul-cz/skills`), `jenkins` (its
     `esoul-awesome-picks` plugin); project skills marked
     `metadata.origin: project` (e.g. `testing-best-practices`).
   - `AGENTS.md` lists where project rules override vendored skills (React Query advice does not
     apply to Nuxt, admin never installs packages, etc.).
   - MCP: `codegraph` (`.mcp.json`: `codegraph serve --mcp`), Pencil for `.pen` design.

## Guideline templates to copy

Copy into `docs/project_guidelines/`:

- `assets/templates/docs/project_guidelines/common/`: `index.md`, `code-review.md`, `testing.md`,
  `documentation.md`, `domain.md`, `security-and-data.md`.
- `assets/templates/docs/project_guidelines/medusa-nuxt/`: `architecture.md` (modules, workflows,
  callers, links, storefront layers, shared types), `workflows.md`, `admin.md`, `frontend.md`,
  `tools.md`, `deployment.md`.

Add project files when needed (Doglead: `api-and-validation.md`, `integrations.md`,
`money-and-time.md`, `medusa.md`).

## Quality gates

Local: `pnpm check` runs, in order and without stopping at the first failure, ESLint
(`pnpm lint`), Formatting (`pnpm format:check`), Structure (`pnpm structure`), Skills lock
(`pnpm skills:check`), TypeScript (`pnpm typecheck`), Unit tests (`pnpm test:unit`), Tooling tests
(`pnpm test:tooling`). Integration tests need `pnpm test:db:up` first, then
`pnpm test:integration`. Playwright E2E (`pnpm test:e2e`) needs the seeded stack and runs locally.

Local soft gate, **not** in CI: `pnpm mutation` — StrykerJS on changed lines, never fails on a
score; `pnpm mutation:full` for all production code.

Jenkins (CI-required, status check `Jenkins`; image `node:24` from `testing-images`, never
`node:lts`). Stages under `Run Checks` run **sequentially** because they share `.nuxt` and
`.medusa/types`:

| Stage | Command |
|---|---|
| Prepare | `node --version && corepack pnpm install --frozen-lockfile --store-dir .pnpm-store` |
| Lint | `corepack pnpm lint` |
| Formatting | `corepack pnpm format:check` |
| Structure | `corepack pnpm structure` |
| Skills lock | `corepack pnpm skills:check` |
| Typecheck | `corepack pnpm -r --if-present typecheck` |
| Unit tests | `corepack pnpm -r --if-present test:unit` |
| Integration tests | Postgres 16 sidecar (`withTestPostgres`), then `corepack pnpm --filter @<scope>/backend test:integration:modules && corepack pnpm --filter @<scope>/backend test:integration:http` |
| Tooling tests | `corepack pnpm test:tooling` |
| Audit | `corepack pnpm audit --audit-level critical` |
| Build | `corepack pnpm -r build` |
| Test Docker Build | PR only, skipped until `apps/*/Dockerfile` exists |
| Deploy production | `main` only, when both Dockerfiles exist: `dockerBuildMultiArch` per app + `deployKomodoStack` |

## Development handover checklist

- [ ] Jenkins green on the scaffold; required check `Jenkins` matches the multibranch job name.
- [ ] `pnpm check` green locally; `pnpm mutation` runs.
- [ ] Structure check enforces module shape and test file names (a misnamed test never runs).
- [ ] ESLint suppression baseline committed; every suppressed rule has a gap issue listed in
      `AGENTS.md`; `pnpm lint:prune` documented.
- [ ] `skills-lock.json` and `.claude/skills` symlinks verified by `pnpm skills:check`.
- [ ] Integration test environment: throwaway Postgres (compose profile `test`, tmpfs), fakes for
      external systems, seed for E2E.
- [ ] One reference module, one reference workflow with compensation, one admin screen and one
      storefront page implemented as patterns.
- [ ] Parity fixtures for any client calculation (prices, surcharges, tiers) before tasking.

## Typical ADR topics

- Medusa as the commerce core; storefront only through the Medusa JS SDK.
- Amount units and money representation; prices, tiers, surcharges, bundles, bill of materials.
- Extending Medusa with modules and links; admin extensions and admin RBAC.
- Payments, shipping carriers, invoicing systems, POS or ERP integration, integration secrets.
- Order status flow and event-driven side effects (subscribers, workflows).
- Search engine; content modules; SEO and AI access; languages and regions.
- Transactional e-mails, marketing and consent, product feeds.
- Design tokens; error contract between backend and storefront.
- Deployment topology; product and customer migration from the legacy shop.

## Pitfalls seen in eSoul projects

- `node:lts` or a non-existent image tag (`node:20-alpine`) in Jenkins broke CI for weeks; pin a
  major that satisfies `engines` and exists in `testing-images`.
- Parallel Jenkins stages sharing a workspace flaked (`nuxt build` wipes `.nuxt` that typecheck and
  Vitest read). Run checks sequentially or isolate workspaces.
- Calling plain `pnpm` in a non-root CI container fails; use `corepack pnpm`.
- Vendored skills edited in place drift from the lock; generic skill advice (React Query,
  `building-storefronts`) contradicts project rules unless `AGENTS.md` says which wins.
- Foreign keys into another module's tables instead of module links; cross-module writes outside
  workflows leave half-done state without compensation.
- Another customer's resource answering `403` instead of `404` leaks existence.
- Retrofit history: PRs merged by the shared account without a recorded human approval, and
  `## Ověření` instead of `## UAT`. Both are fixed by the company UAT and merging rules, not copied.
- Real product exports committed outside `assets/` (LFS) or used as test fixtures.
