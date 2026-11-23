<!-- esoul-guidelines:begin dependencies -->
# Project guidelines - Dependencies

How a project's packages are installed and kept safe. New dependencies need a maintainer's approval ([workflow.md](workflow.md#repository-rules)); when a maintained library that fits the framework solves the problem, use it instead of writing our own. MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

## pnpm repositories

Every repository with a `package.json` uses pnpm, pinned by `packageManager`, with `pnpm-lock.yaml` committed; `npm` and `yarn` are never run in it.

- Current Node releases ship without corepack: install the pinned version with `npm install --global pnpm@<version>`.
- pnpm reads only auth, registry, TLS (`ca`, `cafile`, `cert`, `key`), proxy and `local-address` settings from `.npmrc`. Every other project setting lives in `pnpm-workspace.yaml`, and machine-level settings (such as `stateDir`) live in the global pnpm `config.yaml`.
- `pnpm install --frozen-lockfile` is what CI and the image build run; a lockfile that needs changing fails the build.

### Install hardening

`pnpm-workspace.yaml` hardens installs. These settings MUST NOT be removed:

- `minimumReleaseAge: 1440` (minutes): a new version installs only once it is a day old, so a hijacked release is usually withdrawn before it reaches the project. A newer version is exempted only when it is needed (a security fix), in `minimumReleaseAgeExclude`, with a comment that names the reason.
- **Build scripts run only for allow-listed packages.** `allowBuilds` in `pnpm-workspace.yaml` lists them; it needs pnpm 10.26 or newer, so the pinned `packageManager` MUST be at least that (an older pnpm ignores the setting and runs dependency install scripts without the allow-list). A package that is missing from the list, such as `esbuild`, can have its build script skipped silently, or fails the install with `ERR_PNPM_IGNORED_BUILDS` until it is listed (`pnpm approve-builds`).
- `pnpm audit` runs in CI. An advisory that cannot be fixed yet is ignored in `auditConfig.ignoreGhsas` of `pnpm-workspace.yaml`, one entry per advisory, with a comment that states the reason and the date it is reviewed again. An entry without both is not accepted in review.

**Target.** The Laravel and LSR templates do not meet this yet. The Laravel pipeline runs `pnpm audit --audit-level critical` and fails only on critical advisories, the LSR pipeline runs no `pnpm audit`, and neither template has the `pnpm-workspace.yaml` settings above. They adopt them as one change; until then those two pipelines follow their own framework file.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end dependencies -->
