---
name: esoul-tasking
description: Prepare, preview, and create eSoul work as a self-contained Freelo task or a linked GitHub issue and Freelo task. Use when the user invokes esoul-tasking, asks to pair GitHub issues with Freelo tasks, or authors work under a repository tasking convention. Depends directly on esoul-freelo-task-authoring. Resolve and record the split/no-split convention in root CONTEXT.md, inspect real code and existing work, and require explicit approval before remote writes. Does not implement work or manage its later lifecycle.
---

# eSoul tasking

Author work in one of two modes:

- `freelo-only`: one self-contained Freelo task per independently deliverable result; no GitHub issue is required or created.
- `github-freelo`: one GitHub issue containing the full specification and one Freelo task containing the management summary per independently deliverable result, with reciprocal links.

Splitting the specification between systems is separate from splitting a large outcome into independent tasks. Use the companion's task/subtask and sizing rules in either mode. GitHub-only authoring is outside this workflow.

## Required companion and access

Load and follow `esoul-freelo-task-authoring` before task analysis. It directly requires `freelo`; load that companion as instructed. Inherit their language and domain terminology, evidence gathering, adaptive interview, task/subtask structure, readiness-based tasklists, estimates, labels, relations, duplicate handling, privacy, and approval rules. This skill adds mode selection and GitHub pairing; it does not replace the Freelo workflow. Its only description exception is the explicit split-mode contract below.

Install all three skills in the same scope; do not assume the installer resolves dependencies automatically:

```bash
npx skills add eSoul-cz/skills --skill freelo esoul-freelo-task-authoring esoul-tasking --agent codex --global --yes
```

Replace `codex` with the user's supported agent; omit `--global` for project-local installation. If a companion is missing, stop and provide the installation command rather than improvising its instructions.

Use the available authenticated Freelo tools according to the companion. In `github-freelo` mode, also require authenticated GitHub access through the available integration or `gh`. Inspect actual tool schemas or CLI help before using a capability; never assume a provider-specific MCP tool name or an estimate flag. Check that the approved descriptions, estimates, labels, and reciprocal links can be written and read back before creating either entity. If a required capability is unavailable, report it and stop before writes; do not omit a field or silently switch modes. Never request credentials in chat.

## 1. Resolve and persist the repository convention

Read applicable `AGENTS.md` files and the repository-root `CONTEXT.md` before planning work. Resolve the stored convention in this order:

1. Use an applicable tasking convention in `AGENTS.md` as authoritative. Synchronize only that convention into root `CONTEXT.md` under `## Tasking convention`, replacing a conflicting tasking section while preserving unrelated content.
2. Otherwise respect the tasking convention already in root `CONTEXT.md`; do not overwrite it with a default.
3. If neither defines a mode, ask the user to choose `freelo-only` or `github-freelo` and wait. Explain that the answer will be recorded in root `CONTEXT.md`. An explicit request to establish the project's mode already supplies this choice; a one-off task request does not establish a permanent policy.

Record the chosen mode using this compact form (the example shows `freelo-only`; write `github-freelo` instead when that is the chosen mode):

```md
## Tasking convention

Use the `esoul-tasking` skill for task authoring.

- Mode: `freelo-only`
```

Create root `CONTEXT.md` if absent. Keep edits idempotent; preserve unrelated sections, the companion's separate `## Freelo` mapping, and any additional applicable tasking rules. Do not leave duplicate or contradictory tasking sections. If the authoritative instructions are ambiguous or contain an unsupported mode, ask rather than inventing a mapping. Without a repository root or a writable context file, report the missing prerequisite instead of choosing a global configuration location.

Invocation authorizes synchronization of an existing authoritative convention. The first mode confirmation authorizes only its standardized context edit, not GitHub or Freelo writes. Report any context edit before task preview. Never create a commit merely to record this policy; committing requires separate user authorization.

### Per-request overrides

An explicit request may override the stored mode for the current run without modifying `CONTEXT.md`. Show the stored mode, the effective mode, and the reason in the preview. Ask if it is unclear whether the user intends a one-off override or a permanent change; do not persist an inferred preference. Honor a repository rule that explicitly prohibits overrides.

