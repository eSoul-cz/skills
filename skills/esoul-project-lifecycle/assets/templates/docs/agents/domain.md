# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the vocabulary, the English identifier with the Czech term
  next to it. Where a generic skill says "the glossary in `CONTEXT.md`", read `GLOSSARY.md`;
  root `CONTEXT.md` holds the project conventions (Freelo, tasking, commits, languages, UAT
  dimensions), not the domain language.
- **`docs/adr/`**: read the ADRs that touch the area you are about to work in. The Records table
  in [`docs/adr/index.md`](../adr/index.md) is the only status source: `accepted` is the target
  contract, `proposed` is not an implementation specification, and a superseded record points to
  its successor.
- **[`docs/project_guidelines/domain.md`](../project_guidelines/domain.md)** for the settled
  domain rules, and the guideline that owns calculations for anything that produces a number.

This repository has no `GLOSSARY-MAP.md` and no per-context glossaries. Do not suggest creating
them.

## File structure

Single-context repo:

```
/
├── GLOSSARY.md                    ← domain language
├── CONTEXT.md                     ← project conventions
├── docs/adr/
│   ├── index.md                   ← status source of truth
│   ├── 0001-….md
│   └── …
├── docs/project_guidelines/       ← engineering rules
├── docs/plan/                     ← phases, gates, scope, slices
├── docs/podklady/                 ← the client's material: evidence, not specification
└── docs/legacy/                   ← the old system as it is: evidence, not specification
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a
test name, a class name), use the term as defined in `GLOSSARY.md`. Do not drift to synonyms the
glossary lists under _Avoid_; they are sent back in review.

If the concept you need is not in the glossary yet, that is a signal: either you are inventing
language the project does not use (reconsider) or there is a real gap. A real gap is closed by
adding the term to `GLOSSARY.md` in the same pull request that introduces it. A term listed under
_Candidate terms_ is not decided yet; do not turn it into code.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently
overriding it:

> _Contradicts ADR-NNNN (short title), but worth reopening because…_

Never weaken an `accepted` ADR to match the current code; the difference is an implementation gap
recorded in the ADR's *Implementation status* with its issue.

## Open questions are not yours to answer

A rule the client has not decided lives in
[`docs/podklady/otevrene-otazky.md`](../podklady/otevrene-otazky.md). Do not guess it from the
podklady, the legacy system or your own reasoning, and do not phrase a guess as a decision. Split
the dependent work out and ask.

## Evidence is not specification

`docs/podklady/` and `docs/legacy/` describe how the client and the old system work today. A
behaviour documented there becomes a requirement only through an accepted ADR, a guideline, the
plan or an issue. Numbers and calculations, however, always come from the podklady, never from
your own reasoning.
