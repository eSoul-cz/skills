# Product types and scenario packs

## Resolve the product type

Read `CONTEXT.md › ## Project profile`. An explicit `- Product type:` line wins. Otherwise
derive it:

| Profile | Product type |
|---|---|
| Stack `laravel`, `other:*` with tier `full` | `application` |
| Stack `medusa-nuxt`; WordPress with WooCommerce; any stack whose plan or ADRs contain cart, checkout, or orders | `eshop` |
| Stack `astro` archetype `B-admin` or `C-headless`; WordPress without a shop | `website-admin` |
| Stack `astro` archetype `A-static`; landing pages | `website` |

When two rows match, or none does, propose the type with the reason and ask the user to
confirm, then ask `esoul-project-lifecycle` to write `- Product type: <type>` into the
profile. A project may combine types (an application with a public website): list both and
build both packs.

`UAT dimensions` from the profile (role, sales channel, language, currency, …) become the
columns every scenario states. Do not invent dimensions the profile does not list; propose
them instead.

## Common pack (every product type)

| Area | Scenarios |
|---|---|
| Navigation | every menu item and footer link opens; breadcrumbs; back button; 404 page |
| Responsive sweep | every route on every device in the matrix ([design.md](design.md)) |
| Layout audit | overflow, overlaps, clipping, off-screen, tap targets, broken images, font fallback |
| Console and network | no uncaught errors, no failed requests (4xx/5xx) on any visited page |
| Forms | required fields, error messages in the project language with diacritics, success state, double submit |
| Language | no untranslated strings, correct date, number, and currency formats |
| Accessibility basics | keyboard path through main flows, focus visible, labels, contrast (axe) |
| Empty, loading, error states | for every list and detail |
| Stress content | long names with diacritics, many items, missing optional data, 200 % zoom |

## `application`

| Area | Scenarios |
|---|---|
| Authentication | login, logout, remember me, password reset (needs mail access), e-mail verification, session expiry |
| Roles and permissions | a matrix: for each role, what it sees in the menu, what it can open by URL, what the server refuses; at least two permission scenarios per chapter |
| CRUD per module | create, list (filter, sort, paginate, column toggles), detail, edit, delete with confirmation, undo where offered |
| Validation | every server rule that a user can hit, with the exact message |
| Workflows and states | every state transition, including forbidden ones and repeated submits |
| Notifications | in-app and e-mail for every notification type, recipients per role |
| Files | upload, preview, download, size and type limits, deletion |
| Exports and reports | content, filters applied, file opens, permissions |
| Data volume | lists and searches on full migrated data when such an environment exists |

## `eshop`

| Area | Scenarios |
|---|---|
| Catalogue | category listing, filters, sorting, search incl. typos and diacritics, empty results |
| Product detail | variants, prices incl. VAT, stock states, gallery, related products |
| Cart | add, change quantity, remove, persistence after login, stock limits, coupons |
| Checkout | guest and registered, addresses, shipping and payment methods in sandbox, terms consent, order confirmation |
| Payments | success, cancel, failure, return from gateway, duplicate notification |
| E-mails | order confirmation, shipping, password, invoice; content and links |
| Account | registration, order history, addresses, GDPR export and deletion |
| Localisation | every sales channel, language, and currency from the UAT dimensions |
| Admin | order processing, refunds, stock changes visible on the storefront |
| Legal | cookie consent before tracking, terms, complaints, price history where required |

Use only sandbox payment methods. Never complete a real payment.

## `website-admin`

Everything from `website`, plus: edit each content type in the admin, publish, unpublish,
schedule; the change appears on the web after the documented delay; media upload and
alt text; preview of drafts; roles in the admin.

## `website`

| Area | Scenarios |
|---|---|
| Pages | every page from the sitemap or `docs/plan.md` page table renders its sections |
| Content parity | content matches `docs/obsah-novy-web.md` |
| Redirects | old URLs from `docs/obsah-stary-web.md` redirect with 301 |
| Forms | contact and lead forms deliver (needs mail access), spam protection, GDPR consent |
| SEO | title, description, canonical, OG image, `hreflang`, `robots`, sitemap.xml |
| Tracking | cookie consent blocks tracking until accepted |
| Performance | Lighthouse budgets from the project profile, when defined |

For light-tier projects this pack doubles as the acceptance on the preview; link the
launch checklist in `docs/nasazeni.md` instead of duplicating it.

## Building the catalogue in `plan` mode

1. List the product's surface from code, not from memory: routes, pages, menu entries,
   policies or permission rules, form requests or validators, notification classes, exports.
   Prefer `codegraph_explore` when available.
2. List the intended behaviour from docs: ADRs, plan and slices, issues with `## UAT`,
   GLOSSARY rules.
3. Map every surface item and every rule to a chapter. A surface item without a scenario is
   a gap; a scenario without a surface item is either `basis: zadani` (specified, not built)
   or stale.
4. Write chapters in [scenario-format.md](scenario-format.md), main flow first, then
   validation, permissions, negative, edge cases.
5. Run `node <skill>/scripts/uat.mjs validate docs/testing/uat/scenarios` and fix every error.
