# eSoul usage rules (esoul-skills plugin)

These rules are an optional convenience of the `esoul-skills` plugin; the skills work without it (skill `esoul-model-routing` describes the same delegation by job).

- Give every subagent an explicit `model` (`haiku` for search and runs, `sonnet` for implementation and review); an `esoul-skills:*` agent pins its own. Never start a fork. Search with `esoul-skills:scout`, never Explore, which runs on the session model.
- Size S: do it directly.
- After two failed worker attempts, take over yourself.
- Session title: a cheap model names the session from the first exchange, so when the session works on a GitHub issue or a Freelo task, start the first reply with the line `#<issue number> <issue title>` (Freelo-only work: `Freelo <task id> <task title>`), shortened to about 60 characters. Look the title up first if the prompt gives only a number or a link.

Details: skill `esoul-model-routing` (optional helpers layer).
