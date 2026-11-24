# Freelo write recipe for task creation

The operations of the write and read-back step, with the name of each in the Freelo MCP tools
(used when mounted) and in the `freelo` CLI (otherwise, with `--agent`). Command syntax, output
modes, authentication and entity links belong to the official `freelo` skill
(`freelo skill show`); eSoul's working rules are `esoul-task-work` › `references/freelo.md`. Run
the writes only after approval.

| Step | MCP tool (`mcp__freelo_<name>`) | CLI |
|---|---|---|
| Resolve tasklist IDs by name | `get_tasklists` (`project_id`) | `freelo tasklists list --project <project-id> --agent` |
| Create the task | `create_task` | `freelo tasks create --project <project-id> --tasklist <tasklist-id> --name "<title>" --agent` |
| Description (sanitized HTML; links with `target="_blank" rel="noopener"`) | `update_task` (`description`) | `freelo tasks description <task-id> --set '<p>…</p>' --agent` |
| Label, one per UUID, existing UUIDs only | `manage_task_labels` (`add_to_task`, `labels: [{uuid}]`) | `freelo labels add-to-task --task <task-id> --uuid <label-uuid> --agent` |
| Estimate in minutes | `update_task` (`total_time_estimate_minutes`) | `freelo api post /task/<task-id>/total-time-estimate --data '{"minutes":180}'` (no CLI flag) |
| Relation | `manage_task_relations` (`create`, `{task_id, type, related_task_id}`) | `freelo api post /task/<task-id>/relations --data '{"type":"blocked_by","related_task_id":<other-id>}'` |
| Read back: tasklist, labels, estimate, relations | `get_tasks` (`task_id`) | `freelo api get /task/<task-id>` |
| Search for duplicates | `search` | `freelo search "<keyword>" --type task --agent` (all projects; filter by project) |

- Relation `type` is `blocked_by`, `blocks`, `related_to` or `duplicate_of`, from the point of
  view of `<task-id>`; Freelo shows the reverse side automatically.
- Task-label UUIDs come from the `## Freelo` cache; how to collect a missing one is in
  `esoul-task-work` › `references/freelo.md`.
- Files: `freelo files upload <path> --agent` returns a UUID (MCP: `create_upload_link`); attach it
  with `freelo tasks description <task-id> --set '…' --file <uuid>` (MCP: embed its anchor in
  the `update_task` description).
- Subtasks, comments, editing, moving and other commands: the official `freelo` skill.
