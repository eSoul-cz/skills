# Project guidelines - Testing

This file says which tests the project keeps and how they are judged. The runners, file names,
commands and mutation tooling of the stack are in [tools.md](tools.md); the checks a pull
request needs are in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## What belongs in the suite

The suite keeps only **useful tests**: tests that fail when a user, a caller, an administrator or
an integrated system would notice a regression. A test earns its place when it pins down one of
these:

- **observable behaviour**: return values, persisted state, dispatched events and notifications,
  HTTP status and payload, redirects, rendered page props, export rows;
- **contracts and seams**: what a command, query, route, workflow, request, policy, component or
  DTO promises to its consumers;
- **boundaries and invariants**: limits, empty and null input, uniqueness, immutability, state
  transitions, rounding, amount units, idempotency;
- **failure paths**: validation (which field, never the wording), authorization, exceptions a
  caller handles (their type and metadata, never their message).

The following do **not** belong in the committed suite. Remove them when you find them, and turn
them into a behavioural test when the behaviour behind them matters:

- **performance tests**: timings, benchmarks, query-count budgets, eager-loading assertions;
- **architecture tests**: reflection or directory scans, "every class is registered",
  return-type checks, `class_exists`, unless named below;
- **data-definition tests**: migrations, schema columns and defaults, indexes, model fillables,
  casts or relations in isolation, factories, seeders, enum case lists, configuration values;
- **tests that restate the implementation**: mock echoes and forwarding, getters returning
  constructor arguments, generated SQL text, incidental defaults, a bare "does not throw", or an
  existence or type assertion as the only assertion;
- **duplicates** of another test covering the same path with the same assertions; keep the one at
  the more appropriate level.

### Named exceptions

Architecture and structure checks are a stack or project choice, not a default. A check that
guards a boundary review alone does not hold MAY stay in the suite when this list names it and
the accepted ADR or stack profile that requires it:

<!-- optional: named exceptions; delete the block when there are none -->
| Test | Guards | Decided by |
|---|---|---|
| {{NAMED_EXCEPTION_TEST}} | {{NAMED_EXCEPTION_RULE}} | {{NAMED_EXCEPTION_DECISION}} |

Anything else of these kinds still does not belong.

### Temporary tests

Migration, backfill, schema, seeder, data-import, performance and exploratory tests are welcome
**while developing**, when they are the fastest way to validate something. They are scaffolding:

- they MUST be deleted before the pull request is opened, at the latest before merge;
- the pull request mentions what they verified when the result matters to reviewers;
- a check that must hold permanently is expressed as a behavioural test of the feature that
  depends on it.

## Error and validation messages

Tests MUST NOT assert the text of an error message: exception messages, validation messages,
flashed errors and error bodies, however the text is reached. Assert the machine-readable part
instead: the exception class or error `type`, the error code, the field keys that carry an error,
the HTTP status or redirect, and any metadata the error exposes.

When the class alone does not tell two failure causes apart, the error is missing metadata. Add
it (a field key, a reason enum, a dedicated class, a code) and assert that.

Why: user-facing text is translated and edited, and some errors are shown to users. A test pinned
to the wording fails although no behaviour changed, and stays green when the wrong rule fires
with the same text. Callers depend on the type, the keys and the codes; those are the contract.

The rule covers error text only. Text users read in normal operation (labels, notification and
e-mail copy, page props) is product content and stays testable where it is the behaviour under
test. Text a test supplies itself and expects to be forwarded unchanged is test data.

## Regression tests

- A bug fix MUST come with a regression test that **fails without the fix**. Run it against the
  unfixed code once and say so in the pull request.
- The regression test sits at the layer where the bug was observable to its caller, not only in
  the unit that was patched.
- A regression test is never deleted as part of unrelated cleanup.

## Writing tests

- One test checks one behaviour, is self-contained and does not depend on test order.
- Test names describe the behaviour, consistently with similar tests nearby.
- Prefer table-driven cases (data providers, `it.each`) for several scenarios of one behaviour,
  with a descriptive name per case.
- Tests are deterministic: fix the clock, fake the network and external systems, restore mocks.
  A test that reaches the network is a bug.
- Build data through factories or builders that produce a valid minimal record. What a test cares
  about is set explicitly in that test.
- Test data is invented. Real client names, addresses, amounts or credentials MUST NOT appear in
  tests or fixtures ([security-and-data.md](security-and-data.md)).
- A test of date or time logic fixes the clock and includes an instant just after local midnight,
  which is still the previous day in UTC ([domain.md](domain.md)).
- Authorization is tested for the allowed **and** the refused role
  ([security-and-data.md](security-and-data.md#authorization-tests)).

## Mutation testing

Mutation testing checks that tests are useful, not only that they pass. The stack's tool
(Infection for PHP, Stryker for TypeScript; see [tools.md](tools.md)) changes production code one
small edit at a time and reruns the covering tests. A mutant no test notices has *escaped*.

It is a **local soft gate on changed lines**: it runs before a pull request is opened and before
a slice is reported finished, not in CI, and it never fails on a score. The review is the gate.
Every escaped mutant on a line the pull request changed is either:

- **killed** by a test that asserts the observable behaviour the mutant changes (an outcome, a
  boundary, an error type, a state transition). Never add a test only to reach a line or raise a
  score; or
- **justified** in the pull request: equivalent code, or a change of error wording only. Never
  kill a wording mutant by asserting the message. A mutant that changes an error type, a field
  key, a code or the condition that raises the error is not about wording; kill it.

A mutant killed only by a test that asserts wiring or incidental defaults means that test is not
useful; rework it.

## Testing workflow

1. Write or adjust the behavioural tests for the change, test-first where practical, and run them
   narrowly.
2. Delete temporary tests and anything else that does not belong in the suite.
3. Run the whole suite and the stack's checks ([tools.md](tools.md)).
4. Run mutation testing on the changed lines and work through the escaped mutants.
5. List the checks you ran and the accepted mutants in the pull request.

<!-- optional: client calculations exist in spreadsheets -->
## Parity tests against client workbooks

Where the client computes figures in spreadsheets today, the code MUST agree with them, and the
proof is a parity test ({{PARITY_ADR}}).

- Every formula the application reproduces is documented with its source (`file › sheet › cell`)
  and has a unit test whose numbers come from the client's workbook in `docs/podklady/`. Numbers
  invented for the test prove only that the code agrees with itself.
- The test names its source cell in the method name or a comment, so a reviewer can open it.
- A chain is tested end to end as well as per step.
- The comparison uses an **explicit, named tolerance** fixed by the ADR (spreadsheets compute in
  binary floating point, the application in exact decimals). It MUST NOT be widened quietly to
  make a failing test pass.
- Rounding is asserted, not assumed: a test fails if a second rounding is introduced.
- A known defect in the workbook has a test pinning the behaviour the project decided on, with a
  comment naming the defect and the decision.
- The client's figures reach tests as reviewed fixtures (one per chain, values copied verbatim as
  strings). Fixtures carry figures and cell references only, never names of people, clients or
  projects, and their values are not copied into seeders or other tests.
- A parity test written before its calculator exists checks the fixture against the documented
  formula and then marks itself incomplete, naming the calculator and the slice that will replace
  that line. It is a permanent test waiting for its code, not a temporary one.
- A calculator is never mocked in a parity test or in a test of the code that uses it.
