# Convention bootstrap

Read this when `AGENTS.md` and `CONTEXT.md` disagree about the commit convention, or when none is recorded. Write conventions only to `CONTEXT.md`.

When `AGENTS.md` defines a commit convention:

- copy only that convention into the root `CONTEXT.md` under `## Commit convention`, creating the file if absent;
- move a commit-convention section found only in the `GLOSSARY.md` fallback into `CONTEXT.md` instead of duplicating it;
- replace a conflicting commit-convention section while preserving all unrelated context;
- make the edit idempotent;
- commit this synchronization on its own, using the effective `AGENTS.md` convention, and mention it in the pull request description (recording a missing convention is allowed in any pull request as its own commit);
- follow that convention, not Gitmoji, unless the developer stated their own standard (the recorded convention is a recommendation).

When only `CONTEXT.md` or its `GLOSSARY.md` fallback defines a different convention, recommend it the same way and do not overwrite it.

When nothing defines a convention and the developer stated none, create or update the root `CONTEXT.md` with this block, preserving all existing content:

````md
## Commit convention

Use `gitmoji-commit`; format: `docs/project_guidelines/workflow.md` › Commits
````

Commit that policy on its own before the task commits, and mention it in the pull request description:

```text
:memo: [git] Define gitmoji commit convention
```
