# Project guidelines - Tools

The repository is a pnpm workspace (`apps/*`, `packages/*`). Versions come from the `package.json`
files, the lockfile, `docker-compose.yml` and the `Jenkinsfile`; when they change, update this
table in the same pull request.

## Versions

| Area | Tool | Version and source |
|---|---|---|
| Runtime | Node.js | {{NODE_VERSION}} in CI and locally; `engines` + `engine-strict` in `.npmrc` stop other versions |
| Package manager | pnpm | `packageManager` in the root `package.json`; Jenkins calls `corepack pnpm` |
| Language | TypeScript | `strict` in every package |
| Commerce core | Medusa | `@medusajs/*` pinned to {{MEDUSA_VERSION}} |
| Admin | React, `@medusajs/ui` | the versions `@medusajs/dashboard` uses, pinned exactly ([admin.md](admin.md)) |
| Storefront | Nuxt, Vue, Pinia, Tailwind CSS 4 | {{NUXT_VERSION}} ([frontend.md](frontend.md)) |
| Lint and format | ESLint, typescript-eslint, `@nuxt/eslint`, Prettier, project rules `{{ESLINT_PLUGIN}}` | root `eslint.config.mjs`, `tooling/eslint-rules/` |
| Type checks | `tsc --noEmit`, `nuxt typecheck` (`vue-tsc`) | per package |
| Tests | Jest (backend), Vitest (storefront, packages), Playwright (E2E), `node:test` (tooling) | [testing.md](testing.md) |
| Mutation testing | StrykerJS | `stryker.config.mjs` per app, `tooling/stryker/` |
| Dependency updates | Dependabot | `.github/dependabot.yml`: Medusa packages grouped, no majors of Medusa, Nuxt, Vue |

Use documentation that matches these majors, even when a skill links to another version. Adding
a dependency needs the maintainer's approval. The admin's React-related packages stay on the
versions Medusa uses; Dependabot ignores their version updates and they are aligned by hand after
a Medusa update.

## Root scripts

| Script | What it does |
|---|---|
| `pnpm infra:up` / `infra:down` / `infra:reset` | Starts, stops, or wipes and restarts the local infrastructure |
| `pnpm dev`, `dev:backend`, `dev:storefront` | Runs Medusa and Nuxt on the host |
| `pnpm lint` / `lint:fix` / `lint:prune` | ESLint; `lint:prune` removes suppressions whose violation is fixed |
| `pnpm format:check` / `format:fix` | Prettier |
| `pnpm structure` | `scripts/structure-check.mjs`: module shape, test names, file and directory naming |
| `pnpm skills:check` | `scripts/skills-lock-check.mjs`: vendored skills match `skills-lock.json` |
| `pnpm typecheck` | Type checks in every package |
| `pnpm test` | Unit tests in every package; no infrastructure needed |
| `pnpm test:tooling` | `node --test` over the lint rules and the scripts |
| `pnpm test:integration` | Backend module and HTTP integration tests; needs `pnpm test:db:up` |
| `pnpm test:e2e` | Prepares E2E data and runs Playwright; needs the infrastructure |
| `pnpm mutation` / `mutation:full` | Stryker on changed lines / on all production code, locally only |
| `pnpm check` | All local read-only checks in order, with a PASS/FAIL summary |

## Read-only verification

Before each commit run:

```bash
pnpm check
```

It runs `lint`, `format:check`, `structure`, `skills:check`, `typecheck`, `test:unit` and
`test:tooling`, does not stop at the first failure, and exits non-zero if any step failed. Every
step only reads. Integration tests, E2E tests, the audit and the build are required when the
checks table in [CONTRIBUTING.md](../../CONTRIBUTING.md) says so. For a quick loop in one package,
`pnpm --filter <package> typecheck` and `test` are enough while you work; they do not replace
`pnpm check`.

### Lint and the suppression ratchet

- One ESLint run covers the whole repository. The project's own rules live in
  `tooling/eslint-rules/` (`module-boundaries`, money formatting, raw colours, default palette,
  Vue contract rules). A new rule or a changed boundary gets a test that runs it through a real
  ESLint instance.
- Existing violations are recorded in `eslint-suppressions.json`, never in `eslint-disable`
  comments. **New code MUST NOT add either.** The file only shrinks: fixing a suppressed
  violation is followed by `pnpm lint:prune`, and each remaining suppression group names its gap
  issue in [AGENTS.md](../../AGENTS.md).

### Formatting

Prettier formats code, JSON, YAML and CSS with its defaults. Markdown is excluded and hand-wrapped
at 100 characters ([documentation.md](documentation.md)); generated migrations and lockfiles are
excluded too.

### Structure check

`pnpm structure` reports each violation with its rule name and a fix hint: module directory,
`*_MODULE` export, service and migrations; test file names that their runner picks up (a wrongly
named test would never run); naming of directories, files, pages, components and composables.

### Skills lock

`pnpm skills:check` recomputes the hash of every skill in `.agents/skills/` and compares it with
`skills-lock.json`. It fails when a vendored skill was edited by hand, when a skill is neither
locked nor marked as a project skill, and when `.claude/skills/<name>` is not a symlink to
`.agents/skills/<name>`.

## Mutation testing

StrykerJS mutates production code and runs the covering tests
([testing.md](testing.md#mutation-testing)). It runs locally only, never in Jenkins, and never
fails on a score.

```bash
pnpm mutation                            # lines changed against origin/main, every app
pnpm mutation -- --base <parent-branch>  # stacked branch
pnpm mutation -- --app backend           # one app
pnpm mutation:full -- --app storefront   # all production code of one app (baseline)
```

- `scripts/mutation.mjs` diffs the working tree against the merge base and runs Stryker on those
  line ranges of production files (defined once in `tooling/stryker/`).
- Ignorers skip mutants that can only change error wording and Vue compiler macros; types, codes,
  statuses and conditions stay mutated.
- Reports are in `tmp/mutation/<app>/`.

## Fixes that rewrite files

```bash
pnpm lint:fix
pnpm format:fix
pnpm lint:prune
```

Run them deliberately, review the diff, then run `pnpm check` again. CI uses only read-only
commands. ESLint and Prettier caches live in the gitignored `tmp/` directory.

## Local runtime

The applications run on the host; only the infrastructure runs in Docker
([deployment.md](deployment.md)). Use the Node version CI uses.
