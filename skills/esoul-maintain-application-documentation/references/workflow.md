# Workflow

## Mode selection

### Create

Use when no approved documentation system exists or the user asks to establish a new guide set.

1. Inventory repository instructions, domain context, existing docs, code, tests, configuration, routes/UI, deployment files, observability, and official external contracts.
2. Run `$grill-with-docs` when available, one question at a time. Otherwise conduct the same approval-gated interview directly, one question at a time. Investigate discoverable answers instead of asking.
3. Maintain domain terms in `CONTEXT.md` or the contexts named by `CONTEXT-MAP.md`. Keep implementation details out of the glossary. Offer ADRs only when the domain-modeling criteria are satisfied.
4. Write `docs/documentation-spec.md`. Record substantive choices and evidence conflicts in `docs/documentation-decisions.md` as they occur.
5. Surface unresolved evidence gaps and intended-versus-implemented mismatches.
6. Obtain explicit specification approval.
7. Install managed project tools and create `docs/documentation.toml`.
8. Author the approved guides and optional screenshot manifest.
9. Run mechanical, visual, privacy, accessibility, correctness, and completeness gates.

### Refresh

Use when approved guides and a specification already exist.

1. Establish the change scope from the user request, Git diff, issue/specification, or repository evidence.
2. Compare affected implementation and official contracts with the specification, decisions, existing docs, and screenshots.
3. Continue directly for factual corrections, version updates, renamed labels, added commands, and other changes covered by the specification.
4. Propose reopening `$grill-with-docs` when audience, scope, domain language, source authority, guide structure, planned/current behavior policy, screenshot policy, or publication requirements changed.
5. Update affected content, evidence, screenshots, and decisions.
6. Suggest a documentation-version bump when configured: patch for corrections; minor for new workflows/features/roles/substantial sections; major for materially incompatible audience or scope changes. Never apply a bump without approval.
7. Run the full publication gates for changed guides.

### Verify

Use for read-only assessment unless the user separately authorizes fixes.

1. Check managed-tool version and drift.
2. Validate configuration, sources, links, assets, math, accessibility basics, ignore rules, and likely sensitive data.
3. Compare claims against implementation, tests, configuration, observed UI, and approved external sources.
4. Report stale content, omissions, evidence conflicts, due attestations, intended/implemented mismatches, screenshot drift, and PDF problems.
5. Build and visually inspect when the environment permits; otherwise identify exactly which gates remain unverified. `build` writes disposable PDFs and review artifacts, so in a strictly read-only review use a temporary project copy or obtain authorization for those generated files.
6. Do not edit content in verify mode.

## Evidence policy

Distinguish what exists from what is intended:

- Code, tests, configuration, and observed UI are authoritative for implemented behavior.
- Approved specifications and user attestations are authoritative for intent.
- Official external documentation is authoritative for third-party contracts.
- Existing documentation is evidence, never automatically authoritative.

Record each conflict. Ask the user about claims that cannot be verified. A user may authorize publication; preserve the exact claim, affected section, approval date, rationale/source, and optional `review_after` date as a user-attested claim. Attestations remain valid until contradicted or their optional review date arrives.

If the user publishes intended-but-unimplemented behavior, use a visually distinct **Planned** callout in either guide. Keep it out of current operational steps and track it internally even when the user chooses not to publish the callout.

## Default adaptive outlines

### User guide

- Purpose, scope, roles, and access
- Getting started
- Core workflows
- Monitoring and status interpretation
- Administration when applicable
- Recovery and troubleshooting
- Security and data-handling notes
- Glossary and references

### Developer/operator guide

- Architecture and system boundaries
- Local development
- Configuration and integrations
- Persistence and data flows
- Security and observability
- Deployment, operations, recovery, and scaling
- Testing, CI, and command reference
- Troubleshooting
- Glossary and references

These are prompts for the grill, not mandatory chapters.

Every Mermaid fence must be immediately preceded by a concise text alternative in the form `<!-- diagram-alt: Describe the flow and its important relationships. -->`. The renderer uses it as the PDF figure caption; prose must still carry any details needed to follow the guide without the image.

## Publication contract

Call a guide publish-ready only when all required gates pass:

- Approved and current specification
- Traceable substantive decisions
- No unresolved findings except explicit user acceptances
- Markdown and asset validation
- Successful Dockerized PDF build
- Structural PDF checks and every-page visual inspection
- Privacy and source-level accessibility review
- Independent correctness and completeness reviews when sub-agents are available
