# Stack profile: Astro

Websites and small sites with a client admin. Generalized from `komfort-servis`, `petr_moravec`,
`eSoul_website`, `drvotova_farma` and `cap-teamwear-fe`. The example repositories are
illustrations only: none of them yet runs the required CI gates, so copy structure, not pipelines.

## When this profile applies

`astro.config.*` and `astro` in `package.json`. Pick the archetype first and record it in
`CONTEXT.md › ## Project profile` (`Archetype:`) and in `docs/rozhodnuti.md` (or an ADR):

| Archetype | Examples | Shape | Usual tier |
|---|---|---|---|
| `A-static` | `eSoul_website`, `drvotova_farma` | Static output, no islands; content in content collections or `src/data/*.ts`, edited through git; PHP Slim `api/` for the contact form (honeypot, rate limit, reCAPTCHA, SMTP + DB fallback) | `light` |
| `B-admin` | `komfort-servis` → `petr_moravec` | SSR with `@astrojs/node`; React islands only in the admin; Effect + SQLite; Astro Actions that work without JS; registry of editable sections; migrations and run-once seeds | `light`, escalate when the admin gains domain logic |
| `C-headless` | `cap-teamwear-fe` + `cap-teamwear-be` | Static Astro (+ Vue islands) built from a Laravel/Filament export validated by a Zod contract; "publish" button in the admin triggers Jenkins; umbrella repo with submodules, `GLOSSARY-MAP.md` (older repos: `CONTEXT-MAP.md`), system ADRs | `light` for the site, the backend by its own profile |

## Bootstrap specifics

On top of the common root templates and the light-tier docs (`assets/templates/light/docs/`):

1. Astro 7, Tailwind 4 with all tokens in one `@theme inline` block mirroring the Pencil
   `DS – Foundations` variables (same names, rem not px), Fonts API with `latin-ext`,
   `astro:assets` (AVIF/WebP), `@astrojs/sitemap`.
2. pnpm with `packageManager` pinned and supply-chain hardening in `pnpm-workspace.yaml`:
   `minimumReleaseAge: 1440`, `trustPolicy: no-downgrade` (exceptions only as exact versions with
   a comment). Run tools through `pnpm astro …` / `pnpm exec`, never `npx`.
3. Scripts: `check` (`astro check && tsc --noEmit`), `lint`, `format:check`, `build`,
   `test:e2e` (Playwright), optionally `test:lighthouse`, `test:axe`.
4. Playwright config with projects `desktop` (1440×900) and `mobile` (390×844, touch), locale
   `cs-CZ`, timezone `Europe/Prague`; `e2e/fixtures.ts` fails any test that logs a console error
   and hides the Astro dev toolbar; `BASE_URL` runs read-only specs against a deployment.
5. Pre-launch protection: `PUBLIC_NOINDEX=true` build arg and HTTP basic auth in the web server
   until launch (`drvotova_farma` `docker/nginx.conf` pattern).
6. `Dockerfile` (+ `nginx.conf` for A/C, Node runtime with `tini` for B), `Jenkinsfile` on the
   shared libraries; for C, `disableConcurrentBuilds()` and a callback to the admin.
7. Agent context:
   - Vendored skills in `.agents/skills/` (or `.claude/skills/`) pinned in `skills-lock.json`,
     added with `LC_ALL=en_US.UTF-8 npx skills@1.7.2 add <owner/repo> --skill <name> --agent
     claude-code codex -y`. Seen: `astro` (`astrolicious/agent-skills`), `effect-ts`
     (`Effect-TS/skills`), `playwright-best-practices`. Project-adapted copies are not in the lock
     and must say so in `AGENTS.md`/`CLAUDE.md`.
   - MCP: `astro-docs` (`https://mcp.docs.astro.build/mcp`), Pencil for `.pen` (never read the
     file directly), `motion` when Motion is used, `codegraph` when indexed.
8. Design pipeline: Pencil `.pen` and client files in LFS; mockup bundle in
   `docs/design_pencil/mockup/` outside LFS, published through `esoul-mockup-authoring`.

## Guideline templates to copy

Copy into `docs/project_guidelines/` (light tier may keep them as one `AGENTS.md` section until
the site grows):

- `assets/templates/docs/project_guidelines/common/`: `index.md`, `code-review.md`, `testing.md`,
  `documentation.md`, `domain.md` (only for B with an admin domain), `security-and-data.md`.
- `assets/templates/docs/project_guidelines/astro/`: `architecture.md` (archetype, render mode,
  islands), `content.md` (collections, editable sections, no hard-coded text in components),
  `frontend.md` (tokens only, lightest `client:*`, content without JS, Pencil node → component
  map), `seo.md`, `tools.md`, `deployment.md`.

