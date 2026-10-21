# Project guidelines - CQRS

CQRS (Command Query Responsibility Segregation) separates the operations that change state
(commands) from the operations that read it (queries). The decision is {{ARCHITECTURE_ADR}}; the
layers around it are in [architecture.md](architecture.md).

- **Commands are the only way business state changes.** A handler owns one business operation,
  its transaction and its outbox write.
- **Queries are the read side.** They hand callers a complete, ready-to-use result as DTOs, so
  controllers, exporters, console commands and other handlers never query models or reshape data
  themselves. Many small, specialised queries are preferred over one query with many modes, and
  queries compose other queries.
- A screen and its export read the **same query**. A data import dispatches the **same commands**
  as the user interface; it never inserts into tables directly.

## The reference module

<!-- optional: reference module exists (keep exactly one of the two blocks) -->
The reference module is **{{REFERENCE_MODULE}}**: {{REFERENCE_MODULE_SUMMARY}}. Its commands,
queries and their tests in `tests/Feature/CQRS/{{REFERENCE_MODULE}}` show every rule below in
working code. New modules follow its shape; when this guide and the reference module disagree,
report it.

<!-- optional: no reference module yet -->
**Target.** A reference module shows every rule below in working code. The code does not do this
yet: the first slice that adds a command sets the example the rest follow (#{{REFERENCE_ISSUE}}).

## The package

The project uses the shared packages
[`esoul-cz/laravel-cqrs`](https://github.com/eSoul-cz/laravel-cqrs) (Laravel integration) and
`esoul-cz/cqrs` (buses, contracts, attributes). Do not add an application-local copy of the buses
or contracts.

- `Esoul\Cqrs\Contracts\CommandInterface` / `QueryInterface`: a command or a query.
- `Esoul\Cqrs\Contracts\CommandHandlerInterface` / `QueryHandlerInterface`: their handlers.
- `Esoul\Cqrs\Contracts\CommandBusInterface` (`dispatch()`) / `QueryBusInterface` (`execute()`).
- `Esoul\Cqrs\Attributes\HandlesCommand` / `HandlesQuery`: bind a handler to its command or query.
- `Esoul\LaravelCqrs\Facades\CommandBus` / `QueryBus`: facades over the container-bound buses.

Both buses and all handlers are container singletons, instantiated through the container with
constructor injection. **One handler instance serves every dispatch in a process**, including
every job a queue worker runs, so a handler MUST NOT keep per-call state in its properties.
Configuration lives in `config/cqrs.php`.

## Discovery

Handlers are discovered on boot from `cqrs.discovery.paths` (default `app/Domain/CQRS`). The
directories `app/Domain/CQRS/Command` and `app/Domain/CQRS/Query` MUST exist. Discovery results
are cached in `storage/framework/cache/discovery`; clear it when a handler is not picked up.

- Commands and their handlers live in `App\Domain\CQRS\Command\<Module>`, queries and theirs in
  `App\Domain\CQRS\Query\<Module>`.
- Every class implements the interface of its type, and every handler declares
  `#[HandlesCommand(SomeCommand::class)]` or `#[HandlesQuery(SomeQuery::class)]`.
- A command handler MAY handle several closely related commands: one attribute per command and an
  explicit `instanceof` branch per class. It MUST NOT group unrelated logic.

```php
#[HandlesCommand(CloseOrderCommand::class)]
final class CloseOrderCommandHandler implements CommandHandlerInterface
{
    public function __construct(
        private readonly ConnectionInterface $db,
    ) {}

    /** @param CloseOrderCommand $command */
    public function handle(CommandInterface $command): bool
    {
        return $this->db->transaction(function () use ($command): bool {
            // lock, check the business rule, write, record history, write outbox
            return true;
        });
    }
}
```

## Creating commands and queries

- Generate them with `php artisan make:cqrs-command <Group>/<Action>` and
  `php artisan make:cqrs-query <Group>/<Action>`, always with `--handler` and `--return=<type>`.
- Replace the generated `TODO` markers and `LogicException` before committing, and keep
  `declare(strict_types=1);`.
- The return type is never `void`; use `bool` or `null` when there is no meaningful value. The
  type is declared once, as the generic parameter (`@implements QueryInterface<ProductDetail>`),
  and propagated to the handler.
- `<Group>` is a module noun, `<Action>` a verb (`Order/PlaceOrder`, `Catalog/GetProductDetail`),
  both in the glossary's terms.

## Writing commands

- A command represents a business action, not plain CRUD that a model handles on its own.
- The command class is a readonly DTO with constructor property promotion and no behaviour.
- **The handler owns the transaction.** A handler that changes more than one row, or reads a row
  it is about to change, runs inside one database transaction (injected
  `ConnectionInterface::transaction()`). A nested `transaction()` joins the caller's.
- **Concurrent writes are locked.** Rows that concurrent requests may change are updated
  atomically (`UPDATE … SET x = x + 1`) or read with `lockForUpdate()` inside the transaction.
  Never read, compute in PHP and write back unlocked. Prove such handlers with a concurrency test.
- **External writes go through the outbox.** Every write to an external system is an outbox
  message written by the same handler, in the same transaction as the state change. A handler
  never calls an external system directly.
- **Changes are traceable.** An operation that must be recorded writes its history entry in the
  same transaction, with the acting user the command carries.
- Scope that differs per tenant, sales channel or legal entity is an explicit command property,
  resolved once by the caller. Handlers never read the request, the session or global state.
- HTTP input is validated by form requests before the command exists
  ([requests-and-validation.md](requests-and-validation.md)). The handler enforces the business
  rules and reports a violation with a typed exception in `App\Domain\Exception` that carries the
  facts as properties. Callers and tests react to the type and properties, never to the message.
- A handler MAY dispatch other commands and execute queries through buses injected in its
  constructor, not through facades.

## Writing queries

- A query is a read: it never changes state.
- The query class is a DTO without behaviour. It is not readonly; its properties use asymmetric
  visibility (`private(set)`) and are set through fluent setters, not constructor promotion.
- Required inputs are kept to a minimum, so a query stays reusable without filters. A missing
  required input makes the handler throw `InvalidArgumentException`.
- **The acting user.** A query whose result depends on who asks takes the acting user as an input
  and returns only what that user may see. Callers that serve a user's request MUST pass it.
  Omitting it is only for trusted internal callers (console commands, jobs, other handlers).
- A query MUST NOT return an Eloquent model or an associative array. It returns a DTO from
  `App\Application\Dto\<Module>`, a list of DTOs or a scalar.
- The handler returns a complete result: mapping to DTOs, re-indexing, filtering and formatting
  belong in the handler, not in the caller.
- A handler MAY execute other queries through an injected `QueryBusInterface` instead of
  repeating their logic. Large result sets use `lazy()` or `cursor()`.

## Calling commands and queries

- All commands and queries are called through the buses. Controllers MAY use the facades;
  handlers, services and jobs inject `CommandBusInterface` and `QueryBusInterface`.
- A console command, listener or job that changes state dispatches a command. A state change
  outside a command is `High` in review.

## Testing

Handler tests live in `tests/Feature/CQRS/<Module>` and run through the buses from the container.
Every handler has tests of its successful and unsuccessful scenarios, including the business
rule violations it reports and, for queries, the acting-user narrowing. See
[testing.md](testing.md).
