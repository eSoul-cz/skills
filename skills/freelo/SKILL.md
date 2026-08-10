---
name: freelo
description: >
  Use when interacting with Freelo.io project management through the `freelo`
  CLI — managing projects, tasklists, tasks, subtasks, comments, time tracking,
  work reports, labels, notes, files, custom fields, templates, pinned items,
  workers, notifications, events, invoices, or searching in Freelo. Trigger
  this skill whenever the user mentions Freelo, wants to manage tasks or
  projects, track time, create work reports, check invoices, or do anything
  related to Freelo.io.
---

# Freelo CLI — Agent Skill

You have access to the `freelo` CLI for managing Freelo.io. This skill assumes
`freelo` is installed and authenticated on the user's machine. Everything you
need to do in Freelo goes through CLI commands — **never call the API with
`curl` directly** when the CLI has a command for the same action.

**Always pass `--agent`** for clean, parseable JSON output. In `--agent` mode
the CLI strips its envelope and prints just the payload, so JSON stays machine-
stable even across CLI versions.

**The CLI handles for you:**

- HTTP Basic Auth (from `FREELO_EMAIL` + `FREELO_API_KEY` env vars, or the
  keyring populated by `freelo auth login`)
- The required `User-Agent: FreeloCLI/<version>` header (Freelo backend uses
  this to identify CLI traffic; don't try to override it)
- Rate limiting — ~2.4 s minimum between requests, keeps you under the
  25 req/min API cap without 429s
- Retry-with-backoff on transient errors (429 / 5xx, 3 tries, Retry-After
  honored)
- Consistent error envelope in `--agent` mode:
  `{"ok":false,"error":"...","code":"..."}`

Because the CLI wraps all of that, most of the "API gotchas" you'd have to
handle in raw HTTP land fall away. The ones you still need to think about are
**server-side behaviors** (sanitization, whitelists, inconsistent response
shapes) — those are documented below.

---

## CLI basics

### Output modes

Default behavior depends on context: TTY gets a styled table, piped gets the
JSON envelope. For agents, always use one of:

```bash
freelo <command> --agent       # raw JSON payload only (MOST COMMON for agents)
freelo <command> --json        # full envelope: {"ok":true,"data":...,"summary":"...","breadcrumbs":[...]}
freelo <command> --ids-only    # just IDs, one per line (useful to pipe)
freelo <command> --count       # just the count
freelo <command> --quiet       # minimal output
```

### Exit codes

- `0` — success
- `1` — any error (auth, API, network, invalid args)

In `--agent` mode the JSON on stdout has `"ok":false` on error; the message is
in `"error"`. Check `ok` from the JSON rather than only exit codes when you
want structured error details.

### Check authentication first

```bash
freelo auth status --agent
```

If `"authenticated": false`, tell the user to run `freelo auth login` (or set
`FREELO_EMAIL` + `FREELO_API_KEY` env vars). Do **not** ask for credentials
in the conversation — the user's own machine handles login.

---

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

## Common patterns

### Resolve name → ID

Users often say "the Marketing project" rather than project ID 12345. Resolve
by listing + matching:

```bash
freelo projects list --agent | jq -r '.[] | select(.name == "Marketing") | .id'
```

If the match is ambiguous, list all candidates and ask the user.

### Drilling down

Start broad, filter, act:

```bash
freelo projects list --agent
freelo tasklists list --project 12345 --agent
freelo tasks list --project 12345 --tasklist 67890 --agent
freelo tasks show <task-id> --agent
```

### After create, always GET

The detail response has everything the list doesn't (description, labels, full
worker info, activity). Don't rely on the CREATE body alone.

### Confirm before destructive operations

Always surface the target (name + id) to the user before running:

- `freelo tasks delete <id>` (via `freelo api delete /task/<id>`)
- `freelo projects delete <id>`
- `freelo notes delete <id>`
- `freelo reports delete <id>`
- `freelo labels delete <id>`
- `freelo custom-fields delete <field-uuid>`

Archive is reversible (`archive` + `activate`); delete is **not**.

---

## Clickable entity references — always link

When you mention a Freelo entity in your response, render it as a clickable
Markdown link. Pull the ID from the CLI output and use these templates:

