# Architecture decision records (P3–P4, `adr`)

## ADR or guideline?

Write an ADR only when genuine alternatives have meaningful, hard-to-reverse consequences:
domain model, money and precision, integrations and their ownership, state machines,
authorization model, data migration strategy, hosting topology, content editing model.
A rule that could not reasonably have gone the other way, or a tool choice, is a project
guideline. Light-tier projects use `docs/rozhodnuti.md` (`D-nn` entries with date, decision,
reason, rejected options) instead of ADRs until they escalate.

## Format

Start from `assets/templates/docs/adr/0000-template.md`.

- File `docs/adr/NNNN-english-slug.md`, next free number, never reused.
- English. H1 is the decision as a statement (`Prices are stored as integer minor units`), not
  a topic.
- Frontmatter `status`, `date` (when the status last changed), `deciders` (who decided: people
  with their organisation where known, e.g. `Jan Novák (Client), eSoul`).
- **Context**: the problem, the source (podklad note, legacy document, question `Q-nn`, issue)
  and how the client or the previous system handles it today. Technical facts (library or API
  behaviour, limits, pricing, legal rules) come from primary sources: official documentation,
  source code, specifications, first-party APIs. Cite the source next to each claim. Delegate
  long reading to a background subagent on `sonnet` with a fresh context; its findings go into
  this section or the issue, never into a separate report file.
- **Decision**: present tense, no "should". Link open questions instead of inventing answers.
- **Consequences**: including the unpleasant ones.
- **Alternatives considered**: at least two rejected options with the reason.
- **Implementation status as of YYYY-MM-DD**: required once `accepted`. The files and tests
  that implement it, then every gap with the issue that closes it, or "No issue". While the
  repository has no application code it says only "No application code yet."

## Status lifecycle

`proposed` → `accepted` → `superseded by ADR-NNNN` or `deprecated`.

- `proposed` is not an implementation specification. Issues that depend on it stay `needs-info`.
- `accepted` is the target contract, even when the code differs. Never weaken it to match code;
  open a gap issue instead.
- `docs/adr/index.md` is the status source of truth. Update the table and the frontmatter in the
  same pull request.
- Changing an ADR:
  - never accepted → amend in place with a dated revision note;
  - accepted, a detail changes → dated `> Note of YYYY-MM-DD from <who>` under the title;
  - accepted, the substance flips → new ADR that `Supersedes ADR-NNNN`; mark the old one
    `superseded by ADR-MMMM` and keep it.
- Numbers may be reserved in the index for decisions known to come later.

## Acceptance

Accept ADRs in a reviewed batch PR, one commit per ADR
(`:memo: [<scope>] accept ADR-0002 <short title>`), with the deciders confirmed. The index
records the review date. Accepting an ADR that closes a client question also closes the
question in the register.

## Index sections

Records table (number, decision, status, date), Revisions log, What still blocks (proposed ADRs and
the questions they wait for), Candidates for future ADRs (create only when the decision becomes
active).