Persist a different mode only when the user explicitly requests a project-policy change. If `AGENTS.md` defines the old mode, explain the conflict and resolve the authoritative policy with the user before synchronizing it; do not write a competing rule only into `CONTEXT.md`.

## 2. Resolve targets and inspect existing work

Resolve exactly one Freelo project using `esoul-freelo-task-authoring`, including its confirmation and context-mapping rules. Resolve tasklists, labels, workers, and estimates there; do not hardcode Backlog or require estimates where the companion does not.

In `freelo-only` mode, proceed with Freelo evidence gathering and duplicate search. An existing issue may be cited as background, but the Freelo description must remain self-contained. GitHub authentication is not a prerequisite for this mode.

In `github-freelo` mode:

1. Resolve one target GitHub repository from an explicit user target, applicable repository configuration, or an unambiguous Git remote. Preserve its host for GitHub Enterprise. Inspect the active checkout, not a stored workstation path. Confirm ambiguous targets, such as competing upstream and fork remotes, before searching or writing; never assume an eSoul repository or project.
2. Verify access to the target repository, its issues, and its existing labels using the available GitHub integration or `gh`. With `gh`, use `gh auth status` and `gh repo view <resolved-repository>`. Qualify every issue and label operation with the resolved repository, rather than relying on the current directory's default.
3. Inspect the codebase and applicable issue templates. Use only verified paths, symbols, domain vocabulary, and behavior. Apply the companion's privacy rules to GitHub as well as Freelo; do not copy private information into a more broadly visible destination. Ask if safe disclosure cannot be established.
4. Search open and closed GitHub issues as well as active and finished Freelo tasks. Search by outcome, domain terms, modules, and alternate terms, not just exact titles. Follow pagination and inspect relevant bodies, comments, labels, and existing cross-links. Verify that search hits belong to the selected targets.
5. Classify each proposed result as a new pair, an existing pair to refine, or a missing counterpart to create. Never create another issue or task merely because only one side exists. Apply the companion's state-sensitive duplicate rules; do not reopen completed work automatically. Preview any reuse, edits, or missing-counterpart creation explicitly, preserving unrelated existing content. If existing links disagree about the pairing, resolve that conflict before writing.

Do not create projects, repositories, tasklists, or labels as a setup shortcut. If an existing label cannot be selected reliably in either target, ask. Missing access blocks the requested operation; it never authorizes a downgrade to `freelo-only`.

## 3. Shape titles, labels, and specifications

### Shared title and labels

Follow the companion's `Context: Actionable result` convention. Prefer the specific application module as context; otherwise use a useful one-word context. Omit the prefix when it adds no orientation. Use the same title for both entities in split mode, including when an approved refinement renames an existing counterpart.

Represent work categories such as frontend, backend, data, bug, or documentation with existing labels in each system, not `[FE]`, `[BE]`, or `[DATA]` title prefixes. Select labels independently from the target project's/repository's vocabulary; matching meanings need not have identical names. Apply at least one relevant existing label on each created entity. Use actual Freelo UUIDs and exact GitHub label names. Never invent labels or reuse another project's IDs.

### Freelo-only specification

Use the companion's full, self-contained task description, preview, sanitized HTML, subtasks, metadata, and relations. Include the verification requirements below in the Freelo task itself. Do not require or create a GitHub issue.

### Split-mode specification

The GitHub issue is the source of truth for the detailed specification. Follow repository templates and the companion's language conventions. Include only useful sections, covering:

- outcome and context; for bugs, observed versus expected behavior and reproduction;
- verified affected areas, requested changes, scope and exclusions;
- observable acceptance criteria;
- user-facing acceptance scenarios or technical verification, as appropriate;
- implementation constraints, dependencies, and source links;
- a link to the paired Freelo task.

The Freelo description is a short management summary, not a second full specification. Put the GitHub issue link in its first paragraph, then the outcome, scope summary, and observable done conditions. Point to the issue for detailed acceptance criteria and verification. Keep estimates and work-management metadata in Freelo, using the companion's rules; do not maintain a second estimate in the issue.

