# Checklists, briefs and report

Detail for `esoul-review` Path A. The two-axis flow itself is the installed `code-review` skill plus [code-review.md](code-review.md); this file holds only what that flow does not have. Read the section you need, not the whole file.

## Briefs

Both reviewers of [code-review.md](code-review.md) item 4 get this header. It is self-contained because a reviewer with a fresh context knows nothing else.

```text
You review one axis of a code change before it becomes a pull request. Do not edit files,
run commands that change state, or contact external services.

Repository: <absolute path>
Diff: <diffCommand from the scope JSON>   (untracked files are new: read them whole)
Base: <ref> <sha>; head: <sha>
Files to review (and only these): <path list, with status>
Path instructions: <path glob → instructions, for the files above>
What failure looks like here: <docs/project_guidelines/code-review.md › Default Critical findings and
Default Major findings, plus the project's own, or "not defined"; with no guidelines in the project,
the severity definitions of the general scale (`esoul-review` A2 › No guidelines in the project)>
Already decided on this change (do not raise again without new evidence):
<id or title, path:line, decision (fixed in <sha> | rejected: <reason> | accepted: <reason>); or "none">

Read every hunk with enough surrounding code, callers and tests to judge it. Report only
problems you can point to in the code. For each candidate return: severity (Critical, Major,
Minor or Nitpick, as the guidelines' code-review.md defines them; with no guidelines in the
project, as the definitions above say, and then name the rule as general, not the project's),
title; location path:line;
evidence (at most 5 quoted lines); expected behaviour and its source; the smallest fix, as a
unified diff when short; the test or check that proves it; confidence (high | medium, omit low);
pre-existing (yes when the diff did not introduce it); instances (when the problem is a
pattern: every other path:line, or the search that finds them; one candidate for the class).
Return "no findings" when there are none. No style-only, logging-only or comment-only
candidates the repository rules do not ask for; at most three nitpick-level candidates, and
style a tool can enforce belongs to the tool.
```

The Standards brief adds the tests lens and the stack notes below, the Standards sources of [code-review.md](code-review.md) item 3 (the reviewer reads them itself), and, from the installed `code-review` skill, its smell baseline. The Spec brief adds the spec text (acceptance criteria and `## UAT`) and the defect probes. A re-review brief limits the diff to the delta since the last reviewed head and lists every decided finding.

## Choosing the reviewer

The reviewer's strength is chosen explicitly per axis and never inherited from the session. When the harness offers subagents, start each reviewer as a fresh subagent with that strength; otherwise run the axes as clean passes yourself. `esoul-model-routing` (optional helpers layer) holds the role briefs and the choice of model per role.

| Change | Standards | Spec |
| --- | --- | --- |
| No risk trigger | standard reviewer | standard reviewer |
| Risk trigger, or the user asks for depth | strongest reviewer available | strongest reviewer available |

**Risk trigger:** authorization, money, migrations or destructive data scripts, personal data, concurrency. A change that only touches documentation, copy, translations or tests, or is additive behind a flag, has none. When in doubt, take the risk row. The same trigger decides which blocking candidates get a verifier (step A5), and its strength follows the same row.

## Defect probes

Added to the Spec brief. Each item is a question to ask about the changed code, not a finding to emit; `docs/project_guidelines/code-review.md` › Default Critical findings says what such a defect weighs.

