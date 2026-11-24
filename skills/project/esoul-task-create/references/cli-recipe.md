# Freelo write recipe for task creation

The command sequence of the write and read-back step, for the CLI. Command syntax, output modes,
authentication and entity links belong to the official `freelo` skill (`freelo skill show`);
eSoul's working rules are `esoul-task-work` › `references/freelo.md`. With the Freelo MCP tools
mounted use their equivalents (create, update with time estimate, manage relations). Run the
writes only after approval.

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
- Task-label UUIDs come from the `## Freelo` cache; how to collect a missing one is in
  `esoul-task-work` › `references/freelo.md`.
- Files: `freelo files upload <path> --agent` returns a UUID; attach it with
  `freelo tasks description <task-id> --set '…' --file <uuid>`.
- Subtasks, comments, editing, moving and other commands: the official `freelo` skill.
