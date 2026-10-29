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

- A new domain term goes into `GLOSSARY.md` in the same PR that introduces it in code, docs or
  an issue. Mention it in the PR description.
- When the client's word and the code's word differ, record both. Never rename silently.
- A term disputed between documents is a conflict to report, not to resolve by choice.
- Stress-test new terms as in [domain-modeling.md](domain-modeling.md): challenge conflicts, sharpen fuzzy words, probe edge cases with scenarios, check the code.
- For multi-context systems (for example an Astro frontend with a Laravel admin in submodules),
  keep a root `GLOSSARY-MAP.md` that names each context's glossary.