| Entity        | URL template                                                       |
|---------------|--------------------------------------------------------------------|
| Project       | `https://app.freelo.io/project/{id}`                                |
| Tasklist      | `https://app.freelo.io/project/{project_id}/tasklist/{tasklist_id}` |
| Task          | `https://app.freelo.io/task/{id}`                                   |
| Comment       | `https://app.freelo.io/task/{task_id}#comment-{id}`                 |
| Note          | `https://app.freelo.io/note/{id}`                                   |

### Good vs. bad

- Bad: "Created task 29517210 in Marketing."
- Good: "Created [Nová kampaň](https://app.freelo.io/task/29517210) in
  [Marketing](https://app.freelo.io/project/12345)."

### Rules

- Link the entity's **display name**, not the ID. The ID goes in the URL.
- Link every first-mention of an entity in a response. Repeats can stay plain.
- If you don't have the numeric ID yet, either run the command that produces
  it or ask — never fabricate an ID.

---

# Endpoint reference

## Users & workers

```bash
freelo users me --agent                          # current user (result.user.id)
freelo users list --agent                        # coworkers across the account
freelo workers list --project 12345 --agent      # workers on a specific project

# Invite (one call to many projects)
freelo workers invite --emails "a@b.cz,c@d.cz" --projects "12345,67890" --agent

# Remove from a project by email
freelo workers remove --project 12345 --emails "a@b.cz,c@d.cz" --agent
```

## Projects

Three different "list projects" endpoints exist server-side, depending on
role. The CLI's `freelo projects list` calls `/projects` (projects you own).
If a project the user can access doesn't show up:

- For projects you're invited to (not owned), you may need the raw endpoint:
  `freelo api get /invited-projects --agent`
- **Onboarding / demo projects (e.g. 580898 "Vyzkoušej si Freelo") never
  appear in any listing.** Access them directly by ID:
  `freelo projects show 580898 --agent`

```bash
freelo projects list --agent                          # owned projects (bare array)
freelo projects show 12345 --agent                    # full detail incl. tasklists
freelo projects create --name "New Project" --currency CZK --agent
freelo projects archive 12345 --agent                 # reversible
freelo projects activate 12345 --agent                # un-archive
freelo projects delete 12345 --agent                  # IRREVERSIBLE — confirm first

# Listing archived projects / template projects has no dedicated command — use raw API:
freelo api get /archived-projects --agent
freelo api get /template-projects --agent
```

## Tasklists

```bash
freelo tasklists list --project 12345 --agent         # all tasklists in a project
freelo tasklists list --agent                         # all tasklists you can see
freelo tasklists show 67890 --agent                   # detail (includes tasks)
freelo tasklists create --project 12345 --name "Backlog" --budget 5000 --agent
```

> **Edit and delete tasklist are not supported server-side** — the CLI does not
> expose these subcommands because the API has no such endpoints.

## Tasks

```bash
# List — filters cascade
freelo tasks list --project 12345 --agent
freelo tasks list --project 12345 --tasklist 67890 --agent
freelo tasks list --search "bug" --agent
freelo tasks list --project 12345 --state 2 --agent    # state_id (numeric)

# Detail
freelo tasks show <task-id> --agent

# Create
freelo tasks create --project 12345 --tasklist 67890 --name "Fix bug" --agent

# Create with optional fields
freelo tasks create \
  --project 12345 \
  --tasklist 67890 \
  --name "Fix bug" \
  --priority h \
  --due-date 2026-05-01 \
  --worker 267807 \
  --comment "Initial context" \
  --agent

# Edit (at least one field required)
freelo tasks edit <task-id> --name "Updated name" --agent
freelo tasks edit <task-id> --priority m --agent
freelo tasks edit <task-id> --due-date 2026-05-15 --agent
freelo tasks edit <task-id> --worker 267807 --agent

# State transitions
freelo tasks finish <task-id> --agent
freelo tasks activate <task-id> --agent        # re-open

# Move / delete
freelo tasks move <task-id> --tasklist 99999 --agent
freelo api delete /task/<task-id>               # no 'tasks delete' subcommand — use api passthrough

# Description (stored server-side as a special comment)
freelo tasks description <task-id> --agent                              # get
freelo tasks description <task-id> --set "<p>HTML content</p>" --agent  # set
```

### Task description with files

The description accepts HTML including `<img>` tags pointing to file URLs. The
workflow:

```bash
FILE_UUID=$(freelo files upload /path/to/image.png --agent | jq -r '.uuid')
freelo tasks description <task-id> \
  --set "<p>See attached:</p><img src=\"https://app.freelo.io/file/$FILE_UUID\" />" \
  --agent
```

### Filters that only work on `/all-tasks`

`--search`, `--state`, and label filtering go through the `/all-tasks`
endpoint. When you also pass `--project` + `--tasklist`, the CLI switches to
`/project/{pid}/tasklist/{tid}/tasks` and filters do not apply there.

## Subtasks

**Freelo's API only supports listing and creating subtasks.** There is no
endpoint to finish, activate, or delete a subtask — the CLI reflects this by
not exposing those subcommands.

```bash
freelo subtasks list --task <task-id> --agent
freelo subtasks create --task <task-id> --name "Step 1" --agent
freelo subtasks create --task <task-id> --name "Step 2" --priority h --due-date 2026-05-10 --agent
```

> **Known server-side quirk:** the subtask response includes `task_id` but it
> doesn't match the parent task id (it's a synthetic per-subtask scope id).
> Don't use `task_id` from a subtask response to look up the parent.

