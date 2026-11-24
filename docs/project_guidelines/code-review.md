<!-- esoul-guidelines:begin code-review -->
# Project guidelines - Code review

Reviews happen in pull request threads. This document defines the shared vocabulary for findings, what a reviewer checks a pull request against, and how CodeRabbit and the human review fit together. Branches, commits and pull request rules are in [workflow.md](workflow.md).

## Who reviews

<!-- from: profile/internal -->
- Only privileged people change this repository, so the human review is the **owner's explicit
  go-ahead to merge**, given in the pull request, instead of a second reviewer with write access.
  Every pull request is also reviewed by **CodeRabbit**. CodeRabbit review is configured at the
  platform level; the repository's `.coderabbit.yaml` only excludes generated paths. A CodeRabbit
  approval never replaces the owner's go-ahead.
- The author finishes the pull request with the `esoul-review` skill: green `Jenkins` check,
  every CodeRabbit finding answered, local review run where the skill asks for it.
- When CodeRabbit hits its rate limit or runs out of credits, nobody waits for it: the
  `esoul-review` skill posts a fallback review of the same revision into the pull request, and
  its findings are answered the same way. Once they are resolved, its review (a `COMMENT`, not a
  GitHub approval) stands in for CodeRabbit's. It does not replace the owner's go-ahead.
