# Offer structure

Read when you write the offer text (step 6). The offer is plain Markdown in the Markdown subset of
`esoul-office-documents`, in the offer language (Czech by default, English with `--lang en`).

## Chapter order

1. Title, one-sentence subtitle, version, date, "Důvěrné" (en: "Confidential"); page break;
   contracting parties.
2. Summary (cs: Shrnutí): the main findings, the recommendation, the price table, the delivery time.
3. Findings (what we found), with a table of concrete defects: what, where, impact.
4. Proposed solution.
5. Sitemap, current and proposed; customer journey, current and proposed (for web offers).
6. Packages compared side by side, and what the cheaper one leaves out.
7. Technology comparison when the stack is open, ending in a recommendation and the rule for the
   final choice.
8. Prices per package, optional items.
9. Schedule.
10. How we work, operation and support.
11. Open points and assumptions, what is out of scope, required cooperation.
12. Payment terms and validity, place, date, signature.

## Variation by offer type

Chapters 3 to 7 depend on the offer type: sitemap and customer journey for sites and e-shops,
analysis of the current state for migrations, open questions with their impact on price for
integrations and information systems, SLA parameters when the client asks for guaranteed
availability. A small fixed-price job can merge chapters and keeps the mandatory statements of
`terms-and-pricing.md`.

## Writing rules

- The renderer produces tables and lists; show sitemaps and flows as current-versus-proposed
  tables.
- Write for the client's decision maker: plain language, developer jargon only with a short
  explanation.
- Every finding carries its evidence (page, product, number). Mark what is an assumption.
- Say what was not available (for example access to the administration) and how that limits the
  offer.
- Claims about our experience are true today: "we are building" is not "we operate".
- Client-facing text follows `docs/project_guidelines/security-and-data.md` › Personal and client
  data: internal project names, other clients' data and non-public figures from earlier offers stay
  out; the client is identified from public sources (their site, the business register).
- Describe deliverables and results; the way the work is produced (tooling, automation, AI) stays
  out of the document.
