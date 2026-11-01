# Convention bootstrap

Read this when the repository has no commit convention, or `AGENTS.md` and `CONTEXT.md` conflict. Write conventions only to `CONTEXT.md`, never to `GLOSSARY.md`.

When `AGENTS.md` defines a commit convention:

- copy only that convention into the root `CONTEXT.md` under `## Commit convention`, creating the file if absent;
- move a commit-convention section found only in the `GLOSSARY.md` fallback into `CONTEXT.md` instead of duplicating it;
- replace a conflicting commit-convention section while preserving all unrelated context;
- make the edit idempotent;
- commit this context synchronization separately using the effective `AGENTS.md` convention;
- follow that convention, not Gitmoji, if it differs from this skill.

When only `CONTEXT.md` or its `GLOSSARY.md` fallback defines a different convention, respect it and do not overwrite it.

When none of these files defines a convention, create or update the root `CONTEXT.md` with this block, preserving all existing content:

````md
## Commit convention

Use the `gitmoji-commit` skill for normal agent-authored commits.

```text
:emoji: [optional-context] imperative message

optional explanatory details
```

Use one Gitmoji shortcode per commit and split commits by intention. Context is optional. Keep the complete subject line at 72 characters or fewer when practical.
````

Commit that policy separately before the task commits:

```text
:memo: [git] define gitmoji commit convention
```
