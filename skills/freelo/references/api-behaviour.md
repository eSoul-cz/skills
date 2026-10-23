# Freelo API behaviour behind the CLI

Server-side behaviours the CLI cannot hide: response and error shapes, pagination, formats,
whitelists, and troubleshooting. Read the section you need.

## Response shapes — four API patterns to recognize

The CLI normalizes most listings (pagination is abstracted), but some commands
pass the raw API response through. When you see raw output, expect these four
shapes:

### 1. Paginated with named data key (most `/all-*` listings)

```json
{ "total": 42, "count": 25, "page": 0, "data": { "tasks": [ ... ] } }
```

The key inside `data` varies per endpoint:

| CLI command                       | inner key    |
|-----------------------------------|--------------|
| `freelo tasks list`               | `tasks`      |
| `freelo tasklists list`           | `tasklists`  |
| `freelo comments list`            | `comments`   |
| `freelo notifications list`       | `items`      |
| `freelo files list`               | `items`      |

### 2. Paginated with `data` as an array

```json
{ "total": 10, "data": [ ... ] }
```

Seen in `freelo reports list`, `freelo invoices list`.

### 3. Bare array

```json
[ { "id": 1, ... }, { "id": 2, ... } ]
```

Seen in `freelo projects list`, `freelo users list`, `freelo labels list`.

### 4. Wrapped object

```json
{ "result": "success", "user": { "id": 123, ... } }
```

Seen in `freelo users me`. Unwrap the named key (`user`) when reading fields.

> **You rarely need to parse these shapes by hand** — the CLI handles
> pagination, so `freelo tasks list --agent` gives you a clean array. But the
> escape hatch `freelo api get <path>` returns raw API JSON, and then these
> shapes matter.

---

## Error shapes — two patterns

When the CLI itself reports an error (in `--agent` mode), the envelope is:

```json
{ "ok": false, "error": "API error 404: <...>", "code": "not_found" }
```

When you dig into the `error` string, you'll find one of two server patterns:

- `{"errors": ["Human readable message"]}` — validation / 400-range errors
- `{"message": "..."}` — auth / server errors

---

## Pagination

Most listings accept `--page N` (0-indexed). Default page size is 25.

```bash
freelo tasks list --project 12345 --page 0 --agent
freelo tasks list --project 12345 --page 1 --agent
```

To iterate all pages, keep requesting until `count < per_page` or until the
CLI returns an empty array. The CLI **does not auto-paginate** across pages —
that's intentional, so you know how much you're pulling.

---

## Dates & times — three formats

Freelo uses three date/time conventions that you'll see in responses:

1. **Date-only** (`"2026-04-24"`) — due dates, report dates
2. **Local no-zone** (`"2026-04-24T11:12:38"`) — `date_add` on tasks/comments
3. **Offset** (`"2026-04-24T11:12:38+02:00"`) — some audit fields

All CLI `--date` / `--due-date` / `--from` / `--to` flags accept
**`YYYY-MM-DD`**. Time-of-day is supported on out-of-office (`--from` / `--to`
accept `YYYY-MM-DD HH:MM:SS` in UTC). Freelo's timezone is Europe/Prague.

---

## Currency, colors, priority, IDs — server whitelists

### Currency (projects)

ISO 4217 codes. Most common: `CZK`, `EUR`, `USD`, `GBP`. Defaults to `CZK` in
`freelo projects create` when `--currency` is omitted.

### Colors (labels)

Freelo only accepts colors from its own palette, not arbitrary hex. Passing an
unrecognized hex returns `400 "Color \"#ff00aa\" of label is not a valid
value"`. If you don't know the workspace palette, omit `--color` — the server
picks a default gray.

### Priority (tasks)

Enum: `h` (high), `m` (medium), `l` (low). Any other value is rejected.

### IDs — integers vs UUIDs

- **Projects, tasks, tasklists, users, comments, work reports, notes, pinned
  items, notifications, invoices** — integers
- **Files, task labels, custom fields, custom-field enum options, tracking
  sessions** — UUIDs (strings like `6c8b5f5f-...`)

The CLI parses both correctly from positional args, but pass UUIDs *verbatim*
from the server; never transform or case-shift.