## Comments

**There is no delete endpoint for comments** — the API doesn't support it.
The CLI reflects this.

```bash
freelo comments list --project 12345 --agent
freelo comments create --task <task-id> --content "Text or <b>HTML</b>" --agent
freelo comments edit <comment-id> --content "Updated text" --agent
```

> **HTML sanitization**: comment / description bodies pass through the server's
> HTML sanitizer. It wraps plain text in `<div>...</div>` and strips tags /
> attributes outside its whitelist. Do **not** rely on round-trip equality —
> what you POST is not byte-identical to what GET returns.

## Labels

Two flavors: project labels (scoped to a project) and task labels (account-
wide pool, referenced by UUID or name+color).

```bash
# Project labels
freelo labels add-to-project --project 12345 --name "Urgent" --color "#ff0000" --agent
freelo labels edit <label-id> --name "Critical" --agent
freelo labels remove-from-project --project 12345 --label-id <label-id> --agent
freelo labels delete <label-id> --agent

# Task labels (global pool)
freelo labels list --agent                                  # list task-label pool
freelo labels create --name "backend" --color "#0066cc" --agent
freelo labels add-to-task --task <task-id> --name "backend" --agent
freelo labels add-to-task --task <task-id> --uuid <label-uuid> --agent
freelo labels remove-from-task --task <task-id> --uuid <label-uuid> --agent
freelo labels remove-from-task --task <task-id> --name "backend" --agent
freelo labels remove-from-task --task <task-id> --name "backend" --color "#0066cc" --agent
```

## Custom fields

```bash
freelo custom-fields types --agent                          # list available types
freelo custom-fields list --project 12345 --agent

freelo custom-fields create --project 12345 --name "Budget" \
  --type-uuid <type-uuid> --agent                           # type-uuid from 'types'
freelo custom-fields rename <field-uuid> --name "Cost" --agent
freelo custom-fields delete <field-uuid> --agent            # soft-delete
freelo custom-fields restore <field-uuid> --agent           # undo soft-delete

# Set/clear value on a task (text/number fields)
freelo custom-fields set-value --task <task-id> \
  --field-uuid <field-uuid> --value "12000" --agent
freelo custom-fields delete-value <value-uuid> --agent

# Enum options (for fields of type "enum")
freelo custom-fields enum-options <field-uuid> --agent
freelo custom-fields enum-create <field-uuid> --value "In Progress" --agent
freelo custom-fields enum-edit <enum-uuid> --value "Done" --agent
freelo custom-fields enum-delete <enum-uuid> --agent         # fails if used
freelo custom-fields enum-delete <enum-uuid> --force --agent # delete + detach from tasks

freelo custom-fields set-enum-value --task <task-id> \
  --field-uuid <field-uuid> --enum-uuid <enum-uuid> --agent
```

> **Enum options have no color field** (despite what older docs suggested).
> The CLI accepts `--color` as a no-op for backward compatibility but the
> server ignores it.

## Notes

```bash
freelo notes create --project 12345 --name "Weekly update" \
  --content "<h2>Week 17</h2><p>...</p>" --agent
freelo notes show <note-id> --agent
freelo notes edit <note-id> --name "Updated title" --content "..." --agent
freelo notes delete <note-id> --agent
```

> `freelo notes edit` requires `--name` — the Freelo `EditNote` endpoint
> treats `name` as mandatory (no partial updates on that field).

## Time tracking

