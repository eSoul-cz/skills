# Project guidelines - Content

Every text a visitor reads has exactly one home, and the client's approved copy reaches it
without being retyped by hand. The approved copy is in `docs/obsah-novy-web.md` (the old site's
copy, as evidence, in `docs/obsah-stary-web.md`); titles, descriptions and the page tree are in
`docs/sitemap-a-meta.md`.

## Components never hard-code user-visible text

- A component in `src/components/` MUST NOT contain user-visible text: labels, headings, button
  text, `alt` and `aria-label` values, placeholders, pluralized counts, error messages. Everything
  comes in through props; a component with many strings takes one typed `labels` object.
- The site's copy lives at page level or in the content source of the archetype (below). Fixed
  shell copy (navigation labels, footer headings, form messages) lives in one module per area,
  for example `src/lib/site-labels.ts`.
- The same fact (phone, e-mail, address, opening hours, company id) is defined once and read
  everywhere it appears, including JSON-LD ([seo.md](seo.md)).
- Legal texts (privacy policy, terms) are structured content with an effective date, changed
  deliberately, never edited ad hoc in a component.
- Copy uses the client's vocabulary from the approved content document. When a text is missing,
  write `TBD` in the content source and add it to „Co dodá klient“ in `docs/sitemap-a-meta.md`;
  never invent marketing copy, prices, references or credentials.

## Content editing model per archetype

The archetype decides who edits content and how it reaches the site
([architecture.md](architecture.md)).

<!-- optional: archetype A-static -->
### A — static, edited through git

- Content is in **content collections** (`src/content/`, Markdown or data files) or in typed data
  modules (`src/data/*.ts`). Developers or agents edit it in a pull request.
- Every collection has a Zod schema in `src/content.config.ts`. A missing or invalid field fails
  the build; optional fields are optional on purpose.
- Repeated entries (news, products, references) are collection entries, never copies of a page.
  Adding one is documented in `README.md` in Czech for the person who does it.
- Images referenced by content go through `astro:assets` ([frontend.md](frontend.md#images)).

<!-- optional: archetype B-admin -->
### B — edited by the client in the project's admin

- Every editable section is declared once in a **registry** of sections and fields (in web
  order, with layout, required flag and maximum length). The admin form, the stored keys and the
  page rendering all come from it; a field that is not in the registry is not editable.
- Text is stored per section and key; images are stored as references to uploaded images, never
  as URLs typed by hand.
- The approved copy and photos enter the database through a **run-once seed**, never by typing
  them into the admin. Later corrections to seeded copy use a new seed that replaces a value only
  while it is unedited.
- Structured data the client manages (price lists, galleries, references) has its own tables with
  an explicit `position` for ordering and ids that are never reused.
- Admin copy (labels of the admin itself) lives in one labels module, not in the database.
- The admin is designed in Pencil like the public site, and its screens follow the admin frames.

<!-- optional: archetype C-headless -->
### C — headless, edited in a separate backend

- The backend exports content through one versioned endpoint. The site fetches it **once per
  build** for all collections, through a content loader in `src/content.config.ts`.
- The export is validated by a **Zod schema that is the contract** with the backend's exporter.
  Changing the contract changes both sides together, with a pull request in each repository and
  a link between them. An invalid export fails the build, and the previous version stays live.
- Media are downloaded at build time, verified by hash and served from the site's own path, so
  the site does not depend on the backend at runtime and a changed photo is not visible before
  publication.
- Publication is a button in the backend that triggers the site's Jenkins job; the job reports
  the result back to the backend.
- A local snapshot of the last export MAY be used in development. **CI never uses a snapshot**: a
  build stands on current data or fails.
- View models map the export to the props islands receive, so the export shape does not leak into
  components.
- What stays hard-coded in the site (per-slug exceptions, special pages) is listed in `README.md`;
  a slug change in the backend that would break it fails the build or logs a warning by design.

## Content and SEO fields

- Every indexable page has a title, a description and an Open Graph image from its content
  source, checked against the limits in [seo.md](seo.md).
- `noindex` is a content flag where the archetype supports it, and the sitemap respects it.
