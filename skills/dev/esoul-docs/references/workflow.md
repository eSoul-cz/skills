# Workflow

## Modes

Read only the file for the selected mode:

- [Create](workflow-create.md)
- [Refresh](workflow-refresh.md)
- [Verify](workflow-verify.md)

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

These are prompts for the grill, not mandatory chapters.

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
