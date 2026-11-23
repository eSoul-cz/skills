# Stack profile: Astro

Websites and small sites with a client admin. The rules live in the guideline layer
`framework/astro` (`architecture.md`, `content.md`, `frontend.md`, `seo.md`, `tools.md`,
`deployment.md`, `testing.md`), rendered into the project's `docs/project_guidelines/`; this
profile holds only what bootstrap, handover and the pitfalls add. Read the rendered guidelines of
the project, not a copy here.

## When this profile applies

`astro.config.*` and `astro` in `package.json`. Pick the archetype first (the table is in
`architecture.md › Archetypes`) and record it in `CONTEXT.md › ## Project profile`
(`Archetype:`) and in `docs/rozhodnuti.md` (or an ADR):

| Archetype | Template variant | Usual tier |
|---|---|---|
| `C-headless` (default) | `astro-cms-frontend` + `laravel-cms`, tied by the root template `astro-cms` | `light` for the site, the backend by its own profile |
| `A-static` | `astro-static` | `light` |
| `B-admin` (exception, ADR) | `astro-ssr` | `light`, escalate when the admin gains domain logic |

Forms always post to a backend (the CMS backend, a shared form service, or Astro Actions in
`B-admin`); a PHP micro-API next to the site is not a pattern.

## Bootstrap specifics

On top of the root files and the light-tier docs ([bootstrap.md](../bootstrap.md)):

1. Start from the published template variant of the archetype ([root-files.md](../root-files.md)
   explains how to read a `template-<variant>` repository). It carries the skeleton, the
   `Jenkinsfile` with the `Checks` stage and the `Guidelines` check, the Dockerfile and the
   Playwright setup; do not rebuild them by hand.
2. Layers: `general` and `framework/astro` (add `package/*` layers by hand if the site needs
   them); light projects use the same layers as full ones.
3. Design pipeline: the Pencil `.pen` and client files in LFS; mockup bundle in
   `docs/design_pencil/mockup/` outside LFS, published through `esoul-mockup-authoring`. Tokens
   mirror the Pencil `DS – Foundations` variables (`frontend.md › Design tokens`).
4. Pre-launch protection and the launch switch follow `deployment.md › Preview protection`
   (basic auth from a manifest secret, `PUBLIC_NOINDEX`); the lifecycle's [launch.md](../launch.md)
   checks the switch.
5. Agent context: vendored skills in `.agents/skills/` pinned in `skills-lock.json`, added with
   `LC_ALL=en_US.UTF-8 npx skills@1.7.2 add <owner/repo> --skill <name> --agent claude-code codex -y`
   (seen: `astro` from `astrolicious/agent-skills`, `effect-ts` from `Effect-TS/skills`,
   `playwright-best-practices`); project-adapted copies are not in the lock and say so in
   `AGENTS.md`. MCP: `astro-docs` (`https://mcp.docs.astro.build/mcp`), Pencil for `.pen` (never
   read the file directly), `codegraph` when indexed.
6. Site-specific pre-launch gates on top of the `Checks` stage: axe in Playwright and Lighthouse
   CI mobile budgets (performance ≥ 90, accessibility, SEO and best practices 100, LCP < 2.5 s,
   CLS < 0.05), both required before launch, and the AI-readiness gate
   ([ai-readiness.md](../ai-readiness.md)).

Mutation testing does not apply. For `B-admin`, server code (Effect services, Actions) gets unit
tests in the same `Checks` stage.

## Development handover checklist

- [ ] Archetype, render mode, content-editing model and form handling recorded in
      `docs/rozhodnuti.md` (or ADRs when `full`).
- [ ] Jenkins `Checks` stage green on the scaffold (one route) including `esoul-guidelines check`,
      ruleset requires `Jenkins`.
- [ ] Tokens generated from Pencil; a lint or review rule bans arbitrary Tailwind values.
- [ ] Playwright fixtures (console errors, viewports, hydration helper) and the SEO spec exist.
- [ ] `docs/plan.md` page/section table filled; `docs/sitemap-a-meta.md` has every route with
      title, description and 301s from the old site.
- [ ] Preview environment with noindex and basic auth; `docs/nasazeni.md` launch checklist started.
- [ ] `B-admin`: migrations, seeds and the editable-section registry in place with one section
      done end to end, the media library (tab `Média` and the picker) with one image field using
      it, and the tab `Dokumentace` rendering `docs/admin/*.md` with both guides started.
      `C-headless`: the Zod export contract and a fixture export committed.

## Typical ADR topics

- Archetype and render mode / adapter (static, SSR Node).
- Content-editing model: git-edited data, admin with SQLite, headless CMS export.
- Contact form and anti-spam handling (honeypot, rate limit, reCAPTCHA, SMTP fallback), personal
  data retention; which backend receives the forms.
- Motion stack (Motion only, no `framer-motion`, reduced motion), fonts and licences, images.
- Hosting, preview and launch switch; i18n; redesign branch strategy.
- `C-headless`: export contract and publish flow; ownership of system ADRs in the umbrella repo.

## Pitfalls seen in eSoul projects

- No checks in Jenkins at all: every early Astro repo shipped with build and deploy only. The
  `Checks` stage is mandatory from the first PR.
- `docs/` git-ignored as "local only" (`komfort-servis`): client content, design and decisions
  must be tracked (assets in LFS).
- Mockup bundle accidentally containing LFS pointers, or `.pen` exports read as files instead of
  through Pencil MCP.
- Arbitrary values (`text-[15px]`, `bg-[#…]`) and hard-coded copy in components; Tailwind cannot
  block them, so review and lint must.
- Playwright clicking before islands hydrate; the dev toolbar covering mobile tap targets.
- Behind a reverse proxy, missing `X-Forwarded-Proto` turns every Action POST into a 403;
  appended `X-Forwarded-For` lets visitors dodge rate limits.
- Fonts API needs network during `astro build` (the Docker build must allow it).
- Forgetting to flip `PUBLIC_NOINDEX`, `robots.txt` and basic auth at launch, or forgetting 301s
  from the old URLs.
- Divergent Node versions across sites; pin per repo in `engines` and the Jenkins image, with
  the version the guideline `tools.md` names.
