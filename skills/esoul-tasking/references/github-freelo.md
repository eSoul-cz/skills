# github-freelo mode in detail

## Targets and existing work

In `github-freelo` mode:

1. Resolve one target GitHub repository from an explicit user target, applicable repository configuration, or an unambiguous Git remote. Preserve its host for GitHub Enterprise. Inspect the active checkout, not a stored workstation path. Confirm ambiguous targets, such as competing upstream and fork remotes, before searching or writing; never assume an eSoul repository or project.
2. Verify access to the target repository, its issues, and its existing labels using the available GitHub integration or `gh`. With `gh`, use `gh auth status` and `gh repo view <resolved-repository>`. Qualify every issue and label operation with the resolved repository, rather than relying on the current directory's default.
3. Inspect the codebase and applicable issue templates. Use only verified paths, symbols, domain vocabulary, and behavior. Apply the companion's privacy rules to GitHub as well as Freelo; do not copy private information into a more broadly visible destination. Ask if safe disclosure cannot be established.
4. Search open and closed GitHub issues as well as active and finished Freelo tasks. Search by outcome, domain terms, modules, and alternate terms, not just exact titles. Follow pagination and inspect relevant bodies, comments, labels, and existing cross-links. Verify that search hits belong to the selected targets.
5. Classify each proposed result as a new pair, an existing pair to refine, or a missing counterpart to create. Never create another issue or task merely because only one side exists. Apply the companion's state-sensitive duplicate rules; do not reopen completed work automatically. Preview any reuse, edits, or missing-counterpart creation explicitly, preserving unrelated existing content. If existing links disagree about the pairing, resolve that conflict before writing.

Do not create projects, repositories, tasklists, or labels as a setup shortcut. If an existing label cannot be selected reliably in either target, ask. Missing access blocks the requested operation; it never authorizes a downgrade to `freelo-only`.

## Issue specification

The GitHub issue is the source of truth for the detailed specification. Follow repository templates and the companion's language conventions. Include only useful sections, covering:

- outcome and context; for bugs, observed versus expected behavior and reproduction;
- verified affected areas, requested changes, scope and exclusions;
- observable acceptance criteria;
- user-facing acceptance scenarios or technical verification, as appropriate;
- implementation constraints, dependencies, and source links;
- a link to the paired Freelo task.

Record dependencies between issues as native GitHub issue dependencies (`blocked_by`), which are the source of truth, and mirror them as Freelo relations through the companion. When the repository plans work in slices, put the slice header the repository defines (for example `**Slice:** F1-17 · **Fáze:** F1 · **Rozsah:** S`) at the top of the issue and the slice ID on the first line of the Freelo summary, never in the title.

The Freelo description is a short management summary, not a second full specification. Put the GitHub issue link in its first paragraph, then the outcome, scope summary, and observable done conditions. Point to the issue for detailed acceptance criteria and verification. Keep estimates and work-management metadata in Freelo, using the companion's rules; do not maintain a second estimate in the issue.

Use Markdown for the GitHub body and preview. Use the companion's sanitized HTML rules for Freelo, including link attributes. After initial creation, insert the actual reciprocal URLs returned by the services; never guess IDs or leave preview placeholders in stored content. In the issue, put the Freelo link in the existing links section, or add a compact links section if absent.

## Preview additions

Group split-mode previews by pair. When IDs do not yet exist, clearly describe the link substitutions as part of the preview: the issue URL returned by creation goes into Freelo, and the returned Freelo task URL goes into that issue. Approval covers these mechanical substitutions and the disclosed final backlink edit, not any other content change. It does not authorize storing literal placeholders.

Wait for explicit approval of the exact preview. Allow approval of the full batch or selected results only. A material change to mode, target, content, labels, estimate, scope, relations, or intended operations invalidates approval and requires a new preview. A mode choice, context synchronization, approval of a previous draft, or silence is not approval to write remote entities.

## Write and read back

In `github-freelo` mode, after approval:

1. Re-read relevant existing counterparts before modifying them. If their state or content has changed materially since preview, stop for a revised preview instead of overwriting concurrent work. For new work, create dependency prerequisites before dependent pairs.
2. For each new pair, create the GitHub issue with the approved specification, existing labels, and approved milestone. Omit the not-yet-known Freelo backlink rather than storing a placeholder. Capture the returned issue URL. When using `gh`, pass the Markdown body through `--body-file` to avoid shell quoting or multiline corruption.
3. Create the Freelo task using the companion workflow, with the actual issue URL in the approved summary. Write its approved metadata, labels, subtasks, and relations. For existing counterparts, perform only the approved reuse or refinement operations; create only the missing side, using the existing side's verified URL.
4. Add the approved GitHub `blocked_by` dependencies (they use the blocking issue's database `id`, not its number) and mirror them as Freelo relations through the companion.
5. Complete the reciprocal links. Read the current issue body before adding its Freelo URL; preserve unrelated content and avoid duplicate links. If an unexpected material change appeared, stop and re-preview. Set the Freelo description's issue link as needed for an approved reused task.
6. Read back every created or modified issue and task. Verify both titles, labels, the issue milestone, every approved GitHub `blocked_by` dependency and its mirrored Freelo relation, targets, the full issue specification, the Freelo summary and metadata, subtasks/relations, and reciprocal URLs. Check semantic content after Freelo sanitization, not byte equality. Report any mismatch; a successful write response alone is not completion.
7. Return clickable links to every created or modified entity, including both members of each pair. Claim a complete pair only after both sides and links are verified.

Writes across and within these systems are not atomic. On failure or an uncertain write outcome, stop dependent writes, read actual state in both systems, and report exactly what exists, what succeeded, and what remains. Do not blindly retry creation, delete, roll back, or silently change mode. Preserve successful entities and offer an evidence-based completion plan; obtain fresh approval for changed operations or content before resuming. Apply the same procedure when resuming an interrupted run, including when only one counterpart exists.
