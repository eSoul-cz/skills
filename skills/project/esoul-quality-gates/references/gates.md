# Gate details

How to run each non-AI gate of [SKILL.md](../SKILL.md) and which numbers it uses. Where a guideline
owns the rule, the row points at it; the rest are eSoul defaults that live in this skill until a
guideline carries them. A project that needs another number records it as a decision (ADR, or
`docs/rozhodnuti.md` in the light tier) and passes it to the script.

## Numbers and owners

| Gate | Rule | Owner |
|---|---|---|
| Lighthouse (mobile, key templates) | performance ≥ 90; accessibility, best practices and SEO 100; LCP < 2.5 s; CLS < 0.05 | eSoul default, this skill (`BUDGETS` in `scripts/lighthouse-gate.mjs`) |
| axe accessibility | no `serious` or `critical` violation on any route; keyboard operation, visible focus and `prefers-reduced-motion` checked by hand | eSoul default, this skill; the contrast and focus rules of the design are in the stack's `frontend.md` guideline |
| Link prefetch | internal links prefetch on hover or touch; state-changing links, downloads, signed URLs and the admin are excluded | eSoul default, this skill |
| Security headers | the list of headers the stack must set | the stack's deployment guideline (`framework/astro/deployment.md`, `framework/lsr/deployment.md`) |
| AI readiness | checks, levels, exceptions | [ai-readiness.md](ai-readiness.md) and the guideline `public-website.md` |
| Console errors, broken images, SEO spec | Playwright smoke at 1440 and 390 px in the Jenkins `Checks` stage | the stack's `tools.md` guideline |

## Lighthouse

`scripts/lighthouse-gate.mjs` (Node 22 or newer; Lighthouse and Chrome from `~/.cache/esoul-uat`;
`--check` lists what is missing):

```bash
lighthouse-gate.mjs run --base https://site.cz --urls assets/case-study/urls.txt [--staging] [--auth user:pass] [--out dir]
```

- `--urls` lists one URL per template (the case-study file works); without it only the home page is
  measured.
- `--staging` skips SEO: a preview is `noindex`, so SEO can reach 100 only on production. Run the
  gate on staging before the switch (everything but SEO) and on production after it (everything).
- `--budget metric=value` replaces a number where the project has its own.
- Exit 0: every measured value is within budget; 1: a budget is missed or a page failed; 2: usage or
  tool error. `--out` writes the full Lighthouse JSON per page and `lighthouse-gate.json`.
- A miss is fixed at its cause (image weight, render-blocking script, layout shift), then re-run.
  Lighthouse varies between runs; a value on the edge is re-measured, not argued.

## axe

Preferred: a spec in the project's Playwright e2e that visits every route at 1440 and 390 px, so CI
keeps the gate (adding `@axe-core/playwright` needs the approval the workflow guideline requires
for a new dependency):

```js
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact))).toEqual([]);
```

Without a project spec (a one-off check before launch), install `@axe-core/playwright` into
`~/.cache/esoul-uat` and run the same lines in a throwaway script that is not committed. Then walk
the keyboard path of the main pages by hand: every control reachable, focus visible, no trap, and
motion stops under `prefers-reduced-motion`.

## Link prefetch

Use the stack's own mechanism: Astro `prefetch` (config or `data-astro-prefetch`), Inertia
`<Link prefetch>`, or Speculation Rules on plain server-rendered pages. Verify in the browser's
network panel: hovering or touching an internal link starts a prefetch request, and links that
change state, downloads, signed URLs and admin links start none.

## Security headers

Compare the live response with the list in the stack's deployment guideline:

```bash
curl -sI https://site.cz/ | grep -iE 'content-security-policy|strict-transport|x-content-type|referrer-policy|permissions-policy|x-frame|frame-ancestors'
```

Check the home page, a static asset and an error page: a `location` block with its own `add_header`
drops the inherited headers. A static site's CSP may be a `<meta>` tag instead (the Astro
guideline says when); read the page source then.
