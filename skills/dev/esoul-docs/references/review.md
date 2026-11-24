# Semantic Review

## Authoring record

Maintain `docs/documentation-decisions.md` during work. Record assumptions, evidence conflicts, omissions, source-authority choices, user attestations, planned/current behavior choices, substantive organization choices, documentation-version decisions, and review dispositions. Do not log routine wording or formatting.

## Independent reviewers

When the harness offers subagents, run two fresh-context reviewers in parallel (`esoul-model-routing`, optional helpers layer, holds the reviewer brief). Give them the repository, approved specification, decision log, guides, screenshot manifest, and raw evidence locations. Do not give them suspected findings or expected answers.

### Correctness reviewer brief

> Review the configured application guides for factual correctness. Challenge every material claim against code, tests, configuration, routes and UI, deployment/operations artifacts, approved external contracts, the documentation specification, and recorded attestations. Identify contradictions, misleading planned/current behavior, unsafe instructions, invalid examples, and unjustified authoring decisions. Return findings with severity (`docs/project_guidelines/code-review.md` › Severity), exact document location, evidence, and a proposed disposition. Do not edit files.

### Completeness reviewer brief

> Review the configured application guides for completeness for their approved audiences and scope. Independently inspect the application, tests, configuration, UI/workflows, failure modes, roles, security constraints, operations, recovery, observability, and approved intended behavior. Identify missing tasks, edge cases, prerequisites, cross-links, screenshots, warnings, glossary terms, and intended-versus-implemented mismatches. Return findings with severity (`docs/project_guidelines/code-review.md` › Severity), exact destination, evidence, and a proposed addition or explicit exclusion. Do not edit files.

### Privacy and accessibility pass

Add to each brief above, or run as a third pass:

- Privacy: credentials, tokens, personal data, internal hostnames, real client figures and anything else `docs/project_guidelines/documentation.md` › Authoring rules and `docs/project_guidelines/security-and-data.md` › Personal and client data exclude, in text, code samples, diagrams and every screenshot.
- Accessibility: heading structure, image alt text, descriptive link text, meaning not carried by colour alone, table comprehension, diagram contrast and text alternatives. Mechanical checks are incomplete; this pass judges context. Do not claim PDF/UA conformance.

If only one subagent is available, combine the briefs without revealing the authoring agent's suspected defects. If none is available, run the passes sequentially yourself and state that independence was reduced.

## Findings gate

Close every finding with the finding states of `docs/project_guidelines/code-review.md` › Finding states: `Resolved` (corrected and re-verified, or invalid with concrete evidence), `Accepted` (explicitly accepted by the user and recorded as an attestation or review exception) or `Deferred` (moved to a linked follow-up).

After corrections, rerun targeted reviewer checks and all affected mechanical gates (for PDF projects including the PDF gates). Do not equate a successful build with correct or complete content.

## Planned behavior

Planned content may appear in either guide only after explicit user choice. Render a standardized **Planned** callout, optionally including target version/date and issue link. Do not include planned instructions in current checklists. `verify` continues to report the item until implementation evidence appears or the plan is removed.
