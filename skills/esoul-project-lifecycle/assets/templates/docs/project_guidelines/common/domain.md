# Project guidelines - Domain

The glossary and the `accepted` ADRs define the target domain contract; the code and its tests
show the implementation state. Current code never silently overrides an accepted decision, and
an older document never silently becomes one.

## Reading order and authority

For domain work, read the sources in this order. A higher source wins over a lower one:

1. [GLOSSARY.md](../../GLOSSARY.md) — the mandatory vocabulary — and
   [CONTEXT.md](../../CONTEXT.md) — the project conventions.
2. [docs/adr/](../adr/index.md) — the decisions that touch the area, following every
   supersession link. In a `light` tier project, `docs/rozhodnuti.md` (`D-nn`) plays this role.
3. [AGENTS.md](../../AGENTS.md) and these guidelines — the engineering rules, including where the
   code does not follow them yet.
4. The design — the Pencil file, read only through the Pencil MCP tools. It wins over the design
   tokens and over any summary of it.
5. The plan and the issue — scope and acceptance criteria.
6. `docs/podklady/` and `docs/legacy/` — evidence of how the client works and how the old system
   behaved. Evidence, never requirement.

The issue sets the scope of the work, but it does not override an `accepted` ADR. A section
„Rozhodnutí <datum>“ in an issue takes precedence over the issue text above it.

Read the ADRs the issue links and the ones whose title covers the area you change. There is no
mandatory sweep of every ADR before each task.

## ADR status authority

Every ADR declares exactly one status in its frontmatter, and
[docs/adr/index.md](../adr/index.md) is the source of truth for it. A pull request that changes a
status updates both.

| Status | Authority |
|---|---|
| `accepted` | The target contract, even when the code differs. Record the difference as a gap; never weaken the ADR to match the code. Change it by a dated note or by supersession. |
| `proposed` | Not an implementation specification. Work that depends on it says so and links it. Do not guess its open questions. |
| `superseded by ADR-NNNN` | Historical context only; follow the successor. |
| `deprecated` | MUST NOT be introduced in new work. |

The *Implementation status* section of an `accepted` ADR, not its *Decision*, tells you what runs
today.

## Vocabulary

- Use the glossary term for a domain concept in code, identifiers, test names, issue and pull
  request titles, interfaces and documentation. Do not drift to a synonym the glossary lists
  under `_Avoid_`.
- Identifiers are English; the value a user sees keeps its Czech form from the glossary (a
  status, a type, a label).
- A concept the glossary lacks is a signal. Reconsider whether it belongs to the project; if it
  does, add the term in the same pull request that introduces it.

## Open points and conflicts

- Text marked as open, working, deferred or awaiting confirmation is not a requirement and MUST
  NOT be guessed. An open point blocks only the dependent slice: split it out and ask through the
  question register.
- If an issue, a guideline or a proposed change contradicts an `accepted` ADR, or two accepted
  ADRs contradict each other, or a supersession target is missing, report the conflict instead of
  choosing a source silently.

## Money

These principles hold in every eSoul project that stores or computes amounts:

- **No floating point for money.** An amount is never stored, passed or computed as `float` or
  as a JavaScript `Number` used for arithmetic. A `float` on the path of a money value is a
  `Blocker` ([code-review.md](code-review.md)).
- An amount is an **integer in minor units** together with its **currency**, held in a money
  value object or in fields whose name states the unit (for example a `_minor` suffix). A field
  never mixes units, and neither do a function's parameters. A rate, percentage or coefficient
  is an exact decimal (a `DECIMAL` column, a decimal string or arbitrary-precision type in code).
- Arithmetic happens only within one currency. A conversion uses the rate stored on the entity
  being converted (an order keeps its own rate), never the current one.
- Conversion between units happens at the boundary that needs it, **exactly once**, through one
  shared helper. Code never multiplies or divides by 100 by hand.
- **Rounding is explicit and happens once per calculation chain**, at the place the documented
  formula names, with a named rounding mode. A value is never rounded "for safety" and never
  rounded twice.
- When amounts from two systems are compared, the tolerance is explicit, named and tested.
- A customer never sees a bare number: an amount is rendered with its currency (and its VAT mode
  where it matters) by one shared formatter. A formatted string is never parsed back and never
  feeds a calculation.

<!-- optional: project currencies and formats -->
In this project the representation is decided by {{MONEY_ADR}}: currencies {{CURRENCIES}}; the
money type is {{MONEY_TYPE}}; amounts are formatted by {{MONEY_FORMATTER}}.

## Time and dates

- A timestamp is an **instant**: stored and transported in UTC with an explicit offset (ISO 8601
  with `Z` or an offset). A wall-clock string without a zone is never stored or sent.
- The application clock stays UTC. The business time zone is **{{TIME_ZONE}}**; it is applied
  only where a date is shown to a person or a calendar boundary is cut (a day, a month, a
  deadline, a document date).
- A calendar date that a user or a document sees is the date in {{TIME_ZONE}}, never the UTC date
  cut from an ISO string.
- Backend logic does not use local-time methods or format a date without an explicit time zone.
  A scheduled job whose wall-clock hour matters says in which zone the hour is meant.
- Dates are formatted by one shared formatter with the user's locale and the business time zone,
  so a server render and the browser agree.
- A test of date logic fixes the clock and includes an instant just after midnight in
  {{TIME_ZONE}}, which is still the previous day in UTC.

<!-- optional: localized application -->
## Languages and locales

The application serves {{LOCALES}}; the default is {{DEFAULT_LOCALE}}. Language, currency and
(where they exist) region or sales channel are independent concepts: none of them is derived from
another. User-facing text goes through the translation files, never hard-coded in components.
