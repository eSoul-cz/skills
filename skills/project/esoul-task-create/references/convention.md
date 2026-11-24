# Recording the tasking convention

Record the chosen mode and the title language in this compact form (the example shows `freelo-only` and English titles; write `github-freelo` or `czech` when those are chosen):

```md
## Tasking convention

Use the `esoul-task-create` skill for task authoring.

- Mode: `freelo-only`
- Title language: `english`
```

`Title language` is `english` for a new project and `czech` for an existing Czech project; what each means for the issue, task and PR titles is in [task-content.md](task-content.md) › Title. A section without the line: read the language of the project's existing issue and task titles; when that does not decide, ask once and add the line.

Create root `CONTEXT.md` if absent; write conventions only there, never to `GLOSSARY.md`. When updating a tasking section found only in the `GLOSSARY.md` fallback, move it into `CONTEXT.md` instead of duplicating it. Keep edits idempotent; preserve unrelated sections, the separate `## Freelo` mapping, and any additional applicable tasking rules. Leave exactly one tasking section. If the authoritative instructions are ambiguous or contain an unsupported mode, ask rather than inventing a mapping. Without a repository root or a writable context file, report the missing prerequisite instead of choosing a global configuration location.

Invocation authorizes synchronization of an existing authoritative convention. The first mode confirmation authorizes only its standardized context edit, not GitHub or Freelo writes. Report any context edit before the task preview. Recording the convention is allowed in any pull request as its own commit that the pull request description mentions; committing needs the user's request, so the skill running is not a reason to commit.

### Per-request overrides

An explicit request may override the stored mode for the current run without modifying `CONTEXT.md` or `GLOSSARY.md`. Show the stored mode, the effective mode, and the reason in the preview. Ask if it is unclear whether the user intends a one-off override or a permanent change; persist only what the user states. Honor a repository rule that explicitly prohibits overrides.

Persist a different mode only when the user explicitly requests a project-policy change. If `AGENTS.md` defines the old mode, explain the conflict and resolve the authoritative policy with the user before synchronizing it; the rule lives in `AGENTS.md`, so `CONTEXT.md` follows it.
