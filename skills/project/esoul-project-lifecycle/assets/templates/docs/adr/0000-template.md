---
status: proposed
date: YYYY-MM-DD
deciders: eSoul
---

<!-- Copy this file to NNNN-english-slug.md (next free number, never reused), add a row to the
     Records table in index.md, and delete every comment. Write in English with the terms from
     GLOSSARY.md; a Czech domain term may follow in parentheses where it matters. Change policy
     once the record exists: see Rules in index.md. -->

# English decision title written as a statement

## Context

What forced this decision. Cite where it comes from: a note in
[docs/podklady/](../podklady/README.md), a document in [docs/legacy/](../legacy/index.md), an
open question (issue `#N` labelled `question`), a slice of the plan, an issue or a pull request. Explain how the client
or the old system solves the problem today, why that approach does not simply carry over, and
why the decision cannot wait.

## Decision

State what applies. Use present-tense statements; avoid "should" and "we will consider". If a
part of the decision depends on an answer the client has not given, say so and link the open
question instead of inventing the answer.

## Consequences

Describe the effects on the data model, calculations, integrations, performance, migration,
operations and the handover, **including the unpleasant ones**. An ADR with no disadvantage
usually means the alternatives were not evaluated honestly.

## Alternatives considered

Record at least one considered alternative and explain why it was not selected when there is one (RECOMMENDED). An ADR without a real alternative is allowed.

## Implementation status as of YYYY-MM-DD

Required for an `accepted` ADR once application code exists; a `proposed` one may leave it
out, and while the repository holds no application code it says only "No application code
yet". Name the files and tests that implement the decision, and list every known gap with the
file it is in and the issue that closes it (`#N`), or "No issue". A gap never weakens the
decision; the pull request that closes a gap updates this section.
