<!-- esoul-skills:begin -->
# eSoul usage rules (esoul-skills)

The main session decides, writes briefs and reviews. Mechanical work goes to custom agents (installed in `~/.codex/agents`) with fresh context on cheaper models, so raw output stays out of the main context.

- Search or reading across files, logs, exports: agent `scout` (prefer it over the built-in explorer).
- Tests, build, lint: `test-runner`.
- Implementation of size M and larger: `implementer`.
- Review lenses: `reviewer`. Risky changes (authorization, money, migrations, personal data, concurrency): `critical-reviewer`.
- UAT chapters: `uat-runner`.
- Commits, gh, Freelo chores: `ops`.
- Any other subagent: set a cheap model explicitly (`gpt-6-luna` for search and runs, `gpt-6.1-terra` for implementation and review). Do not spawn agents that copy the whole conversation.
- Main session: `gpt-6.1-sol` at medium effort. Raise effort per task (high for planning, xhigh for L or security work). Use `gpt-6-astra` only by exception, it is very expensive.
- Size S: do it directly.
- After two failed worker attempts, take over yourself.
- One task per session. Do not read whole files, logs or JSON dumps into the main context.
- Batch independent tool calls. Wait for CI in the background, never with sleep loops.

Details: skill `esoul-model-routing`.
<!-- esoul-skills:end -->
