---
name: esoul-offer-authoring
description: Write an eSoul client offer (nabídka, cenová nabídka) step by step - intake, evidence research of the client's current site or specification, scope and package design, pricing, the offer text, and the branded DOCX. Use when asked to prepare, draft, price or revise an offer or proposal for a client. Rendering into the company template stays with esoul-office-documents.
---

# Offer authoring

An offer is a sales document backed by evidence. The client should recognise their own
situation in it, see what they get for each price, and know what to decide next. This skill
owns the content and the process; `esoul-office-documents` owns the template and rendering.

## Workflow

Run the steps in order. Steps 2 and 3 run in parallel through subagents so raw pages, HTML
and repository dumps stay out of the main context.

### 1. Intake

Collect from the request, not by asking, whatever is already there:

- client and contact person, what they asked for, and why now (the business trigger),
- which legal entity makes the offer, because the supplier block and the rate follow from it,
- budget anchors the salesperson gave (target price per package, ceiling),
- required comparisons (platforms, variants) and required sections (sitemap, user flow),
- remarks from colleagues about known problems, quoted verbatim.

Ask only for what blocks pricing and cannot be found: the legal entity and the hourly rate if
no previous offer for that entity states them. Everything else becomes an open point in the
offer.

### 2. Evidence research (parallel)

Pick the briefs that fit the offer type; one subagent per brief, each told to separate
verified facts (and how they were verified) from estimates and from what could not be checked.

| Offer type | Research |
| --- | --- |
| New site or e-shop, redesign | Current site: platform and age, navigation and sitemap, purchase flow, mobile, speed, measurement and consent, product feeds, SEO and AI readiness (structured data, canonical, hreflang, `llms.txt`), trust signals. Sister sites and language versions separately. |
| Product with a configurator or other core tool | Click it through in a real browser on two or three products and write exact reproduction steps for every defect, with URLs. Reproduce what colleagues reported and say whether it is confirmed. |
| Integration, middleware | Client specification point by point, public documentation of both systems, limits, test environments, licences, personal data. |
| Any | The reference projects whose stack or platform the offer builds on: versions, what is already built and reusable, known limits from their ADRs. |

Research is read-only. Never submit an order or a form with real data on a client site.

Check claims from the request against the evidence. When the evidence contradicts the brief
(for example "a pixel cannot be inserted" while a tag manager is present), the offer states
what was found and the reply to the user calls the correction out.

### 3. Previous offers

Read the most recent offer of the same kind as the model for structure, tone, rate and
payment terms. Offers live in each project's `Sales/` folder as a Markdown source next to the
DOCX. Reuse wording for boilerplate chapters; never copy client-specific facts.

### 4. Scope and packages

- Derive scope from the findings: every major finding maps to something the offer delivers,
  or is named as out of scope.
- When the client is price-sensitive, offer two packages. The cheaper one must still solve
  the business trigger completely (if the client came for campaigns, measurement, feeds and
  marketing readiness are in both). The larger one adds robustness and reach.
- Make the cheaper package the first stage of the larger one, on the same platform, and say
  so. State plainly what the cheaper package leaves out.
- Put quick wins that work on the current solution among the optional items.

### 5. Pricing

- Price is hours times the hourly rate; give hours and price per line, with a total row.
  State the rate once in the offer and use it on every line.
- Project management, testing and acceptance are visible lines, not hidden in other items.
- Fit a budget anchor by adjusting scope, never by lowering the rate or hiding work.
- Recompute every total before writing it. Sums in the summary table, the package tables and
  the text must match.
- Add a reserve of 10 % of the work hours as its own last line before the total in every
  price table ("Rezerva na nepředvídané práce (10 %)"), rounded to whole hours. The total
  includes it, so a budget anchor is met with the reserve inside. Say in the offer that the
  reserve is drawn only with the client's approval and that the unused part is not invoiced.
- State what replaces the estimate (a fixed price after analysis). Do not mix a from-to
  range in the lines with a single figure in the summary.
- After any change of scope, hours or rate, recompute every table and the summary; stale
  totals after an edit are the most common defect of past offers.
- If a requested budget is not realistic for the scope, say so to the user with the reason
  and the scope that does fit; do not silently pad or cut.
