# Architecture Decision Records

An ADR records a decision or a proposed design direction. **Its existence does not prove that
the behaviour is implemented.** When code and an ADR differ, code and tests describe runtime
behaviour; the ADR remains the target contract and the difference is recorded as an
implementation gap in its *Implementation status* section. **Never weaken an ADR to match the
code.**

Open points that block a decision are issues labelled `question` in the project's tracker; the
answers are recorded here (and in the glossary or a guideline where they belong), the issue is
then closed.

## Statuses and when to write an ADR

A frontmatter `status` is `proposed`, `accepted`, `superseded by ADR-NNNN` or `deprecated`; what
each means and which one is authoritative is
[domain.md › ADR status authority](../project_guidelines/domain.md#adr-status-authority).
`date` is the day the status last changed, and `deciders` names who decided (the client, eSoul,
or both). Whether a decision is an ADR or a guideline:
[documentation.md › ADR or guideline](../project_guidelines/documentation.md#adr-or-guideline).

## Rules

- **This index is the status source of truth.** Update both the Records table and the ADR
  frontmatter in the same pull request; where they disagree, fix the frontmatter.
- **Numbers are never reused** and records are never deleted. A superseded record keeps its
  file and changes its status.
- Name new files `NNNN-english-slug.md` and write them in English, with the terms from
  [GLOSSARY.md](../../GLOSSARY.md). The title is a statement of the decision, not a topic.
  Start from [0000-template.md](0000-template.md) and keep the sections Context / Decision /
  Consequences / Alternatives considered (at least one, when there is one) / Implementation status.
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

<!-- Numbered list of the open `question` issues (#N) and proposed records that still block
     delivery, each with what exactly it blocks, and the records that must be accepted
     before the first migration because they cannot be changed cheaply afterwards. When
     nothing blocks, say so with the date. -->

## Candidates for future ADRs

Create these only when they become active decisions, not in advance:

<!-- Bulleted list of decisions that are foreseeable but not active yet, each with what would
     make it active. -->
