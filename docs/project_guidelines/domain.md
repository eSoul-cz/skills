<!-- esoul-guidelines:begin domain -->
# Project guidelines - Domain

The glossary and the `accepted` ADRs define the target domain contract; the code and its tests show the implementation state. Current code never silently overrides an accepted decision, and an older document never silently becomes one.

## Reading order and authority

For domain work, read the sources in this order. A higher source wins over a lower one:

1. [GLOSSARY.md](../../GLOSSARY.md) - the mandatory domain vocabulary - and [CONTEXT.md](../../CONTEXT.md) - the project conventions, which hold no domain terms.
2. `docs/adr/` - the decisions that touch the area, following every supersession link - and the decision register of the plan (`docs/plan/`), which ranks with the ADRs as a recorded decision. A project whose decision register is another file (for example `docs/rozhodnuti.md`) names it in `CONTEXT.md` under its sources of truth, and that file ranks the same way.
3. [AGENTS.md](../../AGENTS.md) and these guidelines - the engineering rules, including where the code does not follow them yet.
4. The design, where the project has one. It wins over design tokens and over any summary of it.
5. The plan's slices and schedule, and the issue - scope and acceptance criteria.
6. Client source material and notes on the previous system - evidence of how the client works and how the old system behaved. Evidence, never requirement.

The issue sets the scope of the work, but it does not override an `accepted` ADR. A decision recorded later in an issue's own decision section takes precedence over the issue text above it.

Read the ADRs the issue links and the ones whose title covers the area you change. There is no mandatory sweep of every ADR before each task.

## ADR status authority

Every ADR declares exactly one status in its frontmatter, and the ADR index is the source of truth for it. A pull request that changes a status updates both.

| Status | Authority |
|---|---|
| `accepted` | The target contract, even when the code differs. Record the difference as a gap; never weaken the ADR to match the code. Change it by a dated note or by supersession. |
| `proposed` | A candidate. It MUST NOT be implemented as if it were decided; work that depends on it waits for the decision, unless the owner explicitly approves a pilot. The ADR then records the pilot under *Implementation status* and is accepted or amended after it. |
| `superseded` | History only. Its status names the successor (`superseded by ADR-NNNN`); follow that link. |
| `deprecated` | MUST NOT be introduced in new work. |

The *Implementation status* section of an `accepted` ADR, not its *Decision*, tells you what runs today.

## Vocabulary

- Use the glossary term for a domain concept in code, identifiers, test names, issue and pull request titles, interfaces and documentation. Do not drift to a synonym the glossary lists under `_Avoid_`.
- Identifiers are English; the value a user sees keeps its original-language form from the glossary (a status, a type, a label).
- A concept the glossary lacks is a signal. Reconsider whether it belongs to the project; if it does, add the term to the glossary, preferably in the pull request that introduces it (a stacked pull request is allowed, see [documentation.md](documentation.md#documentation-rides-with-the-change)).

## Open points and conflicts

- Text marked as open, working, deferred or awaiting confirmation is not a requirement and MUST NOT be guessed. An open point blocks only the dependent slice: split it out and ask through the question register: the project's tracker, as an issue or task labelled `question`, never a file ([documentation.md](documentation.md#where-a-piece-of-knowledge-belongs)).
- A rule that is not written down is not settled. Decide it, and record it where it belongs, before implementing it; never guess a rule because the data seems to imply it.
- Numbers, formulas and calculations come only from the client's materials (the source documents, spreadsheets and exports kept as evidence) or from a recorded decision (an ADR or the plan's decision register); never from memory, from the code of the previous system alone or from a guess. Where the client works in spreadsheets, pin the calculation with parity tests, and record a number the materials do not give as an open point.
- If an issue, a guideline or a proposed change contradicts an `accepted` ADR, or two accepted ADRs contradict each other, or an `accepted` ADR and a decision in the plan's decision register contradict each other, or a supersession target is missing, report the conflict instead of choosing a source silently.

## Money

These principles hold in every project that stores or computes amounts:

- **No floating point for money.** An amount is never stored, passed or computed as `float` or as a JavaScript `Number` used for arithmetic. A `float` on the path of a money value is a `Critical` ([code-review.md](code-review.md)).
- An amount is an **integer in minor units** together with its **currency**, held in a money value object or in fields whose name states the unit (for example a `_minor` suffix). A field never mixes units, and neither do a function's parameters. A rate, percentage or coefficient is an exact decimal (a `DECIMAL` column, a decimal string or an arbitrary-precision type in code).
- Arithmetic happens only within one currency. A conversion uses the rate stored on the entity being converted (an order keeps its own rate), never the current one.
- Conversion between units happens at the boundary that needs it, **exactly once**, through one shared helper. Code never multiplies or divides by 100 by hand.
- **Rounding is explicit and happens once per calculation chain**, at the place the documented formula names, with a named rounding mode. A value is never rounded "for safety" and never rounded twice.
- When amounts from two systems are compared, the tolerance is explicit, named and tested.
- A customer never sees a bare number: an amount is rendered with its currency (and its VAT mode where it matters) by one shared formatter. A formatted string is never parsed back and never feeds a calculation.

A project that stores money records its representation (currencies, money type, formatter) in an ADR and follows it.

## Time and dates

- A timestamp is an **instant**: stored and transported in UTC with an explicit offset (ISO 8601 with `Z` or an offset). A wall-clock string without a zone is never stored or sent.
- The application clock stays UTC. The business time zone is named in the project's [CONTEXT.md](../../CONTEXT.md); it is applied only where a date is shown to a person or a calendar boundary is cut (a day, a month, a deadline, a document date).
- A calendar date that a user or a document sees is the date in the business time zone, never the UTC date cut from an ISO string.
- Backend logic does not use local-time methods or format a date without an explicit time zone. A scheduled job whose wall-clock hour matters says in which zone the hour is meant.
- Dates are formatted by one shared formatter with the user's locale and the business time zone, so a server render and the browser agree.
- A calendar fact (a birth date, an invoice date, an opening hour) is stored as `DATE` or `TIME` and is never converted between time zones.
- The test that proves date logic is in [testing.md](testing.md#writing-tests): it fixes the clock and includes an instant just after midnight in the business time zone.

## Languages and locales

Where the application serves more than one language, the supported locales and the default are named in the project's [CONTEXT.md](../../CONTEXT.md). Language, currency and (where they exist) region or sales channel are independent concepts: none of them is derived from another. User-facing text goes through the translation files, never hard-coded in components or templates.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end domain -->
