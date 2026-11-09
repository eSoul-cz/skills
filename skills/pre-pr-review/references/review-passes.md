# Review passes, briefs, and report

Detail for steps 1, 4, 5, and 6 of `pre-pr-review`. Read the section you need, not the whole file.

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
- Queries on real data: a sorted or paginated list without a unique tiebreaker or a decided `NULL` order; a correlated subquery or mapping join that can match more than one row (watch `_ci` collations); counts reported from a precomputed total instead of affected rows; partial updates that cannot clear a field because `null` means "unchanged".
- Root cause: for a bug fix, is the cause fixed where it lives, or only bypassed in a caller (an extra prop or parameter, a special case) without a stated reason?

### 2. Security and data boundaries

- Authorization on every new route, controller action, Livewire or Inertia action, GraphQL resolver, admin screen, signed URL, queued job input, and WordPress AJAX or REST endpoint. Authentication alone is not authorization.
- Scoping: queries filtered by tenant, customer, role, or sales channel on the server; IDs from the request checked for ownership (IDOR). Filtering in the browser is not a boundary, and neither is hiding a button or tab: every rule the UI expresses (deadline, permission, state) needs a server check and a test against the endpoint or handler.
- Injection: raw SQL with interpolation, `whereRaw`, `DB::raw`, `$wpdb->query` without `prepare`; shell commands built from input; path traversal in file names; unescaped output (`{!! !!}`, `v-html`, `innerHTML`, `echo` without `esc_html`/`esc_attr`); SSRF through user-supplied URLs; unsafe deserialization.
- Mass assignment: `$guarded = []`, `fill($request->all())`, spreading request bodies into models or DTOs.
- CSRF and nonces on state-changing requests; open redirects; file uploads (type, size, storage location, public access).
- Secrets and personal data: credentials in code, fixtures, tests, logs, exceptions, or front-end bundles; personal data written to logs or analytics; `APP_DEBUG` or verbose errors enabled.
- Dependencies: new or upgraded packages (maintenance, licence, known advisories), lockfile changes that do not match the manifest.

### 3. Tests and contract

- Each acceptance criterion and the `## UAT` scenario map to code that implements it. Unrelated refactoring or features mixed in is a finding: report each unrelated change (config, `.gitignore`, another domain, docs counters, a changed default) with the proposal to move it to its own PR. A diff over about 400 production lines that could ship in parts is a finding with a proposed split.
- New or changed behavior has a test at a meaningful seam, or the PR description has a `Bez testu: <reason>` line that holds up; a behaviour change with neither is a finding. A bug fix has a regression test that fails without the fix.
- A new or changed data transformation rule (ETL step, legacy import, data fix, mapping) without an automated test that feeds source rows and asserts the expected target rows is a finding; a manual check on a real dump does not replace it.
- A test whose outcome depends on the production database engine (collation or case-insensitive uniqueness, `NULL` ordering, JSON functions, raw SQL, locking) while the suite runs on another engine is a finding unless it is in the `db-engine` group. A new test in the excluded `sandbox` or `quarantine` group needs its reason (provider API; linked flaky-test issue).
- A test added to a new suite where an area suite exists, a path proven again at the integration layer, a sleep or widened timeout, or a retry that hides flakiness is a finding (project `testing.md`).
- Tests assert behavior through the module's interface, not implementation details or the text of an error message; a test that reaches past the interface (mocked internal collaborators, private methods, querying the database instead of the interface) is a finding. Expected values come from an independent source, not recomputed the way the code does. No sleeping, real network, or order dependence.
- Accepted ADRs and `AGENTS.md` MUST rules are respected; a changed target contract comes with an ADR update.
- New terms follow `GLOSSARY.md`; documentation made stale by the change is updated in the same PR.
- An open client question implemented by guesswork is a finding.

### 4. Maintainability and performance

- Search the codebase for an existing helper, scope, component, or service before accepting new code that does the same.
- Dead code, commented-out code, debug output (`dd`, `dump`, `var_dump`, `console.log`, `ray`), leftover TODOs without an issue.
- Names that contradict behavior or the glossary; magic numbers or strings that belong in config or an enum.
- Overengineering: abstractions with one implementation and no planned second (production plus a test fake counts as two), options nobody passes.
- Pass-through layers (deletion test): a class whose removal would make the complexity vanish rather than reappear in its callers, such as a service that only forwards to a repository that only forwards to the model. Report it only where the project's guidelines do not prescribe the layer.
- Performance: N+1 queries (relations used in loops without eager loading), unbounded queries or collections, work inside loops that could run once, missing indexes for new query patterns, synchronous external calls in a request path.
- One source of truth: the same visibility, scoping or eligibility branching in two methods, or the same component copied into each template branch, instead of one scope, policy, enum method or composable.
- Layering: schema changes (create, alter, drop) outside migrations, for example a work table built inside a command handler.
- Vue state: a prop named like a local `computed` or variable, props destructured or copied into constants where reactivity is needed.
- Comments: long rationale blocks that belong in the PR or an ADR; comment language or missing Czech diacritics that differ from the surrounding code.
- Consistency with the surrounding code's patterns, error handling, and style.
- The file's `path_instructions` from `.coderabbit.yaml`, applied as written.

