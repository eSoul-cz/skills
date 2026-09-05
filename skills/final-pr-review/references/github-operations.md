# GitHub operations for final PR review

Primary-source contracts checked 2026-09-05. Native stacks are a public-preview feature; confirm the installed CLI and target host support the documented operations. Commands are recipes, not permission to mutate arbitrary PRs. Replace placeholders with discovered values; do not run angle-bracket placeholders literally. Use the harness's equivalent specialized tools when available.

## Repository and revision discovery

Use `gh --version`, `gh auth status --hostname <host>`, and `gh pr view --help` to establish capabilities. Never print authentication tokens. Set the `GH_HOST` environment variable for the discovered host when needed. For `gh pr` operations, qualify `--repo <host/owner/repo>`; for API operations use `--hostname <host>` and the base repository's `owner/repo` in the path. A PR number is not globally unique.

```sh
gh pr list --repo <host/owner/repo> --state open --head <head-branch> --json number,url,headRefName,headRepositoryOwner,baseRefName
gh pr view <number> --repo <host/owner/repo> --json number,url,state,isDraft,headRefName,headRefOid,baseRefName,baseRefOid,reviewDecision,mergeStateStatus,statusCheckRollup
gh api --hostname <host> repos/<owner>/<repo>/pulls/<number>
```

Confirm a candidate's head repository/owner, not only its branch name. REST PR metadata includes `head.sha`, `head.ref`, `head.repo`, `base.sha`, `base.ref`, and `base.repo`. Use it when installed CLI JSON fields differ. Fork PRs publish to the head repository but reviews/checks/PR metadata belong to the base repository.

Before each write, verify the target PR and intended revision. After publication and immediately before completion, re-read head/base metadata. A `mergeStateStatus` of `UNKNOWN` requires another observation; it is not permission to declare success.

