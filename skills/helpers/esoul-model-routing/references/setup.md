# Human setup: models, settings, Zeron, Codex

Machine and account setup for the routing in `SKILL.md`. Each step names who acts: **person** (the agent cannot do it: it edits user settings, types session commands or operates a GUI), **agent** (the agent can do it when asked). Model names here are aliases; exact model ids and prices come from the provider's documentation.

## Models

| Alias | Default effort | Use for |
|---|---|---|
| `fable` | `high` | The hardest, longest, most autonomous jobs when `opus` at `xhigh` falls short |
| `opus` | `medium` | Orchestration, design, review of risky changes |
| `sonnet` | `medium` | Implementation, tests, reviews, UAT runs; whole S sessions |
| `haiku` | `medium` | Search, running commands, extraction, chores |

- `best` resolves to `fable` where available, otherwise `opus`; use it in shared instructions so colleagues without `fable` fall back automatically.
- Availability differs per person and organization. If a model is refused, take the next one down and say which model actually ran.
- Effort tunes thinking, not the model: try `opus` at `high` or `xhigh` before `fable`.
- The advisor feature (`/advisor opus` on a `sonnet` session) is experimental and each consultation re-reads the conversation uncached; try it for S and M work in short sessions only.
- **person:** set the session model and effort with `/model sonnet|opus|haiku|fable|best` and `/effort low|medium|high|xhigh|max`. Never save `xhigh` as a model's default (every turn, including commits and lookups, then pays for the deepest reasoning); raise it per session, and treat `max` as a one-off.

## Settings (Claude Code)

**person:** edit, or approve the agent's edit of, `~/.claude/settings.json`:

```json
{
  "model": "opus",
  "modelSettings": {
    "<model id of the opus you use>": { "effortLevel": "medium", "autoCompactWindow": 250000 }
  },
  "env": { "CLAUDE_CODE_SUBAGENT_MODEL": "sonnet" },
  "permissions": { "deny": ["Agent(fork)"] }
}
```

- Add one `modelSettings` entry per model you use as the main model (with `fable`: `effortLevel` `high`). The top-level `effortLevel` does not apply to the newest models; the per-model entry does.
- `autoCompactWindow` also caps 1M-context sessions (`[1m]` models, Zeron's 1M option). Raise it for one short session with `/autocompact 1m`, then set it back with `/autocompact 250k`.
- `CLAUDE_CODE_SUBAGENT_MODEL` is only the fallback for subagents that name no model; agent frontmatter and an explicit `model` win. Leave `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` and `CLAUDE_CODE_EFFORT_LEVEL` unset: they override every role.

## Optional plugin agents and hooks

The worker agents, the SessionStart rules hook and the PreToolUse guard exist only when the `esoul-skills` plugin is installed (Claude Code) or `node codex/install.mjs` was run (Codex). The skills work without them; `references/roles.md` carries the same role briefs.

- The SessionStart hook injects four short rules into every session (explicit model, never a fork, size S directly, take over after two failed attempts) and the session-title line; the PreToolUse guard denies Explore, forks, and general-purpose or Plan agents without a `model`. The worker is chosen by the agent descriptions and this skill, not by the hook. **person:** set `ESOUL_AGENT_GUARD=off` to disable the guard.
- `ops` is limited to shell, read and search tools, `Skill` and the Freelo MCP server (`mcp__freelo__*`, so the MCP server must be named `freelo`); `scout`, `reviewer` and `critical-reviewer` are read-only by their rules.

## Zeron

Zeron chats run the Claude Code harness with the same plugins and settings, so the roles work there too. Three specifics:

- **A chat's model, reasoning level and context window set in Zeron override `settings.json`:** Zeron starts Claude Code with `--model` and `--effort`, so `modelSettings` does not apply to Zeron chats.
  - **person:** keep Zeron's default for new chats at `opus` · `medium` · 200K and the title model on `haiku`.
  - Since Zeron 0.3.0 the new-chat defaults are whatever was last picked on the new-chat page; `~/.zeron/composer-defaults.json` is no longer read. A pick made for one chat (`high`, 1M) therefore becomes the default for every chat after it: **person:** set it back on the next new chat.
  - **person:** after every Zeron update open a new chat, check that the picker shows `opus` · Medium · 200K and pick them if not. **agent** (when asked): confirm the next chat runs that way (`list_chats` → `reasoning`, or `ps` shows `--effort medium` and no `[1m]` on the model).
  - 200K, not 1M, as the default: a 200K window compacts at about the same point as the 250K cap, and it cannot silently grow when a setting is bypassed. Pick 1M per chat only for the exception named in `SKILL.md`.
- **Titles name the work item.** The title model sees only the first exchange, cannot be given its own prompt, and an existing chat cannot be renamed through the tools. **agent:** when a chat works on a GitHub issue or a Freelo task, its first reply starts with `#<issue number> <issue title>` (Freelo-only work: `Freelo <task id> <task title>`), about 60 characters at most, with the title looked up first when the prompt gives only a number or a link. When creating a child chat, pass the same text as `title` to `create_chat`/`create_chats`.
- **Child chats** (`create_chat`/`create_chats`, one level deep) count toward the same limit, except work delegated to a non-Claude harness such as Codex, which uses that provider's quota.

## Codex

The roles map to Codex custom agents of the same name, generated from `agents/` in the eSoul skills repository; the model mapping is `MODELS` in `tooling/scripts/build_codex_agents.mjs`.

- **person:** from a clone of the eSoul skills repository run `node codex/install.mjs` (agents into `~/.codex/agents`, rules into `~/.codex/AGENTS.md`; `--dry-run` shows the changes) and merge `codex/config.toml` into `~/.codex/config.toml` by hand.
- Codex work counts against the OpenAI quota, not Claude's.
- A Codex custom agent file cannot set the sandbox, approvals or MCP servers; they come from the session. The read-only agents therefore only lose their connectors there, and `ops` has no tool list. **person:** start review sessions in a read-only sandbox when that matters.
