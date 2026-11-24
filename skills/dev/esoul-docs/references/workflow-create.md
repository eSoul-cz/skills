# Workflow: Create

Shared evidence policy, outlines, and the publication contract are in [workflow.md](workflow.md).

Use when no approved documentation system exists or the user asks to establish a new guide set.

1. Inventory repository instructions, domain context, existing docs, code, tests, configuration, routes/UI, deployment files, observability, and official external contracts. Done when the inventory is written into the specification's Evidence section.
2. Run the approval-gated interview as in SKILL.md (installed `grilling` skill, rounds of independent questions). Investigate discoverable answers instead of asking.
3. Look up domain terms in `GLOSSARY.md` (or the contexts named by `GLOSSARY-MAP.md`) and record new terms there. Keep implementation details out of the glossary. Offer ADRs only for decisions with real alternatives (`docs/project_guidelines/documentation.md` › ADR or guideline).
4. Write `docs/documentation-spec.md`, with the language of each guide taken from `CONTEXT.md` (language per place; developer/operator guide, specification and decision record in English). Record substantive choices and evidence conflicts in `docs/documentation-decisions.md` as they occur.
5. Surface unresolved evidence gaps and intended-versus-implemented mismatches.
6. Obtain explicit specification approval.
7. PDF projects only: when `docs/documentation` is missing, install the managed project tools per [setup.md](setup.md), which also creates a missing `docs/documentation.toml` and sets `primary_language` to match the specification; when tools are already installed, only create or update `docs/documentation.toml`.
8. Author the approved guides and optional screenshot manifest.
9. Run the gates of the Publication contract in [workflow.md](workflow.md). Done when every applicable gate is ticked (for PDF projects, `docs/documentation validate` has no errors).
