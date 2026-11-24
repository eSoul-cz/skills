<!-- esoul-skills:begin -->
# eSoul usage rules (esoul-skills)

These rules are an optional convenience installed by `node codex/install.mjs`; the skills work without it (skill `esoul-model-routing` describes the same delegation by job).

- Give every subagent an explicit model (`gpt-6-luna` for search and runs, `gpt-6.1-terra` for implementation and review); an installed custom agent pins its own. Never spawn an agent that copies the whole conversation. Search with the `scout` agent, not the built-in explorer.
- Size S: do it directly.
- After two failed worker attempts, take over yourself.
- Session title: a cheap model names the session from the first exchange, so when the session works on a GitHub issue or a Freelo task, start the first reply with the line `#<issue number> <issue title>` (Freelo-only work: `Freelo <task id> <task title>`), shortened to about 60 characters. Look the title up first if the prompt gives only a number or a link.

Details: skill `esoul-model-routing` (optional helpers layer).
<!-- esoul-skills:end -->
