# Checklists, briefs and report

Detail for `esoul-review` Path A. The review itself is the two-axis flow in [code-review.md](code-review.md); this file holds only what that flow does not have. Read the section you need, not the whole file.

## Briefs

Both sub-agents of [code-review.md](code-review.md) step 4 also get this header. It is self-contained because a sub-agent knows nothing else.

```text
You review one axis of a code change before it becomes a pull request. Do not edit files,
run commands that change state, or contact external services.

Repository: <absolute path>
Diff: <diffCommand from the scope JSON>   (untracked files are new: read them whole)
Base: <ref> <sha>; head: <sha>
Files to review (and only these): <path list, with status>
Path instructions: <path glob → instructions, for the files above>
What failure looks like here: <guidelines code-review.md "Default Critical findings" plus the project's own, or "not defined">
Already decided on this change (do not raise again without new evidence):
<id or title, path:line, decision (fixed in <sha> | rejected: <reason> | accepted: <reason>); or "none">

Read every hunk with enough surrounding code, callers and tests to judge it. Report only
problems you can point to in the code. For each candidate return: severity (Critical, Major,
Minor or Nitpick, as the guidelines' code-review.md defines them), title; location path:line;
evidence (at most 5 quoted lines); expected behaviour and its source; the smallest fix, as a
unified diff when short; the test or check that proves it; confidence (high | medium, omit low);
pre-existing (yes when the diff did not introduce it); instances (when the problem is a
pattern: every other path:line, or the search that finds them; one candidate for the class).
Return "no findings" when there are none. No style-only, logging-only or comment-only
candidates the repository rules do not ask for; at most three nitpick-level candidates.
```

A re-review brief limits the diff to the delta since the last reviewed head and lists every decided finding.

## Models

Explicit per sub-agent (`esoul-model-routing`), never inherited:

| Change | Standards | Spec |
| --- | --- | --- |
| No risk trigger | `esoul-skills:reviewer` | `esoul-skills:reviewer` |
| Risk trigger (authorization, money, migrations or destructive data scripts, personal data, concurrency), or the user asks for depth | `esoul-skills:critical-reviewer` | `esoul-skills:critical-reviewer` |

Outside Claude Code start a fresh subagent with the model that `esoul-model-routing` assigns to that role. A change that only touches documentation, copy, translations or tests, or is additive behind a flag, has no risk trigger. When in doubt, take the risk row.

## Defect probes

Added to the Spec sub-agent's brief. Each item is a question to ask about the changed code, not a finding to emit; guidelines `code-review.md` "Default Critical findings" says what such a defect weighs.

- **Trace** one realistic input end to end. Boundaries: null or empty, zero, negatives, first and last element, pagination edges, Unicode (Czech diacritics in names, slugs, sorting, `strlen` vs `mb_strlen`).
- **Money and time:** floats for currency, rounding mode, VAT per line vs per total, cents vs crowns; `Europe/Prague` vs UTC, DST, inclusive vs exclusive ranges.
- **Errors:** a swallowed exception, a catch that continues with partial state, missing rollback, error responses that leak internals, retries without backoff.
- **Idempotency and concurrency:** a job, webhook or listener that may run twice; check-then-act races; a missing unique constraint or lock; duplicate writes to an external system.
- **Data changes:** a migration that locks a big table, a non-nullable column without default, an irreversible `down`, a backfill that loads everything into memory, a renamed column still used elsewhere.
- **Contracts:** a changed signature, payload, event, config key or route, and every caller or consumer of it.
- **Queries on real data:** a sorted or paginated list without a unique tiebreaker or a decided `NULL` order; a join that can match more than one row (`_ci` collations); counts taken from a precomputed total; a partial update that cannot clear a field because `null` means "unchanged".
- **Root cause:** is a bug fixed where it lives, or bypassed in a caller without a stated reason?
- **Authorization** on every new entry point (route, action, resolver, signed URL, job input, WordPress AJAX or REST endpoint); authentication alone is not authorization. Ownership checks on request ids (IDOR); every rule the UI expresses has a server-side check and a test against the endpoint.
- **Injection and output:** raw SQL with interpolation, shell built from input, path traversal, unescaped output (`{!! !!}`, `v-html`, `echo` without escaping), SSRF, unsafe deserialization, mass assignment (`$guarded = []`, `fill($request->all())`), CSRF and nonces, uploads (type, size, location, public access).
- **Secrets and personal data** in code, fixtures, tests, logs, exceptions or bundles; `APP_DEBUG` on. New or upgraded dependencies (maintenance, licence, advisories; lockfile matches manifest).

