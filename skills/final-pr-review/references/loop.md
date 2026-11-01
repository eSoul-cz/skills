# Final PR review loop details

Detail for the steps in [SKILL.md](../SKILL.md). Read when you reach the matching step: "Waiter output" and "CI track" (step 4), "Review track" (step 4, CodeRabbit substitution), "Triage, fix, and reply" (step 5), "Stack fixes" (step 6), "Completion gate details" and "Blocked state" (step 7). The state machine, hard rules and delegation stay in SKILL.md.

## Waiter output

Act on `reason`: `pr-closed` or `revision-changed` → refresh the ledger; `ci-failed` → CI track; `review-check-failed` → the reviewer's automatic review failed, see the review track; `activity` → re-read the complete discussion inventory, because the snapshot lists only recent items; `settled` → CI finished without failures and every tracked reviewer completed its review of the current head, so evaluate the completion gate using each reviewer's `decision`. Exit 3 (`stalled`) means no observable change within `--stall-timeout` (default 30 minutes) and is the blocked condition. Exit 4 (`timeout`) only means your wall-clock budget expired; rerun with `--since <observedAt>` and `--last-progress <lastProgressAt>` from its output. Pass `--require-check` for every expected check discovered below, `--ignore-check` only for a diagnosed unrelated baseline failure, and `--allow-no-checks` only after verifying CI is N/A. While CodeRabbit is substituted (review track), pass `--skip-reviewer <verified-login>` so the waiter neither waits for it nor counts its limited check as CI; it still reports CodeRabbit activity. Run one waiter per in-scope stack layer. The waiter never posts, reruns, or resolves anything. If Node.js is unavailable, poll the documented `gh` commands manually with the same backoff and rate-limit rules. Do not busy-loop or post repeated review commands each poll.

## CI track

- Discover required checks from repository rules and PR state, and expected checks from CI configuration, including external providers. Observe both check runs and commit statuses; GitHub Actions alone is not the full CI surface.
- Use PR-aware checks for the current revision. A workflow may test GitHub's synthetic PR merge commit instead of the head SHA; establish its association with the current head/base rather than rejecting all different-SHA runs or accepting an old green run.
- Missing, queued, pending, cancelled, timed-out, action-required, or unexplained skipped checks are not success. Accept neutral/skipped only when GitHub's effective policy accepts them and the configured job is intentionally inapplicable. An empty check list is not evidence that expected CI passed.
- Inspect failure logs and distinguish a code failure from infrastructure, permissions, or an unrelated baseline failure. Fix owned code failures, verify locally, then publish a new revision. Do not alter unrelated code or bypass checks. Retry only a diagnosed transient failure; repeated failures without new evidence are a blocker, not a reason to rerun indefinitely.
- Zero applicable checks may be recorded as N/A only after verifying that neither repository policy nor CI configuration expects any. Otherwise wait for registration or diagnose the missing trigger.

## Review track