Sources: [gh pr list](https://cli.github.com/manual/gh_pr_list), [gh pr view](https://cli.github.com/manual/gh_pr_view), [REST pull requests](https://docs.github.com/en/rest/pulls/pulls), [gh api](https://cli.github.com/manual/gh_api).

## Standalone PR publication

Push the owned branch to the verified remote using the repository's normal workflow; do not guess the remote from the base repository. Search again before creating a PR to avoid duplicates after interruptions.

```sh
gh pr create --repo <host/owner/repo> --head <head-owner:branch-or-branch> --base <base-branch> --title <title> --body-file <prepared-body-file>
gh pr edit <number> --repo <host/owner/repo> --body-file <prepared-body-file>
```

The CLI's `--head <user>:<branch>` form does not support organization owners. For an organization-owned fork in the same repository network, use the REST create endpoint rather than retrying the unsupported CLI form:

```sh
gh api --hostname <host> --method POST repos/<base-owner>/<base-repo>/pulls -f head=<head-owner:branch> -f head_repo=<head-repository-name> -f base=<base-branch> -f title=<title> -F body=@<prepared-body-file> -F draft=false
```

`head_repo` is the repository name, not its URL, and is required when both repositories belong to the same organization. Preserve explicit draft intent instead of always using `draft=false`. Verify permissions and that both repositories share a fork network before publishing; this is a standalone PR fallback, not support for cross-fork native stacks. Never treat `gh pr create --dry-run` as a safe validation call: it may still push changes.

Prepare body files outside tracked repository content and remove them afterward. Preserve existing human-written descriptions when editing. Do not set `--draft` unless the user requires a draft; respect existing explicit draft intent. Use `gh pr ready` only within the authorized finalization scope.

Source: [gh pr create](https://cli.github.com/manual/gh_pr_create), [REST PR creation and head_repo](https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request), [gh pr edit](https://cli.github.com/manual/gh_pr_edit), [gh pr ready](https://cli.github.com/manual/gh_pr_ready).

## Native stacks: server identity before local mutation

REST PR metadata exposes nullable `stack` with `number`, `position`, `size`, and `base`; `position` is 1 at the bottom. A chained `base.ref` alone does not establish native membership. Read the stack using its **repository-local stack number**, not its opaque `id` or a PR number:

```sh
gh api --hostname <host> repos/<owner>/<repo>/pulls/<number>
gh api --hostname <host> repos/<owner>/<repo>/stacks/<stack-number>
gh api --hostname <host> --paginate 'repos/<owner>/<repo>/stacks?pull_request=<pr-number>&per_page=100'
```

Use each member PR's `stack.position` to establish order; do not assume an undocumented array sort order. GraphQL also exposes `PullRequest.stack`, `stackEntry`, and stack entries' `position`; stack GraphQL access is read-only. A permission/unsupported-endpoint error is not proof of no stack. Resolve host capability and access before choosing a fallback.

Distinguish **direct base** (previous layer, used for incremental diff review) from **stack trunk** (`stack.base.ref`, used for repository protection requirements). Record trunk SHA as well: a trunk change can invalidate integration evidence even if an upper layer's direct base has not moved. Native stack protections evaluate against the stack trunk, which need not be the repository default. Native stacks require branches in the same repository; do not attempt to create a cross-fork stack.

Check `gh extension list` and `gh stack --help`. If the official extension is absent, installation is a separate authorized action:

```sh
gh extension install github/gh-stack
```

After scope, ownership, clean-worktree, and remote-tip checks, adopt an existing remote stack using an explicit PR URL (avoids ambiguous numeric stack/PR identifiers):

```sh
gh stack checkout <pr-url>
gh stack view --json
```

`checkout` fetches branches and sets up local tracking; it is not just a read. There is no documented `gh stack list`; use REST for read-only discovery. Inspect composition conflicts rather than accepting an interactive default blindly.

To publish a **new, explicitly requested** native stack of existing owned branches in bottom-to-top order:

```sh
gh stack init --base <trunk> <bottom-branch> <next-branch> <top-branch>
gh stack submit --auto --open --remote <remote>
```

`init` adopts existing branches but also creates missing names and enables `git rerere`; verify all branch names first. `submit` pushes the stack, creates/updates PRs, and creates/extends the native stack. `--auto` defaults new PRs to **draft** without `--open`; `--open` also marks existing PRs ready, so use it only when all affected PRs are authorized for that transition. Review/update generated titles and bodies afterward to match repository templates. Do not use whole-stack submit when some layers are outside authorized scope.

If using an established non-`gh stack` workflow, the documented `gh stack link` can create server membership without local tracking. It also pushes/creates PRs and corrects bases; inspect its help and scope before using it. Low-level REST creation is `POST /repos/{owner}/{repo}/stacks` with `{"pull_requests":[<bottom-pr>,<next-pr>,<top-pr>]}`. All PRs must already exist with compatible bases. Merely creating those PRs is not enough to create a native stack. Prefer the supported CLI lifecycle rather than implementing a second stack manager.

After committing a lower-layer fix on its owning branch:

```sh
gh stack rebase --upstack --remote <remote>
# Run applicable local checks and selected local reviews on changed layers here.
gh stack push --remote <remote>
```

Rebase can fetch/rebase against trunk; inspect the resulting affected scope. `push` sends **all active** nonmerged/nonqueued branches using explicit per-branch `--force-with-lease`. It is **not atomic**: some branches can update even if another lease fails. After any failure, re-fetch every affected remote tip and invalidate evidence for branches already updated before reconciling the rejected branch. Never retry with raw force or overwrite an unexpected remote commit.

`gh stack sync --remote <remote>` can fetch, rebase, push, and change native stack membership. It is not a harmless polling command. Noninteractive composition divergence can exit successfully without syncing: verify actual remote/local state, not exit status. Do not use `--prune`, unstack, modify, or merge as part of this skill without separate authority. If sync must publish a rebase but pre-push local review is required, use the separate supported fetch/rebase, local verification, and push steps instead of an all-in-one sync that would bypass that gate.

Sources: [stack API overview](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks), [REST stacks](https://docs.github.com/en/rest/pulls/stacks), [stack CLI commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands), [managing stacks](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/managing-stacked-pull-requests), [stack reference and requirements](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests), [other stack tools](https://docs.github.com/en/pull-requests/reference/use-other-tools-with-stacked-pull-requests).

## CI: PR-aware checks plus effective policy

```sh
gh pr checks <number> --repo <host/owner/repo> --json name,state,bucket,workflow,link
gh pr checks <number> --repo <host/owner/repo> --required --json name,state,bucket,workflow,link
```

Use the first command to see all reported checks, not just required checks. `--required` alone misses expected nonrequired CI. Run these one-shot snapshots with a per-command timeout and the skill's 30–120 second backoff, checking head/base and remote review progress between polls. Enforce the 30-minute no-progress window (or the user's specified deadline) outside the command; mark expiration blocked. Do not launch an unbounded `--watch` command. Current CLI exit codes distinguish failures from pending checks; read installed help and result buckets rather than treating every nonzero exit as a code failure. No checks reported requires investigation, not success.

GitHub Actions `pull_request` workflows commonly use the synthetic merge ref. Use PR-aware results and inspect run/event/head/base association; do not accept an unrelated green run for a branch with the same name. External CI may publish commit statuses rather than Actions jobs. When investigating raw results, inspect both statuses and check runs for the verified tested revision, including the merge revision when relevant:

```sh
gh api --hostname <host> --paginate 'repos/<owner>/<repo>/commits/<tested-sha>/check-runs?per_page=100'
gh api --hostname <host> --paginate 'repos/<owner>/<repo>/commits/<tested-sha>/statuses?per_page=100'
gh run view <run-id> --repo <host/owner/repo> --log-failed
```

Raw status lists include history; use the latest applicable result per context/app, not an old success. Likewise distinguish rerun attempts. Effective branch/ruleset policy and expected workflow triggers determine what must appear. Do not infer the entire policy from the names currently returned by a rollup. For native stacks, inspect trunk rules, not only the intermediate branch.

Sources: [gh pr checks](https://cli.github.com/manual/gh_pr_checks), [workflow events and pull_request refs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request), [check runs](https://docs.github.com/en/rest/checks/runs), [commit statuses](https://docs.github.com/en/rest/commits/statuses), [gh run view](https://cli.github.com/manual/gh_run_view).

## Complete discussion inventory and replies

Fetch these three independent REST collections with pagination. Reviews contain review-body findings; review comments contain inline roots **and replies**; issue comments contain top-level PR discussion and CodeRabbit walkthroughs.

```sh
gh api --hostname <host> --paginate --slurp 'repos/<owner>/<repo>/pulls/<number>/reviews?per_page=100'
gh api --hostname <host> --paginate --slurp 'repos/<owner>/<repo>/pulls/<number>/comments?per_page=100'
gh api --hostname <host> --paginate --slurp 'repos/<owner>/<repo>/issues/<number>/comments?per_page=100'
```

`--slurp` returns an array of pages, not a flattened list. Flatten before indexing/deduplicating. Use review-comment `id`, `node_id`, `in_reply_to_id`, and `pull_request_review_id` to associate conversations. REST review comments do not expose the thread's resolved state, so fetch that through GraphQL:

```graphql
query($owner: String!, $repo: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      headRefOid
      baseRefOid
      reviewThreads(first: 100, after: $endCursor) {
        nodes {
          id
          path
          line
          isResolved
          isOutdated
          comments(first: 1) {
            nodes { id url }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

Save the query in a temporary file and pass it with `gh api graphql --hostname <host> --paginate -F owner=<owner> -F repo=<repo> -F number=<number> -F query=@<query-file>`. `$endCursor` and `pageInfo` let `gh` paginate the outer thread connection. The single first comment is only the mapping anchor; read **all** bodies/replies from the independently paginated REST comments collection. This avoids silently truncating nested replies at 100. If using a nested GraphQL comment connection instead, paginate it separately for every thread.

Use the original root review comment's numeric REST `id` (not its GraphQL ID or review ID) for a targeted inline reply:

```sh
gh api --hostname <host> --method POST repos/<owner>/<repo>/pulls/<number>/comments -F in_reply_to=<root-comment-id> -F body=@<reply-file>
gh pr comment <number> --repo <host/owner/repo> --body-file <reply-file>
```

The second command is for top-level findings/commands only. Pass bodies from prepared files rather than shell-interpolating reviewer text. GraphQL's `addPullRequestReviewThreadReply` is an alternative taking `pullRequestReviewThreadId` and `body`. If a specific thread may be resolved under repository policy, the supported mutation is `resolveReviewThread(input: {threadId: ...})`; this changes thread state, not review approval. Do not resolve disputed work.

Before repeating a reply after interruption or a timeout, fetch its conversation and compare the intended finding/disposition/fix commit. A timed-out write may already have succeeded.

For CodeRabbit approval, inspect REST review `user.login`, `state`, `commit_id`, `submitted_at`, and `html_url`. Require a real `APPROVED` review from the verified actor with `commit_id` equal to the latest head. An old-SHA approval, dismissed approval, or later changes request fails the gate. Inspect later `COMMENTED` reviews for new findings and incomplete review state rather than treating an earlier approval as unconditional. Also establish that review coverage postdates the last base/trunk change; REST review commit identity alone cannot prove this. After a changed comparison base, request fresh full review and record that cycle.

`reviewDecision` is GitHub's aggregate decision. Use it for effective required-review policy, but not to identify the CodeRabbit approver. Human/CODEOWNER requirements may remain unsatisfied after the bot approves. Read both classic branch protection and effective branch rules when needed; active rulesets can impose additional requirements:

```sh
gh api --hostname <host> repos/<owner>/<repo>/branches/<encoded-policy-branch>/protection
gh api --hostname <host> --paginate repos/<owner>/<repo>/rules/branches/<encoded-policy-branch>
```

URL-encode branch names in path segments. Use the stack trunk as the policy branch for native stacks. Distinguish insufficient permissions from absent protection; missing policy visibility cannot justify bypassing an unexplained required gate.

Sources: [review comments and replies](https://docs.github.com/en/rest/pulls/comments), [PR reviews](https://docs.github.com/en/rest/pulls/reviews), [issue comments](https://docs.github.com/en/rest/issues/comments), [GraphQL pull-request types and mutations](https://docs.github.com/en/graphql/reference/pulls), [gh api pagination and file inputs](https://cli.github.com/manual/gh_api), [gh pr comment](https://cli.github.com/manual/gh_pr_comment), [branch protection](https://docs.github.com/en/rest/branches/branch-protection), [repository rules](https://docs.github.com/en/rest/repos/rules).

## CodeRabbit commands and approval

Use the repository's verified service-account mention. Post one command per justified transition, not per polling interval:

| Top-level PR comment | Use |
| --- | --- |
| `@coderabbitai review` | Request incremental review of a new revision when automatic review did not run and manual review is allowed. |
| `@coderabbitai full review` | Re-review the whole diff after a changed comparison base/restack or incomplete coverage. |
| `@coderabbitai approve` | Only after all findings have evidenced dispositions and no dispute remains; it can resolve threads and only approves with `reviews.request_changes_workflow: true`. |

Never use blanket `@coderabbitai resolve`. `approve` and `resolve` are not supported in inline thread replies. A green bot check, “no actionable comments,” resolved threads, or the bot saying approval is disabled is not a submitted GitHub approval. Do not enable `request_changes_workflow` without authorization. With it enabled, CodeRabbit requires comments resolved, latest commit reviewed, and no failing pre-merge checks.

Sources: [CodeRabbit review commands](https://docs.coderabbit.ai/guides/commands), [configuration reference](https://docs.coderabbit.ai/reference/configuration), [local CLI and current flags](https://docs.coderabbit.ai/cli/).
