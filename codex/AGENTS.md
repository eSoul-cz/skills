<!-- esoul-skills:begin -->
# eSoul usage rules (esoul-skills)

These agents and rules are an optional convenience installed by `node codex/install.mjs`; the skills work without them (skill `esoul-model-routing` describes the same delegation by job).

The main session decides, writes briefs and reviews. Mechanical work goes to custom agents (installed in `~/.codex/agents`) with fresh context on cheaper models, so raw output stays out of the main context.

- Search or reading across files, logs, exports: agent `scout` (prefer it over the built-in explorer).
- Tests, build, lint: `test-runner`.
- Implementation of size M and larger: `implementer`.
- Review lenses: `reviewer`. Risky changes (authorization, money, migrations or destructive data scripts, personal data, concurrency): `critical-reviewer`.
- UAT chapters: `uat-runner`.
- Commits, gh, Freelo chores: `ops`.
- Any other subagent: set a cheap model explicitly (`gpt-6-luna` for search and runs, `gpt-6.1-terra` for implementation and review). Do not spawn agents that copy the whole conversation.
- Main session: `gpt-6.1-sol` at medium effort. Raise effort per task (high for planning, xhigh for L or security work). Use `gpt-6-astra` only by exception, it is very expensive.
- Size S: do it directly.
- After two failed worker attempts, take over yourself.
- One task per session. Do not read whole files, logs or JSON dumps into the main context.
- Session title: a cheap model names the session from the first exchange, so when the session works on a GitHub issue or a Freelo task, start the first reply with the line `#<issue number> <issue title>` (Freelo-only work: `Freelo <task id> <task title>`), shortened to about 60 characters. Look the title up first if the prompt gives only a number or a link.
- Batch independent tool calls. Wait for CI in the background, never with sleep loops.

Details: skill `esoul-model-routing` (optional helpers layer).
<!-- esoul-skills:end -->