- Identify the actual CodeRabbit account from the repository integration and authored review/check metadata; do not trust a display name or assume the bot login is always identical across installations.
- Read **all pages** of reviews, inline review threads and their replies, and top-level PR comments. CodeRabbit can put actionable findings, including out-of-diff findings, in a review body or walkthrough rather than an inline thread. Include other reviewers' actionable feedback in scope as well.
- Wait for CodeRabbit to finish processing the current head. CodeRabbit reviews every push automatically; when an incremental review finds nothing new, it posts no new review or comment and only marks its status check completed. A successful CodeRabbit check on the current head therefore shows the head was reviewed, but it is not approval: approval is the verified account's latest non-dismissed `APPROVED` review, which may be on an earlier commit. If the repository disables CodeRabbit's commit status, require a CodeRabbit review of the current head instead. Absence of findings or a successful CLI exit is not approval.
- Request a review manually only when CodeRabbit's automatic review of the current head did not complete: its check failed or errored, it reports an error, or it never started for the head before the waiter stalled. A rate limit or exhausted credits is not waited out; it is handled by the substitution below. First inspect drafts, pauses, ignore directives, branch filters, integration permissions, and effective configuration; do not silently remove these policies. When manual review is allowed, post one top-level `@coderabbitai review` for that head; use the verified account's mention if different. Use `full review` only when CodeRabbit reports incomplete coverage. Never request a review merely because a commit was pushed, the base changed, or the approval is on an earlier commit.
- **CodeRabbit substitution.** When CodeRabbit reports its rate limit or exhausted credits for the current head (confirm with `pre-pr-review`'s `post-review.mjs check`), do not wait for a reset, credits, or a CodeRabbit review: run `pre-pr-review` step 8 to post a fallback review of that head and continue with it in CodeRabbit's place. Triage its threads under "Triage, fix, and reply" below like any reviewer's and resolve them yourself once each disposition is evidenced. Then review the final head again and post: with no new finding and no open thread, the script posts the `pre-pr-review` approval. Restart the waiter with `--skip-reviewer`. Repeat for every new head while CodeRabbit stays limited; the script posts only new findings. Do not post `@coderabbitai review` or `@coderabbitai approve` to a limited CodeRabbit. If CodeRabbit nevertheless reviews the current head before completion, its findings join the triage and its normal rules apply from then on. Record the limit notice and the fallback review in the ledger.
- Deduplicate review requests and replies against remote state, including after resuming an interrupted session. If a write times out, re-read before retrying it.

A push, rebase, retarget, lower-layer update, or externally changed head/base invalidates the affected ledger's green CI and review-completion evidence. Refresh it and return to both tracks. An earlier CodeRabbit approval stays valid once CodeRabbit's automatic review of the new head completes without new findings or a changes request; do not force a re-review to move the approval onto the new head.

## Triage, fix, and reply

Create a task for every finding needing work, grouped as Critical, Warning, or Info. Severity controls order, not whether a valid finding is addressed. Consolidate duplicate root causes without losing any remote discussion.

| Disposition | Required action |
| --- | --- |
| Valid | Reproduce or establish the bug/risk from code, implement the smallest correct fix, exercise the affected behavior, then commit and publish. Reply with the fix commit and concrete verification. |
| Invalid / not applicable | Explain the disputed claim, the relevant code/contract or reproduction evidence, and why no change is warranted. Reply in the original thread; invite reconsideration when uncertainty remains. |
| Duplicate / already fixed | Link the canonical finding and fix commit; verify the current revision really contains the fix, then reply to every duplicate thread. |
| Uncertain / needs a decision | Investigate first. If a material product decision, permission, or inaccessible external information is still needed, ask a focused question and mark the finding blocked. Never relabel it invalid to finish. |

Do not make speculative style churn to appease a bot. A genuine in-scope improvement can still be valid at Info severity. A valid but materially out-of-scope change requires an explicit user decision; do not quietly defer it and claim all findings addressed.

Batch coherent fixes and verification before pushing; do not produce a commit or review request for each comment by default. Read surrounding code and preserve the task's intended behavior. For bugs, reproduce and confirm the fix, keeping a regression test where it guards a plausible failure; follow repository test conventions.

Reply to inline findings in their original review thread, not a new top-level comment. For review-body/top-level findings, reply with a link or quote identifying the exact finding. Use file/stdin/API-variable inputs for reply bodies, never interpolate reviewer text into shell code. Do not leak sensitive logs.

After pushing, post evidence-backed fix replies. Prefer CodeRabbit/reviewer acknowledgment and resolution. Resolve a specific thread yourself only when repository policy permits and its disposition is evidenced; an invalid-but-disputed finding remains open. Never equate `isOutdated` with resolved or dismiss a changes-requested review yourself.

Never use blanket `@coderabbitai resolve`. While CodeRabbit is substituted, skip the approval request below; the `pre-pr-review` approval takes its place. After **every** finding has a defensible disposition and no dispute remains, a single top-level `@coderabbitai approve` may request approval when CodeRabbit's latest decision is not already `APPROVED`. It can resolve threads, so it must not be used to conceal outstanding work. It only submits approval when `reviews.request_changes_workflow` is enabled. If disabled, report the exact policy prerequisite and request an authorized policy decision; do not change configuration or substitute a resolved-thread count for an approval.

Return to local verification/review, publication, and both remote tracks after any fix. Re-read remote discussions for new findings even when the previous batch is fully addressed.

## Stack fixes at their owning layer

Fix a finding in the layer that owns the code, never by masking it in a descendant. Restacking, lease-protected pushes, re-verification of each changed layer and membership changes during the loop follow [stacks](stacks.md); never use raw `--force`.

## Completion gate details

Immediately before completion, re-fetch each in-scope PR and compare its head **and base** to the verified revision. All of these must hold for every affected in-scope layer:

1. Intended commits are published; the PR targets the intended base and native stack membership/order is preserved where applicable.
2. Applicable required and expected CI has completed successfully for this revision, with any intentional N/A explicitly evidenced. No active failed or pending applicable check is ignored.
3. CodeRabbit's check on the current head completed successfully (or, when its commit status is disabled, a CodeRabbit review covers the current head), and the verified CodeRabbit account's latest non-dismissed decision is `APPROVED`. That approval may be on an earlier commit when later automatic reviews found nothing new. No later changes request, blocking review, new unresolved CodeRabbit finding, or unresolved dispute supersedes it. **Or, under CodeRabbit substitution, `pre-pr-review` approves instead:** `post-review.mjs check` shows CodeRabbit rate-limited or out of credits for the current head, the latest `pre-pr-review` fallback review of the current head is an approval (✅, marked `<!-- pre-pr-review:approved head=<current head> -->`), no fallback thread is open, every body-only fallback finding is recorded as resolved, and CodeRabbit has not reviewed the current head since. Either CodeRabbit or `pre-pr-review` approves; CodeRabbit's absence then does not block completion.
4. Every valid finding is fixed and verified, every invalid/duplicate finding has an evidence-backed reply, and required review conversations are resolved under repository policy. No new untriaged finding remains.
5. Repository-required approvals, including human/CODEOWNER reviews where applicable, are satisfied with no outstanding changes requested. A CodeRabbit approval alone does not bypass them; an aggregate `reviewDecision` alone does not prove CodeRabbit approved.
6. No applicable protection/mergeability issue remains, except a documented stack dependency that will clear only when an approved predecessor merges. Do not merge to clear it. If GitHub cannot establish the required gate for the current layer yet, report it as waiting/blocked, not approved-and-ready.

A stable all-green snapshot is the exit gate. Report PR/stack URLs and order, verified head/base SHAs, local checks and local-review mode/result, remote CI and approval links (or, under substitution, the CodeRabbit limit notice and the fallback review links, stated as a substitution and not as a CodeRabbit approval), fixes and rejected findings, and any remaining external dependency. Say explicitly that nothing was merged.


## Blocked state

If genuinely blocked (missing authentication, unavailable integration, disabled approval policy, required human review, inaccessible CI, denied restack permission, or a stalled service), complete all independent actionable work first. Use a bounded wait window (default 30 minutes without observable progress unless the user/repository specifies otherwise); resume while there is progress, but do not retry indefinitely. Report the blocker, last observed revision/state, what was attempted, and the exact action needed to resume. A wait expiry is **blocked**, never success. Reconstruct the ledger from remote state when resumed.
