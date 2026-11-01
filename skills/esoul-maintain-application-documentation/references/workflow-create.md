# Workflow: Create

Shared evidence policy, outlines, and the publication contract are in [workflow.md](workflow.md).

Use when no approved documentation system exists or the user asks to establish a new guide set.

1. Inventory repository instructions, domain context, existing docs, code, tests, configuration, routes/UI, deployment files, observability, and official external contracts.
2. Run `$grill-with-docs` when available, one question at a time. Otherwise conduct the same approval-gated interview directly, one question at a time. Investigate discoverable answers instead of asking.
3. Maintain domain terms in `GLOSSARY.md` or the contexts named by `GLOSSARY-MAP.md`. Read legacy `CONTEXT.md` or `CONTEXT-MAP.md` glossaries as the fallback when no glossary exists, but record new terms in `GLOSSARY.md`. Keep implementation details out of the glossary. Offer ADRs only when the domain-modeling criteria are satisfied.
4. Write `docs/documentation-spec.md`. Record substantive choices and evidence conflicts in `docs/documentation-decisions.md` as they occur.
5. Surface unresolved evidence gaps and intended-versus-implemented mismatches.
6. Obtain explicit specification approval.
7. Install managed project tools and create `docs/documentation.toml`.
8. Author the approved guides and optional screenshot manifest.
9. Run mechanical, visual, privacy, accessibility, correctness, and completeness gates.
