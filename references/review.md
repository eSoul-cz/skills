# Semantic Review

## Authoring record

Maintain `docs/documentation-decisions.md` during work. Record assumptions, evidence conflicts, omissions, source-authority choices, user attestations, planned/current behavior choices, substantive organization choices, documentation-version decisions, and review dispositions. Do not log routine wording or formatting.

## Independent reviewers

Prefer two parallel sub-agents. Give them the repository, approved specification, decision log, generated guides, screenshot manifest, and raw evidence locations. Do not give them suspected findings or expected answers.

### Correctness reviewer brief

> Review the configured application guides for factual correctness. Challenge every material claim against code, tests, configuration, routes and UI, deployment/operations artifacts, approved external contracts, the documentation specification, and recorded attestations. Identify contradictions, misleading planned/current behavior, unsafe instructions, invalid examples, and unjustified authoring decisions. Return findings with severity, exact document location, evidence, and a proposed disposition. Do not edit files.

### Completeness reviewer brief

> Review the configured application guides for completeness for their approved audiences and scope. Independently inspect the application, tests, configuration, UI/workflows, failure modes, roles, security constraints, operations, recovery, observability, and approved intended behavior. Identify missing tasks, edge cases, prerequisites, cross-links, screenshots, warnings, glossary terms, and intended-versus-implemented mismatches. Return findings with severity, exact destination, evidence, and a proposed addition or explicit exclusion. Do not edit files.

If only one sub-agent is available, combine the two briefs without revealing the authoring agent's suspected defects. If none are available, run both passes sequentially and state that independence was reduced.

## Findings gate

Every finding must be one of:

1. Corrected and re-verified.
2. Rejected with concrete evidence.
3. Explicitly accepted by the user and recorded as an attestation or review exception.

After corrections, rerun targeted reviewer checks and all affected mechanical/PDF gates. Do not equate a successful PDF build with correct or complete content.

## Planned behavior

Planned content may appear in either guide only after explicit user choice. Render a standardized **Planned** callout, optionally including target version/date and issue link. Do not include planned instructions in current checklists. `verify` continues to report the item until implementation evidence appears or the plan is removed.

