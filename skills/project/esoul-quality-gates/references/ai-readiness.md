# AI readiness

An eSoul public site is built so that search engines, AI assistants and agents can find, read and
use it. The rules for public pages (HTML content, crawling and indexing, sitemap, `llms.txt`,
Markdown versions, preview gate, redirects, exceptions) belong to the guideline
`public-website.md` (`docs/project_guidelines/public-website.md` in the project): read it first and
do not restate it. This file holds what only the skill owns: the standard slices AI-01…AI-06, their
checks, the checker `scripts/ai-readiness.mjs`, the launch gate and the exception procedure.
Crawler list, stack notes, content rules and the contested list are in
[ai-readiness-reference.md](ai-readiness-reference.md); load it when a row below says so.

## Scope

| Product type | Rule |
|---|---|
| `website`, `website-admin`, `eshop` | Slices AI-01…AI-05; AI-06 for `eshop` only |
| `application` | Its public part only (landing, marketing, public catalogue); no slices unless the public part is a product in itself. Run the checker with `--type application` when in doubt |
| No public site | Not applicable; delete the AI slices |

The product type is in `CONTEXT.md › Project profile`. Conformance warns (`ai-readiness-doc`,
`ai-readiness-slices`) when an in-scope project lacks `docs/ai-readiness.md` or the slices.

## Principles

1. **No external services.** No external checkers, SaaS or CDN features (managed robots.txt,
   Markdown conversion) and no plugin as the source of truth. The site generates robots.txt,
   sitemap, `llms.txt`, Markdown versions, JSON-LD and feeds from its own data; the bundled script
   verifies them locally.
2. **One source of data.** Pages, JSON-LD, Markdown, `llms.txt`, sitemap and feeds come from the same
   data and never disagree (price, availability, address, dates).
3. **Stack-agnostic.** Requirements are the same everywhere; implementation notes per stack are in the
   reference.

## Checks by slice

Levels: **must** blocks launch, **should** is a warning to fix unless there is a reason, **info** is
reported only. A check on a guideline rule is never stronger than the guideline's wording (SHOULD →
should, MAY → info). `Check` is the stable id of the checker, used in exceptions and reports.
`Rule`: **G** = the guideline owns it and the check verifies it, **S** = skill policy defined here.

| Slice | Level | Check | Rule | Requirement |
|---|---|---|---|---|
| AI-01 Crawler access | must | `robots` | G | `robots.txt` answers 200 as text, no applicable group disallows `/` or the sampled pages for a listed bot, `Sitemap:` present |
| | must | `bot-access` | S | Home and sampled pages answer 200 to every bot UA of the checker with no challenge (`cf-mitigated`, CAPTCHA, 403/429/503) and a body comparable to the browser's: firewall, WAF, security plugins and host rules let the bots through (list: reference) |
| | must | `indexable` | G | Production has no `noindex` (meta or `X-Robots-Tag`); previews follow the guideline's preview gate, `robots.txt` reachable without auth |
| | must | `sitemap` | G | Absolute same-host URLs, `<lastmod>` on every `<url>`, sampled URLs answer 200, indexable pages only; on a preview a missing sitemap is `info` with `--staging` |
| | should | `indexnow` | S | Key file `/<key>.txt` with the key as body; the site pings IndexNow when a page is published or changed |
| AI-02 HTML and semantics | must | `ssr-content` | G | Raw HTML has the h1 and at least 70 % of the words of the rendered `main`; internal navigation links are in raw HTML |
| | must | `html-basics` | G + S | `<html lang>`, title, meta description, absolute canonical (G); reciprocal `hreflang` with `x-default` on multilingual sites (S) |
| | must | `semantics` | S | One h1, a `main` landmark, accessible names on form controls, real `<a>` and `<button>`; native HTML first, ARIA only to fill gaps |
| | should | `og` | S | `og:title`, `og:description`, `og:image` (absolute, 1200 × 630), `og:url` |
| | should | `captcha` | G | No CAPTCHA wall in front of content or the contact route; an e-mail or phone fallback |
| | should | `images-alt` | S | Content images have `alt` (decorative `alt=""` allowed) |
| AI-03 Structured data | must | `jsonld` | S | Every block parses; home has Organization or LocalBusiness and WebSite; articles have Article/BlogPosting with author, `datePublished`, `dateModified`; BreadcrumbList on inner pages (warn) |
| | must (eshop) | `product-data` | S | Product with name, image, `offers.price`, `priceCurrency`, `availability`; `shippingDetails` and `hasMerchantReturnPolicy` (warn); the price equals the visible price |
| AI-04 Facts | must | `facts` | S | Raw HTML of home or contact has phone or e-mail, a postal address and, on Czech sites, the IČO, as text |
| | must (eshop), should | `policies` | S | Privacy policy linked site-wide; eshop also terms and conditions, shipping and payment, returns and complaints |
| | should | `article-meta` | S | Articles show author and a visible update date in raw HTML |
| AI-05 llms.txt, Markdown | should | `llms-txt` | G | `/llms.txt` answers 200 as `text/plain` or `text/markdown`, starts with `# `, has a summary and at least 3 links that answer 200 |
| | info | `markdown` | G | Prose pages: `Accept: text/markdown` returns Markdown with `Vary: Accept`, and/or `<url>.md` advertised by `<link rel="alternate" type="text/markdown">`; it contains the page's h1. Interface pages have none |
| | info | `webmcp` | S | WebMCP attributes or `navigator.modelContext`; experimental, never required |
| AI-06 Feeds (eshop) | must | `feeds` | S | Each feed answers 200 as XML with the required fields (formats: reference), unique `ITEM_ID`, prices and availability equal to the product page and its JSON-LD |

