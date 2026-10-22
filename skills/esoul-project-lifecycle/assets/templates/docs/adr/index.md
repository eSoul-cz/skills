# Architecture Decision Records

An ADR records a decision or a proposed design direction. **Its existence does not prove that
the behaviour is implemented.** When code and an ADR differ, code and tests describe runtime
behaviour; the ADR remains the target contract and the difference is recorded as an
implementation gap in its *Implementation status* section. **Never weaken an ADR to match the
code.**

Open points that block a decision live in
[docs/podklady/otevrene-otazky.md](../podklady/otevrene-otazky.md); the answers are recorded
here, not there.

## Statuses

Every ADR uses one of these frontmatter statuses:

| Status | Meaning |
|---|---|
| `proposed` | Awaiting discussion or a client answer; **not an implementation specification**. |
| `accepted` | Valid target contract. |
| `superseded by ADR-NNNN` | Historical context; follow its successor. |
| `deprecated` | Do not introduce this approach in new work. |

`date` is the day the status last changed, and `deciders` names who decided (the client, eSoul,
or both).

## When to write an ADR

Write one only when genuine alternatives have meaningful consequences. Ask: "Will someone want
to know a year from now why this was not done differently?" Tool choices such as a formatter, a
linter or a test runner are project guidelines in
[docs/project_guidelines/](../project_guidelines/index.md), not ADRs. A restatement of the
client's assignment is not an ADR either; the assignment is summarised in
[docs/podklady/](../podklady/README.md).

## Rules

- **This index is the status source of truth.** Update both the Records table and the ADR
  frontmatter in the same pull request; where they disagree, fix the frontmatter.
- **Numbers are never reused** and records are never deleted. A superseded record keeps its
  file and changes its status.
- Name new files `NNNN-english-slug.md` and write them in English, with the terms from
  [GLOSSARY.md](../../GLOSSARY.md). The title is a statement of the decision, not a topic.
  Start from [0000-template.md](0000-template.md) and keep the sections Context / Decision /
  Consequences / Alternatives considered (at least two rejected) / Implementation status.
- **Changing a record:** a record that was never accepted is amended in place with a dated
  revision note under its title; an accepted record gets a dated `> Note of YYYY-MM-DD` that
  fills in, confirms or narrows a point; when the substance of an accepted decision flips, a
  new ADR supersedes it. Every amendment and supersession is listed under
  [Revisions](#revisions).
- The pull request that closes an implementation gap updates the *Implementation status* of
  the ADR.

## Records

| # | Decision | Status | Date |
|---|---|---|---|

## Revisions

<!-- Dated paragraphs, newest last: which records were amended in place and why that was
     allowed (never accepted), which accepted records received dated notes and from which
     source, which records were superseded and by what, and which were accepted on which
     date and by whom. -->

## What still blocks

<!-- Numbered list of the open questions (Q-nn) and proposed records that still block
     delivery, each with what exactly it blocks, and the records that must be accepted
     before the first migration because they cannot be changed cheaply afterwards. When
     nothing blocks, say so with the date. -->

## Candidates for future ADRs

Create these only when they become active decisions, not in advance:

<!-- Bulleted list of decisions that are foreseeable but not active yet, each with what would
     make it active. -->
