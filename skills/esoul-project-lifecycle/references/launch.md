# Launch readiness (`launch`)

Run before a public website or application goes live, and record the result in
`docs/nasazeni.md` (light tier) or the handover documentation (full tier). Each item needs
evidence: a command output, a screenshot, or a link.

## Content and SEO / GEO

- [ ] Every page has a unique title, description and canonical URL.
- [ ] Structured data (JSON-LD) validates for the page types used (Organization or
      LocalBusiness, Person, Service, Product, FAQ, Breadcrumb).
- [ ] Open Graph and Twitter images 1200 × 630 exist for every indexable page.
- [ ] `sitemap.xml` lists every public page and nothing else; `robots.txt` points to it and
      allows AI crawlers unless the client decided otherwise (record that decision).
- [ ] `llms.txt` (and `llms-full.txt` where useful) describes the site.
- [ ] 301 redirects from every old URL that had traffic or backlinks; removed media return 410.
- [ ] Trailing-slash policy is consistent with canonicals and the sitemap.

## Quality

- [ ] Playwright smoke of every route at 1440 and 390 px passes with no console errors and no
      broken images or links.
- [ ] Lighthouse mobile on key templates: performance ≥ 90, accessibility, best practices and
      SEO 100, LCP < 2.5 s, CLS < 0.05.
- [ ] axe reports no serious or critical violations; keyboard navigation and focus states work;
      `prefers-reduced-motion` is honoured.
- [ ] Forms work without JavaScript, reject spam (honeypot, rate limit, captcha where chosen)
      and deliver to the right mailbox; a fallback store exists.

## Security and operations

- [ ] Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- [ ] Secrets only in the deployment environment; nothing in the image or repository.
- [ ] Backups configured and one restore tested.
- [ ] Error and uptime monitoring configured.
- [ ] Cookie consent and analytics configured per the client's decision.

## Switch-over

- [ ] `noindex` and basic auth removed from production, kept on staging and previews.
- [ ] DNS and TLS ready; the old site's shutdown or redirect planned.
- [ ] After launch: Google Search Console and Bing Webmaster with the sitemap submitted,
      Google Business Profile and Firmy.cz updated, analytics receiving data.
- [ ] The client has accepted the site on the preview, recorded with a date.
