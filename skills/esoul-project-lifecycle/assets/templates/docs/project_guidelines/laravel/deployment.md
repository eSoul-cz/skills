# Project guidelines - Deployment and runtime

The application runs only in eSoul's Docker images: Jenkins builds and tests them, the Scaleway
registry stores them, Komodo deploys them. Laravel Cloud, Forge and Sail-based deployments are
not used; ignore generic Laravel guidance that suggests them. The decision is
{{DEPLOYMENT_ADR}}.

## Images

- Every image starts from the shared eSoul base image
  `rg.fr-par.scw.cloud/esoul-starters/php-fpm-laravel:{{PHP_VERSION}}`, which already provides
  the common PHP extensions. A missing extension is added to the base image, not installed ad hoc
  in a project Dockerfile.
- One multi-stage `docker/production/Dockerfile` builds the release images; `docker/dev/Dockerfile`
  builds the development image.

| Image | Runs | Never runs |
|---|---|---|
| `{{APP_IMAGE}}` | PHP-FPM behind nginx, the scheduler, optionally a queue worker, under Supervisor | — |

<!-- optional: separate worker image -->
A second target builds `{{APP_IMAGE}}-worker`, which runs only queue workers and never PHP-FPM,
the scheduler or migrations ({{TOPOLOGY_ADR}}).

- Environment variables decide what runs in a container (`RUN_MIGRATIONS`, `RUN_SCHEDULER`,
  `RUN_QUEUE_WORKER`). Exactly one container in a stack runs the scheduler.
- Every process logs to the container's output, so `docker logs` and Komodo show it. A log line
  names records by id and carries no personal data or amounts.
- Each image has a Docker `HEALTHCHECK`; Supervisor restarts a crashed process, the healthcheck
  reports one that stays down. An external check calls `/up` and alerts eSoul.
- The application trusts only the proxy in front of it and is reachable only through it. The
  proxy sets `Host` and the `X-Forwarded-*` headers itself and drops values a client sent.
- Large design and source material (`docs/design_pencil/`, `docs/podklady/`, `assets/`) is in Git
  LFS and outside the Docker build context (`.dockerignore`); the pipeline sets
  `GIT_LFS_SKIP_SMUDGE=1`.

## Local development stack

Local development always runs in Docker; running the application on the host (`artisan serve`,
Sail, a host database) is not supported. `docker-compose.yml` starts:

| Service | Purpose |
|---|---|
| `laravel` | PHP-FPM, queue worker, scheduler and Vite under Supervisor; the repository is bind-mounted |
| `nginx` | Serves the application on `${APP_PORT:-80}` |
| `{{DATABASE_SERVICE}}` | {{DATABASE}}, named volume, health-checked |
| `mailpit` | Catches all outgoing e-mail; UI on localhost only |

<!-- optional: further local services -->
The stack also runs {{EXTRA_SERVICES}}.

Every published port of a support service binds to `127.0.0.1`. Credentials come from `.env`,
copied from `.env.example`. Tests never use the development database.

## Pipeline

The `Jenkinsfile` uses eSoul's shared Jenkins libraries
(`@Library(['dockerHelpers', 'testing', 'deploy'])`) and reports the required `Jenkins` check on
every branch and pull request.

1. **Testing**, for every branch and pull request:
   - **Prepare** — `composer install`, an `.env` from `.env.example` with a fresh key,
     `php artisan wayfinder:generate`;
   - **PHP tests** — the shared `fullPhpTest` step: PHPStan, `pint --test`,
     `php artisan test --parallel`;
   - **Dependency audit** — `composer audit --locked` and `pnpm audit --audit-level critical`;
     the build fails on critical advisories;
   - **JS tests** — the shared `fullNodeTest` step: install, ESLint, Prettier check, TypeScript,
     Vitest, the structure scripts and their own tests, the production build;
   - **Test Docker build** — on pull requests, a no-cache build of every release image.
2. **Build and push**, on `main`: multi-architecture images tagged `latest` and with any Git tag
   on the commit, pushed to `rg.fr-par.scw.cloud/app-images/`.
3. **Deploy** — the Komodo stack `{{KOMODO_STACK}}` is redeployed. `SKIP_DEPLOY = 'true'` keeps
   the stage off until the stack exists.
4. **Always** — throwaway test containers and the workspace are cleaned up.

Mutation testing does not run in CI; it is a local soft gate ([testing.md](testing.md)). Keep the
stage names stable: the required check is the multibranch job's `Jenkins` status.

Jenkins is shared by every eSoul project, so build time matters:

- `options { disableConcurrentBuilds(abortPrevious: true) }` aborts a running build when a newer
  revision of the same branch or pull request arrives.
- Push a coherent unit, and push review fixes together once they pass locally; every push starts
  a full build.
- When the multibranch job discovers both branches and pull requests, a commit with an open pull
  request is built twice and both builds write the same `Jenkins` check. Building each commit once
  is a job setting (*Discover branches*: exclude branches that are also filed as pull requests).
  Do not skip stages in one of the two jobs instead: the one that finishes last decides the
  required check.
- Integration tests follow [testing.md](testing.md#keeping-the-integration-run-short).

## Environments

- **Staging is built from `main`.** Every merge to `main` that passes the pipeline is deployed to
  the staging stack as `latest`. Staging ({{STAGING_URL}}) is where a Freelo task in `Testing`
  is accepted. There is no `staging` branch.
- **Production is deployed from a release tag on `main`**: the image carrying that tag is
  deployed deliberately, after the same commit was accepted on staging. Production
  ({{PRODUCTION_URL}}) never runs `latest`.
- Each environment has its own stack, database, buckets, `APP_KEY` and OAuth redirects. Staging
  that holds real data is protected like production.

<!-- optional: single environment during development -->
**Target.** Staging deploys from `main` and production from a release tag. The code does not do
this yet: the `Jenkinsfile` deploys `main` to the single stack `{{KOMODO_STACK}}`; the second
stack and the tag-based deploy arrive with the environments ({{DEPLOYMENT_ISSUE}}).

## Migrations and seeders

- Migrations run once per deployment in the entrypoint of the container with
  `RUN_MIGRATIONS=true`; worker containers never migrate. They are forward-only and safe to run
  while the previous release still serves requests ([architecture.md](architecture.md)).
- A production deployment that contains a migration is preceded by an on-demand database backup
  and has already run on staging; the deployer reads the migration output in the log.
- The production seeder creates only what every environment needs. Every seeder it calls is
  idempotent and create-only: it never overwrites rows staff may have changed. Local-only data
  belongs in a demo seeder.
- Data corrections ship as migrations or as console commands that dispatch commands, never as
  manual SQL ([security-and-data.md](security-and-data.md#production-access)).

## Backups, configuration and secrets

- Backups are taken by the infrastructure, outside the application: daily, of the production
  database and buckets, stored away from the production host. A restore is rehearsed on staging
  before go-live.
- Environment variables and credentials of staging and production are managed in Komodo and
  1Password, never in the repository. `.env.example` holds only local defaults.
- A variable left out of a stack falls back to the image's default, so the stack sets at least
  `APP_ENV`, `APP_DEBUG=false`, `APP_KEY`, `APP_URL`, the database, mail and storage settings and
  `SESSION_SECURE_COOKIE=true`. The application clock (`app.timezone`) stays UTC.
- Hosts and the production web server configuration are prepared by eSoul with the stacks.
  Agents never deploy, push images or change Jenkins credentials.
