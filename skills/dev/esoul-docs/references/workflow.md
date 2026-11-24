# Workflow

Read the shared policy (evidence, outlines, publication contract), then only the section of the selected mode: [Create](#create), [Refresh](#refresh) or [Verify](#verify).

## Evidence policy

Evidence precedence and the rules for intent versus implementation are in `docs/project_guidelines/documentation.md` (the opening of the file and › Evidence is not a specification). Official external documentation is authoritative for third-party contracts. Existing documentation is evidence, never automatically authoritative.

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

These are prompts for the interview, not mandatory chapters.

Every Mermaid fence must be immediately preceded by a concise text alternative in the form `<!-- diagram-alt: Describe the flow and its important relationships. -->`. A PDF build uses it as the figure caption; prose must still carry any details needed to follow the guide without the image.

## Publication contract

Call a guide publish-ready only when all gates that apply pass:

- Approved and current specification
- Traceable substantive decisions
- No unresolved findings except explicit user acceptances
- Markdown and asset validation (by hand, or `docs/documentation validate` when installed)
- Privacy and source-level accessibility review
- Correctness and completeness reviews, independent when the harness offers fresh-context reviewers
- PDF projects only: successful PDF build, structural PDF checks and every-page visual inspection (delegated, see SKILL.md)

## Create

Use when no approved documentation system exists or the user asks to establish a new guide set.

1. Inventory repository instructions, domain context, existing docs, code, tests, configuration, routes/UI, deployment files, observability, and official external contracts. Done when the inventory is written into the specification's Evidence section.
2. Run the approval-gated interview as in SKILL.md (installed `grilling` skill, rounds of independent questions). Investigate discoverable answers instead of asking.
3. Look up domain terms as `esoul-workflow` describes and record new terms in `GLOSSARY.md`. Keep implementation details out of the glossary. Offer ADRs only for decisions with real alternatives (`docs/project_guidelines/documentation.md` › ADR or guideline).
4. Write `docs/documentation-spec.md`, with the language of each guide taken from `CONTEXT.md` (language per place; developer/operator guide, specification and decision record in English). Create `docs/documentation-decisions.md` from the template, name it under sources of truth in `CONTEXT.md`, and record substantive choices and evidence conflicts in it as they occur.
5. Surface unresolved evidence gaps and intended-versus-implemented mismatches.
6. Obtain explicit specification approval.
7. PDF projects only: when `docs/documentation` is missing, install the managed project tools per [setup.md](setup.md) (first install needs the maintainer's approval), which also creates a missing `docs/documentation.toml`; set each guide's `language` (and `primary_language` as the default) to match the specification. When tools are already installed, only create or update `docs/documentation.toml`.
8. Author the approved guides and optional screenshot manifest.
9. Run the gates of the Publication contract above. Done when every applicable gate is ticked (for PDF projects, `docs/documentation validate` has no errors).

## Refresh

Use when approved guides and a specification already exist.

1. Establish the change scope from the user request, Git diff, issue/specification, or repository evidence.
2. Compare affected implementation and official contracts with the specification, decisions, existing docs, and screenshots.
3. Continue directly for factual corrections, version updates, renamed labels, added commands, and other changes covered by the specification.
4. Propose reopening the interview (installed `grilling` skill, rounds of independent questions) when audience, scope, domain language, source authority, guide structure, planned/current behavior policy, screenshot policy, or publication requirements changed.
5. Update affected content, evidence, screenshots, and decisions.
6. Suggest a documentation-version bump when configured: patch for corrections, clarifications, screenshots, or formatting; minor for new workflows/features/roles/substantial sections; major for materially incompatible audience or scope changes. Never apply a bump without approval.
7. Run the gates of the Publication contract above for the changed guides. Done when every applicable gate is ticked.

## Verify

Use for read-only assessment unless the user separately authorizes fixes. Verify mode changes no tracked file; report findings in the chat.

1. PDF projects only: check managed-tool version and drift (`docs/documentation doctor`).
2. Validate configuration, sources, links, assets, accessibility basics, ignore rules, likely sensitive data and math (`docs/documentation validate` when installed, otherwise by hand as listed in SKILL.md).
3. Compare claims against implementation, tests, configuration, observed UI, and approved external sources.
4. Report stale content, omissions, evidence conflicts, due attestations, intended/implemented mismatches, screenshot drift, and, for PDF projects, PDF problems.
5. PDF projects: build and visually inspect when the environment permits; otherwise identify exactly which gates remain unverified. `build` writes disposable PDFs and review artifacts, so in a strictly read-only review use a temporary project copy or obtain authorization for those generated files.
