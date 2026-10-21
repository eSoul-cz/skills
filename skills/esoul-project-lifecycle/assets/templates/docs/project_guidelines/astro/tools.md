# Project guidelines - Tools

| Area | Tool | Version / source |
|---|---|---|
| Runtime | Node.js | {{NODE_VERSION}} (`engines` in `package.json`) |
| Package manager | pnpm | `packageManager` in `package.json` |
| Framework | Astro | {{ASTRO_VERSION}} |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` | [frontend.md](frontend.md) |
| Islands | {{ISLAND_FRAMEWORK}} | [architecture.md](architecture.md#islands) |
| Type checks | `astro check`, `tsc --noEmit` | `tsconfig.json` |
| Lint and format | ESLint, Prettier (with the Astro plugin) | `eslint.config.mjs`, `prettier.config.mjs` |
| Browser tests | Playwright | `playwright.config.ts`, `e2e/` |
| Audits | Lighthouse, axe | `scripts/` or `e2e/` |
| Delivery | Docker or static rsync, Jenkins, Komodo | [deployment.md](deployment.md) |

`package.json` and `pnpm-lock.yaml` are authoritative for versions. Use the Astro documentation
for the installed major (the Astro Docs MCP when available) and check the installed source
before concluding that a feature does not exist.

## Running Astro

- Run the CLI through pnpm: **`pnpm astro …`, never `npx`** (and no `npx` for any other CLI the
  project installs).
- Start the dev server with `pnpm dev`; an agent runs it in the background and stops it when
  done.
- Zod comes from `astro/zod`. Invalid HTML is a compile error; close every non-void element.

## pnpm hardening

`pnpm-workspace.yaml` hardens installs; never remove these settings:

- `minimumReleaseAge: 1440` — new versions install only once they are a day old. Exempt a newer
  version only when it is needed (a security fix), in `minimumReleaseAgeExclude`, with a comment.
- `trustPolicy: no-downgrade` — an install fails when a version has weaker trust signals than
  earlier ones. Exempt only exact, verified versions in `trustPolicyExclude`, with a comment.
- Build scripts run only for packages listed in `allowBuilds`.
- `engine-strict` keeps everyone on the Node version CI uses.

Adding a dependency needs the maintainer's approval. When a maintained library that works with
Astro solves the problem, use it instead of writing our own.

## Local checks

```bash
pnpm check          # astro check + tsc --noEmit
pnpm lint           # ESLint
pnpm format:check   # Prettier, read-only
pnpm build          # astro build, plus any post-build verification
pnpm test:e2e       # Playwright smoke and SEO specs at 1440 and 390 px
```

Run them before every push; Jenkins runs the same commands. `pnpm format` and `pnpm lint --fix`
rewrite files; run them deliberately and review the diff.

## Jenkins `Checks` stage

The `Jenkinsfile` has a **`Checks` stage that is mandatory** and runs before any image is built
or any file is deployed. It fails the build when any step fails:

1. `pnpm check` — `astro check` and `tsc --noEmit`;
2. `pnpm lint` and `pnpm format:check`;
3. `pnpm build`;
4. **Playwright smoke** of every route at **1440×900 and 390×844**, against the built site
   (`pnpm preview` or the built image), failing on any console error, failed request or broken
   image;
5. **SEO spec**: every indexable route has a title and description within limits, one `h1`, a
   canonical URL, Open Graph tags and an image; the sitemap lists exactly the indexable routes;
   `robots.txt` and `llms.txt` exist ([seo.md](seo.md)).

<!-- optional: Checks stage not wired yet -->
**Target.** The `Checks` stage runs in Jenkins. The code does not do this yet:
{{CHECKS_GAP}} ({{CHECKS_ISSUE}}).

## Playwright

- Specs live in `e2e/*.spec.ts` and import `test` and `expect` from `e2e/fixtures.ts`, which fails
  any test that logs a console error. A test that causes one on purpose lists it explicitly.
- Two projects match the design frames: `desktop` (1440×900) and `mobile` (390×844, touch), with
  locale `cs-CZ` and time zone `Europe/Prague`.
- Wait for islands to hydrate before interacting with them.
- A test that changes content is tagged `@writes` and never runs against a deployed environment;
  `BASE_URL` points the read-only tests at a running deployment.

## Lighthouse and accessibility

Recommended on every pull request that changes layout, images, fonts or scripts, and **mandatory
before launch** (`launch` mode, `docs/nasazeni.md`):

| Metric (mobile, production build) | Budget |
|---|---|
| Performance | ≥ 90 |
| Accessibility, Best practices, SEO | 100 |
| Largest Contentful Paint | < 2.5 s |
| Cumulative Layout Shift | < 0.05 |

- axe reports no violations on any route at both widths.
- While basic auth and `noindex` protect the preview, the SEO score is lower by design; measure it
  again after they are switched off.
- Record the measured results with the date in `README.md`, *Naměřeno*.

<!-- optional: archetype B-admin with a React admin -->
## Admin checks

`pnpm react-doctor --scope changed` runs after React changes in the admin. Admin end-to-end tests
log in once in a setup project and never log out the shared session.
