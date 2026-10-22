# Project guidelines - Deployment and runtime

Every merge to `main` goes through Jenkins: the `Checks` stage ([tools.md](tools.md)), then the
build and the deploy. Agents never deploy, push images or change Jenkins credentials. The
hosting decision is {{HOSTING_DECISION}}.

## Delivery paths

<!-- optional: Docker image deployed by Komodo (archetypes A-static with a PHP API, B-admin) -->
### Docker image → Jenkins → Scaleway → Komodo

```text
push to main
  └─ Jenkins
       ├─ Checks stage
       ├─ dockerBuildMultiArch → rg.fr-par.scw.cloud/app-images/{{APP_IMAGE}}:latest (+ Git tags)
       └─ deployKomodoStack    → stack {{KOMODO_STACK}}
```

- The `Dockerfile` is multi-stage. The build stage runs `pnpm install --frozen-lockfile` and
  `pnpm build` (it needs network: the Fonts API downloads fonts). The runtime stage holds only
  what runs: the built site and, where it exists, the server code or the PHP API with its
  production dependencies.
- `.dockerignore` keeps host `node_modules`, `.env`, runtime data, `docs/`, `assets/` and tests
  out of the build context. Native modules are installed inside the build, for the target
  platform.
- The container runs as an unprivileged user under an init process; an entrypoint MAY start as
  root only to hand persistent directories to that user.
- A static site served by a separate nginx container is copied into a shared volume on **every**
  start, so a new image never leaves the old site in the volume.
- Migrations, seeds and settings validation run before the server listens; a failure exits the
  container instead of serving errors. The server stops gracefully on `SIGTERM`.
- Every image has a healthcheck. Persistent state (database, uploads, form backups, logs) lives in
  named volumes listed in `README.md`, with the backup and restore procedure.

<!-- optional: static build rsynced to a server (archetype C-headless) -->
### Static build → Jenkins → rsync

A push to `main`, or the publish button in the backend, starts the Jenkins job: install, the
`Checks` stage, `pnpm build`, a verification of the built output, then `rsync` of `dist/` to
`{{DEPLOY_PATH}}` on the server. A failed build leaves the previous version live. HTML is served
`no-cache`; hashed assets (`/_astro/*` and the media path) get a long cache.

## Build arguments

A static build bakes public values in at build time, so they are passed as `PUBLIC_*` build
arguments from the `Jenkinsfile`, never read from a runtime `.env`:

| Build argument | Source | Meaning |
|---|---|---|
| `PUBLIC_SITE_URL` | `Jenkinsfile` | Canonical origin |
| `PUBLIC_NOINDEX` | `Jenkinsfile` | `true` while the preview is protected |
| `PUBLIC_{{PUBLIC_VAR}}` | {{PUBLIC_VAR_SOURCE}} | {{PUBLIC_VAR_MEANING}} |

- An empty analytics or consent id means the script is not included at all.
- Secrets (SMTP, database, captcha secret, API tokens) are **never** build arguments and never
  baked into an image. The container receives them at runtime from the Komodo stack; Jenkins
  reads its own credentials only through `withCredentials`.
- `.env.example` lists every runtime variable with a placeholder.

## Preview protection

Until launch, the deployed site is a protected preview:

- **HTTP basic auth** in the web server, with a throwaway password kept in the repository on
  purpose. It is a barrier against accidental visitors, not a secret. `robots.txt` stays
  reachable without auth.
- **`noindex`**: `PUBLIC_NOINDEX=true` puts `noindex` on every page and `robots.txt` disallows
  everything.
- The preview URL is {{STAGING_URL}}.

Switching protection off is a launch step in `docs/nasazeni.md`: remove basic auth, set
`PUBLIC_NOINDEX=false`, allow crawling in `robots.txt`, deploy, then verify headers, sitemap and
indexability. Nothing else changes in the same deploy.

## Reverse proxy and headers

- TLS ends at the reverse proxy; the site is HTTPS-only with HSTS, and `www` and non-`www`
  redirect to the canonical host.
- The proxy sends `X-Forwarded-Host`, `X-Forwarded-Proto: https` and an `X-Forwarded-For` that it
  **replaces**, not appends; an SSR site trusts forwarded headers only for its own domains
  (`security.allowedDomains`). Rate limits depend on the client address being right.
- Security headers (CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `frame-ancestors 'none'`) are set on every response, static files included. In nginx, a
  `location` with its own `add_header` repeats the shared header snippet, because nginx drops
  inherited headers.

## Forms in production

- The form's captcha keys are registered for the production domain, SMTP is configured from the
  stack, and a test submission is sent and received after every launch-relevant deploy.
- Stored submissions contain personal data: they are deleted when their purpose ends, at the
  latest after the retention period recorded in `docs/rozhodnuti.md`.