## Tests lens

Added to the Standards brief. The rules are the project's `testing.md` and the guidelines' `code-review.md` ("What a reviewer checks against", item 4); read them, do not restate them. The questions the sub-agent answers per changed behaviour:

- A test at a meaningful seam, or a `No test: <reason>` line in the PR description that holds up (documentation-only and dependency-only PRs need none); a bug fix has a regression test that fails without the fix.
- A new or changed data transformation rule (ETL step, legacy import, data fix, mapping) has an automated test that feeds source rows and asserts the target rows; a manual check on a real dump does not replace it.
- Tests assert behaviour through the module's interface, with expected values from an independent source; error types, keys, codes and status, never user-facing message text.
- No new test beyond the tier its flow needs, no sleep, widened timeout or retry hiding flakiness, no test in the `db-engine`, `sandbox` or `quarantine` group without the reason `testing.md` asks for.

## Stack notes

Added to the Standards brief for the touched stacks. Guidelines of the stack (`framework/*`) take precedence.

- **Laravel / PHP:** Form Requests for validation, policies or gates for authorization, `$fillable` over `$guarded = []`, `DB::transaction` around multi-write operations, queued jobs that are `ShouldBeUnique` or idempotent, `strict_types` where used, the project's PHPStan level. N+1 queries (relations in loops without eager loading), unbounded queries, missing indexes for new query patterns, synchronous external calls in a request path. Schema changes (create, alter, drop) only in migrations.
- **Migrations for MariaDB / MySQL** (each shipped to production in an eSoul project because the suite ran on SQLite): a generated index or foreign key name over 64 characters (`<table>_<columns>_foreign`; count it); `timestamp()` without `nullable()` or a default under strict mode; a migration without a working `down()`; a SELECT expression that differs from its GROUP BY under `ONLY_FULL_GROUP_BY`.
- **Symfony:** voters for authorization, Doctrine flush in loops, serializer groups exposing internal fields.
- **JavaScript / TypeScript / Vue / Nuxt:** `any` and non-null assertions hiding real nulls, reactive state mutated outside its store, missing `key` in lists, unhandled promise rejections, `window` on the server, secrets in runtime config exposed to the client; a prop named like a local `computed`, props destructured into constants where reactivity is needed.
- **WordPress:** capability checks plus nonces on every action, `$wpdb->prepare`, escaping on output and sanitizing on input, no direct edits of core, plugins or Oxygen/Breakdance data outside their APIs, upload URLs relative to the domain.
- **SQL and data scripts:** a WHERE clause on every UPDATE and DELETE, transactions, a dry-run or count check, idempotent re-runs.
- **Shell, CI, Docker:** quoting, `set -euo pipefail`, secrets passed as arguments or baked into images, pinned versions, cache keys.

## Verifier brief

Under a risk trigger each blocking candidate gets one fresh verifier (SKILL.md step A5). It gets the code and the claim, not the session's conclusion, so its answer is not anchored on the first reviewer's.

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

Use `esoul-skills:critical-reviewer` for candidates in a risk area, `esoul-skills:reviewer` otherwise. A REFUTED verdict is a claim too: check its evidence before dropping the candidate.

## Report template

````markdown
## Review: <branch> → <base ref>

**Result:** <n> findings (<n> blocking) | Nothing to fix in the reviewed scope.
**Scope:** <type> · base `<base sha 12>` · head `<head sha 12>`<, + uncommitted changes> · risk <ordinary | trigger>
**Reviewed:** <n> files (+<added>/−<deleted>) · **Excluded:** <n> (<reason summary>)
**Checks:** <command> ✅ / ❌ <short result> / reused from receipt · …
**Axes:** Standards (<model>), Spec (<model> | skipped: no spec) <(sub-agents | sequential: why)>
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
**Proposed fix:**
```diff
<minimal diff>
```
**Verification:** <test or check>
<**Instances:** <other path:line with the same bug>, for a class-of-bug finding>
<**Verified by:** <independent verifier verdict>, under a risk trigger>

<at most three nitpick-level findings, then "+<n> more nitpicks left out">
Axis summary: <n> findings; worst: <title>.

### Spec

<same layout; "no spec available" when the Spec sub-agent was skipped>

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

Apply `.coderabbit.yaml` `reviews.path_filters` by hand (`!glob` excludes; plain globs form an allow-list), plus lockfiles, `vendor/`, `node_modules/`, build output and minified files. Open the files the last command lists, plus untracked files, `.env` files and database dumps, and judge them without repeating any value. Never print added lines wholesale: that echoes the credentials you are looking for.
