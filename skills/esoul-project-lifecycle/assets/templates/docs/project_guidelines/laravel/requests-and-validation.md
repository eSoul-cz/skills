# Project guidelines - Requests and validation

Incoming HTTP input is validated with Laravel form requests. The controller only handles a
request that has already been validated and authorized.

- All validation MUST happen in the form request class.
- Form requests MUST live in the `App\Infrastructure\Http\Requests` namespace and directory.

## Where validation lives

- A form request answers one question: **is this input acceptable to receive** — shape, type,
  presence, format, referential existence.
- A domain rule answers a different one: **is this operation valid** — whether a record may move
  to a state, whether a value may change on a date. Domain rules live in the framework-free core,
  are enforced by the command handler and are authoritative ([cqrs.md](cqrs.md)).
- A domain rule MAY be mirrored as a validation rule so the user gets a field-level message. The
  mirror is a convenience; it MUST NOT become the only place the rule exists.
- **Authorization is not validation.** `authorize()` delegates to the policy for the action
  ([security-and-data.md](security-and-data.md#authorization)). It MUST NOT re-implement a role
  check.

## Validation rules

- Rules are defined in `rules()`.
- A custom rule MAY be a closure in `rules()`, or a class implementing
  `Illuminate\Contracts\Validation\ValidationRule` when several requests reuse it.
- Complex cross-field validation SHOULD go in `withValidator()`.
- Every custom rule is tested, including its edge cases.
- Use `Rule::exists()`, `Rule::unique()` and `Rule::enum()` instead of the string syntax for
  those rules.
- A value the client manages as data (a type, a tag, a category) MUST be validated with
  `Rule::exists()` against its table, never with `Rule::in()` against a hardcoded list.
- An upload is validated by its **content**, not by the type the browser claims, against types
  and size limits from configuration. Private files use an explicitly configured private disk;
  the request never picks a disk and the command handler writes the file.

<!-- optional: users type decimals in a comma locale -->
## Decimal input

Users type `1,25` and paste `1 234,50` from spreadsheets. Nothing downstream may see that string.

- The comma decimal separator is normalised in `prepareForValidation()`, before the rules run.
  Accept `,` and `.`; reject a value containing both.
- Thousands separators (space, non-breaking space, narrow no-break space) are stripped in the
  same step.
- The normalised value is validated as a decimal with an explicit scale, for example
  `decimal:0,2`. `numeric` alone accepts scientific notation and is too permissive for money.
- **A decimal MUST NOT be cast to `float`.** It stays a string through validation and becomes a
  money value object or an exact decimal where the request maps to the command.
- A percentage entered in the interface becomes its factor exactly once, in the mapping method.

## Dates and time zone

- A date is validated with an explicit format (`date_format:Y-m-d`); a time with `H:i`.
- A date or time the user enters is local time in the business time zone and is converted to an
  instant once, in the mapping method ([domain.md](domain.md#time-and-dates)).

## Retrieving validated data

- The request data is annotated with PHPDoc `@property-read` on the form request and MAY be read
  as properties (`$request->name`).
- Every property is transformed to its type in `passedValidation()`, with the request's typed
  accessors (`boolean()`, `integer()`, `string()`, `array()`, `enum()`), and set with `merge()`.
  - `string()` returns a `Stringable`; call `->toString()`.
  - `float()` MUST NOT be used for money, quantities or hours.
  - Only scalars and arrays go into the validated data; DTOs are built later, in the mapping
    method, because the input bag cannot hold them.
  - A PHP enum is annotated as the scalar type of its backing value (`type-of<EnumClass>`).

## A request never writes

A form request MUST NOT write: no create, update or delete, no queued job, export or mail.
`prepareForValidation()`, `rules()`, `withValidator()` and `passedValidation()` may query to
validate; they may not persist. Creating a missing related record "because the user typed a new
one" is a write and belongs to the command handler, inside its transaction. A mutating request is
a `Blocker` in review: a rejected request would be half-applied.

## Mapping to commands and queries

- A form request SHOULD expose `toCommand()` or `toQuery()`, which turns the validated data into
  the command or query the controller dispatches. Building it in the constructor is possible but
  not recommended; a factory method on the command or query SHOULD NOT be used.
- The mapping method is where request-shaped values become domain-shaped ones: a decimal string
  becomes a money value object, a local date becomes an instant, a percentage becomes a factor.
- The mapping method passes the acting user (`$this->user()`) into every command and into every
  query whose result depends on who asks. The handler never reads it from the request.

## Testing

Each request is tested through its endpoint: the accepted input, each rejected field by its key
(`assertSessionHasErrors(['field'])` or `assertJsonValidationErrors(['field'])`) with the status,
never by the message text ([testing.md](testing.md#error-and-validation-messages)).
