# AI readiness: reference

Loaded from [ai-readiness.md](ai-readiness.md) only when needed: crawler list and real-bot proof
(AI-01, a failing `bot-access`), feed formats (AI-06), stack notes (implementing AI-01…AI-05),
content rules (copywriters and designers) and the contested list (a client asks what to expect).
Vendor behaviour changes; check the operator's documentation before promising a client anything.

## Crawlers

The checker's `BOTS` list (`scripts/ai-readiness.mjs`) is the single source of bot names and UA
strings; this table only classifies them. All listed bots are allowed. "Token" is what `robots.txt`
matches. User-triggered fetchers often ignore `robots.txt` by design, so only WAF or firewall rules
decide whether they get through.

| Bot token | Operator | Type |
|---|---|---|
| `Googlebot` | Google | search (also feeds AI Overviews and AI Mode) |
| `Google-Extended` | Google | training; robots token only, does not affect Search |
| `bingbot` | Microsoft | search (Bing, Copilot) |
| `SeznamBot` | Seznam | search (also feeds Seznam Asistent) |
| `OAI-SearchBot`, `ChatGPT-User`, `GPTBot` | OpenAI | search, user-triggered, training |
| `Claude-SearchBot`, `Claude-User`, `ClaudeBot` | Anthropic | search, user-triggered, training |
| `PerplexityBot`, `Perplexity-User` | Perplexity | search, user-triggered |
| `Applebot`, `Applebot-Extended` | Apple | search (Siri, Spotlight), training (robots token only) |
| `CCBot` | Common Crawl | training (open dataset) |

- Blocking a search bot removes the site from that product's answers; blocking a training bot does
  not. Operators with separate bots treat them as independent.
- Cloudflare and some hosts block AI crawlers by default on new zones. Check the zone and host
  settings of every project: that is configuration of the client's infrastructure, not use of a
  Cloudflare feature as a source of truth.
- **Proving real bots get through.** The `bot-access` check spoofs the UA from the checker's IP, so a
  403 may be the host's fake-bot protection working correctly. Before recording an exception, find
  requests from the operator's real IPs in the server logs (reverse DNS plus forward DNS, or the
  operator's published IP list) and read their status codes. A real bot that gets 403, 429 or a
  challenge is a defect in AI-01.
- IndexNow is supported by Bing, Yandex and Seznam, not by Google; one shared endpoint
  (`api.indexnow.org`) is enough, Seznam has its own (`search.seznam.cz/indexnow`).

## Feeds (AI-06)

Prices include VAT. Product pages keep price and stock in server HTML, one canonical URL per variant.

| Feed | Format and required fields | Specification |
|---|---|---|
| Google Merchant | RSS/Atom with the `g:` namespace: `id`, `title`, `link`, `price`, `availability`, `image_link` (plus `description`, `gtin` when known) | Google Merchant Center product data specification |
| Zboží.cz | `<SHOP xmlns="http://www.zbozi.cz/ns/offer/1.0">`, `<SHOPITEM>`: `PRODUCTNAME`, `DESCRIPTION`, `URL`, `PRICE_VAT`, `DELIVERY_DATE`, `IMGURL`; a duplicate `PRODUCTNAME` or `ITEM_ID` drops offers | https://napoveda.sklik.cz/en/shopping-ads/xml-feed-shopping/specifications/ |
| Heureka | `<SHOP>/<SHOPITEM>`, UTF-8: `ITEM_ID`, `PRODUCTNAME`, `URL`, `IMGURL`, `PRICE_VAT`, `CATEGORYTEXT`, `DELIVERY_DATE`, `DELIVERY` | https://heureka.github.io/xml-feed-specs |

The Zboží.cz specification also lists `EPREL_ID`; check at implementation time whether it applies to
the shop's categories.

## Stack notes

The site produces everything itself. A plugin or package may help as a library when its output is
verified by the checker; it is never the unverified source of truth.

