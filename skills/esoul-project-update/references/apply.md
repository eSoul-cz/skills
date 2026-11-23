# Apply one changelog entry

Setup, from `SKILL.md`: `$AT` is the app-templates clone, `$TV` the `template-<variant>` clone, `$PROJECT` the project worktree. The entries are in apply order (oldest first), each with its commit `c_i`; `c_0` is the commit recorded in `.esoul/template.json`.

## The delta of an entry

`template-<variant>` holds one commit per app-templates commit that changed the variant, its tree being the exact build and its body `Built from app-templates commit <sha>.` The state at a source commit is therefore the publish commit of the nearest source commit at or before it (a source commit that changed nothing in the variant has no publish commit):

```bash
state() { # <source sha> -> publish commit in $TV; empty when no earlier publish exists
  git -C "$AT" rev-list "$1" | while read -r s; do
    p=$(git -C "$TV" log main -1 --format=%H --fixed-strings --grep="Built from app-templates commit $s")
    [ -n "$p" ] && { echo "$p"; break; }
  done
}
```

The delta of entry `i` is `git -C "$TV" diff "$(state c_{i-1})" "$(state c_i)"`: the deltas of all entries add up to `base..main`, so no change reaches the project without an entry that names it. `state c_0` is the base tree. Both states equal: the entry changes no files (documentation or builder entry); only its `Migration:` applies. No publish commit at or before `c_0`: the project predates the published variant; use [adopt.md](adopt.md), "commit: null".

A `notApplicable` entry with a non-empty delta is shown to the user and treated as applicable; its `Affects:` was incomplete.

## Merge into the project

For every file in the delta (`git -C "$TV" diff --name-status -M <from> <to>`), `<from>` is the base side, `<to>` the template side, the project file is "ours":

| Delta | Action |
| --- | --- |
| Modified | `git show <from>:<path> > base`, `git show <to>:<path> > theirs`, then `git merge-file -p "$PROJECT/<path>" base theirs > merged`; write `merged` back. Exit status 0 clean, above 0 is the number of conflicts |
| Added | Absent in the project: copy it. Present and identical: nothing. Present and different: a conflict (the project made its own) |
| Deleted | Project file equals the base: delete it. It differs: a conflict, keep it |
| Renamed | Apply the rename when the project still has the old file unchanged; otherwise a conflict |

The variant root is the project root; a project that moved the file reports a conflict for it. Binary files and `.esoul/template.json` are not merged (`.esoul/template.json` is written in the record step). Skip generated files: `docs/project_guidelines/`, the guidelines block of `AGENTS.md`, `esoul-guidelines.lock` and lock files come from `esoul-guidelines sync` and the package manager after the manifest change.

Conflicts: keep the project side (`git merge-file --ours`), do not leave markers. Record each as `<path>: <what the template changed, what the project kept>`; the entry's status is then `conflict`, its commit is still made, and a later run offers the entry again, merging cleanly whatever already landed. When keeping the project side would break the entry's intent (the migration note needs the template's version), stop that entry, tell the user, and set `skipped` with the reason.

## Migration notes

Read the entry's `Migration:` before the commit and do each action that belongs in the repository: files to copy or edit by hand, commands (`php artisan migrate` is a deploy action: list it in the Deploy notes, do not run it), configuration keys to add to `.env.example` and the deployment documentation. An action that needs a decision of the owner, a secret, a remote system or an installed tool is not done: the entry is `skipped` with that reason, or `applied` with the action under Deploy notes when the repository part is complete.

Guidelines versions: an entry that renders a newer `esoul-cz/guidelines` (its title says "Render guidelines x.y.z") has the migration `composer update esoul-cz/guidelines`, then `esoul-guidelines sync`, then committing the changed `AGENTS.md`, `esoul-guidelines.lock` and `docs/project_guidelines/`. Projects without Composer (the Astro variants) run the installer by one of the routes in the guidelines' `README.md`; ask before installing it.

## Commit

One commit per entry through `gitmoji-commit`: subject `:arrow_up: [template] <entry title>`, body one line per conflict or unfinished migration action. Stage only files this entry touched. An entry with nothing to change makes no commit.

## Statuses for `record`

| Status | When |
| --- | --- |
| `applied` | delta merged without keeping the project side, migration actions done or listed under Deploy notes; also when everything was already present |
| `conflict` | at least one file kept the project side |
| `skipped` | the entry was not applied (decision, secret, tool, remote action, breaking project customisation); reason recorded |
| `not-applicable` | the entry does not touch the project (from the `notApplicable` list, empty delta) |
