# Project guidelines - SEO

Search engines and AI assistants read the HTML the build or the server produces. Every rule below
is rendered by the base layout or by Astro integrations, never assembled by hand per page. The
page tree, the meta texts, the redirects and what the client still has to deliver are in
`docs/sitemap-a-meta.md`; the launch steps are in `docs/nasazeni.md`.

## URLs and trailing slash

- The canonical origin is `site` in `astro.config.mjs`: {{PRODUCTION_URL}}. Nothing else builds
  absolute URLs.
- Trailing slash policy: **{{TRAILING_SLASH_POLICY}}**, set once through `trailingSlash` and
  `build.format` so that page URLs, canonical URLs, the sitemap, internal links and redirects all
  agree. The non-canonical form redirects with 301.
- Slugs are lowercase, Czech words without diacritics, joined by hyphens.

## Meta

- Every indexable page has a unique title of **at most 60 characters** and a description of
  **110–155 characters**, from its content source; a check verifies the lengths.
- Every page has exactly one `h1`, matching the page's topic.
- `<html lang="{{SITE_LANGUAGE}}">`, `og:locale` and, on a multilingual site, `hreflang`
  alternates for every language the page exists in.
- Pages that must not be indexed (404, 500, privacy policy when decided, thank-you pages, the
  admin) carry `noindex` through a base layout flag and are left out of the sitemap.

## Canonical and Open Graph

- Every page declares its canonical URL from `site` and the page path; `og:url` equals it.
- Open Graph and Twitter tags: `og:title`, `og:description`, `og:type`, `og:image` and
  `twitter:card` `summary_large_image`.
- **OG images are 1200×630**, JPEG or PNG (link previews do not show AVIF), one per indexable
  page or a shared template with the page title. Their source lives in `assets/` and the design
  file.

## Structured data

- JSON-LD is rendered on the server in the base layout, from the same data the page shows. It
  never contains a fact that is not visible on the site.
- Globally: the organisation or local business (`Organization`, `LocalBusiness` or a fitting
  subtype) with name, URL, logo, contact, address and `sameAs` profiles.
- Per page as it applies: `BreadcrumbList`, `Service`, `Product`, `FAQPage` for real FAQ sections,
  `Article` or `CreativeWork` for references.
- No `AggregateRating` or `Review` markup for reviews the site publishes about itself.
- The identity (name, address, phone, company id) is identical on the site, in JSON-LD, Google
  Business Profile, Firmy.cz and social profiles.

## Sitemap and robots

- `@astrojs/sitemap` writes the sitemap at build time with canonical URLs only, without
  `noindex` pages. On a headless site the integration also respects `noindex` set in the backend.
- `robots.txt` links the sitemap and explicitly allows the search and AI crawlers:
  `Googlebot`, `Bingbot`, `OAI-SearchBot`, `ChatGPT-User`, `GPTBot`, `ClaudeBot`,
  `Claude-SearchBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`. Check that the
  hosting or CDN does not block them.
- While the site is a protected preview, `robots.txt` disallows everything and every page is
  `noindex` ([deployment.md](deployment.md#preview-protection)); `robots.txt` stays reachable
  without basic auth.

## `llms.txt`

`/llms.txt` in the site root gives a short description of the business, the area it serves, its
main pages and services with links, and the contact. It is generated from the same content as the
pages or kept next to them and updated with them. It is cheap; do not expect a large effect.

## Redirects from the old site

- Every URL of the old site that had traffic or links gets a **301** to its closest new page, as
  listed in `docs/sitemap-a-meta.md`. Redirects live in `redirects` in `astro.config.mjs` or in the
  web server configuration, in one place.
- Content removed for good returns **410**, not a redirect to the homepage. Old upload paths
  (`/wp-content/uploads/*`) are handled explicitly.
- Redirect targets use the canonical trailing slash form, so no chain of two redirects exists.
- After a slug change, the old slug redirects to the new one.

## Performance is SEO

Lighthouse on mobile: performance ≥ 90, accessibility, best practices and SEO 100, LCP < 2.5 s,
CLS < 0.05 ([tools.md](tools.md#lighthouse-and-accessibility)). These budgets are mandatory
before launch.

## After launch

Register the site and the sitemap in Google Search Console and Bing Webmaster Tools, update
Google Business Profile and Firmy.cz, and verify the analytics. The checklist is in
`docs/nasazeni.md`.
