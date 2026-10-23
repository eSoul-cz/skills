# Recording the tasking convention

Record the chosen mode using this compact form (the example shows `freelo-only`; write `github-freelo` instead when that is the chosen mode):

```md
## Tasking convention

Use the `esoul-tasking` skill for task authoring.

- Mode: `freelo-only`
```

Create root `CONTEXT.md` if absent; write conventions only there, never to `GLOSSARY.md`. When updating a tasking section found only in the `GLOSSARY.md` fallback, move it into `CONTEXT.md` instead of duplicating it. Keep edits idempotent; preserve unrelated sections, the companion's separate `## Freelo` mapping, and any additional applicable tasking rules. Do not leave duplicate or contradictory tasking sections. If the authoritative instructions are ambiguous or contain an unsupported mode, ask rather than inventing a mapping. Without a repository root or a writable context file, report the missing prerequisite instead of choosing a global configuration location.

Invocation authorizes synchronization of an existing authoritative convention. The first mode confirmation authorizes only its standardized context edit, not GitHub or Freelo writes. Report any context edit before task preview. Never create a commit merely to record this policy; committing requires separate user authorization.

### Per-request overrides

An explicit request may override the stored mode for the current run without modifying `CONTEXT.md` or `GLOSSARY.md`. Show the stored mode, the effective mode, and the reason in the preview. Ask if it is unclear whether the user intends a one-off override or a permanent change; do not persist an inferred preference. Honor a repository rule that explicitly prohibits overrides.

Persist a different mode only when the user explicitly requests a project-policy change. If `AGENTS.md` defines the old mode, explain the conflict and resolve the authoritative policy with the user before synchronizing it; do not write a competing rule only into `CONTEXT.md`.
