# Workflow: Refresh

Shared evidence policy, outlines, and the publication contract are in [workflow.md](workflow.md).

Use when approved guides and a specification already exist.

1. Establish the change scope from the user request, Git diff, issue/specification, or repository evidence.
2. Compare affected implementation and official contracts with the specification, decisions, existing docs, and screenshots.
3. Continue directly for factual corrections, version updates, renamed labels, added commands, and other changes covered by the specification.
4. Propose reopening `$grill-with-docs` when audience, scope, domain language, source authority, guide structure, planned/current behavior policy, screenshot policy, or publication requirements changed.
5. Update affected content, evidence, screenshots, and decisions.
6. Suggest a documentation-version bump when configured: patch for corrections; minor for new workflows/features/roles/substantial sections; major for materially incompatible audience or scope changes. Never apply a bump without approval.
7. Run the full publication gates for changed guides.
