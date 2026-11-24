# Glossary (P3)

`GLOSSARY.md` holds the domain language: one term, one meaning, one word. Conventions such as
Freelo, tasking and commits belong in `CONTEXT.md`, not here.

## Entry format

```md
**Project (`Zakázka`)**

One piece of contracted work for one client, carried by one legal entity. A project is split
into phases; a project without phases behaves as a single phase.

_Avoid_: `projekt`, `job`, `úkol`.
```

- The English term is canonical in code and developer documentation. The Czech term in
  parentheses is what the client says and what the UI shows.
- The definition describes language, not implementation. Do not name classes or tables.
- `_Avoid_` lists synonyms that must not be used, in the language they would appear in.
- Group entries by domain area with numbered `##` sections that mirror the plan's areas.
- End with `## Candidate terms` (agreed words not yet needed) and `## Terms not used`
  (words deliberately rejected, with the reason).

## Rules

- A new term goes into `GLOSSARY.md` in the same PR that introduces it, and the PR description
  mentions it (`documentation.md`, `domain.md` › Vocabulary).
- When the client's word and the code's word differ, record both. Never rename silently.
- A term disputed between documents is a conflict to report, not to resolve by choice.
- Stress-test new terms in the session discipline below.
- For multi-context systems (for example an Astro frontend with a Laravel admin in submodules),
  keep a root `GLOSSARY-MAP.md` that names each context's glossary.

## Session discipline

Use this in `glossary`, `adr`, `intake` and `client-update` work, and whenever a conversation is changing the domain model rather than only reading it. Use the installed `domain-modeling` skill (layer upstream-core) for the session discipline: challenge terms against the glossary, sharpen fuzzy words, probe edge cases with scenarios, check the code. eSoul additions:

- The formats are eSoul's: entries as above, decisions as in [adr.md](adr.md). `GLOSSARY.md` holds domain language only; conventions belong in `CONTEXT.md`, and the ADR index (`docs/adr/index.md`) is the source of ADR statuses.
- A resolved term is written to `GLOSSARY.md` at once, free of implementation detail; it ships in the PR that introduces the term. An open point becomes a `question` issue, never an invented answer.
- A contradiction between documents is reported, not resolved by choice.
- Offer an ADR only when the decision is hard to reverse, would surprise a future reader without context, and came from a real trade-off; otherwise it is a project guideline or nothing.

When the skill is not installed, ask the user to run `npx @esoul-cz/skills install upstream-core`, or apply the additions above alone.

Done when every term the work touched is in `GLOSSARY.md` with its Czech term and `_Avoid_` list,
and every open point is a `question` issue.