- Operating costs, SLA and third-party fees are separate from the delivery price.
- Operation always has three variants: A hosted by us, B on the client's infrastructure with
  our supervision, C run by the client alone, where we hand over the source code and
  deployment documentation and charge no monthly fee. Monthly prices of A and B are a
  proposal to be confirmed by a colleague; flag them in the handover.

### 6. Write the offer

Markdown source in `Sales/nabidka/nabidka-<topic>.md`. Chapter order:

1. Title, one-sentence subtitle, version, date, "Důvěrné"; page break; contracting parties.
2. Shrnutí: the main findings, the recommendation, the price table, the delivery time.
3. Findings (what we found), with a table of concrete defects: what, where, impact.
4. Proposed solution.
5. Sitemap, current and proposed; customer journey, current and proposed (for web offers).
6. Packages compared side by side, and what the cheaper one leaves out.
7. Technology comparison when the stack is open, ending in a recommendation and the rule for
   the final choice.
8. Prices per package, optional items.
9. Schedule.
10. How we work, operation and support.
11. Open points and assumptions, what is out of scope, required cooperation.
12. Payment terms and validity, place, date, signature.

Chapters 3 to 7 depend on the offer type: sitemap and customer journey for sites and
e-shops, analysis of the current state for migrations, open questions with their impact on
price for integrations and information systems, SLA parameters when the client asks for
guaranteed availability. A small fixed-price job can merge chapters but keeps the mandatory
statements.

Mandatory statements in every offer, whatever its size: version and date, client
identification, prices without VAT, the 10 % reserve line, payment schedule,
invoice due date, validity of the offer, free repair period, who owns the source code, what
is out of scope, assumptions, the three operation variants.

Rules, in addition to the authoring rules of `esoul-office-documents`:

- Write for the client's decision maker: plain Czech, no internal project or client names,
  no developer jargon without a short explanation.
- Every finding carries its evidence (page, product, number). Mark what is an assumption.
- Say what was not available (for example access to the administration) and how that limits
  the offer.
- Claims about our experience must be true today: "we are building" is not "we operate".
- The template renders tables and lists, not images. Present sitemaps and flows as
  current-versus-proposed tables.
- Take the supplier block, signature line and payment terms from the previous offer.
- Client identification only from public sources (their site, the business register).

### 7. Render and verify

1. Render with `esoul-office-documents` (`md_to_docx.py`) to
   `Sales/eSoul-nabidka-<Klient>-<topic>.docx`. Only DOCX unless a PDF is asked for.
2. Check the archive, then the structure: table and heading counts match the source, no
   Markdown markers left in the text.
3. Check the pages visually through a PDF export. If the export cannot be produced, say so
   in the reply; do not claim the layout was checked.
4. Run `python3 scripts/check_offer.py OFFER.md --rate RATE`. It recomputes every table
   with a "Celkem" row, checks hours times rate on each line, and reports leftover
   placeholders and missing mandatory statements. Fix the source and rebuild until it is
   clean; a justified exception is named in the handover.
5. Read the document once as the client: no internal remarks, notes to self, informal
   address, other clients' names or sample text.

### 8. Hand over

Reply to the user with: the file paths, the package prices, the findings that changed the
brief, the decisions made on their behalf (rate, operating costs, split of packages), and
what they should confirm before sending. Later changes go into the Markdown source and the
DOCX is rebuilt, never edited by hand.

## Common corrections

Feedback given on earlier offers; apply it from the start.

- Schedules were too long. Propose the shortest realistic schedule and state its conditions.
- For each price, describe what the client receives, most of all for the first stage.
- Say that the solution is built on a proven platform, not that it is taken over from
  another client's project.
- Mention acceptance testing and documentation as part of the delivery.
- Never mention internal tooling, automation or AI as the way the work is done.
- Operating prices may be adjusted by a colleague; flag them as to be confirmed.
- Always include operation variant C (the client runs it alone).

Defects found in past offers; the check script catches the first three.

- Totals that did not match their lines, usually after a later edit of scope.
- Placeholders and internal remarks left in the sent document ("XXXX", "k diskuzi", notes
  on how to recompute fields).
- Missing payment terms, validity, warranty or code ownership.
- Inconsistent facts between chapters (technology versions, application type).
- Hours too low to be believed for analysis or project management.