### Stack notes

- **Laravel / PHP:** Form Requests for validation, policies or gates for authorization, `$fillable` over `$guarded = []`, `DB::transaction` around multi-write operations, queued jobs that implement `ShouldBeUnique` or are otherwise idempotent, `strict_types` where the project uses it, PHPStan level of the project.
- **Migrations for MariaDB / MySQL** (each of these shipped to production in an eSoul project because the suite ran on SQLite): a generated index or foreign key name over 64 characters (`<table>_<columns>_foreign`; count it); `timestamp()` without `nullable()` or a default under strict mode; a migration without a working `down()`; a SELECT expression that differs from its GROUP BY under `ONLY_FULL_GROUP_BY`.
- **Symfony:** voters for authorization, Doctrine flush in loops, serializer groups exposing internal fields.
- **JavaScript / TypeScript / Vue / Nuxt:** `any` and non-null assertions hiding real nulls, reactive state mutated outside its store, missing `key` in lists, unhandled promise rejections, SSR-only vs client-only code (`window` on the server), secrets in runtime config exposed to the client.
- **WordPress:** capability checks plus nonces on every action, `$wpdb->prepare`, escaping on output and sanitizing on input, no direct edits of core, plugins, or Oxygen/Breakdance data outside their APIs, upload URLs relative to the domain.
- **SQL and data scripts:** a WHERE clause on every UPDATE and DELETE, transactions, a dry-run or count check, idempotent re-runs.
- **Shell, CI, Docker:** quoting, `set -euo pipefail`, secrets passed as arguments or baked into images, pinned versions, cache keys.

## Subagent brief

Give each subagent (one per lens, or one for all lenses) a self-contained brief. It knows nothing else.

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
What failure looks like here: <from code-review.md, or "not defined">
Depth: <Quick | Standard | Deep>
Already decided on this change (do not raise again without new evidence):
<id or title, path:line, decision (fixed in <sha> | rejected: <reason> | accepted: <reason>); or "none">

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
- pre-existing: yes when the diff did not introduce the problem
- instances: when the problem is a pattern, every other path:line with the same bug, or the
  search that finds them; report the class once, not one candidate per instance
Return "no findings" when there are none. No style-only, logging or comment-only, or cleanup
candidates the repository rules do not ask for; at most three nitpick-level candidates.
```

## Verifier brief

Under Deep depth, each blocking candidate gets one fresh verifier (SKILL.md step 5). Give it the code and the claim, not this session's conclusion, so its answer is not anchored on the first reviewer's.

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

In Claude Code start the subagents in plugin agents, whose model and effort are fixed. The default is one `esoul-skills:reviewer` (Sonnet, medium) with one brief covering the depth's lenses (copy those checklists into the "Your lens" part: two under Quick, four under Standard). For larger scopes use one agent per lens: `esoul-skills:reviewer` for maintainability and tests-and-contract, and for correctness and security on ordinary changes. When the change hits a risk trigger (authorization, money, migrations or destructive data scripts, personal data, concurrency), correctness and security always go to `esoul-skills:critical-reviewer` (Opus, high), regardless of size. Elsewhere pass the same model explicitly; without one a subagent inherits the parent's model and effort. Verification of the returned candidates (SKILL.md step 5) stays on the parent model, except the independent verifiers of blocking candidates under Deep.

## Report template

````markdown
## Pre-PR review: <branch> → <base ref>

**Result:** <n> findings (<n> blocking) | Nothing to fix in the reviewed scope.
**Scope:** <type> · base `<base sha 12>` · head `<head sha 12>`<, + uncommitted changes> · depth <Quick | Standard | Deep>
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
<**Instances:** <other path:line with the same bug>, for a class-of-bug finding>
<**Verified by:** <independent verifier verdict>, under Deep>

<…repeat, ordered by severity; at most three nitpick-level findings, then "+<n> more nitpicks left out">

### Outside the diff
<only the two highest severities, each title prefixed with `[Pre-existing]`; otherwise omit the section>

### Questions
<decisions the reviewer cannot make; otherwise omit>

### Prevention
<for a recurring or tool-detectable finding: the lint rule, architecture test, AGENTS.md line, or code-review.md item that would catch it next time; otherwise omit>

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
