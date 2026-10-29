# Project mapping and cache in CONTEXT.md

The `## Freelo` section of root `CONTEXT.md` maps the repository to its Freelo project and
caches the IDs every run needs. Freelo allows roughly one request per 2.4 seconds, and task
label UUIDs can only be collected by paging through existing tasks, so resolving them on every
run is the slowest part of authoring. Resolve them once, write them here, and reuse them.

```md
## Freelo

- Projekt: <project name>
- Project ID: <numeric id>
- URL: https://app.freelo.io/project/<numeric id>
- Tasklisty: Backlog `<id>` · To Do `<id>` · In progress `<id>` · Code review `<id>` · Testing `<id>` · Done `<id>` · LTT `<id>`

Task labels (verified YYYY-MM-DD; add by UUID, never create new ones):

| Label | UUID |
| --- | --- |
| <emoji and name exactly as in Freelo> | `<uuid>` |
```

Write the block near the beginning of `CONTEXT.md`, creating the file if absent; never write it
to `GLOSSARY.md`. List the tasklists the project actually has, by their Freelo names.

## When to write or refresh it

- **First run on a repository:** after the user confirms an inferred project, write the mapping
  lines. In the same run, once the tasklists and task labels are loaded, add the `Tasklisty` line
  and the label table. The confirmation authorizes only this standardized context edit; report
  it before continuing and do not include it later in the task preview.
- **Existing mapping without cache:** add the cache lines after the first run that loaded the
  data. Report the edit.
- **Every later run:** read the section and use the cached IDs and UUIDs directly. Do not list
  tasklists or page through tasks to find labels.
- **Refresh** only when a cached ID or UUID is rejected, a label the task needs is missing from
  the table, or the user says the project changed. Update the affected lines and the
  verification date; never drop labels that are still valid.

The edit is a normal repository change. Commit it with the work it belongs to, or on its own
through the repository's usual documentation flow when `CONTEXT.md` is protected.

## Conflicts

If `CONTEXT.md` or its `GLOSSARY.md` fallback contains a conflicting mapping, stop and resolve the
conflict with the user. A project-specific category table (GitHub label ↔ Freelo label) belongs
in `## Tasking convention` and may reference the UUIDs listed here.
