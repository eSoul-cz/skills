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

Manage Freelo.io through the authenticated `freelo` CLI. Never call the API with `curl` when
the CLI (or `freelo api`) can do it. Always pass `--agent` for the raw JSON payload; in
`--agent` mode an error is `{"ok":false,"error":"...","code":"..."}` on stdout and exit code 1.
The CLI handles auth (keyring or `FREELO_EMAIL` + `FREELO_API_KEY`), the required User-Agent,
rate limiting (~2.4 s between requests) and retries.

This file is the core. Read a reference only when the task needs it:

- [references/commands.md](references/commands.md): every command by area (projects,
  tasklists, tasks, subtasks, comments, labels, custom fields, notes, time tracking, work
  reports, files, templates, pinned items, notifications, events, invoices, search, tips).
- [references/api-behaviour.md](references/api-behaviour.md): response and error shapes,
  pagination, date formats, whitelists (currency, colours, priority), integer IDs vs UUIDs,
  CREATE vs GET differences, data model, raw API escape hatch, troubleshooting.

If this skill is already loaded in the session, do not load it again.

## Check authentication first

```bash
freelo auth status --agent
```

If `"authenticated": false`, tell the user to run `freelo auth login`. Never ask for
credentials in the conversation.

## Output modes

```bash
freelo <command> --agent       # raw JSON payload (use this)
freelo <command> --json        # envelope with summary and breadcrumbs
freelo <command> --ids-only    # IDs, one per line
freelo <command> --count       # count only
```

## Task authoring recipe (verified with CLI 1.3)

```bash
freelo tasklists list --project <project-id> --agent                    # resolve tasklist IDs by name
freelo tasks create --project <project-id> --tasklist <tasklist-id> --name "<title>" --agent
freelo tasks description <task-id> --set '<p>…</p>' --agent             # sanitized HTML; links with target="_blank" rel="noopener"
freelo labels add-to-task --task <task-id> --uuid <label-uuid> --agent  # one call per label, existing UUIDs only
freelo api post /task/<task-id>/total-time-estimate --data '{"minutes":180}'   # estimate; the CLI has no flag
freelo api post /task/<task-id>/relations --data '{"type":"blocked_by","related_task_id":<other-id>}'
freelo api get /task/<task-id>                                          # read back: tasklist, labels, total_time_estimate, relations
freelo search "<keyword>" --type task --agent                           # duplicates (searches all projects; filter by project)
```

- Relation `type` is `blocked_by`, `blocks`, `related_to` or `duplicate_of`, from the point of
  view of `<task-id>`; Freelo shows the reverse side automatically.
- Task label UUIDs: `freelo labels list` returns *project* labels, not task labels. Collect
  task-label UUIDs from existing tasks of the project:
  `freelo api get "/all-tasks?projects_ids[]=<project-id>&p=<page>"` → `labels[].uuid`.
  Never create a label by name; that creates a duplicate.
- Files: `freelo files upload <path> --agent` returns a UUID; attach it with
  `freelo tasks description <task-id> --set '…' --file <uuid>`.
- Subtasks, comments, editing, moving and other commands: [references/commands.md](references/commands.md).

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