Use Markdown for the GitHub body and preview. Use the companion's sanitized HTML rules for Freelo, including link attributes. After initial creation, insert the actual reciprocal URLs returned by the services; never guess IDs or leave preview placeholders in stored content. In the issue, put the Freelo link in the existing links section, or add a compact links section if absent.

### Verification in the full specification

Acceptance criteria describe the done state; verification explains how to prove it.

For work with observable application behavior, include user-facing acceptance scenarios with the role, prerequisites/test data, and numbered steps with empty checkboxes. Each step contains a user action and its expected result. Cover negative or authorization scenarios when relevant. Keep SQL, shell commands, and log inspection out of user-facing steps.

For purely technical work without a meaningful user-visible effect, state that explicitly and provide concrete technical verification with an expected observable result, such as a report, command output, or behavior-specific test. Do not invent a UI scenario or require an artificial UAT section. Use the full-specification location for the effective mode: Freelo in `freelo-only`, GitHub in `github-freelo`.

## 4. Preview and approve all writes

Use the companion's complete task preview and exact-approval rules. Additionally show:

- the stored and effective modes, including any one-off override;
- in split mode, the resolved GitHub repository, exact issue title/body, existing issue labels, and the distinct Freelo summary and metadata;
- results of both duplicate searches in split mode, including existing entities to reuse or modify;
- every intended remote operation, including reciprocal links, edits to existing entities, relations, and comments.

Group split-mode previews by pair. When IDs do not yet exist, clearly describe the link substitutions as part of the preview: the issue URL returned by creation goes into Freelo, and the returned Freelo task URL goes into that issue. Approval covers these mechanical substitutions and the disclosed final backlink edit, not any other content change. It does not authorize storing literal placeholders.

Wait for explicit approval of the exact preview. Allow approval of the full batch or selected results only. A material change to mode, target, content, labels, estimate, scope, relations, or intended operations invalidates approval and requires a new preview. A mode choice, context synchronization, approval of a previous draft, or silence is not approval to write remote entities.

## 5. Write and read back

In `freelo-only` mode, execute the companion's approved Freelo workflow and return the verified task links.

In `github-freelo` mode, after approval:

1. Re-read relevant existing counterparts before modifying them. If their state or content has changed materially since preview, stop for a revised preview instead of overwriting concurrent work. For new work, create dependency prerequisites before dependent pairs.
2. For each new pair, create the GitHub issue with the approved specification and existing labels. Omit the not-yet-known Freelo backlink rather than storing a placeholder. Capture the returned issue URL. When using `gh`, pass the Markdown body through `--body-file` to avoid shell quoting or multiline corruption.
3. Create the Freelo task using the companion workflow, with the actual issue URL in the approved summary. Write its approved metadata, labels, subtasks, and relations. For existing counterparts, perform only the approved reuse or refinement operations; create only the missing side, using the existing side's verified URL.
4. Complete the reciprocal links. Read the current issue body before adding its Freelo URL; preserve unrelated content and avoid duplicate links. If an unexpected material change appeared, stop and re-preview. Set the Freelo description's issue link as needed for an approved reused task.
5. Read back every created or modified issue and task. Verify both titles, labels, targets, the full issue specification, the Freelo summary and metadata, subtasks/relations, and reciprocal URLs. Check semantic content after Freelo sanitization, not byte equality. Report any mismatch; a successful write response alone is not completion.
6. Return clickable links to every created or modified entity, including both members of each pair. Claim a complete pair only after both sides and links are verified.

Writes across and within these systems are not atomic. On failure or an uncertain write outcome, stop dependent writes, read actual state in both systems, and report exactly what exists, what succeeded, and what remains. Do not blindly retry creation, delete, roll back, or silently change mode. Preserve successful entities and offer an evidence-based completion plan; obtain fresh approval for changed operations or content before resuming. Apply the same procedure when resuming an interrupted run, including when only one counterpart exists.

Do not implement the work, move tasks through lifecycle states, track time, close or reopen issues, or assign people without explicit scope. This skill authors approved work and ends with verified links.
