# Review passes, briefs, and report

Detail for steps 1, 4, and 6 of `pre-pr-review`. Read the section you need, not the whole file.

## Lens checklists

Apply each item to the changed code and what it touches. A checklist item is a question to ask, not a finding to emit.

### 1. Correctness

- Does the code do what the issue and commit say? Trace one realistic input end to end.
- Boundaries: null or empty values, zero, negatives, first and last element, pagination edges, very large input, Unicode (Czech diacritics in names, slugs, sorting, `strlen` vs `mb_strlen`).
- Money and numbers: floats for currency, rounding mode and place, VAT computed per line vs per total, integer overflow, unit mix-ups (cents vs crowns, minutes vs hours).
- Time: time zones (`Europe/Prague` vs UTC), DST transitions, inclusive vs exclusive date ranges, "today" computed on the server vs the client.
- Errors: swallowed exceptions, a catch that continues with partial state, missing rollback, error responses that leak internals, retries without backoff.
- Idempotency and concurrency: a job, webhook, or listener that may run twice; check-then-act races; missing unique constraint or lock; duplicate writes to an external system (invoice, payment, e-mail, ERP).
- Data changes: migrations that lock big tables, non-nullable columns without defaults, irreversible down migrations, backfills that load everything into memory, renamed columns still used elsewhere.
- Contracts: changed signatures, return shapes, events, API payloads, config keys, or routes, and every caller or consumer of them.

### 2. Security and data boundaries

- Authorization on every new route, controller action, Livewire or Inertia action, GraphQL resolver, admin screen, signed URL, queued job input, and WordPress AJAX or REST endpoint. Authentication alone is not authorization.
- Scoping: queries filtered by tenant, customer, role, or sales channel on the server; IDs from the request checked for ownership (IDOR). Filtering in the browser is not a boundary.
- Injection: raw SQL with interpolation, `whereRaw`, `DB::raw`, `$wpdb->query` without `prepare`; shell commands built from input; path traversal in file names; unescaped output (`{!! !!}`, `v-html`, `innerHTML`, `echo` without `esc_html`/`esc_attr`); SSRF through user-supplied URLs; unsafe deserialization.
- Mass assignment: `$guarded = []`, `fill($request->all())`, spreading request bodies into models or DTOs.
- CSRF and nonces on state-changing requests; open redirects; file uploads (type, size, storage location, public access).
- Secrets and personal data: credentials in code, fixtures, tests, logs, exceptions, or front-end bundles; personal data written to logs or analytics; `APP_DEBUG` or verbose errors enabled.
- Dependencies: new or upgraded packages (maintenance, licence, known advisories), lockfile changes that do not match the manifest.

### 3. Tests and contract

- Each acceptance criterion and the `## UAT` scenario map to code that implements it. Unrelated refactoring or features mixed in is a finding.
- New or changed behavior has a test at a meaningful seam. A bug fix has a regression test that fails without the fix.
- Tests assert behavior, not implementation details or the text of an error message. No sleeping, real network, or order dependence.
- Accepted ADRs and `AGENTS.md` MUST rules are respected; a changed target contract comes with an ADR update.
- New terms follow `GLOSSARY.md`; documentation made stale by the change is updated in the same PR.
- An open client question implemented by guesswork is a finding.

### 4. Maintainability and performance

- Search the codebase for an existing helper, scope, component, or service before accepting new code that does the same.
- Dead code, commented-out code, debug output (`dd`, `dump`, `var_dump`, `console.log`, `ray`), leftover TODOs without an issue.
- Names that contradict behavior or the glossary; magic numbers or strings that belong in config or an enum.
- Overengineering: abstractions with one implementation and no planned second, options nobody passes.
- Performance: N+1 queries (relations used in loops without eager loading), unbounded queries or collections, work inside loops that could run once, missing indexes for new query patterns, synchronous external calls in a request path.
- Consistency with the surrounding code's patterns, error handling, and style.
- The file's `path_instructions` from `.coderabbit.yaml`, applied as written.

### Stack notes