Neither `llms-txt` nor `markdown` blocks a launch (the reference lists why). Generate JSON-LD as one
graph per page from site data, never fake reviews or `AggregateRating`; markup matches visible
content. Generate `llms.txt` and Markdown from the page content, cached, never by an external
converter.

## The checker

`scripts/ai-readiness.mjs` (Node 22 or newer; Playwright and Chrome from `~/.cache/esoul-uat` for
`ssr-content` and `semantics`; no external services). `ai-readiness.mjs --check` lists what is
missing; the script header lists every option.

```bash
ai-readiness.mjs run --base https://site.cz [--urls file | --max 20] [--type website|website-admin|eshop|application]
  [--staging] [--exceptions docs/ai-readiness.md] [--feeds google=/feed.xml,zbozi=/zbozi.xml,heureka=/heureka.xml]
  [--indexnow-key <key>] [--header 'Name: value']... [--auth user:pass] [--out dir] [--json] [--no-browser]
```

- Pages come from `--urls` (the format of `assets/case-study/urls.txt`) or are discovered, one per
  template up to `--max`. On a protected preview pass `--auth` or `--header`.
- Exit 0: every `must` passed or has a confirmed exception; 1: an unexcepted `must` failed; 2: usage
  or tool error. `should` and `info` never change the exit code. `--out` writes `report.json` and
  `report.md`.
- `--staging` expects the guideline's preview gate: bot rules in `robots`, `indexable` and a missing
  sitemap become `info`. `--no-browser` skips `ssr-content` and `semantics`; a gate run uses the
  browser.

| Moment | Run | Result |
|---|---|---|
| During the build | any time on the preview, as a self-check | optional |
| Before the DNS switch | `run --base <staging> --staging … --out assets/ai-readiness/<YYYY-MM-DD>/` | every `must` passes or is excepted |
| Right after the switch | the same on production | same; the first production run proves `bot-access`, `indexable` and `sitemap` |
| Audit of a live site | the same on production | findings go to the audit report |

Record every gate run in the run log of `docs/ai-readiness.md` (date, environment, `must x/y`,
`should x/y`, report path). The run is mechanical: hand it to a cheap helper when the harness
offers one, otherwise run it yourself; the result is the summary, the failed checks and the report
path. A failing `bot-access` check: read the verification procedure in the reference before
recording anything.

## Exceptions

A failing `must` blocks launch. The only way past it is an exception confirmed by the project lead
(not by the implementer) in the `## Exceptions` table of the project's `docs/ai-readiness.md`:

```md
| Check | Scope | Reason | Confirmed by | Date |
|---|---|---|---|---|
| robots | * | The client opts out of model training: GPTBot and CCBot disallowed (ADR 0012) | Name | 2026-11-12 |
```

`Check` is the check id, `Scope` is `*` or a URL path prefix. A row without `Confirmed by` or `Date` is
ignored and reported as ignored. A deviation from a rule the guideline owns (the `G` rows: a blocked
bot, no sitemap) also has an ADR, as the guideline's Exceptions section requires; the row cites it
in `Reason`. `should` and `info` checks need no row. A legacy page that cannot be fixed or a feed
for a marketplace the shop does not use are typical exceptions. Exceptions are reviewed at every
launch and audit. The parser also accepts the Czech header set (`## Výjimky`, `Kontrola | Rozsah |
Důvod | Potvrdil | Datum`) of projects started before the English template.

## Case study

The case-study capture of the original site (skill `esoul-website-launch`) also stores a checker
report so that before and after can be compared: report only, no exceptions, because the old site
is not ours to fix. Its commands are in that skill.
