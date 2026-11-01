# Freelo CLI recipe for task authoring (verified with CLI 1.3)

This is the command sequence for the write and verify step. The `freelo` skill core owns the
general CLI rules (`--agent`, authentication, links). Run the writes only after approval.

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
- Subtasks, comments, editing, moving and other commands:
  [commands.md](../../freelo/references/commands.md).

## Delegation

In an orchestrated session the searches (`freelo search`, `/all-tasks` pagination, label and
tasklist cache refresh) and, after approval, the writes and the read-back run through
`esoul-skills:ops`; see the `freelo` skill, Delegation.
