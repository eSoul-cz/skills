# Project guidelines - Code review

Reviews happen in pull request threads. This document defines the shared vocabulary for
findings, what a reviewer checks a pull request against, and how CodeRabbit and the human review
fit together. The process around it (branches, checks, Definition of Done, merging) is in
[CONTRIBUTING.md](../../CONTRIBUTING.md); the company standard is at https://dev.docs.esoul.cz.

## Who reviews

- Every pull request is reviewed twice: by **CodeRabbit**, which runs automatically with
  [`.coderabbit.yaml`](../../.coderabbit.yaml) (inheriting the organisation's policy), and by at
  least **one human** with write access. A CodeRabbit approval never replaces the human review.
- The author finishes the pull request with the `final-pr-review` skill: green `Jenkins` check,
  every CodeRabbit finding answered, local review run where the skill asks for it.
- A pull request merges with a **squash merge** after one human approval and a green `Jenkins`
  check. A human merges from a personal account. Agents never merge, never approve, and never
  use a ruleset bypass.
- When review finds defects, the Freelo task moves back to `In progress`; review time is logged
  as a Freelo work report.

## Severity

> [!CAUTION]
> **Blocker** — the pull request must not merge until the finding is resolved.

> [!WARNING]
> **High** — materially wrong behaviour, lost authorised work, or a violation of an `accepted`
> ADR or of a MUST rule in `AGENTS.md` or these guidelines.

> [!IMPORTANT]
> **Medium** — significant duplication, overengineering, a missing test for a non-critical path,
> or another maintainability risk.

> [!NOTE]
> **Low** — local cleanup that can be included with related remediation.

`Blocker` and `High` prevent the merge. `Medium` and `Low` MAY be merged when the author fixes
them in the same pull request or the project lead accepts a follow-up; a follow-up is a new issue
and Freelo pair like any other work.

### Default Blockers

A finding is a `Blocker` by default when it can:

- produce a **wrong amount or figure**: a price, a total, a tax, a balance, an hour count, a
  computed number the client relies on. A wrong number has already been sent by the time a later
  fix lands;
- cause a **duplicate write to an external system**: a second invoice, payment, shipment, e-mail
  or ERP record. A non-idempotent handler, subscriber or job is the usual cause;
- **leak data across a boundary**: another tenant's, customer's, role's or sales channel's data
  in a payload, an export, a notification or a log. Filtering in the browser is not a boundary;
- make a **data change untraceable**: stored data changed without the record, history entry or
  source reference that lets the change be explained or recomputed;
- put a **credential or real client data** into code, tests, fixtures, issues or pull requests.

These are the findings a later fix does not repair.

<!-- optional: project-specific Blockers -->
In this project a finding is also a `Blocker` by default when {{PROJECT_SPECIFIC_BLOCKERS}}.

## What a reviewer checks against

Read the issue and its `## UAT` section before reading the diff. Then check, in this order:

1. **The issue.** The change stays within its scope and meets every acceptance criterion. The
   UAT scenario has been exercised. A feature is not mixed with unrelated refactoring.
2. **`accepted` ADRs** that touch the area. The change implements them or records the
   difference as a gap; a change of the target contract comes with an ADR. A pull request that
   closes a gap updates the ADR's *Implementation status*.
3. **`AGENTS.md` and these guidelines**, in particular the architecture and boundary rules of the
   stack.
4. **Tests.** New or changed behaviour has a useful test, a bug fix has a regression test that
   fails without the fix, no test asserts the text of an error message, and escaped mutants on
   changed lines are killed or justified in the pull request ([testing.md](testing.md)).
5. **Vocabulary.** Names follow [GLOSSARY.md](../../GLOSSARY.md); a new term is added in the same
   pull request.
6. **Documentation.** Text that the change makes stale is updated in the same pull request
   ([documentation.md](documentation.md)).
7. **Open questions.** A rule the client has not decided is not implemented anyway. Guessing an
   open question is `High`; the fix is to split the slice and ask.

A green `Jenkins` check proves that the automated checks pass. It does not prove that the issue
is solved, that the design is matched or that UAT passes. Those stay the reviewer's job.

A pull request that changes more than roughly 30 files SHOULD be split. If that is impossible,
its description says how to review it in parts.

## Findings

A finding describes **one problem with one remediation boundary**, not one affected file. Before
raising a new finding, compare it with the existing ones. If it has the same root cause,
intended behaviour or remediation, add the evidence to the existing finding instead of opening a
second one from a different file or symptom.

Write a finding so that the author can act on it without asking:

- **Severity** and a short title;
- **Evidence** — what the code does, with the file and line;
- **Expected** — the intended behaviour and its source (issue, ADR, `AGENTS.md` rule,
  guideline, podklady reference);
- **Proposed resolution** — the smallest coherent fix;
- **Verification** — the test or check that proves the fix.

Facts the repository or `docs/podklady/` answer are investigated, not asked about. Discuss one
decision question at a time.

### Findings stay in the pull request

Each finding is one review thread. Findings MUST NOT be recorded in a repository file: no review
ledger such as `docs/review/PR_<number>.md`, not even for a large pull request or a review that
takes several rounds. Decisions that should outlive the review (an accepted risk, deferred work)
go into the pull request description, which survives the squash merge.

### Finding states

When findings cannot be closed in one round, track their state in the thread:

| State | Meaning |
|---|---|
| `Candidate` | Raised, awaiting the owner's confirmation |
| `Confirmed` | Agreed; must be fixed or explicitly accepted |
| `Planned` | Assigned to a remediation pull request |
| `In progress` | The remediation is being implemented |
| `Resolved` | Fix merged and verified |
| `Accepted` | Behaviour or complexity explicitly accepted without a code change |
| `Deferred` | Moved out of scope with an agreed follow-up issue and Freelo pair |

A finding is closed only as `Resolved`, `Accepted` or `Deferred`, each with its evidence linked.

```markdown
> [!WARNING]
> ### BE-XXX — Short finding title
>
> - **State:** `Candidate`
> - **Severity:** `High`
> - **Category:** Correctness / security / integration / architecture / duplication / other
> - **Affected files:** Paths
> - **Evidence:** What the implementation currently does
> - **Expected:** Agreed intended behaviour and its source
> - **Proposed resolution:** Smallest coherent remediation
> - **Verification:** Required tests or manual checks
> - **Resolution notes:** Filled when resolved, accepted or deferred
```

Use `BE-` for backend findings and `FE-` for frontend ones.

## Answering findings

- Treat CodeRabbit findings like any reviewer's. **Fix the valid ones. Answer the invalid ones
  with evidence**: the file and line, the test, the ADR or the guideline that shows why the
  finding does not apply. "Not relevant" without evidence is not an answer.
- Do not resolve another person's thread silently. Reply with what changed and the commit that
  changed it.
- An accepted finding states who accepted it and why. An accepted escaped mutant inside a
  calculation that is not provably equivalent is `High`.
