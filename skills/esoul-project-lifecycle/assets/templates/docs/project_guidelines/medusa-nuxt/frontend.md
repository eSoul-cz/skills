# Project guidelines - Frontend

These guidelines define the standard for storefront code in `apps/storefront`. Code that
contradicts them is a bug to fix, not a precedent to follow; where existing code does not follow a
rule yet, the rule says so as a **Target** and names the gap.

The storefront is Nuxt {{NUXT_VERSION}} with Vue 3, TypeScript, Pinia, Tailwind CSS 4,
`@nuxtjs/i18n`, `@nuxt/image`, `@nuxtjs/sitemap` and `@medusajs/js-sdk`, tested with Vitest,
`@nuxt/test-utils` and Playwright. It renders on the server and reaches Medusa only through the
SDK. The Medusa admin has its own rules ([admin.md](admin.md)); the storefront MUST NOT contain
React or a client-side query library. Paths are relative to `apps/storefront`.

## Project structure

```text
apps/storefront/
├── app/
│   ├── pages/              # file-system routes; localized slugs in nuxt.config.ts
│   ├── layouts/
│   ├── components/         # site-wide components
│   │   ├── ui/             # Ui primitives (UiButton, UiInput, …)
│   │   └── <domain>/       # components of one domain (product/, checkout/, …)
│   ├── composables/        # useMedusa, useMedusaFetch, useCart, …
│   ├── stores/             # Pinia: cart, customer, region
│   ├── plugins/
│   ├── utils/              # pure functions (pricing, dates, …)
│   └── assets/css/main.css # Tailwind 4 @theme tokens
├── i18n/locales/           # one JSON file per locale
├── server/                 # sitemap source and robots.txt only
├── tests/                  # unit/ and components/
└── e2e/                    # Playwright
```

- Pages compose a screen and coordinate its data. A component used by one domain lives in
  `components/<domain>/`, a site-wide one directly in `components/`, a domain-independent
  primitive in `components/ui/`.
- Nuxt auto-imports components by path and drops a repeated prefix
  (`components/product/ProductCard.vue` is `<ProductCard>`). A test fails on any component Nuxt
  cannot resolve.
- `utils/` holds stateless functions; reactive or lifecycle-aware behaviour is a composable
  named `useXxx.ts`. `pnpm structure` checks file and directory naming.
- Per-visitor state MUST NOT live in module-level variables: on the server they are shared by
  every request.

## Components

- Single-file components with `<script setup lang="ts">`, then `<template>`, then optional
  `<style scoped>`.
- Contracts are named type aliases: `defineProps<Props>()` and `defineEmits<Emits>()` with call
  signatures. Templates access props by name, never through `props.` or `$props`. Project lint
  rules enforce these.
- Props are never mutated; derive with `computed` and emit the change upward. `watch` is only for
  side effects, which clean up after themselves.
- `v-for` keys items by a stable id when items can be added, removed or reordered.
- Extract before extending a component that approaches 500 lines or mixes presentation with data
  access.

## Primitives and design tokens

- Primitives live in `components/ui/` with the `Ui` prefix. Check them before writing a new
  control. A primitive is domain-independent: no domain names, Medusa calls or copy of its own.
- Colours, fonts, type scale, spacing and radii come only from the `@theme` tokens in
  `assets/css/main.css`, which mirror the Pencil design; when they disagree, the design wins.
  There is no `tailwind.config.js`.
- Code MUST NOT use a hex colour or a class from Tailwind's default palette; project lint rules
  reject both. Add or change a token instead.

## Talking to Medusa

- Core Store API calls go through `useMedusa()`, custom `/store/*` routes through
  `medusaFetch()`; both send the publishable key and the customer token. Raw `$fetch` and `ofetch`
  are rejected by lint in `app/`.
- Medusa shapes come from `@medusajs/types`; custom route responses from the shared types
  package.
- Develop against the local Medusa API, not against mocks.

## Data and state

- Data a page needs for its server render is read with `useAsyncData` and a key that includes
  every input. An `onMounted` fetch is only for browser-only work (payment widgets, data that
  needs the customer token).
- Cart, customer and region state lives in Pinia stores. After a mutation, refresh the affected
  store; never keep a second copy in the page. Code never stores tokens itself.
- Plugins that need another plugin's state declare `dependsOn`.
- Pages that carry a visitor's cart or account MUST NOT be cached across visitors.
- Every request has a visible loading state, an empty state and an error state, and the error
  state is distinguishable from the empty one. A `catch {}` that returns `[]` turns an outage into
  "nothing here"; never write one.
- Submit actions are disabled while their request runs.
- Errors are shown through an i18n message chosen by the error's `code`, never the backend's
  `message`.

## Money and dates

Amounts are formatted only by the shared formatters in `app/utils/` (one for base units, one for
minor units), always with the current locale; a page never computes minor units by hand. Dates
are formatted by one shared helper with the locale and the business time zone, so the server
render and the browser agree ([domain.md](domain.md)).

## Internationalization and routes

- All customer-facing text goes through `i18n/locales/*.json`; the files have the same keys and
  placeholders (a test checks it). Bare text in templates is rejected by lint. Copy uses the
  glossary's terms.
- The default locale {{DEFAULT_LOCALE}} has no URL prefix; other locales are prefixed. Localized
  slugs are the `pages` map in `nuxt.config.ts`; a new page customers reach gets an entry for
  every locale.
- Internal links use `<NuxtLink>` with `localePath()`, which takes the path in the default
  locale.

## Images

- Images use `<NuxtImg>` or `<NuxtPicture>`, never `<img>`, with a meaningful `alt` (empty for
  decoration), `sizes` for responsive images and `loading="lazy"` below the fold.

## SEO and structured data

- Every page sets its metadata with `useSeoMeta`; `app.vue` adds `lang` and hreflang alternates.
  Account, cart and checkout pages are `noindex, nofollow`.
- Structured data is rendered on the server through one `JsonLd` component, never inside
  `<ClientOnly>`.
- The sitemap source and `robots.txt` are the only Nuxt server routes.

## Accessibility

- Build mobile-first.
- Every form control has a label bound to it and a `name`; a test fails on a `<label>` without a
  binding. Primitives generate ids with `useId()`.
- `<button>` for actions, `<NuxtLink>` for navigation. Icon-only controls have an accessible
  name; decorative icons are hidden from assistive technology.
- Colour is never the only carrier of a state. Asynchronous results that are not otherwise
  visible are announced.

## Third-party scripts

- Payment and shipping widgets load only through their composable or component.
- Analytics and marketing scripts load from one client plugin and only after the cookie consent
  allows them.

## Tests

Pure logic belongs in a function or composable tested in `tests/unit/`; mount a component in
`tests/components/` only for behaviour a customer can observe. A test that needs the Nuxt runtime
is named `*.nuxt.spec.ts`. Do not mock the Pinia stores; use `setActivePinia(createPinia())`.
Customer flows are covered by Playwright in `e2e/`, and a change to a customer flow runs
`pnpm test:e2e` ([testing.md](testing.md)).