---

## CREATE vs GET response shapes — don't assume equality

When you create a task, the API returns **less** than a subsequent GET of the
same task. For full detail after creation:

```bash
# Create returns minimal fields (id, name, worker, date_add)
TASK_ID=$(freelo tasks create --project 12345 --tasklist 67890 --name "New" --agent \
  | jq -r '.id')

# Get full detail — comments, subtasks, labels, description, activity
freelo tasks show $TASK_ID --agent
```

The skill pattern: **after every create/edit, GET the resource** if you need
to present full detail to the user.

---

## Author field — naming inconsistency

Across different endpoints the "who did this" field has different keys:

| Response                          | Author key  |
|-----------------------------------|-------------|
| Task detail                       | `author`    |
| Comment                           | `author`    |
| Work report                       | `worker`    |
| Note                              | `author`    |
| Event / notification              | `author`    |

If you're scripting generic "who modified" display, check both keys.

---

## Data model — quick map

```
Account
 └── Projects (integer id)
      ├── Tasklists (integer id)
      │    └── Tasks (integer id)
      │         ├── Subtasks (integer id — but task_id comes back as null!)
      │         ├── Comments (integer id)
      │         ├── Description (stored as a comment under the hood)
      │         ├── Labels (UUID-keyed, shared pool across the account)
      │         ├── Custom field values (UUID)
      │         ├── Work reports (integer id)
      │         └── Time tracking sessions (UUID)
      ├── Notes (integer id)
      ├── Files (UUID)
      ├── Pinned items (integer id)
      └── Workers (user ids)
```

---


## Raw API escape hatch

For endpoints the CLI doesn't expose directly (archived projects,
invited projects, paid-plan features, upcoming endpoints), use the passthrough:

```bash
freelo api get /archived-projects --agent
freelo api get /invited-projects --agent
freelo api post /search --data '{"search_query":"test"}' --agent
freelo api put /path --data '{"key":"value"}' --agent
freelo api delete /task/12345 --agent
```

The passthrough uses the same wrapper — auth, User-Agent, rate limit, and
retry still apply.

---

## Troubleshooting

### HTTP status codes you'll see

| Code | Meaning                                             | CLI behavior             |
|------|-----------------------------------------------------|--------------------------|
| 200  | Success                                             | `ok:true` with data      |
| 201  | Created                                             | `ok:true` with new entity |
| 400  | Validation / bad field                              | `ok:false`, error body surfaced |
| 401  | Bad credentials                                     | hint: `freelo auth login` |
| 403  | Forbidden (plan restriction or not-your-project)    | `ok:false`, 403 in error |
| 404  | Not found / unsupported endpoint                    | `ok:false`, 404 in error |
| 422  | Semantic error (e.g. bad currency code)             | `ok:false`, message in error |
| 429  | Rate limited                                        | CLI retries up to 3 times |
| 5xx  | Server error                                        | CLI retries up to 3 times |

### Common pitfalls

- **"Color … is not a valid value"** → label colors come from a whitelist.
  Omit `--color` or use one already on an existing label.
- **"currency_iso is required"** on project create → the CLI defaults to CZK;
  pass `--currency EUR` etc. if needed.
- **Task `task_id` on subtask response doesn't match the parent** → known
  server quirk; pass the actual parent ID from your own state.
- **Onboarding project missing from `freelo projects list`** → access by ID
  directly (e.g. `freelo projects show 580898 --agent`).
- **Content you post in a comment comes back wrapped in `<div>`** → server-
  side sanitization. Don't assert byte equality in tests.
- **`--agent` returns `null` for listings** → the server returned JSON null
  (no data). Treat as empty; check with `freelo … list --count --agent`.
- **Auth works but calls 401 anyway** → likely a stale API key. Have the user
  regenerate in Freelo → Profil → API.

### When the CLI says "unsupported endpoint"

Some endpoints are paid-plan only or not documented in the OpenAPI spec. The
CLI does not expose them. If you need one, use `freelo api get/post/…` with
the path from the user's paid-plan docs. If it returns 404, the endpoint
truly doesn't exist — no amount of retries will help.

---

