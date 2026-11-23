# Convention bootstrap

Read this when the repository has no commit convention, or `AGENTS.md` and `CONTEXT.md` conflict. Write conventions only to `CONTEXT.md`, never to `GLOSSARY.md`.

When `AGENTS.md` defines a commit convention:

- copy only that convention into the root `CONTEXT.md` under `## Commit convention`, creating the file if absent;
- move a commit-convention section found only in the `GLOSSARY.md` fallback into `CONTEXT.md` instead of duplicating it;
- replace a conflicting commit-convention section while preserving all unrelated context;
- make the edit idempotent;
- commit this context synchronization on its own, using the effective `AGENTS.md` convention, and mention it in the pull request description (recording a missing convention is allowed in any pull request as its own commit);
- follow that convention, not Gitmoji, if it differs from this skill.

When only `CONTEXT.md` or its `GLOSSARY.md` fallback defines a different convention, respect it and do not overwrite it.

When none of these files defines a convention, create or update the root `CONTEXT.md` with this block, preserving all existing content:

````md
## Commit convention

Use the `gitmoji-commit` skill for normal agent-authored commits.

```text
:sparkles: [checkout] Add delivery selection

optional explanatory details
```

Use one Gitmoji shortcode per commit and split commits by intention. Context is optional. The message is imperative and starts with an uppercase letter. Keep the complete subject line at 72 characters or fewer when practical.
````

Commit that policy on its own before the task commits, and mention it in the pull request description:

```text
:memo: [git] Define gitmoji commit convention
```