- The author merges under the rules in [workflow.md](workflow.md#pull-requests): the owner's
  explicit go-ahead (or the approval of a reviewer, when one is set) and a green `Jenkins`
  check. Agents MUST NOT merge, approve or use a ruleset bypass unless the human
  owner explicitly authorises it for that pull request or batch; the authorisation, and the reason
  for a bypass, go in the pull request description.
- When review finds defects, the task moves back to `In progress`; review time is logged as a
  work report.

## Severity

The names are CodeRabbit's, so human, CodeRabbit and agent findings share one scale.

- **Critical** - the pull request must not merge until the finding is resolved.
- **Major** - materially wrong behaviour, work that was already approved or committed being discarded or overwritten (a reverted feature, a migration that drops data), or a violation of an `accepted` ADR or of a MUST rule in `AGENTS.md` or these guidelines.
- **Minor** - significant duplication, overengineering, a missing test for a non-critical path, or another maintainability risk.
- **Nitpick** - local cleanup that can be included with related remediation.

A project or template that still uses the older names maps them: Blocker is Critical, High is Major, Medium is Minor, Low is Nitpick.

`Critical` and `Major` findings on the changes of the pull request prevent the merge (a **Pre-existing** problem is the exception, see [Keeping review short](#keeping-review-short)). `Minor` and `Nitpick` are either fixed in the same pull request or marked `Deferred`: the pull request merges with a linked follow-up issue, which is a new issue and task like any other work.

### Default Critical findings

A finding is `Critical` by default when it can:

- produce a **wrong amount or figure**: a price, a total, a tax, a balance, an hour count, a computed number the client relies on. A wrong number has already been sent by the time a later fix lands;
- cause a **duplicate write to an external system**: a second invoice, payment, shipment, e-mail or ERP record. A non-idempotent handler, listener or job is the usual cause;
- **leak data across a boundary**: another tenant's, customer's or role's data in a payload, an export, a notification or a log. Filtering in the browser is not a boundary;
- make a **data change untraceable**: stored data changed without the record, history entry or source reference that lets the change be explained or recomputed;
- put a **credential, personal data or non-public client data** (real amounts, rates, prices, documents) into code, tests, fixtures, issues or pull requests, except what [security-and-data.md](security-and-data.md#personal-and-client-data) allows (public data and its exports, an anonymised sample of faulty records, recorded exceptions);
- **break a published contract without a migration path**: the public API of a released package, a webhook, REST or export payload that another system consumes, or an irreversible migration without a rollback plan;
- **rely on the interface alone to enforce a rule**: a deadline, a permission, a limit, a required field or a state that hides a button or a tab. Every rule the interface shows is enforced on the server too (form request, policy or the domain check in the command handler) and tested there by a call that expects the rejection ([security-and-data.md](security-and-data.md#authorization), [testing.md](testing.md#authorization-tests)). Hiding a control is presentation, not enforcement.

These are the findings a later fix does not repair. A project MAY add its own default Critical findings in its project-specific guidelines.

### Default Major findings

- A rule that decides visibility, scoping, eligibility or status lives in more than one place: two methods with the same branching, or the same markup copied into each branch of a template. The rule is one query scope, policy, enum method or composable that every caller uses, and the author searches for an existing one before writing a new helper. Copies that already disagree are the defect the rule prevents.

## Keeping review short

- At most three `Nitpick` findings per review. Style a formatter or linter can enforce goes into the tool, not into review comments.
- Generated code, vendored assets and anonymised fixtures derived from a client export ([security-and-data.md](security-and-data.md)) are not reviewed line by line; review the generator, its input and the rule that produced them.
- A problem the pull request did not introduce is marked **Pre-existing**. It is reported only when it is `Critical` or `Major`, and it is fixed in this pull request only when the fix is small and in scope; otherwise it does not block this pull request and becomes a `Deferred` follow-up.
- A pattern is reported once, with every instance, so it is fixed in one go.
- A finding that keeps coming back in reviews becomes a rule: a lint or static analysis rule, a test, a line in `AGENTS.md`, or a line in these guidelines. The author of the pull request where it recurs proposes the rule, in that pull request or a linked follow-up.

## What a reviewer checks against

Read the issue and its acceptance criteria before reading the diff. Then check, in this order:

1. **The issue.** The change stays within its scope and meets every acceptance criterion. A feature is not mixed with unrelated refactoring.
2. **`accepted` ADRs** that touch the area. The change implements them or records the difference as a gap; a change of the target contract comes with an ADR in the same pull request ([workflow.md](workflow.md#pull-requests)). A pull request that closes a gap updates the ADR's *Implementation status*.
3. **`AGENTS.md` and these guidelines**, in particular the architecture and boundary rules of the stack.
4. **Tests.** New or changed behaviour has a useful test, a bug fix has a regression test that fails without the fix, no test asserts the text of a user-facing error message (assert the type or class, error keys or codes, field names or HTTP status instead; the text of an internal error message, such as an exception or a developer-facing validation or configuration error, MAY be asserted), and the checks the author ran are listed in the pull request ([testing.md](testing.md)). A test beyond the tier its flow needs ([How much to test](testing.md#how-much-to-test)), or more than 30 seconds of added test time without a reason in the description, is reported as overengineering.
5. **Vocabulary.** Names follow the glossary; a new term is added to the glossary, preferably in the same pull request ([domain.md](domain.md)).
6. **Documentation.** Text that the change makes stale is updated, preferably in the same pull request, otherwise in a stacked one ([documentation.md](documentation.md)).
7. **Open questions.** A rule the client has not decided is not implemented anyway. Guessing an open question is `Major`; the fix is to split the slice and ask.

A green `Jenkins` check proves that the automated checks pass. It does not prove that the issue is solved, that the design is matched or that acceptance testing passes. Those stay the reviewer's job.

A pull request that changes more than roughly 30 files is split ([workflow.md](workflow.md#pull-requests)); when it cannot be split, its description says how to review it in parts. Mechanical changes (formatter output, generated files, lock files) in their own commit do not count towards the limit.

## Findings

A finding names **one problem with one fix**, not one affected file. Before raising a new finding, compare it with the existing ones. If it has the same root cause or the same remediation, add the evidence to the existing finding instead of opening a second one from a different file or symptom. A shared intended behaviour alone is not enough: two defects that need two independent fixes are two findings.

Write a finding so that the author can act on it without asking:

- **Severity** and a short title;
- **Evidence** - what the code does, with the file and line;
- **Expected** - the intended behaviour and its source (issue, ADR, `AGENTS.md` rule, guideline);
- **Proposed resolution** - the smallest coherent fix;
- **Verification** - the test or check that proves the fix.

Facts the repository answers are investigated, not asked about. Decisions are put to the owner in rounds: ask together the questions that do not depend on each other, wait for the answers, then ask the ones that depended on them.

### Findings stay in the pull request

Each finding is one review thread. Findings MUST NOT be recorded in a repository file: no review ledger such as `docs/review/PR_<number>.md`, not even for a large pull request or a review that takes several rounds. A pull request too large to review in one pass is split (or, when it cannot be split, described so that it can be reviewed in parts; [workflow.md](workflow.md#pull-requests)), not tracked in a ledger. Decisions that should outlive the review (an accepted risk, deferred work) go into the pull request description, which survives the squash merge. A reviewer MAY keep a temporary local ledger as working evidence; it is never committed or pushed.

### Finding states

When findings cannot be closed in one round, track their state in the thread. A finding is `open` until it is closed with one of the outcomes below:

| State | Meaning |
|---|---|
| `open` | Raised and not yet closed |
| `Resolved` | The fix is committed to the pull request branch (or merged) and verified |
| `Accepted` | Behaviour or complexity explicitly accepted without a code change |
| `Deferred` | Moved out of scope: the pull request merges with a linked follow-up issue (and task) that owns the work |

A finding is closed only as `Resolved`, `Accepted` or `Deferred`, each with its evidence linked. A finding on code of the pull request is `Resolved` as soon as the verified fix is on the branch, so a `Critical` finding can be closed before the merge. A finding that is **invalid** is closed as `Resolved` with no code change: the reply that shows why it does not apply (the file and line, the test, the ADR or the guideline, as in [Answering findings](#answering-findings)) is its linked evidence.

## Answering findings

- Treat CodeRabbit findings like any reviewer's. **Fix the valid ones. Answer the invalid ones with evidence**: the file and line, the test, the ADR or the guideline that shows why the finding does not apply. "Not relevant" without evidence is not an answer.
- Do not resolve another person's thread silently. Reply with what changed and the commit that changed it.
- An accepted finding states who accepted it and why.
- A valid finding that arrives after the merge is fixed in a follow-up pull request linked from the thread; it is not left unanswered.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end code-review -->
