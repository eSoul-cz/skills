<!-- esoul-guidelines:begin testing -->
# Project guidelines - Testing

This file says which tests the project keeps and how they are judged. The runners, file names and commands of the stack are in the stack's tools guideline (`tools.md`). Good tests are the priority; CI time is the constraint, so the suite stays small, fast and useful.

## What belongs in the suite

The suite keeps only **useful tests**: tests that fail when a user, a caller, an administrator or an integrated system would notice a regression. A test earns its place when it pins down one of these:

- **observable behaviour**: return values, persisted state, dispatched events and notifications, HTTP status and payload, redirects, rendered page props, export rows;
- **contracts and seams**: what a command, query, route, request, policy, component or DTO promises to its consumers;
- **boundaries and invariants**: limits, empty and null input, uniqueness, immutability, state transitions, rounding, amount units, idempotency;
- **failure paths**: validation (which field, never the wording), authorization, exceptions a caller handles (their type and metadata; never the text of a user-facing message).

The following do **not** belong in the committed suite. Remove them when you find them, and turn them into a behavioural test when the behaviour behind them matters:

- **performance tests**: timings, benchmarks, query-count budgets, eager-loading assertions;
- **architecture tests**: reflection or directory scans, "every class is registered", return-type checks, `class_exists`, unless named below;
- **data-definition tests**: migrations, schema columns and defaults, indexes, model fillables, casts or relations in isolation, factories, seeders, enum case lists, configuration values;
- **tests that restate the implementation**: mock echoes and forwarding, getters returning constructor arguments, generated SQL text, incidental defaults, a bare "does not throw", or an existence or type assertion as the only assertion;
- **duplicates** of another test covering the same path with the same assertions; keep the one at the more appropriate level.

## Named exceptions

Architecture and structure checks are a stack or project choice, not a default. A check that guards a boundary review alone does not hold MAY stay in the suite when the stack guidelines or an accepted ADR name it. Anything else of these kinds still does not belong.

## How much to test

How many tests a behaviour gets depends on the damage a regression would do, not on the code existing. Decide in this order:

1. **Unit tests first.** When unit tests cover the whole behaviour, a separate feature test SHOULD NOT be written for it.
2. **Fold, do not add.** A feature test is for what only the real framework or database shows: wiring of route, request, bus and handler, authorization, persistence, events across parts. Before adding one, extend the scenario of the feature test that already builds most of the same set-up, usually the endpoint test of the route that triggers the behaviour. A handler feature test plus an endpoint test of the same flow is a duplicate.
3. **Size what remains by tier.** Each route, console command or page (a **surface**) is in one tier:

| Tier | Flows | Feature tests of the surface |
|---|---|---|
| 1, critical | orders, payments, prices and tax, invoices and integrations of record, authentication and authorization, irreversible data changes | full scenarios: every success and failure path whose outcome a user, a caller or the record would notice |
| 2, everything else | every other surface | one success contract test (status or return value, payload, persisted state), its [authorization tests](#authorization-tests) and one validation-keys test (one request that breaks the rules, asserting the error keys) |

- The project lists its tier-1 flows in an ADR (or the decision register of its plan) and references that list from its project guidelines, below the managed block. A flow nobody listed is tier 2; the pull request that adds a flow in one of the categories above adds it to the list.
- **Rule variants are unit tests**, in both tiers: branches, boundaries, calculations, state transitions, validation rules. A rule that only a full flow can reach is a design problem: extract it into a unit that takes its inputs, and test that.
- **A layer above a tested layer does not repeat its scenarios.** A surface that wraps a tested command or query proves only its own contract: routing, input mapping, status, response shape, authorization.
- **The floor is per surface.** The success, authorization and validation-keys tests of tier 2 are the surface's feature tests; a command or query reached only through one surface is covered by that surface's tests, not by its own feature test. One reached through several surfaces, or through none (a job, a bus-only call), is a surface of its own.

## More tests are not more safety

A test earns its place by its tier ([How much to test](#how-much-to-test)) or as the regression test of a bug fix. A review finding, an escaped mutant or a follow-up issue is a reason to look at the behaviour, not by itself a reason to add a test. Every test costs every push of every project, so a change that makes a test redundant deletes it in the same pull request, duplicates included.

## Temporary tests

Migration, backfill, schema, seeder, data-import, performance and exploratory tests are welcome **while developing**, when they are the fastest way to validate something. They are scaffolding:

- they MUST be deleted before the pull request is opened, at the latest before merge, so that the checks that follow measure what will be merged;
- the pull request mentions what they verified when the result matters to reviewers;
- a check that must hold permanently is expressed as a behavioural test of the feature that depends on it.

## Error and validation messages

Tests MUST NOT assert the text of a user-facing error message: a message shown to users, translated or subject to rewording (validation messages, flashed errors, error bodies and the exception messages that reach them), however the text is reached (an exception-message expectation, `getMessage()` compared with a literal, a validation or flash assertion with a value, a JSON `message` or error value, an assertion on rendered error text). Assert the machine-readable part:

| Failure | Assert |
|---|---|
| exception thrown by domain or application code | the exception class or error `type` and the metadata it exposes: field keys, error codes, reason, related ids |
| exception that carries field errors | the keys, and that each key has at least one message, not what it says (a key with an empty message list is no error to the user) |
| JSON request failing validation | the status (`422`) and the keys of the errors |
| web form failing validation | the redirect status and `Location`, and the keys of the flashed errors |
| error flashed from a caught exception | the redirect and that an error was flashed, without its value |

When the class alone does not tell two failure causes apart, the error is missing metadata. Add it (a field key, a reason enum, a dedicated class, a code) and assert that instead of telling the causes apart by wording.

Asserting the text of an *internal* error message is fine: an exception or a developer-facing validation or configuration error that no user reads, translates or rewords. Such a test pins the developer-facing contract of the failure.

Why: user-facing text is translated and edited, and some errors are shown to users. A test pinned to the wording fails although no behaviour changed, and stays green when the wrong rule fires with the same text. Callers depend on the type, the keys and the codes; those are the contract.

The rule covers user-facing error text only. Text users read in normal operation (labels, notification and e-mail copy, page props) is product content and stays testable where it is the behaviour under test. Text a test supplies itself and expects to be forwarded unchanged is test data, not wording: `assertSame($message, $failure->getMessage())` for an exception built with `$message` is fine, a retyped sentence is not. Existing tests that pin user-facing wording are not a precedent; replace the assertion whenever you change the test or the code it covers.

## Every behaviour change carries a test

A pull request that changes behaviour MUST contain a test that fails without the change, or one line in its description: `No test: <reason>` (markup or copy only, configuration, a data task verified by its own checks, behaviour no seam can reach). A reviewer reports a behaviour change with neither. Documentation-only and dependency-only pull requests need no line.

## Regression tests

- A bug fix MUST come with a regression test that **fails without the fix**. Run it against the unfixed code once and say so in the pull request.
- The test is named after the behaviour, not the ticket: a reader who never saw the issue has to understand what is protected.
- The regression test sits at the layer where the bug was observable to its caller, not only in the unit that was patched.
- A regression test is never deleted as part of unrelated cleanup.

## Writing tests

- A **unit test** checks one behaviour. A **feature test** is a scenario: see [Keeping the integration run short](#keeping-the-integration-run-short). Every test is self-contained and does not depend on test order.
- Test names describe the behaviour, consistently with similar tests nearby.
- Prefer table-driven cases (data providers, `it.each`) for the variants of one behaviour in **unit tests**, with a descriptive name per case. In a feature test a provider case per pair of inputs is a matrix, which is one test ([Keeping the integration run short](#keeping-the-integration-run-short)).
- Tests are deterministic: fix the clock, fake the network and external systems, restore mocks. A test that reaches the network is a bug.
- Build data through factories or builders that produce a valid minimal record. What a test cares about is set explicitly in that test.
- Test data is invented. Real client names, addresses, amounts or credentials MUST NOT appear in tests or fixtures ([security-and-data.md](security-and-data.md)).
- A test of date or time logic fixes the clock and includes an instant at which the date in the business time zone differs from the date in UTC: just after local midnight for a zone east of UTC, just before it for a zone west of UTC. A project whose business time zone is UTC has no such instant. The date rules are in [domain.md](domain.md#time-and-dates).
- A test of rendered HTML (templates, e-mail) rejects raw executable tags.
- A test that renders untrusted or user input also asserts its encoded markup (`&lt;script&gt;`).

## Authorization tests

The rules are in [security-and-data.md](security-and-data.md#authorization). In tests:

- every protected surface has a test for the role that is **allowed** and for at least one role that is **refused**; a test that only proves access is granted is not sufficient;
- the refused case asserts an explicit status (`403`, `404` or a redirect), never "not 200";
- a value a role must not see is asserted **absent from the payload** (page props, JSON, export rows), not hidden in rendered markup;
- ownership and scope (tenant, customer, sales channel, legal entity) are tested with two users, each seeing only their own records;
- default deny is enforced by one test that fails on any route without an authorization decision, so a new route cannot ship unguarded.

## Test doubles

Doubles (mocks, stubs, fakes) isolate the code under test from external systems, and from the database only when the behaviour under test does not need it.

- Behaviour-specific fakes stay in the individual test. Suite-wide safety guards MAY live in the shared base test class.
- **Network guard.** The suite is guarded so that a connection to anything but localhost fails the test, and integration keys are empty in the test environment. A test that needs an external system fakes it; a request nobody faked is a bug, never a silent real call. The stack's testing guideline names the mechanism. The one exception is the `sandbox` group ([Test groups](#test-groups)), which is meant to reach a provider's test API: the guard is lifted for it alone, and its credentials come from the environment of the job that runs the group (a test without them skips itself).
- Do not install blanket exception or sleep fakes only to make the suite faster.
- Do not mock the collaborator whose result is the behaviour under test (a calculator in a test of its caller). A small real collaborator beats a mock that echoes the implementation.

## Database in tests

- A test never uses the development or a production database, and never depends on the order of other tests or on data another test left behind.
- A test that needs the database starts from a known state the stack sets up for it; the stack guidelines say how.

## Keeping the integration run short

The cost of an integration (feature) test is starting the application and building the data the test needs, not resetting the database. Every eSoul project shares one Jenkins, so a slow run blocks every other project too.

- **Pick the cheapest layer that can see the behaviour.** Calculations, mapping, value validation and branching are unit tests, with table-driven cases for the variants. An integration test is for what needs the real database, framework or application: the contract of a route or command, authorization, persistence, events and wiring across parts.
- **A feature test is a scenario**: one realistic flow per test, asserting all its observable outcomes (status, persisted state, dispatched events, props). Unit tests stay one behaviour per test.
- **Variants of one rule are unit tests**, never more feature tests. Each failure class and the success of a route or command are proven once at the integration layer. A data provider multiplies the fixture, because every data set pays the set-up again.
- **A scenario creates only the data it asserts on.** Factories build minimal valid records; do not build a catalogue to test one product.
- **Preconditions are built, not played through.** Factories, states and builders create the state a scenario starts from (a placed order, a paid invoice, a published product); only the behaviour under test uses its real entry point. A precondition played through real flows makes every test pay for those flows and fail when they break.
- **A matrix is one test.** A check over a cross product (role × page, route × middleware, class × layer) loops over it, collects the violations and asserts that the list is empty, so one failure lists every violation. Never a data-provider case per pair: each case pays the set-up again.
- **Derived data stays off unless it is under test, when the project has derived data.** A project that has derived data (read models, search indexes, projections, feeds, sitemaps) has its shared base test class fake the recomputation of it; a test of that derivation opts back in (the stack's testing guideline says how). Every other test asserts the source data. A project without derived data has nothing to fake and adds no such class.
- **Concurrency is proven by design and review** (the locking rule of the stack's CQRS guideline), not by tests: on the test engine a multi-process test cannot show row locks, and it costs a process per worker. A multi-process test is written only for a named damaging invariant (a double-spent stock, a double-charged payment); it names the invariant in its docblock, carries `db-engine` and runs only in the scheduled job on the production engine ([Test groups](#test-groups)).
- **Add to the suite of the area.** A new integration test goes into the existing suite of its area. A new suite is only for an area no suite covers, and the pull request says why. Name a suite after the area, never after an issue.
- **A feature test that takes over 1 second** in a full local run is called out in review: make it cheaper or say in its docblock why it cannot be.

Suites that break these rules are merged or moved to a cheaper layer in their own issue, not in passing.

## Suite time budget

- The CI test stage has a wall-time budget of **10 minutes**. A project MAY set its own and states it in its project guidelines, below the managed block.
- The test stage SHOULD publish JUnit results with per-test times, so the slowest tests and the growth per pull request are read from the build, not guessed.
- A test stage over budget is an issue that trims the suite (a cheaper layer, a matrix as one test, preconditions from factories, duplicates deleted), and it comes before new feature tests.
- A pull request that adds more than **30 seconds** of summed test time (the sum of the per-test times of a full run, before and after) says why in its description.

## Test groups

The default run (local and CI) excludes `sandbox` and `quarantine`; they run on a schedule or on demand (the stack's testing rules say how). A test joins a group only for the reason named here.

| Group | For | Runs |
|---|---|---|
| `sandbox` | contract tests against a provider's test API or a recorded cassette refresh; they skip themselves when credentials are missing | on demand and on schedule |
| `quarantine` | a flaky test whose cause is not fixed yet; a comment on its group attribute holds the URL of its issue | on schedule only, until fixed or deleted within that issue |

`db-engine` is a project opt-in. A project that runs on a different database engine in production than in its tests MAY mark tests whose outcome depends on the production engine (collations and case-insensitive uniqueness, `NULL` ordering, JSON functions, raw SQL, locking, strict mode) with it. They stay in the default run on the test engine and run again on the production engine in a scheduled job, which the project MUST set up, otherwise the group proves nothing. A `db-engine` test that shows nothing on the test engine (a multi-process concurrency test) skips itself there, so only the scheduled job runs it. A defect found on the production engine gets a regression test in `db-engine`, never a workaround that only satisfies the test engine.

## Flaky tests

A test that fails and passes on the same code is a defect. Do not rerun the build until it is green and do not add sleeps or wider timeouts. Find the cause (clock, order dependence, shared state, parallel workers, network) and fix it; when that is not quick, quarantine the test with an issue as above.

## Running tests

- The whole suite runs with the stack's one command (named in the stack's tools guideline, `tools.md`), once, on the code that will be pushed. While editing, run narrowly: one file or one filter, then the test directories of the touched area.
- Run tests with the debugger and coverage driver off unless you need them; they slow a run down several times.
- Coverage shows which lines the tests execute, not whether they check anything.

## Testing workflow

1. Write or adjust the behavioural tests for the change, test-first where practical, and run them narrowly.
2. Delete temporary tests and anything else that does not belong in the suite. Do this first, so the next steps measure the tests that will be merged.
3. Run the whole suite and the stack's static analysis (the stack's tools guideline, `tools.md`) once, on the code that will be pushed; formatters run before every commit instead ([workflow.md](workflow.md#commits)). Skip what the change cannot affect: a documentation-only change runs no tests.
4. Optional: where the stack provides mutation testing, run it when the change has logic with boundaries or branching, and use the results as the stack's mutation-testing section says. It is a diagnostic, not a gate, and nothing from it goes into the pull request.
5. List the checks you ran, with their results, in the pull request, or the `No test:` line; add the reason when the pull request adds more than 30 seconds of test time ([Suite time budget](#suite-time-budget)).
6. Push review fixes together, after they pass locally: every push is a full CI build. A red build is reproduced locally before its fix is pushed.

Do steps 2 to 5 before opening a pull request and before reporting a slice as finished.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end testing -->
