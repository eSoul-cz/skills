# AI readiness

Every eSoul website is built so that search engines, AI assistants and agents can find, read and
use it. This file is the single owner of the rules; stack profiles, templates and the launch
checklist only point here. The work is planned from day one as the standard slices AI-01…AI-06,
and launch is blocked by a failing `must` check. Facts below were researched on 2026-11-12;
re-verify vendor behaviour before promising a client anything.

## Scope

| Product type | Rule |
|---|---|
| `website`, `website-admin`, `eshop` | In scope: slices AI-01…AI-05; AI-06 for `eshop` only |
| `application` | Only its public part (landing, marketing, public catalogue); no slices unless the public part is a product in itself. Run the script with `--type application` when in doubt |
| Without a public site | Not applicable; delete the AI slices |

The product type is in `CONTEXT.md › Project profile`. Conformance warns (`ai-readiness-doc`,
`ai-readiness-slices`) when an in-scope project lacks `docs/ai-readiness.md` or the slices.

## Principles

1. **No external services.** No external checkers, SaaS, CDN features (Cloudflare Markdown
   conversion, managed robots.txt) and no third-party plugin as the source of truth. The site
   generates robots.txt, sitemap, `llms.txt`, Markdown versions, JSON-LD and feeds from its own
   data; the bundled script checks it, locally. Protocol endpoints (IndexNow ping, search engines
   fetching the site) are not "services" in this sense.
