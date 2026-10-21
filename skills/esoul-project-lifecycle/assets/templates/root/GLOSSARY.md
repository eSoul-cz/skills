# {{PROJECT_NAME}} — glossary

This is the domain glossary for {{PROJECT_NAME}}. Project conventions (Freelo, tasking, commits,
languages) live in [CONTEXT.md](CONTEXT.md).

## How to use this glossary

Use these terms in issues, classes, tables, tests, and technical communication. The English term
is canonical in code and developer documentation. The Czech term in parentheses is what the
client says and what the user interface shows. Text listed under _Avoid_ is kept in its original
language because it documents a prohibited synonym.

If a required concept is missing, do not invent it in code. Add it here in the same pull request
and mention the addition in the PR description.

This glossary defines **language, not implementation**. ADRs in `docs/adr/` own the target
technical contracts; prices, rates, limits and other numbers live there, in the guidelines or in
the seed data, not here. `docs/podklady/` and `docs/legacy/` describe how the client works today;
they are evidence, not a specification. A _Not wired yet_ note names what a term promises but the
running code does not do yet.

<!-- Group terms into numbered areas (`## 1. <Area>`). Entry format:

**English term (`Czech term`)**

What the concept is, what it is not, and how it relates to neighbouring terms. Name the ADR that
owns its contract, if any.

_Avoid_: `synonym`, `another synonym`.
-->

## Candidate terms

Terms that appear in the podklady or in discussion but are not decided yet. Do not turn any of
them into code, a column or an enum value before the decision exists; each one is tracked in the
ADR or the question (`Q-nn` in `docs/podklady/otevrene-otazky.md`) named next to it. Move a term
into its area once it is decided and the first task in the area exists.

## Terms not used

Terms that a reader meets in the client's own files or in the legacy system, recorded here so
they know what the term means and why the application does not use it. This is not vocabulary;
it is the opposite.
