---
status: proposed
date: YYYY-MM-DD
deciders: eSoul
---

<!-- Copy this file to NNNN-english-slug.md (next free number, never reused), add a row to the
     Records table in index.md, and delete every comment. Write in English with the terms from
     GLOSSARY.md; a Czech domain term may follow in parentheses where it matters.

     Change policy, once the record exists:
     - Never accepted yet: amend it in place. Put a dated revision note directly under the title
       and say what changed and why:
         > Revised YYYY-MM-DD by the project maintainer after the client's answers. The record
         > had never been accepted, so it is amended in place rather than superseded.
       List the record under Revisions in index.md.
     - Accepted, and a point is filled in, confirmed or narrowed: add a dated note under the
       title, newest first, citing its source (podklady note, Q-nn, issue). Never rewrite the
       accepted text:
         > Note of YYYY-MM-DD from the client's written answers (odpovedi-klienta-YYYY-MM-DD.md).
         > **One-sentence outcome.** Detail, and which bullet below it overrides.
     - Accepted, and the substance of the decision flips: write a new ADR, set this one to
       `superseded by ADR-NNNN` in its frontmatter and in index.md, and keep it unchanged as
       history.
     In every case `date` is the day the status last changed. -->

# English decision title written as a statement

## Context

What forced this decision. Cite where it comes from: a note in
[docs/podklady/](../podklady/README.md), a document in [docs/legacy/](../legacy/index.md), an
open question (`Q-nn`), a slice of the plan, an issue or a pull request. Explain how the client
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

Include at least two rejected alternatives and explain why each was not selected.

## Implementation status as of YYYY-MM-DD

Required for an `accepted` ADR once application code exists; a `proposed` one may leave it
out, and while the repository holds no application code it says only "No application code
yet". Name the files and tests that implement the decision, and list every known gap with the
file it is in and the issue that closes it (`#N`), or "No issue". A gap never weakens the
decision; the pull request that closes a gap updates this section.