- **Trace** one realistic input end to end. Boundaries: null or empty, zero, negatives, first and last element, pagination edges, Unicode (Czech diacritics in names, slugs, sorting, `strlen` vs `mb_strlen`).
- **Money and time:** floats for currency, rounding mode, VAT per line vs per total, cents vs crowns; the business time zone named in `CONTEXT.md` vs UTC, DST, inclusive vs exclusive ranges.
- **Errors:** a swallowed exception, a catch that continues with partial state, missing rollback, error responses that leak internals, retries without backoff.
- **Idempotency and concurrency:** a job, webhook or listener that may run twice; check-then-act races; a missing unique constraint or lock; duplicate writes to an external system.
- **Data changes:** a migration that locks a big table, a non-nullable column without default, an irreversible `down`, a backfill that loads everything into memory, a renamed column still used elsewhere; a script with no `WHERE`, dry-run or count check.
- **Contracts:** a changed signature, payload, event, config key or route, and every caller or consumer of it.
- **Queries on real data** (`docs/project_guidelines/architecture.md` › Queries that stay correct on real data): a sorted or paginated list without a tiebreaker or a decided `NULL` order; a join that can match more than one row; counts taken from a precomputed total instead of the affected rows.
- **Partial updates** (`requests-and-validation.md` › Partial updates: not sent or cleared): a field that cannot be cleared because `null` means "unchanged".
- **Root cause** (`workflow.md` › Fixing a bug): is the bug fixed where it lives, or bypassed in a caller without a stated reason and a follow-up?
- **One source of truth** (`code-review.md` › Default Major findings): the same visibility, scoping or status rule written twice.
- **Authorization** on every new entry point (route, action, resolver, signed URL, job input, AJAX or REST endpoint); authentication alone is not authorization. Ownership checks on request ids (IDOR). Every rule the interface expresses has a server-side check and a test against the endpoint (`code-review.md` › Default Critical findings, the interface-only rule).
- **Injection and output:** raw SQL with interpolation, shell built from input, path traversal, unescaped output (`{!! !!}`, `v-html`, `echo` without escaping), SSRF, unsafe deserialization, mass assignment (`$guarded = []`, `fill($request->all())`), CSRF and nonces, uploads (type, size, location, public access).
- **Secrets and personal data** in code, fixtures, tests, logs, exceptions or bundles; `APP_DEBUG` on. New or upgraded dependencies (maintenance, licence, advisories; lockfile matches manifest).

## Tests lens

Added to the Standards brief. The rules are the project's `testing.md` and `code-review.md` › What a reviewer checks against, item 4; the reviewer reads them and reports one finding per violated rule, without restating them. Per changed behaviour it answers:

- Is there a test at a meaningful seam, or a `No test:` line in the PR description that holds up (`testing.md` › How much to test)?
- Does a bug fix carry a regression test that fails on the cause (`testing.md` › Regression tests, `workflow.md` › Fixing a bug)?
- Did migration, import or data-transformation checks stay temporary scaffolding, deleted before the PR (`testing.md` › Temporary tests)?
- Is any test beyond the tier its flow needs, or a sleep, widened timeout or retry hiding flakiness (`testing.md` › Flaky tests, Test groups)?

## Stack notes

Added to the Standards brief for the touched stacks. The guidelines of the stack (`docs/project_guidelines/` files of the framework layers) take precedence; these are reviewer heuristics they do not carry.

- **Laravel / PHP:** N+1 queries (relations in loops without eager loading), unbounded queries, missing indexes for new query patterns, synchronous external calls in a request path, `DB::transaction` around multi-write operations, queued jobs that are `ShouldBeUnique` or idempotent.
- **Migrations for MariaDB / MySQL** (each shipped to production in an eSoul project because the suite ran on SQLite): `timestamp()` without `nullable()` or a default under strict mode; a migration without a working `down()`; a SELECT expression that differs from its GROUP BY under `ONLY_FULL_GROUP_BY`.
- **Symfony:** Doctrine flush in loops, serializer groups exposing internal fields.
- **JavaScript / TypeScript / Vue:** `any` and non-null assertions hiding real nulls, reactive state mutated outside its store, missing `key` in lists, unhandled promise rejections, `window` on the server, secrets in runtime config exposed to the client; a prop named like a local `computed`, props destructured into constants where reactivity is needed; a composable with module-level state (`frontend.md` › Composables with module-level state).
- **WordPress:** `$wpdb->prepare`, escaping on output and sanitizing on input, no direct edits of core, plugins or Oxygen/Breakdance data outside their APIs, upload URLs relative to the domain.
- **SQL and data scripts:** transactions and idempotent re-runs; a dry run or a count of the affected rows before the write, and a `WHERE` on every `UPDATE` and `DELETE`; reported counts come from affected rows; one-off import scripts and their output are working material (`esoul-data`), not committed unless anonymised.
- **Shell, CI, Docker:** quoting, `set -euo pipefail`, secrets passed as arguments or baked into images, pinned versions, cache keys.

## Verifier brief