- **Laravel / PHP:** Form Requests for validation, policies or gates for authorization, `$fillable` over `$guarded = []`, `DB::transaction` around multi-write operations, queued jobs that implement `ShouldBeUnique` or are otherwise idempotent, `strict_types` where the project uses it, PHPStan level of the project.
- **Symfony:** voters for authorization, Doctrine flush in loops, serializer groups exposing internal fields.
- **JavaScript / TypeScript / Vue / Nuxt:** `any` and non-null assertions hiding real nulls, reactive state mutated outside its store, missing `key` in lists, unhandled promise rejections, SSR-only vs client-only code (`window` on the server), secrets in runtime config exposed to the client.
- **WordPress:** capability checks plus nonces on every action, `$wpdb->prepare`, escaping on output and sanitizing on input, no direct edits of core, plugins, or Oxygen/Breakdance data outside their APIs, upload URLs relative to the domain.
- **SQL and data scripts:** a WHERE clause on every UPDATE and DELETE, transactions, a dry-run or count check, idempotent re-runs.
- **Shell, CI, Docker:** quoting, `set -euo pipefail`, secrets passed as arguments or baked into images, pinned versions, cache keys.

## Subagent brief

Give each lens subagent a self-contained brief. It knows nothing else.

```text
You review one aspect of a code change before it becomes a pull request. Do not edit files,
run commands that change state, or contact external services.

Repository: <absolute path>
Diff: <diffCommand from the scope JSON>   (untracked files are new: read them whole)
Base: <ref> <sha>; head: <sha>
Change intent: <issue title, acceptance criteria, and UAT, or "no issue; commit messages: ...">
Files to review (and only these): <path list, with status>
Path instructions: <path glob → instructions, for the files above>
Repository rules that apply: <AGENTS.md rules, ADRs, guideline excerpts, verbatim and short>

Your lens: <lens name>. Checklist:
<the lens checklist and relevant stack notes, copied verbatim>

Read every hunk together with enough surrounding code, callers, and tests to judge it.
Report only problems you can point to in the code. For each candidate return:
- severity (<project scale>), title
- location: path:line (line in the current file)
- evidence: what the code does, quoting at most 5 lines
- expected: the intended behavior and its source
- proposed fix: the smallest coherent change, as a unified diff when short
- verification: the test or check that would prove the fix
- confidence: high | medium (omit low-confidence candidates)
Return "no findings" when there are none. Do not pad the list with style preferences.
```

Pick a model with `esoul-model-routing` when available; the security and correctness lenses deserve the stronger model on risky changes.

## Report template

````markdown
## Pre-PR review: <branch> → <base ref>

**Scope:** <type> · base `<base sha 12>` · head `<head sha 12>`<, + uncommitted changes>
**Reviewed:** <n> files (+<added>/−<deleted>) · **Excluded:** <n> (<reason summary>)
**Checks:** <command> ✅ / ❌ <short result> · …
**Passes:** correctness, security, tests and contract, maintainability <(subagents | in context | sequential: why)>
**Config:** .coderabbit.yaml profile <chill|assertive>, <n> path instructions<, inherits organization settings not visible here>

### Walkthrough

<2–5 sentences: what the change does and why.>

| Area | Files | Change |
| --- | --- | --- |
| <module or layer> | `<path>`, `<path>` | <one line> |

### Findings

#### 1. [<Severity>] <title> — `<path>:<line>`

**Evidence:** <what the code does>
**Expected:** <intended behavior> (source: <issue / ADR / rule / guideline>)
**Proposed fix:**
```diff
<minimal diff>
```
**Verification:** <test or check>

<…repeat, ordered by severity…>

### Outside the diff
<only the two highest severities; otherwise omit the section>

### Questions
<decisions the reviewer cannot make; otherwise omit>

### Verdict
<n> valid findings (<n> blocking) | No valid findings in the reviewed scope.
Not covered: <excluded files, skipped checks, missing issue contract, invisible organization settings>.
````

The verdict never says "approved". When the calling workflow is `final-pr-review`, the walkthrough and table may seed the PR description.

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

Apply `.coderabbit.yaml` `reviews.path_filters` by hand (`!glob` excludes; plain globs form an allow-list), plus lockfiles, `vendor/`, `node_modules/`, build output, and minified files. Open the files the last command lists, plus untracked files, `.env` files, and database dumps, and judge them without repeating any value. Never print added lines wholesale: that echoes the credentials you are looking for.
