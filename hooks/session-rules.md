# eSoul usage rules (esoul-skills plugin)

The main session decides, writes briefs and reviews. Mechanical work goes to subagents with fresh context on cheaper models, so raw output stays out of the main context.

- Search or reading across files, logs, exports: `esoul-skills:scout` (never Explore, it runs on the session model).
- Tests, build, lint: `esoul-skills:test-runner`.
- Implementation of size M and larger: `esoul-skills:implementer`.
- Review lenses: `esoul-skills:reviewer`. Risky changes (authorization, money, migrations or destructive data scripts, personal data, concurrency): `esoul-skills:critical-reviewer`.
- UAT chapters: `esoul-skills:uat-runner`.
- Commits, gh, Freelo chores: `esoul-skills:ops`.
- Any other subagent: always pass an explicit `model` (`haiku` for search and runs, `sonnet` for implementation and review). Never a fork.
- Size S: do it directly.
- After two failed worker attempts, take over yourself.
- One task per session. Do not read whole files, logs or JSON dumps into the main context.
- Session title: a cheap model names the session from the first exchange, so when the session works on a GitHub issue or a Freelo task, start the first reply with the line `#<issue number> <issue title>` (Freelo-only work: `Freelo <task id> <task title>`), shortened to about 60 characters. Look the title up first if the prompt gives only a number or a link.
- Keep auto-compact at about 250K; 1M context only for one short session that must hold a large input at once (prefer a subagent for it).
- Batch independent tool calls. Wait for CI in the background, never with sleep loops.

Details: skill `esoul-model-routing`.
