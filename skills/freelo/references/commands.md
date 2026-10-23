# Freelo CLI command reference

Full command reference by area. Read only the area you need. Derived from `freelo skill show` (Freelo CLI 1.3.0); when the CLI updates its skill, re-split it into the core and these references.

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

