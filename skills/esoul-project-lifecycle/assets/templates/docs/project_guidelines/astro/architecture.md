# Project guidelines - Architecture

{{PROJECT_NAME}} is an Astro website of archetype **`{{ARCHETYPE}}`**, recorded in
[CONTEXT.md](../../CONTEXT.md), *Project profile*, and decided in {{ARCHETYPE_DECISION}}. The
archetype fixes the render mode, how content is edited and how forms are handled; changing it is
a new decision, not a refactor.

| Archetype | Render mode | Content edited by | Forms | Typical stack |
|---|---|---|---|---|
| `A-static` | `output: 'static'` | Developers or agents through git ([content.md](content.md)) | PHP Slim micro-API in `api/` | Astro, Tailwind, no or few islands |
| `B-admin` | `output: 'server'` with `@astrojs/node` | The client in the project's own admin | Astro Actions | Astro SSR, admin islands, server services, SQLite |
| `C-headless` | `output: 'static'`, data fetched at build | The client in a separate CMS or admin application | Posted to the backend | Astro, islands, a Zod-validated content contract |

Decisions live in `docs/rozhodnuti.md` (`D-nn`, `light` tier) or in `docs/adr/` (`full` tier).
Typical topics: render mode and adapter, content editing model, form and anti-spam, motion stack,
fonts and licences, image pipeline, hosting and preview protection, languages.

## Pages, layouts and components

- Public pages render inside one base layout (`src/layouts/BaseLayout.astro`) that owns the head
  (meta, canonical, Open Graph, JSON-LD, fonts, icons), the header and the footer
  ([seo.md](seo.md)). A page passes its title, description and flags; it does not write head tags.
- Static content is written in `.astro` components. A UI framework component is used only for a
  real interactive island.
- UI components live in `src/components/ui/`, one per design-system component or variant group
  of the Pencil file ([frontend.md](frontend.md#pencil-to-component-map)); page sections live in
  `src/components/<page-or-area>/`.
- Components never hard-code user-visible text ([content.md](content.md)).

## Islands

- **Use the lightest hydration directive that works**: none, then `client:visible`, then
  `client:idle`; `client:load` only for an island that must react before the user scrolls to it.
  Each `client:load` is justified in the pull request.
- Island props MUST be serializable. When a component needs functions (plurals, formatters),
  hydrate it through a small wrapper island that builds them on the client.
- An island used on a public page keeps its JavaScript small; a library that adds weight to every
  page needs a decision.
- Islands use one UI framework per project ({{ISLAND_FRAMEWORK}}); a second one needs a decision.
- Plain `<script>` setup on a page that uses `<ClientRouter />` runs on `astro:page-load`, not
  once.

## Content must not depend on JavaScript

- Every text, link, image and heading of a public page is in the HTML the server or the build
  produces. Search engines, AI crawlers, link previews and visitors without JavaScript see the
  whole page.
- Interactive enhancements (tabs, filters, carousels, lightboxes, instant validation) work as
  progressive enhancement: without JavaScript all content is visible and every form still
  submits. Use `noscript:` variants or the base layer to reveal what scripts would otherwise
  toggle.
- Animations never hide content that has no other way to appear ([frontend.md](frontend.md)).

## Forms

<!-- optional: archetype A-static (PHP Slim micro-API) -->
Forms post to the PHP Slim micro-API in `api/` (PHP-DI, PHPMailer), served next to the static
build:

1. **honeypot** — a hidden field; when filled, the robot gets a fake success and nothing is sent;
2. **rate limit** — per client address, state stored outside the webroot;
3. **reCAPTCHA v3** — verified on the server with a score threshold; without a secret
   (local development only) verification is skipped with a logged warning;
4. **delivery** — e-mail over SMTP **and** a database record as a backup;
5. **last resort** — when both fail, the submission is appended to a file outside the webroot.

The client address is stored only as a hash. The form posts with a plain `<form method="post">`
and works without JavaScript; a script MAY enhance it with in-place results.

<!-- optional: archetype B-admin (Astro Actions) -->
Forms submit to Astro Actions with `accept: "form"`, so a plain `<form method="post">` works
without JavaScript and the page renders the result from `Astro.getActionResult()`. A script MAY
take over for instant validation and in-place results.

- The action validates with a schema shared with the browser, **stores the submission first** and
  sends the notification in the background: a mail failure never fails the submission.
- Spam protection is a honeypot plus a rate limit per client; a captcha only by decision.
- Every action except login and the public form submissions starts with the session check. A
  server island (`server:defer`) checks the session itself, because it is fetched outside the
  middleware.

<!-- optional: archetype C-headless -->
Forms post to the backend's form endpoint, whose URL is set at build time; the backend owns
recipients, SMTP and stored submissions. Without JavaScript the form posts normally and the
backend redirects back with a result anchor. The backend lists the site in its allowed origins.

## Server code

<!-- optional: archetype B-admin -->
- Server code lives in `src/server/` as plain Node TypeScript with no `astro:*` imports, so
  scripts (migrations, seeds) run it directly. One runtime serves actions, pages, API routes and
  middleware.
- Migrations are numbered files registered in one place; the start fails when a registered
  migration below the latest applied one never ran. A migration from a parallel branch takes an id
  above everything merged.
- Seeds run once per database, in id order, in a transaction with their marker, and never again,
  even when the client later edits the data. Changed seeded copy gets its own seed that replaces
  the old value only where it is still unedited.
- Settings from the environment are validated when migrations run and at startup, so an invalid
  value fails the deploy instead of a request.
- The middleware sets security headers (CSP, `nosniff`, `Referrer-Policy`), limits request body
  sizes, and marks admin and action responses `Cache-Control: private, no-store`.
- Uploads are validated by decoding their content, stored outside the build, and served only as
  resized copies; originals (with EXIF and GPS) are served to logged-in administrators only.

<!-- optional: archetype A-static or C-headless -->
The site has no server code beyond {{SERVER_CODE}}. Everything else is produced at build time.