| Stack | Notes |
|---|---|
| WordPress | `robots.txt` (`robots_txt` filter), sitemap (core `wp-sitemap.xml` with `lastmod`, or theme/mu-plugin code), `llms.txt`, Markdown versions (rewrite rule plus `template_redirect` honouring `Accept`), JSON-LD and feeds in theme or mu-plugin code under version control. SEO plugins (Rank Math, Yoast) may generate meta and a JSON-LD graph, but one source only: remove duplicate graphs from theme, plugin and builder. Settings › Reading must not discourage search engines on production; a physical `robots.txt` overrides the virtual one. Security plugins and host or CDN bot rules must let the bots through |
| Elementor, Oxygen, Breakdance | Server-rendered, which is fine. Watch for sliders, tabs, accordions and popups whose content loads on click or by AJAX, lazy-loaded sections, `div` + click-handler pseudo-buttons, heading levels chosen by looks and missing `alt`. Set the heading tag per widget, use real links and buttons, label forms. Builder "agent ready" modules are optional helpers only |
| WooCommerce | Product JSON-LD comes from core; extend or replace it from site code so `shippingDetails`, `hasMerchantReturnPolicy`, GTIN and CZK prices are present and equal the page. Feeds from site code, cached, UTF-8. Product lists and filters server-rendered; guest checkout, no CAPTCHA at the cart |
| Laravel | Routes or controllers (not static files) for `robots.txt`, `sitemap.xml`, `llms.txt`, feeds and Markdown versions, rendered from the same data and cached (`Vary: Accept`); one JSON-LD Blade component per page; the IndexNow ping from the publish event through a queued job behind a port with a fake driver. Rate limiters and middleware must not answer bots with 429. Inertia pages need SSR or prerendering |
| Astro / SSG | Build-time endpoints (`src/pages/robots.txt.ts`, `llms.txt.ts`, `[...slug].md.ts`) and `@astrojs/sitemap` with `lastmod`; `Accept` negotiation needs the web server or an adapter, so `<url>.md` plus `<link rel="alternate">` is the default; JSON-LD in the base layout; `docs/project_guidelines/seo.md` |
| Other | Same requirements; record the generation mechanism in the AI-01 issue and in `docs/ai-readiness.md` |

## Content rules for copy and design

For copywriters and designers; they make the `facts`, `ssr-content` and `article-meta` checks pass.

- **Facts as text.** Who we are, what we sell, where we operate, prices (incl. VAT), delivery, contact,
  opening hours, IČO and registered address are text in the HTML, not only in images, PDFs, sliders
  or widgets.
- **Answer first.** Each page and article opens with a direct answer or summary, then detail.
  Descriptive headings, tables and lists for data.
- **Authors and dates.** Articles show the author (with a short bio) and a visible published/updated
  date; `dateModified` changes only with a real update.
- **No key content only behind interaction.** Content that matters is not exclusively in tabs,
  sliders, click-loaded accordions, AJAX, popups, cookie walls or behind a login or CAPTCHA.
  Hidden-by-CSS-but-in-HTML content is fine.
- **NAP identical.** Name, address, phone and opening hours match on the site, in JSON-LD, Google
  Business Profile, Firmy.cz and Mapy.com; Firmy.cz and Zboží.cz are data sources of Seznam Asistent.
- **Policy pages** (terms and conditions, shipping, returns and complaints, privacy) are plain pages
  linked from the footer on every page.
- No filler written for bots, no keyword stuffing, no fake reviews or authors.

## Contested and watch list

Not requirements; keep out of client promises.

| Topic | Status |
|---|---|
| `llms.txt` | A proposal, not a standard; Google says AI features need no special files, and published log and citation studies show little or no crawler use. Coding agents and documentation sites do use it. The guideline asks for it as SHOULD because it is cheap and checkers look for it. Promise no visibility |
| "AI optimisation" vs plain SEO | Google states AI Overviews and AI Mode have no requirements beyond being crawlable, indexable and snippet-eligible; most GEO tactics (chunking, FAQ blocks, answer-first) are vendor claims without measured effect and stay as good writing |
| Schema and citations | No demonstrated causal effect on AI citations; still needed for rich results and merchant listings. Some fetch tools strip `<script>`, so visible text carries the same facts |
| `robots.txt` | Advisory: training and search bots honour it, user-triggered fetchers generally do not |
| JS rendering | Whether AI crawlers run JavaScript is poorly documented; Googlebot does. Re-test with `curl` |
| WebMCP, NLWeb, `/.well-known/` agent files, Web Bot Auth, agentic commerce protocols | Experimental or drafts; not actionable beyond clean feeds. WebMCP is `info` only |
| Checker scores of third-party tools | Measure delivery of standards with opaque weights, not citations. Our checker is the only gate |

Measurement outside the gate: Bing Webmaster Tools AI Performance, Google Search Console, GA4
referrals from AI assistants (`utm_source=chatgpt.com`), manual prompts in Czech once a month.