## Quality gates

What the example repos run today:

- `komfort-servis`: `pnpm check` = `astro check && tsc --noEmit`; `pnpm build` =
  `astro check && astro build`; `pnpm test:e2e` = `playwright test` (desktop + mobile, console
  errors fail) — all **local**; Jenkins only builds the image and deploys.
- `petr_moravec`: design and content repository so far; implementation will take the
  `komfort-servis` template (B), so it inherits the same gates.
- `eSoul_website`, `drvotova_farma`, `cap-teamwear-fe`: `astro build` (+ `format:check` in
  `cap-teamwear-fe`) only; no checks on PRs.

Required target (company rule for Astro checks). Jenkins stage `Checks` runs on every PR and on `main` before deploy;
status check `Jenkins` is required:

| Step | Command (adapt names, keep the content) | CI |
|---|---|---|
| Install | `corepack pnpm install --frozen-lockfile` | required |
| Types | `pnpm astro check && pnpm exec tsc --noEmit` | required |
| Lint, format | `pnpm lint` (ESLint), `pnpm format:check` (Prettier with `prettier-plugin-astro`) | required |
| Build | `pnpm build` | required |
| Smoke | `pnpm test:e2e` — Playwright over **every route** at 1440 and 390, fails on console errors | required |
| SEO spec | Playwright spec: title, description, canonical, OG, JSON-LD, `sitemap.xml`, `robots.txt`, 404 | required |
| Accessibility | axe in Playwright | recommended; required before launch |
| Lighthouse | Lighthouse CI mobile budgets: performance ≥ 90, accessibility, SEO and best practices 100, LCP < 2.5 s, CLS < 0.05 | recommended; required before launch |
| Docker smoke | build the image, start it, run read-only specs with `BASE_URL` | recommended |

Mutation testing does not apply. For B, server code (Effect services, Actions) gets unit tests in
the same `Checks` stage.

## Development handover checklist

- [ ] Archetype, render mode, content-editing model and form handling recorded in
      `docs/rozhodnuti.md` (or ADRs when `full`).
- [ ] Jenkins `Checks` stage green on the scaffold (one route), ruleset requires `Jenkins`.
- [ ] Tokens generated from Pencil; a lint or review rule bans arbitrary Tailwind values.
- [ ] Playwright fixtures (console errors, viewports, hydration helper) and the SEO spec exist.
- [ ] `docs/plan.md` page/section table filled; `docs/sitemap-a-meta.md` has every route with
      title, description and 301s from the old site.
- [ ] Preview environment with noindex + basic auth; `docs/nasazeni.md` launch checklist started.
- [ ] B: migrations, seeds and the editable-section registry pattern in place with one section
      done end to end. C: the Zod export contract and a fixture export committed.

## Typical ADR topics

- Archetype and render mode / adapter (static, SSR Node, hybrid).
- Content-editing model: git-edited data, admin with SQLite, headless CMS export.
- Contact form and antispam (Slim API vs Astro Action, honeypot, rate limit, reCAPTCHA, SMTP
  fallback), personal data retention.
- Motion stack (Motion only, no `framer-motion`, reduced motion), fonts and licences, images.
- Hosting, preview, noindex and basic auth, launch switch; i18n; redesign branch strategy.
- C: export contract and publish flow; ownership of system ADRs in the umbrella repo.

## Pitfalls seen in eSoul projects

- No checks in Jenkins at all: every Astro repo shipped with build + deploy only. The company
  rule makes the `Checks` stage mandatory from the first PR.
- `docs/` git-ignored as "local only" (`komfort-servis`): client content, design and decisions
  must be tracked (assets in LFS).
- Mockup bundle accidentally containing LFS pointers, or `.pen` exports read as files instead of
  through Pencil MCP.
- Arbitrary values (`text-[15px]`, `bg-[#…]`) and hard-coded copy in components; Tailwind cannot
  block them, so review and lint must.
- Playwright clicking before islands hydrate; the dev toolbar covering mobile tap targets.
- Behind a reverse proxy, missing `X-Forwarded-Proto` turns every Action POST into a 403;
  appended `X-Forwarded-For` lets visitors dodge rate limits.
- Fonts API needs network during `astro build` (Docker build must allow it).
- Forgetting to flip `PUBLIC_NOINDEX`, `robots.txt` and basic auth at launch, or forgetting 301s
  from the old URLs.
- Divergent Node versions across sites (`>=26` vs `>=22.12`); pin per repo in `engines` and the
  Jenkins image.
