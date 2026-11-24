# Research briefs

Read when you start step 2 (evidence research). Pick the briefs that fit the offer type; give each
one to its own read-only subagent when the harness offers subagents, otherwise run them yourself
one after another. Every brief returns three lists: verified facts (and how they were verified),
estimates, and what could not be checked.

| Offer type | Research |
| --- | --- |
| New site or e-shop, redesign | Current site: platform and age, navigation and sitemap, purchase flow, mobile, speed, measurement and consent, product feeds, SEO and AI readiness, trust signals. Sister sites and language versions separately. |
| Product with a configurator or other core tool | Click it through in a browser on two or three products and write exact reproduction steps for every defect, with URLs. Reproduce what colleagues reported and say whether it is confirmed. Without a browser tool, say so and list the tool as not checked. |
| Integration, middleware | Client specification point by point, public documentation of both systems, limits, test environments, licences, personal data. |
| Any | The reference projects whose stack or platform the offer builds on: versions, what is already built and reusable, known limits from their ADRs. |

- Research with read-only requests: reading pages and calling public endpoints on the client's site
  (`docs/project_guidelines/security-and-data.md` › Production access).
- **AI readiness criteria** come from the guidelines, not from this skill: `public-website.md`
  (crawling, sitemap, `llms.txt`, canonical) and the Astro `seo.md` (structured data, hreflang).
  Check the client's site against them and report each gap with its URL.
- Check claims from the request against the evidence. When the evidence contradicts the brief (for
  example "a pixel cannot be inserted" while a tag manager is present), the offer states what was
  found and the reply to the user calls the correction out.
