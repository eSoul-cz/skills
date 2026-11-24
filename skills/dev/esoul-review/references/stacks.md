# Stacked and chained pull requests

Read this reference when the work is a chain of dependent PRs or a native GitHub stack. Standalone PRs do not need it. A native stack's commands are in `gh stack --help`; its non-obvious behaviour (server identity, non-atomic push, `sync` mutates) is in [GitHub operations](github-operations.md#stacks).

## Discover the stack

Native stack membership is server metadata, not a PR-body label or a non-default base branch. Absence of the `gh stack` extension does not prove absence of a remote stack; read the PR's `stack` field through the API. Native stacks need all branches in one repository.

Add to the work ledger, for each in-scope layer: stack membership and order, the trunk ref and SHA, owned layers and affected descendants, and the scope or permission for each branch.

Keep the topology you find: a native stack keeps its immediate predecessor as each layer's base and its order; an ordinary chain stays an ordinary chain. An entire-stack request covers its owned unmerged layers. A single-layer request does not authorize rewriting collaborator-owned descendants: identify affected branches and ask for that permission.

The direct predecessor is the local review base of a layer (`--base` is the predecessor, not the trunk); protection requirements and integration evidence follow the stack trunk.

## Publish

Inspect the scope of any submit or push command before running it: it can affect more than the current branch. Standalone PRs for stack layers duplicate the stack. Run one waiter (`wait-pr.mjs`) per in-scope layer.

## Fix at the owning layer

Work bottom-up where dependencies require it; independent CI and review observation may run concurrently. Fix a finding in the layer that owns the code, never by masking it in a descendant.

A lower-layer fix is restacked onto its descendants (for a native stack, `gh stack rebase --upstack` then `gh stack push`; for an ordinary chain, the repository's restack workflow). Both rewrite and publish affected descendants, so run them only with a clean worktree, known remote tips and authorization for **all** affected branches. A stacked-finalization request authorizes restacking the user's in-scope owned branches, but not collaborator branches and not history rewriting the repository prohibits; when these conflict, ask first.

Push with the lease-protected form the tool provides (`--force-with-lease`, `gh stack push`), never raw `--force`. On lease failure fetch and reconcile the competing update instead of retrying with a new lease blindly. Resolve conflicts with the repository's conflict workflow and keep unfamiliar commits. Commit preparation follows the project's commit convention (`gitmoji-commit` when installed); restacking does not authorize amending or rewriting unrelated commit messages.

Re-run the applicable local verification and the selected local review on each changed layer **before** pushing the restack. Then refresh metadata, checks, discussions and review completion for the edited layer and every descendant whose head or base changed.

If a predecessor merges or someone changes membership during the loop, rediscover the stack and use the supported sync workflow only within authorized scope. When sync would publish a rebase before the required local review, do the fetch, rebase, local verification and push as separate steps. Pruning branches, dissolving or reordering the stack and merging a predecessor to get green are outside this skill.

## Completion

The completion gate applies to every affected in-scope layer: native stack membership and order are preserved, and a mergeability issue may remain only as a documented stack dependency that clears when an approved predecessor merges. Do not merge to clear it. Report the stack URLs and order.
