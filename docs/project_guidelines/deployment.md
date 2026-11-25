<!-- esoul-guidelines:begin deployment -->
# Project guidelines - Deployment

People and agents working on a project do not control deployment. This file is a **reference** for how eSoul applications are built and run, so that the code, the Dockerfile and the pull request fit the scheme. Only people with devops access deploy and change stacks, manifests and servers; what is written here about them is a fact of the scheme, not a task for project developers. Framework files add runtime detail to the sections of this file and MUST NOT contradict it. MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119. **Target.** marks a rule the infrastructure does not yet meet; the gap is named.

## How an application reaches production

- A **change to code or to a stack's configuration** reaches production only through a merged pull request and the project's CI pipeline in Jenkins. Publishing content from a CMS is not such a change: the editor's publish action starts the site's Jenkins job, which builds and deploys the already merged code with the new content, without a pull request (the publish flow in the stack's deployment guideline describes it). Deploying and changing stacks is done by people with devops access, through Jenkins and the manifest, never by hand in Komodo, on the server or with `docker` commands. The one exception is the rollback in an incident, which devops MAY do in Komodo ([Rollback](#environments-and-releases)). Agents never deploy outside Jenkins ([security-and-data.md](security-and-data.md#production-access)).
- A pull request runs the checks and tests (and, where the pipeline has it, a test build of the images); nothing is pushed or deployed.
- **The push build is fixed.** A new stage or check in it (a pipeline option that adds one, a script a pipeline step starts) needs an accepted ADR and a human's approval before it is added; no project, branch or agent batch adds one on its own authority. A check that needs the production database engine runs in the project's scheduled job ([testing.md](testing.md#test-groups)), never in the push build. The test stage stays within the [suite time budget](testing.md#suite-time-budget).
- A branch with a deploy rule builds multi-architecture images and pushes them to the company registry under `<registry>/app-images/`, tagged as the rule says (`latest` for `main`, [Environments and releases](#environments-and-releases)) and with every Git tag on the commit except `latest`, which only `main` pushes.
- A pipeline MAY smoke-test the pushed image before deploying (Jenkins capacity is limited, so it is not the default); where it does, a failed smoke test MUST stop the deploy that the pipeline starts. The image is then already in the registry, so a stack that Komodo redeploys on every new `latest` image is not protected by it (see the **Target.** in [Environments and releases](#environments-and-releases)).
- The deploy redeploys the project's Komodo stack, which pulls the tag and runs the stack's hooks. Which branch deploys to which stack is part of the project's pipeline configuration ([Environments and releases](#environments-and-releases)).
- A static site is released as a new directory and switched by one atomic link (`releases/<id>`, `current`). The previous releases stay on the server, so a rollback re-points the link.

## Stacks and manifests

- Every deployed stack is defined by one manifest, `apps/<client>/<name>.yaml`, in the infrastructure repository. A change to a stack is a change to its manifest.
- Applying a manifest writes the compose file, the Komodo stack definition and the NGINX site. **Applying is not a deploy:** it does not recreate running containers. Starting or updating containers is done only by a Komodo deploy, which Jenkins runs.
- A stack's difference from its shape goes into the manifest (`compose_extra`, `nginx.extra`, `env`) or into the project's own override (`project`). Nobody edits a rendered file or a Komodo setting that the manifest describes; the next apply replaces it.
- A manifest uses one of the shapes it offers (`laravel-fpm`, `lsr-roadrunner`, `node-http`, `static-release`). `custom` is used only when no shape fits, and the project records why.
- A second deployment of an application is a second manifest named `<name>-<environment>`. Stack names and domains are unique across servers.
- **Target.** Stacks still outside manifests are migrated one file at a time; until then their Komodo settings are changed in Komodo and recorded in the migration plan.

## Environments and releases

- A project starts with only the `main` branch, which is deployed during development to a **staging** environment. After the release `main` becomes **production**. A `staging` branch, deployed to the staging stack, MAY be added afterwards; it is project-specific and depends on the client's requirements (some clients do not pay for two deployments). The same lifecycle is in [workflow.md](workflow.md#branches).
- Every environment has its own stack, database, Komodo variables, buckets and secrets. Staging that holds real data is protected like production. A development stack MAY exist; it is not a release environment and holds no production data.
- The pipeline's deploy rules say which branch goes where, for example `main` to the staging stack before the release and to the production stack after it, and `staging` to the staging stack.
- Production runs the image built from `main`, tagged `latest`. Only `main` pushes `latest`; a second deploy branch pushes its own tag (for example `staging`), so a stack that Komodo redeploys on every new `latest` never runs staging code. No release-tag step is required.
- **Rollback.** The pipeline records what runs: after every successful `Deploy` it tags each image of the stack `deployed-<stack>` (the image that runs now) and moves the image that ran before to `previous-<stack>`. A rollback deploys `previous-<stack>` and is the one named exception to "never by hand in Komodo" ([How an application reaches production](#how-an-application-reaches-production)): in an incident, devops (the people with Komodo access) set the stack's `image_tag` to `previous-<stack>` and deploy the stack in Komodo. Afterwards the state is brought back in line: the hotfix issue records the rollback (when, which image, who), and the stack goes back to the manifest's `image_tag` with the next deploy of the fix through Jenkins. An `apply` resets `image_tag` to the manifest value but is not a deploy, so the rolled-back containers keep running until that deploy; until then `latest` still points at the broken image, so nobody redeploys the stack by hand at `latest`. Images pushed by a build whose `Deploy` failed are never `deployed-` or `previous-`, so they are never a rollback target; the tags move only in the pipeline, so a manual rollback leaves them as they were. A stack has the tags from its first deployment after the pipeline began to record them (`jenkins-libraries`, 2026-11-25); before that, the previous release is the image of the Git tag of the previous successful `main` build, or the digest the registry lists for the push before the current one, skipping builds that did not deploy. Do not rerun the old Jenkins build to roll back; it rebuilds the code and moves `latest` again. A static site is rolled back with `rollbackStaticSite`, which re-points `current` to the previous release without a build.
- Migrations run once per deployment, forward-only, and are safe while the previous release still serves requests. Only one container per stack runs them ([The production start entrypoint](#the-production-start-entrypoint) says how they run and what a failure does).
- **Target.** Some stacks are still redeployed by Komodo on every new `latest` image (auto-update); the pipeline deploys them instead once their stacks are managed.

## Monitoring a deployment

- A deployment to a real production environment MUST be monitored by the person who pushed or started it (merged the pull request that deploys, or started the Jenkins job). They stay with it until the new release serves, and check that the application still works in production: the health endpoint and the state of the stack's containers, the feature the change touched, the logs and the error alerts for new errors, and the output of the migrations from the start entrypoint, which is the only signal of a migration that failed ([The production start entrypoint](#the-production-start-entrypoint)).
- They are ready to roll back ([Rollback](#environments-and-releases)) or to ship a hotfix ([Hotfix](workflow.md#hotfix)), and decide which; the incident goes in the hotfix issue. Nobody starts a production deployment and walks away.
- A deployment to staging SHOULD be monitored the same way. It is recommended there, not required.

## The production start entrypoint

The production image starts through a `start` entrypoint, the script the container runs before it hands over to the server (Laravel `docker/production/start`, LSR `docker/startProd.sh`, the Node image's start script). Its stack detail is in the framework's deployment guideline; the rules are these.

- **It SHOULD be quick.** It starts the server (php-fpm, RoadRunner, Node) promptly. A heavy data task (a recalculation, a sync, a data cache warm-up, an import) runs in the background, as a one-shot Supervisor program or a background process (`&`), and never before the server starts. Migrations are the exception: they run before the application starts. Other steps the application needs before it can serve MAY stay in front of the server, for example caching configuration and routes, linking storage, preparing writable directories and the LSR `/prepare-runtime`.
- **Migrations run forward-only and non-destructively** (`php artisan migrate --force`, the LSR `app:install`; never a fresh, reset, rollback or wipe option), only in the container whose switch is on. **A failing migration MUST NOT block the deployment.** The container starts anyway and the entrypoint logs the failure loudly on standard error, naming the step and saying that the schema may be behind the code. The person who monitors the deployment ([Monitoring a deployment](#monitoring-a-deployment)) reads that output and reacts.
- **The start entrypoint MUST NOT run any seeder**: no `db:seed`, `migrate --seed`, install command that seeds, or seed step in a Dockerfile or a Komodo hook. Seeding is a deliberate act of a developer, done by hand in the container's terminal (`docker exec <container> php artisan db:seed --class=ProductionSeeder`, the stack's equivalent), where the output is in front of them.
- **In staging and production only deliberate seeders MAY run, and only by hand.** What matters is that the seeder is deliberate, not general random data to fill the database. The usual ones are the production seeder (the data every environment needs: idempotent, create-only, no account) and demo seeders (deliberate demo content, for example for a staging demo; the framework's deployment guideline gives the detail). The list is not exhaustive: a project MAY define other environments and seeder sets. A deliberate seeder SHOULD NOT depend on Faker: deployed images install no development dependencies, so Faker is usually missing there. It creates no account with credentials outside local development ([security-and-data.md](security-and-data.md#sessions-and-accounts)). A **general** seeder, the `DatabaseSeeder`-style seeding of synthetic development data, is for local development only: it MUST NOT run in staging or production, and it refuses to run there.

## Local development

- Local development runs in Docker. The project's `docker-compose.yml` MUST list every service the application needs: the database engine the application uses in production, a Valkey service when it uses a cache, a search node when it searches, and so on. Nothing the application needs is installed on the developer's host.
- Helper containers belong in the same file: `mailpit` to catch e-mail, and an S3-compatible container (a maintained MinIO image or an alternative) in place of object storage. Deployed applications use the company's Scaleway Object Storage, never a self-hosted object store.
- A web server container (NGINX) is allowed locally. It is not part of a deployed stack ([Reverse proxy and TLS](#reverse-proxy-and-tls)).
- The ports of support services MAY be bound to `127.0.0.1`; it is not required.
- Local credentials come from `.env`, copied from `.env.example`. Tests never use the development database ([testing.md](testing.md)).

## Shared services

The servers run a few shared services, each applied from the infrastructure repository. An application uses them through its manifest and never adds a server of the same kind to its own stack.

### Database

- Application data is kept in a shared database server of the host. **MariaDB is the default.** **PostgreSQL** is for applications whose framework or libraries require it. A new application that needs PostgreSQL gets a login and a database on the shared server. Applications reach the server at `host.docker.internal`.
- Each application has its own database and its own login, declared in its manifest. A login owns only its database and never receives a superuser password.
- The password of a login is generated and kept in 1Password (vault `DevOps`, category Database); the stack receives it through a Komodo variable. It is never in a manifest, a rendered file or the repository.
- Schema changes go through migrations ([Environments and releases](#environments-and-releases)); no manual SQL in any real environment ([security-and-data.md](security-and-data.md#production-access)).
- **Target.** Several stacks still run their own PostgreSQL container; migrating them to the shared server is open.

### Cache

- A Redis-compatible cache is a Valkey service in the application's own stack (`valkey: {profile: cache}` or `{profile: kept}`), reachable only from that stack. No Redis-compatible server is shared between applications.
- `cache` holds caches and locks and MAY be emptied by a restart. `kept` holds sessions and queues and writes to disk. Code MUST NOT assume that a `cache` profile survives a restart.
- The application reads its host from `REDIS_HOST=valkey` (the `redis` alias also resolves).
- **Target.** Some stacks still use a KeyDB server (shared on the host, or a sidecar) and move to Valkey with their manifests.

### Search

- Full-text search uses the shared Elasticsearch node, and only when the application needs it. Each application has a user that can reach only the indices starting with its prefix.
- Indices MUST be rebuildable from the application's own database. An index that cannot be rebuilt does not go into the shared node.
- A different search engine needs an ADR first.

### Object storage

- Deployed applications store files in Scaleway Object Storage (S3 API, region `fr-par`). Buckets are per application and environment, named `esoul-<app>-<env>-<purpose>`.
- Public and private files use separate buckets. A private file is never served from a public bucket.
- The storage key is limited to Object Storage and kept in Komodo.
- **Target.** Buckets are created by hand before the first deploy and are not yet part of the backup.

## Reverse proxy and TLS

- Public traffic enters through the load balancer, which ends TLS and speaks HTTP to the host NGINX. NGINX runs only on the host; a deployed stack contains no web server container, and the application image contains no web server.
- Every PHP application, RoadRunner included, is reached from NGINX through FastCGI. Plain HTTP is proxied only in specific cases (some JavaScript-based projects, certain RoadRunner cases), and the manifest says so.
- Every public name of an application is listed in its manifest (`domains`, `redirects`) and resolves to the load balancer. The apply issues the certificates on the load balancer.
- The application trusts forwarded headers only from the proxy's addresses, never from `*`. The proxy sets the host, the scheme and the client address itself (as FastCGI parameters or `X-Forwarded-*` headers) and drops what a client sent.
- Production sites redirect plain HTTP to HTTPS and send HSTS.
- Metrics and status ports (RoadRunner's `2112` and `2114`, and the like) are never routed. Application admin interfaces are application routes behind authentication. The application's health endpoint ([Health endpoint](#health-endpoint)) is the one service endpoint that MAY be public.

## Health endpoint

- An application served from a container exposes `GET /up`: `200` when it is ready and `503` when it is not. It does not depend on the session or on CSRF protection. The endpoint reveals only whether the application is up, so it MAY be public; the external check uses it.
- The image has a Docker `HEALTHCHECK` that requests it from inside the container. A crashed process is restarted by the container's supervisor; the healthcheck reports one that stays down.

## Configuration and secrets

- Plain settings are `env` in the manifest. Secrets are listed under `secrets` and become Komodo variables named `<STACK>_<NAME>`. Values MUST NOT appear in manifests, rendered files, Git or Komodo exports.
- Secrets have one home each: Komodo variables for a stack, 1Password for database logins and service accounts, the Ansible vault only for host-level secrets. A secret shared by several stacks is one Komodo variable that each stack references.
- **A new configuration variable:** the developer adds it to `.env.example` with a placeholder and names it in the pull request's deploy notes ([workflow.md](workflow.md#pull-requests)); devops add it to the manifest or to Komodo before the deploy.
- Secrets never go into build arguments, image layers or logs.
- Files on the server that hold secrets are readable only by root and by the container user. **Target.** Several `.env` files are currently readable by everyone.

## Observability

- Every application exports traces, logs and metrics over OpenTelemetry OTLP to the host collector (gRPC on `host.docker.internal:4317`), with the standard `OTEL_*` variables.
- Logs go to standard output and error. A log line names records by id and carries no personal data, amounts or file content ([security-and-data.md](security-and-data.md#personal-and-client-data)).
- Every production stack has an alert when its health check fails. **Target.** Coverage is not verified per stack.

## Backups

- The infrastructure backs up every application database and the application directories daily, away from the production host. Restores are tested.
- Data that must survive a container lives in the stack's run directory (a bind mount) or in a shared service, never only in a Docker volume ([Networks and access](#networks-and-access)).
- **Target.** Object-storage buckets are included in the backup; restore tests cover application directories and PostgreSQL.

## Networks and access

- Containers deployed by Komodo publish **no ports**. The containers of a stack talk on the stack's own network; shared containers (the search node, …) are on the server's shared network (`apps`).
- The host NGINX proxies to a container directly by name: the `hoster` service writes the containers' addresses and aliases into `/etc/hosts`. Docker-published ports bypass the host firewall, which is why none are published.
- Persistent state is a **bind mount** under the stack's run directory, `/data/apps/<client>/<app>`, and is covered by the backups. A named Docker volume is only for disposable data (caches, build output), which no restore depends on.
- Server access is by SSH key, from allowed addresses or over the tailnet. The tailnet access policy is kept in the infrastructure repository. **Target.** It is not yet applied.

## What not to introduce

- Laravel Cloud, Laravel Forge, Vapor or any hosted platform for production. Sail is not a production deployment.
- A Redis or KeyDB server shared between applications. A Redis-compatible store is a Valkey service in the application's own stack.
- A self-hosted object store in a deployed stack. Use Scaleway Object Storage through the S3 API; for local development any S3-compatible dev container is fine.
- A database server or a search engine owned by one application.
- A second reverse proxy (Traefik, Caddy) in front of or beside the host NGINX, without an ADR.
- A web server container in a deployed stack. (Locally it is allowed.)
- Hand edits in Komodo, on the server or in rendered files that the manifest manages. The only exception is the incident rollback ([Rollback](#environments-and-releases)).
- `docker system prune`, `docker volume prune`, `docker image prune -a` or `docker container prune` on a server: they remove data of stopped stacks.
- Production secrets or `.env` files with real values in Git, tickets, pull requests, logs or chat.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end deployment -->
