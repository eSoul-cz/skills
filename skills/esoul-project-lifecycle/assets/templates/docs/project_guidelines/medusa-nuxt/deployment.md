# Project guidelines - Deployment and runtime

Locally the infrastructure runs in Docker and the two applications run on the host. Jenkins
checks every push, builds the images and deploys them to Komodo. The production topology is
decided in {{DEPLOYMENT_ADR}}.

## Local development stack

Requirements: Node {{NODE_VERSION}} as in CI, pnpm from `packageManager`, and a Docker runtime
with Compose (Colima on macOS).

| Service | Purpose |
|---|---|
| `postgres` | Development database, named volume, health-checked |
| `redis` | Sessions and, where configured, Medusa's event bus, locking and cache |
| `postgres-test` | Throwaway test database (profile `test`, data in `tmpfs`), not started by `infra:up` |

<!-- optional: further local services -->
The stack also runs {{EXTRA_SERVICES}}.

```bash
pnpm infra:up       # start the stack in the background
pnpm infra:down     # stop it; named volumes keep the data
pnpm infra:reset    # delete all volumes and start again
pnpm test:db:up     # start only postgres-test and wait until it is healthy
```

The backend runs on port 9000 (Store API `/store`, Admin API `/admin`, admin UI `/app`), the
storefront on 3000. Integration and E2E tests never use the development database. The local stack
is insecure on purpose (services without auth, `:latest` images) and MUST NOT be copied to a
server.

## Environment files

| File | Committed | Contents |
|---|---|---|
| `.env.example` | yes | Every variable the applications and Compose read, with placeholders, grouped by the file that reads it |
| `.env`, `apps/backend/.env`, `apps/storefront/.env` | no | Local values copied from `.env.example` |
| `apps/backend/.env.test` | yes | Test database, test-only secrets, every integration key empty |

- A new variable is added to `.env.example` with a placeholder and a comment when its effect is
  not obvious. A backend variable that holds an integration key is also added, empty, to
  `.env.test`, otherwise the development value leaks into tests.
- `.env.test` never contains a real secret.
- In production, `medusa-config.ts` refuses an empty, placeholder or short `JWT_SECRET` and
  `COOKIE_SECRET`, and the server does not start.

## Pipeline

`Jenkinsfile` uses eSoul's shared Jenkins libraries (`dockerHelpers`, `testing`, `deploy`) and
reports the required `Jenkins` check on every push. Every check runs in the testing image
`rg.fr-par.scw.cloud/testing-images/node:{{NODE_VERSION}}` with `corepack pnpm`.

1. **Prepare** — `pnpm install --frozen-lockfile` into a workspace pnpm store.
2. **Checks**, one stage after another, because they share the workspace (`nuxt build` deletes
   `.nuxt`, `medusa build` rewrites `.medusa/types`):
   - lint, formatting, structure, skills lock, typecheck, unit tests;
   - integration tests against a `postgres` sidecar;
   - tooling tests, dependency audit (`pnpm audit --audit-level critical`), build.
3. **Test Docker build** — on pull requests, the backend and storefront images without pushing.
4. **Build and push**, on `main` — multi-architecture images `{{APP_IMAGE}}_backend` and
   `{{APP_IMAGE}}_storefront`, tagged `latest` and with any Git tag, pushed to
   `rg.fr-par.scw.cloud/app-images`.
5. **Deploy** — the Komodo stack `{{KOMODO_STACK}}`. `SKIP_DEPLOY` keeps it off until the stack
   exists.

E2E tests do not run in Jenkins because they need the whole stack; a pull request that changes a
customer flow runs them locally and lists the result. Keep the check stages sequential, and keep
the required `Jenkins` check matching the multibranch job.

## Environments

- Staging ({{STAGING_URL}}) is deployed from `main`; production ({{PRODUCTION_URL}}) from a
  release tag on `main`, after the same commit was accepted on staging.
- Production runs Medusa as a server and a worker process with Redis-backed event bus, workflow
  engine, locking and cache, the storefront, the data services and a reverse proxy with TLS.
  Splitting server and worker without the Redis event bus would stop every subscriber, and every
  worker would run each scheduled job.
- Processes run with `TZ=UTC`.

<!-- optional: production not set up yet -->
**Target.** Production runs as described above. The code does not do this yet:
{{DEPLOYMENT_GAP}} ({{DEPLOYMENT_ISSUE}}). A Dockerfile, production compose file or deploy
configuration MUST NOT be added outside the issue that implements the accepted ADR.

## Configuration and secrets

- Never commit `.env` files, database exports or files with personal data.
- Jenkins reads secrets only through `withCredentials`; a pipeline change MUST NOT print one.
- Staging and production variables live in Komodo and 1Password.
- Integration keys come from one documented source per key (environment or admin settings), as
  the integration's ADR decides.

## Never touch production systems

- No command, script, test or seed writes to a payment provider, bank, accounting, shipping,
  POS or e-mail service in its production environment. Use test-mode keys or no key; without a
  key the integration stays switched off.
- A network guard blocks test connections outside localhost.
- Agents never run a deployment, push images or change Jenkins credentials. Deploy stages run only
  from Jenkins on `main` after a merged pull request.