Under a risk trigger each blocking candidate gets one fresh verifier (step A5), started with the strength of the risk row in [Choosing the reviewer](#choosing-the-reviewer). It gets the code and the claim, not the session's conclusion, so its answer is not anchored on the first reviewer's.

```text
Verify a claimed defect in a code change. Do not edit files, run commands that change state,
or contact external services. You did not raise this claim; judge it on the code alone.

Repository: <absolute path>
Diff: <diffCommand>; base <sha>, head <sha>
Change intent: <one or two sentences>
Claim: <title>, at <path:line>. <one-sentence description of the failure, without the
reviewer's reasoning>

Read the code at the location, its callers, its tests, and any place that might already handle
the case. Answer with exactly one verdict:
- CONFIRMED: the defect is real and reachable; give a concrete input or sequence that triggers it.
- REFUTED: give the path:line that prevents it or shows the claim wrong.
- UNCERTAIN: name the single fact that would decide it.
```

A REFUTED verdict is a claim too: check its evidence before dropping the candidate.

## Report template

````markdown
## Review: <branch> → <base ref>

**Result:** <n> findings (<n> blocking) | Nothing to fix in the reviewed scope.
**Scope:** <type> · base `<base sha 12>` · head `<head sha 12>`<, + uncommitted changes> · risk <ordinary | trigger>
**Reviewed:** <n> files (+<added>/−<deleted>) · **Excluded:** <n> (<reason summary>)
**Checks:** <command> ✅ / ❌ <short result> / reused from receipt · …
**Axes:** Standards (<standard | strong reviewer>), Spec (<standard | strong reviewer> | skipped: no spec) <(subagents | sequential: why)>
**Config:** .coderabbit.yaml profile <chill|assertive>, <n> path instructions<, inherits organization settings not visible here>

### Walkthrough

<2–5 sentences: what the change does and why.>

| Area | Files | Change |
| --- | --- | --- |
| <module or layer> | `<path>`, `<path>` | <one line> |

### Standards

Findings ordered by severity; the axes are never merged or reranked:

#### 1. [<Severity>] <title> — `<path>:<line>`

**Evidence:** <what the code does>
**Expected:** <intended behaviour> (source: <issue / ADR / rule / guideline>)
**Proposed resolution:**
```diff
<minimal diff>
```
**Verification:** <test or check>
<**Instances:** <other path:line with the same bug>, for a class-of-bug finding>
<**Verified by:** <independent verifier verdict>, under a risk trigger>

<at most three nitpick-level findings, then "+<n> more nitpicks left out">
Axis summary: <n> findings; worst: <title>.

### Spec

<same layout; "no spec available" when the Spec axis was skipped>

### Outside the diff
<only Critical and Major, each title prefixed `[Pre-existing]`; otherwise omit the section>

### Questions
<decisions the reviewer cannot make; otherwise omit>

### Prevention
<for a recurring or tool-detectable finding: the lint rule, architecture test, AGENTS.md line or guideline item that would catch it next time; otherwise omit>

### Verdict
<n> valid findings (<n> blocking) | No valid findings in the reviewed scope.
Not covered: <excluded files, skipped checks, missing issue contract, invisible organization settings>.
````

Keep the template's headings and severity labels in English; write the prose in the conversation's language and quote code verbatim. The verdict never says "approved". The walkthrough and table can seed the PR description.

## Manual scope

Without Node.js, reproduce the scope with git. Replace placeholders with discovered values.

```bash
git fetch <remote> <base-branch>
base=$(git merge-base <remote>/<base-branch> HEAD)
git -c core.quotePath=false diff -M --name-status "$base"           # committed + staged + unstaged
git -c core.quotePath=false diff -M --numstat "$base"               # sizes; "-" means binary
git -c core.quotePath=false ls-files --others --exclude-standard    # untracked (new) files
git -c core.quotePath=false diff -M --name-only -i -G 'PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_|glpat-|xox[abprs]-|sk_live_|password|secret|token|api.?key' "$base"   # files whose changes look like credentials
```

Apply `.coderabbit.yaml` `reviews.path_filters` by hand (`!glob` excludes; plain globs form an allow-list), plus lockfiles, `vendor/`, `node_modules/`, build output and minified files. Open the files the last command lists, plus untracked files, `.env` files and database dumps, and judge them without repeating any value. Printing added lines wholesale echoes the credentials you are looking for, so list file names only.
