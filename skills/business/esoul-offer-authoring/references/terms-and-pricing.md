# Terms and pricing policy

Read when you design packages or price an offer (steps 4 and 5) and when you write the mandatory
statements (step 6).

**Owner: Tomáš Vojík.** This is eSoul's sales policy, not a guideline: changes to the reserve, the
operation variants, the mandatory statements or the package rule go through him, and this file is
changed with his approval. Treated as current since the content review of 2026-11-24 (the owner did
not object to the 10 % reserve and the three operation variants). Raise it with the owner when an
offer needs to depart from any of it.

## Packages

- When the client is price-sensitive, offer two packages. The cheaper one still solves the business
  trigger completely (if the client came for campaigns, measurement, feeds and marketing readiness
  are in both). The larger one adds robustness and reach.
- The cheaper package is the first stage of the larger one, on the same platform; the offer says
  so and states plainly what the cheaper package leaves out.
- Quick wins that work on the current solution are optional items.

## Reserve

Every price table has a reserve of 10 % of the work hours as its own last line before the total,
rounded to whole hours: cs "Rezerva na nepředvídané práce (10 %)", en "Contingency reserve (10 %)".
The total includes it, so a budget anchor is met with the reserve inside. The offer says that the
reserve is drawn only with the client's approval and that the unused part is not invoiced.

## Operation variants

Operation always has three variants: A hosted by us, B on the client's infrastructure under our
supervision, C run by the client alone, where we hand over the source code and the deployment
documentation and charge no monthly fee (cs "provoz ve vlastní režii", en "operated by the
client"). Variant C is always included. The monthly prices of A and B are a proposal that a
colleague confirms: flag them in the handover. Operating costs, SLA and third-party fees stay
separate from the delivery price.

## Mandatory statements

Every offer, whatever its size, states:

- Checked by `scripts/check_offer.py` (its output is the checklist): prices without VAT, validity
  of the offer, invoice due date, issue date, free repair period or warranty, the reserve line,
  operation variant C.
- Verified by you (the script prints this list): version and client identification, payment
  schedule, who owns the source code, what is out of scope, assumptions, operation variants A and B.
- Supplier block, signature line and payment terms: taken from the previous offer, otherwise asked
  of the user (step 1); what stays unknown is written `TBD`.
