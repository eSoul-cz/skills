# GitHub operations for the PR loop

Commands are recipes, not permission to mutate arbitrary PRs. Replace placeholders with discovered values; do not run angle-bracket placeholders literally. Use the harness's equivalent specialized tools when available. `gh <command> --help` is the source for flags; this file keeps what the help does not tell.

## Repository and revision discovery

Use `gh auth status --hostname <host>` and `gh pr view --help` to establish capabilities, and keep tokens out of output. Set `GH_HOST` for the discovered host when needed. For `gh pr` operations qualify `--repo <host/owner/repo>`; for API operations use `--hostname <host>` and the base repository's `owner/repo` in the path. A PR number is not globally unique.

```sh
gh pr list --repo <host/owner/repo> --state open --head <head-branch> --json number,url,headRefName,headRepositoryOwner,baseRefName
gh pr view <number> --repo <host/owner/repo> --json number,url,state,isDraft,headRefName,headRefOid,baseRefName,baseRefOid,reviewDecision,mergeStateStatus,statusCheckRollup
gh api --hostname <host> repos/<owner>/<repo>/pulls/<number>
```

Confirm a candidate's head repository and owner, not only its branch name. REST PR metadata (`head.sha`, `head.repo`, `base.sha`, `base.repo`) fills in where the CLI JSON fields differ. Fork PRs publish to the head repository, but reviews, checks and PR metadata belong to the base repository.

Before each write, verify the target PR and intended revision. After publication and immediately before completion, re-read head and base metadata. A `mergeStateStatus` of `UNKNOWN` requires another observation; it is not permission to declare success.

## Standalone PR publication

Push the owned branch to the verified remote using the repository's normal workflow, and search again before creating a PR to avoid duplicates after interruptions.

```sh
gh pr create --repo <host/owner/repo> --head <head-owner:branch-or-branch> --base <base-branch> --title <title> --body-file <prepared-body-file>
gh pr edit <number> --repo <host/owner/repo> --body-file <prepared-body-file>
```

`gh pr create --head <user>:<branch>` does not support organization owners. For an organization-owned fork in the same repository network use the REST endpoint:

```sh
gh api --hostname <host> --method POST repos/<base-owner>/<base-repo>/pulls -f head=<head-owner:branch> -f head_repo=<head-repository-name> -f base=<base-branch> -f title=<title> -F body=@<prepared-body-file> -F draft=false
```

`head_repo` is the repository name, not its URL, and is required when both repositories belong to the same organization. Preserve explicit draft intent instead of always sending `draft=false`. `gh pr create --dry-run` is not a safe validation call: it may still push changes.

Keep body files outside tracked repository content and remove them afterward. Preserve existing human-written descriptions when editing. Set `--draft` only when the user requires a draft; use `gh pr ready` within the authorized finalization scope.

## Stacks

Ordinary chained PRs: [stacks.md](stacks.md). For a native GitHub stack read `gh stack --help` (and `gh stack <command> --help`) for the commands. What the help does not say:

- A native stack's membership is server metadata. REST PR metadata has a nullable `stack` (`number`, `position`, `size`, `base`; `position` 1 is the bottom); a chained `base.ref` alone does not establish membership. Read a stack with its **repository-local stack number**, which is not a PR number and not the opaque `id`:

  ```sh
  gh api --hostname <host> repos/<owner>/<repo>/stacks/<stack-number>
  gh api --hostname <host> --paginate 'repos/<owner>/<repo>/stacks?pull_request=<pr-number>&per_page=100'
  ```

  Order comes from each member's `stack.position`. A permission or unsupported-endpoint error is not proof of no stack. All branches of a native stack live in one repository; a cross-fork stack cannot be created.
- The **direct base** (previous layer) is the incremental review base; the **stack trunk** (`stack.base.ref`) is where protection rules apply. Record the trunk SHA: a trunk change invalidates integration evidence.
- `gh stack push` is **not atomic**: with per-branch leases, some branches can update while another lease fails. After any failure re-fetch every affected remote tip and invalidate the evidence of branches that were updated before reconciling the rejected one.
- `gh stack sync` mutates: it can fetch, rebase, push and change stack membership. It is not a polling command, and noninteractive composition divergence can exit successfully without syncing, so verify actual state, not exit status.
- `gh stack checkout`, `init` and `submit` also change local or remote state; check scope, ownership and a clean worktree first, and use `submit --auto` without `--open` unless every affected PR may be marked ready.

## CI: PR-aware checks plus effective policy

```sh
gh pr checks <number> --repo <host/owner/repo> --json name,state,bucket,workflow,link
gh pr checks <number> --repo <host/owner/repo> --required --json name,state,bucket,workflow,link
```

The first command shows all reported checks; `--required` alone misses expected non-required CI. For waiting use `scripts/wait-pr.mjs`: it reads the same PR rollup (check runs and commit statuses, all pages) and enforces backoff, rate limits and the no-progress window. Use the one-shot commands for investigation. When the poller cannot run, poll manually with a per-command timeout and 30 to 120 seconds of backoff, check head, base and remote review progress between polls, and enforce the 30-minute no-progress window outside the command; an unbounded `--watch` is not allowed, and an expired window is blocked.

GitHub Actions `pull_request` workflows commonly use the synthetic merge ref. Use PR-aware results and inspect run, event, head and base association; an unrelated green run for a branch with the same name does not count. External CI may publish commit statuses rather than Actions jobs. When investigating raw results, inspect both for the tested revision, including the merge revision when relevant:

```sh
gh api --hostname <host> --paginate 'repos/<owner>/<repo>/commits/<tested-sha>/check-runs?per_page=100'
gh api --hostname <host> --paginate 'repos/<owner>/<repo>/commits/<tested-sha>/statuses?per_page=100'
gh run view <run-id> --repo <host/owner/repo> --log-failed
```

Raw status lists include history; use the latest applicable result per context, not an old success, and distinguish rerun attempts. Effective branch and ruleset policy and the expected workflow triggers determine what must appear; the names currently in a rollup do not define the policy. For native stacks inspect trunk rules too.

## Complete discussion inventory and replies

Fetch these three independent REST collections with pagination. Reviews contain review-body findings; review comments contain inline roots **and replies**; issue comments contain top-level PR discussion and CodeRabbit walkthroughs.

```sh
gh api --hostname <host> --paginate --slurp 'repos/<owner>/<repo>/pulls/<number>/reviews?per_page=100'
gh api --hostname <host> --paginate --slurp 'repos/<owner>/<repo>/pulls/<number>/comments?per_page=100'
gh api --hostname <host> --paginate --slurp 'repos/<owner>/<repo>/issues/<number>/comments?per_page=100'
```

`--slurp` returns an array of pages, not a flattened list: flatten before indexing or deduplicating. Associate conversations with review-comment `id`, `node_id`, `in_reply_to_id` and `pull_request_review_id`. REST review comments do not expose a thread's resolved state, so fetch that through GraphQL:

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

Save the query in a temporary file and pass it with `gh api graphql --hostname <host> --paginate -F owner=<owner> -F repo=<repo> -F number=<number> -F query=@<query-file>`. `$endCursor` and `pageInfo` let `gh` paginate the outer thread connection. The single first comment is only the mapping anchor; read **all** bodies and replies from the independently paginated REST comments collection, which avoids silently truncating nested replies at 100.

Use the original root review comment's numeric REST `id` (not its GraphQL ID or review ID) for a targeted inline reply:

```sh
gh api --hostname <host> --method POST repos/<owner>/<repo>/pulls/<number>/comments -F in_reply_to=<root-comment-id> -F body=@<reply-file>
gh pr comment <number> --repo <host/owner/repo> --body-file <reply-file>
```

The second command is for top-level findings and commands only. Take bodies from prepared files rather than shell-interpolating reviewer text. If a specific thread may be resolved under repository policy, the mutation is `resolveReviewThread(input: {threadId: ...})`; it changes thread state, not review approval. A disputed thread stays open.

Before repeating a reply after interruption or a timeout, fetch its conversation and compare the intended finding, disposition and fix commit: a timed-out write may already have succeeded.

For CodeRabbit approval, inspect REST review `user.login`, `state`, `commit_id`, `submitted_at` and `html_url` for the verified actor. Its latest non-dismissed decision (`APPROVED` or `CHANGES_REQUESTED`) must be `APPROVED`; a dismissed approval or a later changes request fails the gate. Inspect later `COMMENTED` reviews for new findings rather than treating an earlier approval as unconditional. The approval's `commit_id` may be older than the head: CodeRabbit reviews every push automatically and posts nothing new when an incremental review finds no new issues. Coverage of the current head comes from CodeRabbit's commit status on the head SHA (created by the verified account, usually context `CodeRabbit`): `pending` means in progress, `success` means reviewed.

`reviewDecision` is GitHub's aggregate decision. Use it for effective required-review policy, not to identify the CodeRabbit approver. Human review requirements may remain unsatisfied after the bot approves. Read classic branch protection and effective branch rules when needed; active rulesets can impose additional requirements:

```sh
gh api --hostname <host> repos/<owner>/<repo>/branches/<encoded-policy-branch>/protection
gh api --hostname <host> --paginate repos/<owner>/<repo>/rules/branches/<encoded-policy-branch>
```

URL-encode branch names in path segments; use the stack trunk as the policy branch for native stacks. Distinguish insufficient permissions from absent protection; missing policy visibility cannot justify bypassing an unexplained required gate.

## CodeRabbit commands and approval

Use the repository's verified service-account mention. Post one command per justified transition, not per polling interval:

| Top-level PR comment | Use |
| --- | --- |
| `@coderabbitai review` | Request a review of the current head only when its automatic review failed, errored, or never started, and manual review is allowed. Not for each new commit, a changed base, or an approval on an earlier commit. Not to a rate-limited or out-of-credits CodeRabbit: that case is the fallback review (SKILL.md step A9). |
| `@coderabbitai full review` | Re-review the whole diff only when CodeRabbit reports incomplete coverage. |
| `@coderabbitai approve` | Only when CodeRabbit's latest decision is not already `APPROVED`, all findings have evidenced dispositions, no dispute remains, and CodeRabbit is not substituted. It can resolve threads and only approves with `reviews.request_changes_workflow: true`. |

Blanket `@coderabbitai resolve` is not used. `approve` and `resolve` are not supported in inline thread replies. A green bot check, "no actionable comments", resolved threads, or the bot saying approval is disabled is not a submitted GitHub approval. `request_changes_workflow` is enabled only with authorization; once enabled, CodeRabbit requires comments resolved, the latest commit reviewed and no failing pre-merge checks.