```bash
freelo tracking status --agent                               # what's running?
freelo tracking start --task <task-id> --note "Context" --agent
freelo tracking stop --agent                                 # also creates a work report
```

## Work reports

```bash
freelo reports list --project 12345 --agent
freelo reports list --user 267807 --agent

freelo reports create --task <task-id> --minutes 90 \
  --date 2026-04-24 --note "Design review" --agent

freelo reports edit <report-id> --minutes 120 --agent
freelo reports delete <report-id> --agent
```

## Files

File attachment is a **three-step workflow**: upload → attach → (optionally)
download. A file uploaded but never attached becomes orphaned.

```bash
# List all docs/files
freelo files list --project 12345 --agent
freelo files list --project 12345 --type file --agent         # filter
freelo files list --project 12345 --type document --agent

# 1. Upload — returns a UUID
FILE_UUID=$(freelo files upload /path/to/report.pdf --agent | jq -r '.uuid')

# 2. Attach — the CLI has no dedicated attach command; attach via the
#    entity that owns the file. Examples:
#    - Task description with a file: include <img> or <a> pointing to
#      https://app.freelo.io/file/$FILE_UUID
#    - Comment: put <a href="https://app.freelo.io/file/$FILE_UUID">...</a>
#      in --content
#    - Note: same as comment

# 3. Download — saves under Content-Disposition name or the UUID
freelo files download $FILE_UUID --agent
freelo files download $FILE_UUID --output ./report.pdf --agent
```

> **Server-side filename sanitization**: Freelo replaces spaces and special
> characters in filenames on upload. Display names come back ASCII-normalized
> even if you uploaded `Měsíční zpráva.pdf`.

## Templates

```bash
freelo templates list --agent                                  # template projects

freelo templates create-project --template <id> --name "Q3 plan" --agent
freelo templates create-tasklist --template <tasklist-template-id> --agent
freelo templates create-task --template <task-template-id> --agent
```

## Pinned items

```bash
freelo pinned list --project 12345 --agent
freelo pinned create --project 12345 --link "https://app.freelo.io/task/29517210" \
  --title "Hot item" --agent
freelo pinned delete <pinned-item-id> --agent
```

## Notifications

```bash
freelo notifications list --agent
freelo notifications list --unread --agent
freelo notifications read <notification-id> --agent
freelo notifications unread <notification-id> --agent
```

## Events (audit log)

```bash
freelo events list --project 12345 --agent
freelo events list --user 267807 --agent
freelo events list --project 12345 --user 267807 --page 0 --agent
```

## Out of office

```bash
freelo out-of-office status --user 267807 --agent
freelo out-of-office enable --user 267807 \
  --from "2026-08-01 00:00:00" --to "2026-08-15 23:59:59" --agent
freelo out-of-office disable --user 267807 --agent
```

`--from` / `--to` are UTC. `YYYY-MM-DD` (treated as start of day UTC) also works.

## Invoices

```bash
freelo invoices list --agent
freelo invoices list --project 12345 --agent
freelo invoices show <invoice-id> --agent
freelo invoices mark-invoiced <invoice-id> --url "https://..." --subject "INV-2026-04" --agent
```

## Search

Single endpoint across everything:

```bash
freelo search "budget" --agent
freelo search "budget" --type task --project 12345 --agent
freelo search "report" --type project --agent
```

`--type` values: `task`, `subtask`, `project`, `tasklist`, `file`, `comment`.

### Result quirks

- Results include a `type` field per item — use it to decide which
  `freelo <group> show <id>` to call for full detail.
- Project filter is best-effort: the server may return cross-project matches
  when relevance beats the filter.

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

## Tips for fast, accurate work

1. **Always pass `--agent`** unless you need human-readable output.
2. **Use `jq` liberally** to pluck IDs:
   `freelo projects list --agent | jq -r '.[] | select(.name | test("Marketing";"i")) | .id'`
3. **Batch reads before writes** — when possible, read the current state first
   so you can confirm the edit target with the user.
4. **Render clickable links** for every entity you mention (see the entity
   URL templates above).
5. **`freelo <group> --help`** lists subcommands. `freelo <group> <sub>
   --help` lists flags. Use them when memory fails.

---

## Fallback: full API reference

For endpoints or fields the CLI doesn't expose, the authoritative spec lives
at <https://api.freelo.io/docs/v1/freelo-api>. The same spec drives the CLI's
generated client (regenerated weekly by CI — a freshly-updated CLI sees any
new endpoints automatically).
