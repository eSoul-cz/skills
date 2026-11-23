<!-- esoul-guidelines:begin public-website -->
# Project guidelines - Public websites

These rules hold for every application that serves public pages: an Astro website, the public pages of a Laravel or LSR application, a marketing site next to an application. A tool or an admin behind a login is out of scope. Search engines and AI assistants read the HTML the server returns, so the rules are about what the server publishes, not about one framework. The framework's own guidelines describe how it implements them. MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

The page tree, the meta texts, the redirect list and what the client still has to deliver are kept in the project's sitemap and meta document; the launch steps are in the project's launch checklist.

## Content in the HTML

- Every text, heading, link and image of an indexable page MUST be in the HTML the server returns. Most AI crawlers and link-preview bots do not run JavaScript.
- Interactive enhancement MAY add behaviour on top. Content that a script would reveal MUST have a no-script rendering. A form protected by reCAPTCHA is the exception that needs JavaScript to submit: its page still renders without scripts and shows a contact alternative next to the form.

## Crawling and indexing

- In production **all bots are allowed**. `robots.txt` carries `User-agent: *` and `Allow: /`, and it MUST NOT block a crawler or an AI assistant by name without an ADR that records why.
- `robots.txt` disallows only the application's own non-public paths (the admin, the API, other back-end routes) and names the sitemap.
- A page that must not be indexed (not found and error pages, thank-you pages, pages for a signed-in visitor or a transaction such as account, cart and checkout, anything the project decides) carries `noindex` in its HTML and is left out of the sitemap. It is **not** disallowed in `robots.txt`: a crawler has to fetch the page to see `noindex`.
- Every indexable page declares one canonical URL on the project's canonical origin, in one form (with or without a trailing slash, chosen once). The canonical tag, `og:url`, the sitemap, internal links and redirect targets all use that form.

## Sitemap

- The site publishes an XML sitemap that lists exactly the indexable canonical URLs: no `noindex` page, no redirect, no other origin.
- Every entry has `lastmod`, the date the page's content last changed. Entries whose content did not change keep their previous date, so a rebuild does not touch them.
- A check after the build or the deploy compares the sitemap with the pages the site produces and fails on a difference.

## `llms.txt`

- The site SHOULD publish `/llms.txt`: a short Markdown file with the site's name, a one-line description and links to the key pages, each with a one-line description. Longer material goes in linked pages, not into the file.
- The file is generated from the same content as the pages, never kept by hand, so it cannot disagree with them. It lists no `noindex` page.

## Markdown versions

- Where a page is mostly prose a model should read (services, articles, FAQs, documentation), the site MAY publish the same content as Markdown at a predictable URL and advertise it from the HTML with `<link rel="alternate" type="text/markdown" href="...">`.
- A Markdown version carries the same facts as the HTML page and nothing that exists only there. Pages that are mostly interface (forms, carts, dashboards) have none.

## Preview gate

Until launch, and on every environment that is reachable from the internet but is not the live site, the site is a protected preview:

- the web server asks for **HTTP basic auth**; the password is a secret ([security-and-data.md](security-and-data.md#secrets)) and `robots.txt` stays reachable without it;
- **every page is `noindex,nofollow`**, `robots.txt` disallows everything and no sitemap is published;
- one switch in the build or the configuration turns the three together, so they cannot disagree, and a check fails when they do.

Switching the gate off is a launch step in the launch checklist: remove basic auth, turn the switch off, deploy, then verify the response headers, `robots.txt`, the sitemap and indexability. Nothing else changes in the same deploy.

## Redirects from an old site

- Every URL of the old site that had traffic or links gets a **301** to its closest new page, as listed in the project's sitemap and meta document. Content removed for good returns **410**, not a redirect to the homepage. Old upload paths (for example `/wp-content/uploads/*`) are handled explicitly.
- Redirect targets use the canonical URL form, so no chain of two redirects exists. After a slug change, the old slug redirects to the new one.
- Redirects live in the host NGINX site, not in the application: in the manifest (`nginx.extra`) or in a redirect map the project keeps and devops include. The project keeps the list in its sitemap document and hands it over in the pull request's deploy notes ([workflow.md](workflow.md#pull-requests)); devops apply it.

## Exceptions

A deviation from these rules (a bot that is blocked, a site without a sitemap, a gate that stays on in production) is recorded in an ADR with its reason, and the project's checks encode it, so it does not read as a regression.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end public-website -->
