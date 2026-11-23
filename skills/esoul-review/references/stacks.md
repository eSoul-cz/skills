# Stacked and chained pull requests

Read this reference when the work is an ordinary chain of dependent PRs or a native GitHub stack.
Standalone PRs do not need it. Command details are in [GitHub operations](github-operations.md).

## Discover the stack

Native stack membership is server metadata, not a PR-body label or merely a non-default base
branch. Check host support and installed `gh stack` capabilities rather than assuming a preview
API exists everywhere. Absence of the extension does not prove absence of a remote stack.

Add to the work ledger, for each in-scope layer: stack membership and order, the trunk ref and
SHA, owned layers and affected descendants, and the scope or permission for each branch.

For a native stack, preserve the immediate predecessor as each layer's base and the stack's
existing order. Do not recreate native stacks as ordinary PR chains. For an ordinary chain,
preserve its topology; do not silently convert it to a native stack. An entire-stack request
covers its owned unmerged layers. A single-layer request does not authorize rewriting
collaborator-owned descendants: identify affected branches and ask for that permission if
necessary.

For native stacks, derive protection requirements from the stack trunk, not only the immediate
predecessor. Include the trunk in revision snapshots and invalidate integration evidence when it
changes. The direct predecessor remains the local incremental-review base: for a stacked layer,
local review uses its immediate predecessor as `--base`, not the stack trunk.

## Publish

Use the installed official stack workflow to preserve server membership. Inspect the scope of
submit/push operations before invoking them: they can affect more than the current branch. Do not
create duplicate standalone PRs for stack layers. Run one waiter (`wait-pr.mjs`) per in-scope
stack layer.

## Fix at the owning layer

Work bottom-up where dependencies require it; independent CI/review observation may run
concurrently. Fix a finding in the layer that owns the code, never by masking it in a descendant.

For a native stack, a lower-layer fix normally requires `gh stack rebase --upstack` followed by
`gh stack push`. These operations rewrite/publish affected descendants; inspect installed help and
[GitHub operations](github-operations.md) first. Run only with a clean worktree, known remote
tips, and authorization for **all** affected branches. A stacked-finalization request authorizes
necessary restacking of the user's in-scope owned branches, but does not override repository
prohibitions on history rewriting or authorize collaborator branches. If those constraints
conflict, ask before restacking.

Use the stack tool's lease-protected push; never raw `--force`. On lease failure fetch/reconcile
the competing update rather than retrying with a new lease blindly. Resolve conflicts with the
repository's conflict workflow; never drop unfamiliar commits. Commit preparation remains governed
by `gitmoji-commit`; stack rebasing is a separate authorized lifecycle operation, not permission to
amend/rewrite unrelated commit messages.

Re-run applicable local verification and the selected local review on each changed layer
**before** pushing the restack. Refresh metadata, checks, discussions, and review completion for
the edited layer and every descendant whose head or base changed; CodeRabbit reviews each pushed
head automatically under the review-track rules.

If a predecessor merges or someone changes stack membership during the loop, rediscover the stack
and use the supported sync workflow only within authorized scope. Sync can rebase and push; it is
not a read-only discovery command. Do not prune branches, dissolve/reorder the stack, or merge a
predecessor merely to get green status. Ordinary dependent PR chains use the repository's
established restack tool/workflow; do not apply native stack commands to them blindly.

## Completion

The completion gate applies to every affected in-scope layer: native stack membership and order
are preserved, and a mergeability issue may remain only as a documented stack dependency that will
clear when an approved predecessor merges. Do not merge to clear it. Report the stack URLs and
order.