2. **Everything allowed.** Every bot is allowed by default, training bots included (GPTBot,
   ClaudeBot, Google-Extended, Applebot-Extended, CCBot). A client who wants to opt out decides it
   explicitly; it is recorded as a confirmed exception ([Exceptions](#exceptions)).
3. **Server HTML first.** Seznam and most AI crawlers render JavaScript poorly or not at all;
   content, links and facts must be in the HTML the server sends.
4. **One source of data.** The pages, JSON-LD, Markdown versions, `llms.txt`, sitemap and feeds
   come from the same data and never disagree (price, availability, address, dates).
5. **Stack-agnostic.** The requirements are the same everywhere; only the implementation differs
   ([Stack notes](#stack-notes)).

## Requirements by slice

Levels: **must** blocks launch, **should** is fixed unless there is a reason, **info** is reported
only. `Check` is the stable id of `scripts/ai-readiness.mjs`, used in exceptions and reports.

### AI-01 Přístup robotů a indexace

| Level | Check | Requirement |
|---|---|---|
| must | `robots` | `robots.txt` answers 200 as text, no group applicable to a listed bot disallows `/` or the sampled pages, `Sitemap:` present |
| must | `bot-access` | Home and sampled pages answer 200 to every bot UA in the [crawler table](#crawlers) with no challenge (`cf-mitigated`, "Just a moment", CAPTCHA, 403/429/503) and a body comparable to the browser's. Firewall, WAF, security plugins and host rules let the bots through |
| must | `indexable` | Production has no `noindex` (meta or `X-Robots-Tag`); previews and staging have `noindex`, basic auth and `Disallow: /`, `robots.txt` reachable without auth |
| must | `sitemap` | Generated XML with absolute same-host URLs, every `<url>` has `<lastmod>`, sampled URLs answer 200, only indexable pages |
| should | `indexnow` | Key file at `/<key>.txt` with the key as body; the site pings IndexNow (`api.indexnow.org` and `search.seznam.cz/indexnow`) when a page is published or changed |

### AI-02 Obsah v HTML a sémantika

| Level | Check | Requirement |
|---|---|---|
| must | `ssr-content` | Raw HTML has the h1 and at least 70 % of the words of the rendered `main`; internal navigation links are in raw HTML |
| must | `html-basics` | `<html lang>`, title, meta description, absolute canonical; `hreflang` reciprocal with `x-default` on multilingual sites |
| must | `semantics` | One h1, a `main` landmark, every form control has an accessible name, real `<a>` and `<button>`; native HTML first, ARIA only to fill gaps |
| should | `og` | `og:title`, `og:description`, `og:image` (absolute, 1200 × 630), `og:url` |
| should | `captcha` | No CAPTCHA wall in front of content or the contact route; offer an e-mail or phone fallback |
| should | `images-alt` | Content images have `alt` (decorative `alt=""` allowed) |

### AI-03 Strukturovaná data (JSON-LD)

| Level | Check | Requirement |
|---|---|---|
| must | `jsonld` | Every block parses; home has Organization or LocalBusiness (or subtype) and WebSite; articles have Article/BlogPosting with author, `datePublished`, `dateModified`; BreadcrumbList on inner pages (warn) |
| must (eshop) | `product-data` | Product with name, image, `offers.price`, `priceCurrency` (CZK), `availability`; `shippingDetails` and `hasMerchantReturnPolicy` (warn); GTIN when known; price equals the visible price |

Generate one graph per page from site data, never from a plugin's guess and never fake reviews or
`AggregateRating` for reviews the site publishes about itself. Markup must match visible content.

### AI-04 Fakta a stránky pro agenty

| Level | Check | Requirement |
|---|---|---|
| must | `facts` | Raw HTML of home or contact has phone or e-mail, a postal address and, for Czech sites, the IČO, as text |
| must (eshop), should | `policies` | Privacy policy linked site-wide; eshop also obchodní podmínky, doprava a platba, vrácení a reklamace |
| should | `article-meta` | Articles show author and a visible update date in raw HTML |

Content rules are in [Content rules](#content-rules-for-copy-and-design).

### AI-05 llms.txt a Markdown verze stránek

| Level | Check | Requirement |
|---|---|---|
| must | `llms-txt` | `/llms.txt` answers 200 as `text/plain` or `text/markdown`, starts with `# `, has a summary, at least 3 links, sampled links answer 200. Format: [llmstxt.org](https://llmstxt.org/) |
| must | `markdown` | Every indexable page has a Markdown version: `Accept: text/markdown` returns `text/markdown; charset=utf-8` with `Vary: Accept`, and/or `<url>.md`, advertised by `<link rel="alternate" type="text/markdown" href="…">`; the Markdown contains the page's h1 |
| info | `webmcp` | Forms with WebMCP attributes or `navigator.modelContext`; experimental, never required |

`llms.txt` is a must because it is cheap and checked by tools, not because it is proven to help
([Contested](#contested-and-watch-list)). Generate it and the Markdown from the page content,
cached, never by an external converter.

### AI-06 Produktová data a feedy (eshop only)

| Level | Check | Requirement |
|---|---|---|
| must | `feeds` | Each feed answers 200 as XML with the required fields below, unique `ITEM_ID`; prices and availability equal the product page and its JSON-LD |

| Feed | Format and required fields | Specification |
|---|---|---|
| Google Merchant | RSS/Atom with `g:` namespace: `id`, `title`, `link`, `price`, `availability`, `image_link` (plus `description`, `gtin` when known) | Google Merchant Center product data specification |
| Zboží.cz | `<SHOP xmlns="http://www.zbozi.cz/ns/offer/1.0">`, `<SHOPITEM>`: `PRODUCTNAME`, `DESCRIPTION`, `URL`, `PRICE_VAT`, `DELIVERY_DATE`, `IMGURL`; duplicate `PRODUCTNAME` or `ITEM_ID` drops offers | https://napoveda.sklik.cz/en/shopping-ads/xml-feed-shopping/specifications/ (validator on the same site) |
| Heureka | `<SHOP>/<SHOPITEM>`, UTF-8: `ITEM_ID`, `PRODUCTNAME`, `URL`, `IMGURL`, `PRICE_VAT`, `CATEGORYTEXT`, `DELIVERY_DATE`, `DELIVERY` | https://heureka.github.io/xml-feed-specs |

Prices include VAT. The Zboží.cz specification also lists `EPREL_ID` as mandatory; check at
implementation time whether it applies to the shop's categories. Product pages keep price and
stock in server HTML (not loaded by JS), one canonical URL per variant.

## Crawlers

All listed bots are allowed. "Token" is what `robots.txt` matches; "UA" is the string in access
logs. User-triggered fetchers often ignore `robots.txt` by design, so only WAF or firewall rules
decide whether they get through.

| Bot | Operator | Type | Token / UA | Real-bot verification |
|---|---|---|---|---|
| Googlebot | Google | search (also feeds AI Overviews and AI Mode) | `Googlebot` | reverse DNS `*.googlebot.com`, Google's published IP list |
| Google-Extended | Google | training (Gemini) | robots token only, no UA | token only; does not affect Search |
| Bingbot | Microsoft | search (Bing, Copilot) | `bingbot` | reverse DNS `*.search.msn.com`, Bing's published IP list |
| SeznamBot | Seznam | search (also feeds Seznam Asistent) | `SeznamBot` (UA `…SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/`) | PTR `fulltextrobot-*.seznam.cz`; list https://search.seznam.cz/ipranges/seznambot.json |
| OAI-SearchBot | OpenAI | search (ChatGPT search) | `OAI-SearchBot` | IP list published by OpenAI (`searchbot.json`); see https://developers.openai.com/api/docs/bots |
| ChatGPT-User | OpenAI | user-triggered | `ChatGPT-User` | IP list published by OpenAI |
| GPTBot | OpenAI | training | `GPTBot` | IP list published by OpenAI |
| Claude-SearchBot | Anthropic | search | `Claude-SearchBot` | IP list https://claude.com/crawling/bots.json; https://support.claude.com/en/articles/8896518 |
| Claude-User | Anthropic | user-triggered | `Claude-User` | same list |
| ClaudeBot | Anthropic | training | `ClaudeBot` | same list |
| PerplexityBot | Perplexity | search | `PerplexityBot` | IP lists in https://docs.perplexity.ai/guides/bots |
| Perplexity-User | Perplexity | user-triggered | `Perplexity-User` | same page |
| Applebot | Apple | search (Siri, Spotlight) | `Applebot` | reverse DNS `*.applebot.apple.com` |
| Applebot-Extended | Apple | training | robots token only | token only |
| CCBot | Common Crawl | training (open dataset) | `CCBot` | Common Crawl's published IP list |

Notes:

- Blocking a search bot removes the site from that product's answers; blocking a training bot does
  not. OpenAI states the three of its bots are independent; changes take about 24 hours.
- Seznam supports `Allow`, `*`, `$`, `Sitemap:` and the non-standard `Request-rate: 1/10s` (at
  most one document per 10 seconds; its minimum). Do not set it unless the server is struggling.
  `Crawl-delay` is not documented for SeznamBot. Seznam also has a fast news crawler (FreshBot)
  without a separate UA string.
- IndexNow: Google does not support it; Bing, Yandex and Seznam do. Seznam endpoint
  `https://search.seznam.cz/indexnow?url=…&key=…`, shared endpoint `https://api.indexnow.org/indexnow`.
  Seznam verifies the key file from 77.75.72.74 and 77.75.73.74.
- **Verifying real bots in your own access logs.** The script's `bot-access` check spoofs the UA
  from the checker's IP, so a 403 may be the host's fake-bot protection working correctly. Before
  recording an exception, confirm in the server logs that requests from the operator's real IPs
  are served: resolve the IP by reverse DNS and confirm forward DNS, or match it to the operator's
  published IP list, then check the status codes of those requests. A real bot that gets 403, 429
  or a challenge is a defect in AI-01.
- Cloudflare and some hosts block AI crawlers by default on new zones. Check the zone and host
  settings on every project; that is configuration of the client's own infrastructure, not use of
  a Cloudflare feature as source of truth.

## Stack notes

The site produces everything itself. A plugin or package may help as a library when its output is
verified by the script; it is never the unverified source of truth.

| Stack | Notes |
|---|---|
| WordPress | Generate robots.txt (`robots_txt` filter), sitemap (core `wp-sitemap.xml` with `lastmod`, or a theme/mu-plugin implementation), `llms.txt`, Markdown versions (rewrite rule plus `template_redirect` honouring `Accept`), JSON-LD and feeds in theme or mu-plugin code under version control. SEO plugins (Rank Math, Yoast) may generate meta and a JSON-LD graph, but one source only: remove duplicate graphs from theme, plugin and builder, and run the script to prove the result. Settings › Reading must not discourage search engines on production; a physical `robots.txt` overrides the virtual one. Security plugins (Wordfence, Sucuri) and host or CDN bot rules must let the bots through |
| Elementor, Oxygen, Breakdance | Server-rendered, which is fine. Watch for sliders, tabs, accordions and popups whose content loads on click or by AJAX, lazy-loaded sections, `div` + click-handler pseudo-buttons, heading levels chosen by looks, and missing `alt`. Set heading tag per widget, use real links and buttons, label forms. Builder "agent ready" modules are optional helpers only (principle 1) |
| WooCommerce | Product JSON-LD is emitted by core; extend or replace it from site code so `shippingDetails`, `hasMerchantReturnPolicy`, GTIN and CZK prices are present and equal the page. Feeds are generated by site code from the product data (Google Merchant, Zboží.cz, Heureka), cached, UTF-8. Product lists and filters must have server-rendered HTML; guest checkout, no CAPTCHA at cart |
| Laravel | Routes or controllers (not static files) for `robots.txt`, `sitemap.xml`, `llms.txt`, feeds and Markdown versions (a middleware or action rendering from the same Blade data and cached, `Vary: Accept`); one JSON-LD Blade component per page; IndexNow ping from the publish event through a queued job behind a port with a fake driver. Rate limiters and middleware must not answer the bots with 429. Inertia/Vue/React pages need SSR or prerendering |
| Astro / SSG | Build-time endpoints (`src/pages/robots.txt.ts`, `llms.txt.ts`, `[...slug].md.ts`) and `@astrojs/sitemap` with `lastmod`; `Accept` negotiation needs the web server or an adapter, so the `<url>.md` + `<link rel="alternate">` form is the default; JSON-LD in the base layout; see `docs/project_guidelines/seo.md` |
| Nuxt / Medusa | SSR or prerender for every public route; server routes for robots, sitemap, `llms.txt`, Markdown and feeds, built from Medusa product data via the JS SDK; JSON-LD in the layout; feeds as scheduled or cached server routes; IndexNow from a Medusa subscriber |
| Other | Same requirements; decide the generation mechanism in the AI-01 issue and record it in `docs/ai-readiness.md` |

## Content rules for copy and design

For copywriters and designers; they make the `facts`, `ssr-content` and `article-meta` checks pass.

- **Facts as text.** Who we are, what we sell, where we operate, prices (incl. VAT), delivery,
  contact, opening hours, IČO and registered address are written text in the HTML, not only in
  images, PDFs, sliders or widgets.
- **Answer first.** Each page and article opens with a direct answer or summary, then detail.
  Descriptive headings, tables and lists for data.
- **Authors and dates.** Articles show author (with a short bio) and a visible published/updated
  date; `dateModified` changes only with a real update.
- **No key content only behind interaction.** Content that matters is not exclusively in tabs,
  sliders, accordions that load on click, AJAX, popups, cookie walls or behind a login/CAPTCHA.
  Hidden-by-CSS-but-in-HTML content is fine.
- **NAP identical.** Name, address, phone and opening hours are the same on the site, in JSON-LD,
  Google Business Profile, Firmy.cz and Mapy.com. Seznam Asistent uses Firmy.cz and Zboží.cz as
  data sources, so keep both current (general practice; Seznam publishes no NAP guidance).
- **Policy pages** (obchodní podmínky, doprava, vrácení a reklamace, ochrana osobních údajů) are
  plain pages linked from the footer on every page.
- No filler written for bots, no keyword stuffing, no fake reviews or authors.

## The check script

`<skill>/scripts/ai-readiness.mjs` (Node ≥ 18, Playwright from `~/.cache/esoul-uat`, local only):

```bash
ai-readiness.mjs --check
ai-readiness.mjs run --base https://site.cz [--urls file | --max 20] [--type website|website-admin|eshop|application]
  [--staging] [--exceptions docs/ai-readiness.md] [--feeds google=/feed.xml,zbozi=/zbozi.xml,heureka=/heureka.xml]
  [--indexnow-key <key>] [--header 'Name: value']... [--auth user:pass] [--out dir] [--json] [--no-browser]
```

- Pages come from `--urls` (same format as `assets/case-study/urls.txt`) or are discovered, one
  per template up to `--max`. On a protected preview pass `--auth` or `--header`.
- Exit code 0: every `must` passed or has a confirmed exception; 1: an unexcepted `must` failed;
  2: usage or tool error. `--out` writes `report.json` and `report.md`.
- `--staging` expects `noindex` and `Disallow`: the `robots` bot rules and `indexable` become info.
- `--no-browser` skips `ssr-content` and `semantics`; a gate run uses the browser.

| Moment | Run | Output |
|---|---|---|
| During build | Any time, on the preview, as a self-check | optional |
| Before the DNS switch | `run --base <staging> --staging … --out assets/ai-readiness/<YYYY-MM-DD>/` | must pass or be excepted |
| Right after the switch | `run --base <production> … --out assets/ai-readiness/<YYYY-MM-DD>/` | must pass or be excepted; the first run on production proves `bot-access` and `indexable` |
| Audit of a live site | Same, on production | [audit.md](audit.md) |

Record every gate run in the run log of `docs/ai-readiness.md` (date, environment, `must x/y`,
`should x/y`, report path). The run is mechanical: give it to `esoul-skills:test-runner`, which
returns the summary, failed checks and the report path.

## Exceptions

A failing `must` blocks launch. The only way past it is an exception confirmed by the project lead
(not by the implementer) in the `## Výjimky` table of the project's `docs/ai-readiness.md`:

```md
| Kontrola | Rozsah | Důvod | Potvrdil | Datum |
|---|---|---|---|---|
| robots | * | Klient nechce trénink modelů: GPTBot a CCBot zakázány | Jméno | 2026-11-12 |
```

`Kontrola` is the check id, `Rozsah` is `*` or a URL path prefix. A row without `Potvrdil` or
`Datum` is ignored and reported as ignored. Client opt-outs of training bots, a legacy page that
cannot be fixed, a feed for a marketplace the shop does not use are typical exceptions. Fake-bot
protection that blocks only spoofed UAs needs the access-log proof from [Crawlers](#crawlers)
first. Exceptions are reviewed at every launch and audit.

## Case study

The case-study "před" capture ([case-study.md](case-study.md)) also records the AI readiness of the
original site, so before and after can be compared:

```bash
ai-readiness.mjs run --base https://old.cz --type <product type> \
  --out assets/case-study/pred/<YYYY-MM-DD>/ai-readiness
```

It is report only: it never blocks anything and needs no exceptions, because the old site is not
ours to fix. At launch the "po" run goes to `assets/case-study/po/<YYYY-MM-DD>/ai-readiness`
(the production gate run can double as it). No original site: nothing to capture.

## Contested and watch list

Not requirements; keep out of client promises.

| Topic | Status |
|---|---|
| `llms.txt` | A proposal, not a standard. Google says AI features need no special files; log and citation studies (secondary, vendor) show little or no crawler use or effect. Real use is by coding agents and documentation sites. Kept as a must because it is cheap and tools (Lighthouse, checkers) look for it. Promise no visibility |
| "AI optimisation" vs plain SEO | Google states AI Overviews and AI Mode have no extra requirements beyond being crawlable, indexable and snippet-eligible; most GEO tactics (chunking, FAQ blocks, answer-first) are vendor claims without measured effect. They are kept as good writing |
| Schema and citations | No demonstrated causal effect on AI citations; still needed for rich results and merchant listings. Some fetch tools strip `<script>`, so visible text must carry the same facts |
| `robots.txt` | Advisory. Training and search bots honour it, user-triggered fetchers generally do not |
| JS rendering | The claim that AI crawlers do not run JS rests on a single 2024 study; Googlebot does. Re-test with `curl`. Seznam publishes nothing; treat it as weak |
| WebMCP, NLWeb, `/.well-known/` agent files, Web Bot Auth | Experimental or drafts; no mainstream agent use shown. WebMCP is `info` only |
| Google UCP, OpenAI ACP (agentic commerce) | Emerging, US-first or scaled back; not actionable for Czech shops beyond clean feeds |
| Checker scores (Elementor, Cloudflare, Ora) | Measure delivery of standards with opaque weights, not citations. Our script is the only gate |

Measurement outside the gate: Bing Webmaster Tools AI Performance, Google Search Console, GA4
referrals from AI assistants (`utm_source=chatgpt.com`), manual prompts in Czech once a month.
