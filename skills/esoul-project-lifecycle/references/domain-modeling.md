<!-- Adapted from mattpocock/skills v1.3.2, `skills/engineering/domain-modeling/SKILL.md` (MIT
     License, (c) 2026 Matt Pocock; see LICENSE-mattpocock-skills.md). eSoul changes: the session
     discipline only; the glossary and ADR formats are eSoul's own (glossary.md, adr.md), and new
     terms and ADRs land through the PR rules of this skill. -->

# Domain modeling during a session

Use this in `glossary`, `adr`, `intake` and `client-update` work, and whenever a conversation is
changing the domain model rather than only reading it. Looking a term up in `GLOSSARY.md` is not
this discipline; that is a one-line habit every skill already has.

The formats are eSoul's: entries as in [glossary.md](glossary.md), decisions as in
[adr.md](adr.md). `GLOSSARY.md` holds domain language only; conventions belong in `CONTEXT.md`.

## Challenge against the glossary

When someone uses a term that conflicts with `GLOSSARY.md`, say so at once: "The glossary defines
'cancellation' as X, but you seem to mean Y. Which is it?"

## Sharpen fuzzy language

When a term is vague or overloaded, propose a precise canonical one: "You say 'account': do you
mean the customer or the user? Those are different things." Record both the client's word and the
code's word when they differ.

## Discuss concrete scenarios

Stress-test relationships between concepts with specific scenarios. Invent the edge cases that
force a precise boundary: the partial cancellation, the order with two currencies, the animal that
changes owner mid-season.

## Cross-reference with code

When someone states how something works, check whether the code agrees, and surface a
contradiction: "The code cancels whole orders, but you just said partial cancellation is
possible. Which is right?" A contradiction between documents is reported, not resolved by
choice.

## Write it down when it settles

Update `GLOSSARY.md` the moment a term is resolved instead of batching the changes; keep the
definition free of implementation details. The change ships in the pull request that introduces
the term. An open point becomes a `Q-nn` question in the register, never an invented answer.

## Offer ADRs sparingly

Offer an ADR only when the decision is hard to reverse, would surprise a future reader without
context, and came from a real trade-off between alternatives. Otherwise it is a project guideline
or nothing. [adr.md](adr.md) decides the format and the status lifecycle.
