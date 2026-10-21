# Project guidelines - Workflows, events and jobs

Medusa runs business operations as **workflows** (steps with compensation), announces what
happened as **events** that **subscribers** react to, and runs periodic work as **scheduled
jobs**. This guide says when to use which and how to write them. Official documentation:
https://docs.medusajs.com/learn/fundamentals/workflows. Paths are relative to
`apps/backend/src`.

## When logic must be a workflow

- An operation MUST be a workflow when it changes data of more than one module (Medusa's
  included), or when a later step can fail after an earlier one has written something that must
  then be undone.
- A Medusa operation whose event or side effects the project relies on MUST run through Medusa's
  core workflow from `@medusajs/medusa/core-flows`, never through the module service: capturing a
  payment (`capturePaymentWorkflow`, so that `payment.captured` fires), creating a fulfillment or
  shipment, updating products and variants. Seeds create Medusa data through core workflows too.
- An operation on one project module's own data MAY stay a module service method called from a
  route, a subscriber or a job.
- Use a workflow hook of a core flow when a project step must succeed or fail together with it;
  a follow-up that may fail on its own belongs in a subscriber.

## Writing a workflow

- One workflow per kebab-case file in `workflows/`:
  `export const fooWorkflow = createWorkflow("foo", …)` with an exported typed input. Steps are
  `createStep("foo-step", invoke, compensate)`. Workflow and step ids are unique.
- The workflow function only wires steps together. It MUST NOT `await`, branch on or compute from
  its input, because Medusa builds the step graph once. Use `transform` for data manipulation and
  `when` for conditions.
- A step resolves what it needs from its `container` with types. Query MAY be used in a step.
- A step that writes returns `new StepResponse(output, compensationInput)`. Its compensation MUST
  undo exactly that write and return early when `compensationInput` is undefined.
- A step whose effect cannot be undone (a document issued in an external system) says so in a
  comment and SHOULD be the last step that can fail.
- A business failure is reported by throwing `MedusaError` with a type and a machine-readable
  error code from the shared error contract, never a plain `Error`.
- Run a workflow with `await fooWorkflow(req.scope).run({ input })` in a route and
  `fooWorkflow(container).run({ input })` in a subscriber or job.
- Amounts in the input keep their unit in the field name (`refund_amount_minor`) and are
  converted once by the caller ([domain.md](domain.md#money)).
- Every workflow has tests of its success, each failing step and its compensation
  ([testing.md](testing.md)).

## Events and subscribers

### Which events a subscriber may listen to

- A subscriber listens only to an event a Medusa workflow emits (the `*WorkflowEvents` and
  `PaymentEvents` constants from `@medusajs/framework/utils`) or to a project event declared in
  one constant map (`{{EVENT_NAMESPACE}}Events`). A guard test fails for any other name.
- `config.event` uses those constants, never string literals, so a renamed event fails to
  compile.
- Payment and fulfillment events carry the payment or fulfillment id, not the order id; resolve
  the order through a shared helper.

### Writing a subscriber

- Order and payment side effects (invoices, loyalty, marketing, e-mails, external systems) MUST
  run in subscribers, never in an API route or in the checkout, so an outage of an external system
  cannot fail the customer's request.
- A subscriber assembles the data with Query and hands it to the module that acts.
- A failure is logged with the ids the subscriber handled.
- Subscribers of one event run in no fixed order. A follow-up that needs another subscriber's
  result listens to an event that subscriber emits.
- A project event is emitted through the event bus after the state it announces is saved, and
  carries ids only.
- A subscriber is tested through the real event, not only by calling its handler, because a
  handler test cannot catch a wrong event name or payload.

### Idempotency

- **Every subscriber MUST be idempotent.** An event delivered again MUST NOT issue a second
  document, add points twice, send a second e-mail or call an external system twice. Use a
  persisted marker checked under a lock, or a record of what was handled protected by a unique
  index. A duplicate external write is a `Blocker` ([code-review.md](code-review.md)).
- When the event bus delivers at most once (the in-memory bus) a failed side effect is lost;
  when it retries (the Redis bus) it is delivered again. Idempotency is required in both cases.

## Scheduled jobs

- Scheduled work is a file in `jobs/` with a default-exported
  `async function (container: MedusaContainer)` and `export const config = { name, schedule }`,
  where `name` equals the file name. Do not add an external scheduler.
- The cron expression runs in the process's time zone. Prefer interval schedules; a job whose
  wall-clock hour matters says in a comment which zone the hour is meant in, and the processes
  run with `TZ=UTC`.
- A job that processes several items catches and logs the failure of one item and continues.
- A job MUST be safe to run again and concurrently: it selects only work that is still pending
  and records what it has done.
- A job that needs data from several modules reads it with Query and passes it to the module.
- A job that must also run on demand gets a `medusa exec` script in `scripts/`.

## Locks

- Use `container.resolve<ILockingModule>(Modules.LOCKING).execute(key, fn)` around a
  read-check-write that concurrent events or requests can run at once. Keys are
  `<purpose>:<id>`.
- The in-memory locking provider holds only within one process. Until locking runs on a shared
  provider, a lock MUST be paired with a persisted marker or a unique constraint wherever a
  duplicate would be a defect.
