# Posting a fallback review to the PR

Detail for step 8 of `pre-pr-review`: CodeRabbit hit its rate limit or ran out of credits on an open PR, and the findings go into the PR as review comments instead.

## Detect the limit

```bash
node "$SKILL_DIR/scripts/post-review.mjs" check <pr-url> [--reviewer <verified-coderabbit-login>]
```

Read-only. `rateLimited: true` means CodeRabbit's latest word on the PR is its "Rate limit exceeded" notice (marked `<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->` in its summary comment) or its status or check run on the head mentions the limit. `notice.resetAt` is when the hourly limit lifts; `creditsExhausted: true` means waiting will not help until someone buys credits. A notice older than CodeRabbit's latest review no longer counts: CodeRabbit removes it once a review goes through. `head` is the revision to review.

## Review exactly the published head

The comments are anchored to the PR head commit, so review that revision, not local work:

- If the local branch is at the PR head with a clean worktree, review there.
- Otherwise fetch the head (`git fetch <remote> pull/<number>/head`, which also works for forks) and review it in a temporary worktree outside the repository (`git worktree add --detach <scratch-dir>/pr-<number> <head-sha>`). Remove it afterwards (`git worktree remove`).

Run the scope script with `--type committed --base <PR base SHA>` after fetching the base; that is the diff GitHub shows. Then follow steps 2–5 as usual.

## Findings file

Write it outside the repository (the scratchpad or a temp directory):

```json
{
  "head": "<full PR head SHA that was reviewed>",
  "language": "cs",
  "reason": "CodeRabbit narazil na hodinový limit (reset v 10:54).",
  "summary": "<walkthrough paragraph and changes table from the report>",
  "verdict": "<verdict and Not covered lines from the report>",
  "findings": [
    {
      "severity": "High",
      "title": "Total ignores the discount",
      "path": "app/Orders/Total.php",
      "line": 42,
      "startLine": 40,
      "body": "**Evidence:** ...\n\n**Expected:** ... (source: ...)\n\n**Verification:** ...",
      "suggestion": "<exact replacement text for lines startLine..line>",
      "id": "<optional: reuse an existing id>"
    }
  ],
  "resolved": [
    { "id": "<id of an earlier finding outside the diff>", "note": "Fixed in abc1234; covered by TotalTest::testDiscount." }
  ]
}
```

- `language`: `cs` or `en` for the fixed texts. Take it from `.coderabbit.yaml` `language` (`cs-CZ` → `cs`); otherwise match the PR description. Write `reason`, `summary`, `verdict`, titles, and bodies in the same language.
- `line` and `startLine` are line numbers in the head version of the file. A finding becomes an inline comment only when its whole range lies in one hunk of the PR diff; otherwise it goes to the review body under "Outside the diff range", with its location.
- `suggestion` is optional and only for a fix that replaces exactly those lines; GitHub then offers it as a one-click commit. Leave it out for anything larger, and describe the fix in `body` as a short diff instead.
- `id` defaults to a hash of path and normalized title; an explicit id may contain only letters, digits, `_`, and `-`. Reuse an id from the dry run's `existing` list when a finding was already reported with different wording.
- `resolved` records findings that earlier fallback reviews listed in their body (outside the diff). They have no thread to resolve, so they stay open, and block the approval, until a later review lists them here with the fix commit or evidence. The dry run's `openInBodies` names them; an unknown id is rejected.
- Mentions (`@name`) in severities, titles, locations, bodies, `reason`, `summary`, `verdict`, and resolution notes are defanged outside code, so quoted text never notifies anyone or addresses a bot. Marker-shaped text (`<!-- pre-pr-review:...`) quoted anywhere in the review is broken up, so only the script's own markers decide a finding's state. Inline suggestions are published unchanged.
- Never put a credential, real client data, or anything from `.env` into a body or suggestion.

## Post

```bash
node "$SKILL_DIR/scripts/post-review.mjs" post <pr-url> --findings <file>          # dry run: prints the payload
node "$SKILL_DIR/scripts/post-review.mjs" post <pr-url> --findings <file> --post   # publishes
```

The dry run prints the exact review payload, which findings go inline or to the body, which are duplicates, and the fallback threads already on the PR (`existing`). Check placement and content, then publish. The script:

- posts one review with event `COMMENT`, never `APPROVE` or `REQUEST_CHANGES`;
- refuses a closed PR, and exits 3 when the PR head moved after the review (review the new head instead);
- skips findings that already have an unresolved fallback thread, and body findings listed in an earlier fallback review and not yet recorded under `resolved`; a finding whose thread was resolved, or whose body entry was recorded as resolved, is posted again when found again;
- rejects an id listed both in `findings` and in `resolved`;
- approves the head (`approved: true`, a "✅ Approved by `pre-pr-review`" section, and a `<!-- pre-pr-review:approved head=<sha> -->` marker) when the findings file is empty, no fallback thread is open, and every body-only finding is recorded as resolved; otherwise the body says how many findings are still open (`openFindings`);
- reports `up-to-date` and posts nothing when this head already has a fallback review, nothing is new, and the approval state has not changed; a first review with no findings is still posted once, so the PR shows it was reviewed;
- if GitHub rejects the inline positions (HTTP 422), posts once more with every finding in the body.

Each comment carries a hidden `<!-- pre-pr-review:finding:<id> -->` marker and the review a `<!-- pre-pr-review:review head=<sha> -->` marker; do not remove them when editing.

## After posting

- The threads come from the authenticated account, usually the PR author, and no bot will answer them. Handle them like any reviewer's findings. After pushing a fix, reply in the thread with the commit and verification, then resolve the thread yourself. A finding you reject gets an evidence-backed reply and is resolved with it.
- On every new head while CodeRabbit is still limited, run `check` and the PR-mode review again; the script posts only what is new.
- To approve, resolve every fallback thread, review the current head once more, and post a findings file that leaves out findings already answered with evidence and lists every `openInBodies` finding under `resolved`. An empty `findings` array with nothing open produces the approval, even on a head that already has a fallback review.
- Never post `@coderabbitai` commands from this skill. `final-pr-review` treats the fallback review as CodeRabbit's substitute for that head and does not wait for a reset or credits; if CodeRabbit reviews the head after all, its findings are handled like any other.
