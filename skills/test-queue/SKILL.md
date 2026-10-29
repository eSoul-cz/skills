---
name: test-queue
description: Shared queue (`testq`) that stops parallel agent sessions on one machine from running test suites, E2E, mutation tests and builds all at once and driving it into swap. Installs the CLI, a Claude Code hook that queues test commands, and a macOS menu bar widget. Use when installing or tuning the queue or widget, when tests time out because several sessions run them together, when output contains `[testq]`, or when the user asks about machine load or the TestQ widget.
---

# Test queue

Several agent sessions on one laptop each start `phpunit`, Playwright, Infection or a build,
every tool spawns one worker per core, and a 16 GB machine ends up swapping with a load of
several hundred: tests time out and everything crawls. `testq` is one queue for all sessions
on the machine. It lets cheap checks run at once, admits test suites and builds in a limited
number, runs E2E and mutation testing one at a time, and starts nothing new while memory is
short.

## Parts

| Part | Where | Role |
|---|---|---|
| `testq` CLI (Python 3.8+, no dependencies) | `~/.local/bin/testq` | Queue, limits, status, history, `doctor` |
| Claude Code hook | `~/.claude/settings.json`, PreToolUse `Bash` | Prefixes test and build commands with `testq run -c <class> --` and caps their worker count |
| TestQ menu bar widget (macOS) | `~/Applications/TestQ.app`, LaunchAgent `cz.esoul.testq` | Rings for CPU, memory, swap and load; running and waiting jobs with stop buttons; pause, on/off and limits; Colima memory with a restart button |
| State | `~/.local/state/testq/` | `config.json`, `jobs/`, `history.jsonl`, shared by all of the above |

## Install, update, remove

Installing changes global user configuration (Claude settings, a login item), so do it only
when the user asks for it. Resolve `SKILL_DIR` to this skill's installed directory, then:

```sh
sh "$SKILL_DIR/scripts/install.sh"               # CLI + hook + widget
sh "$SKILL_DIR/scripts/install.sh" --no-widget   # without the menu bar app (always on Linux)
sh "$SKILL_DIR/scripts/install.sh" --no-hook     # queue only when called as `testq run`
sh "$SKILL_DIR/scripts/install.sh" --uninstall   # remove everything; add --purge to drop state
```

- The installer copies the CLI to `~/.local/share/testq`, so plugin updates do not change
  the installed version. **Re-run it after the skill updates.**
- It writes limits tuned to the machine's RAM and cores (`testq init`) and keeps values the
  user already set.
- It merges the hook into existing settings and keeps a `settings.json.bak-testq` backup.
- The widget build needs `swiftc` (Xcode Command Line Tools); without it the installer
  skips the widget and says so.
- Only **new** Claude Code sessions load the hook. Tell the user to restart running ones.
- Finish with `testq doctor` and report what it says.

## Working in a session with the queue

- **Do not remove or bypass the prefix.** The hook rewrites commands like
  `docker compose exec app php artisan test` into
  `~/.local/bin/testq run -c medium -- docker compose exec app php artisan test`.
  Bypass it with `TESTQ_BYPASS=1` only when the user asks.
- Run full suites, E2E and mutation tests with `run_in_background`. Time spent waiting in the
  queue otherwise counts towards the Bash tool timeout. Wait for the completion notification
  instead of polling with `sleep`.
- Prefer targeted runs: a single test file or `--filter` is `light` and does not wait.
- `[testq] waiting (...)` on stderr is queue state, not an error. `testq status` shows what
  the job waits for. Do not start the same suite again because it waits.
- The exit code is the command's own. `143` means someone stopped the run from the widget
  or with `testq stop`.
- Waiting in the queue is not billable work.

## Classes

| Class | Typical commands | Default weight / limit (16 GB) |
|---|---|---|
| `light` | lint, phpstan, tsc, a single test file, `--filter`, `-t` | 1 / 4, ignores the budget and memory gate |
| `medium` | full `phpunit` / `artisan test` / `pest` / `vitest` / `jest` suite, `pnpm test`, `composer test`, `astro`/`vite`/`nuxt` build | 3 / 2 |
| `heavy` | Playwright, Infection, Dusk, Cypress, Stryker, scripts named `*e2e*`, `*mutat*` | 5 / 1 |

Medium and heavy jobs share a budget (8 on 16 GB): one heavy plus one medium, or two medium. The
budget never blocks a class limit on its own: `max.heavy 2` admits two heavy jobs.
Within a class jobs start in arrival order. A job may overtake only an earlier job of another
class that is blocked by its own class limit. The full detection rules and how to extend
them are in [references/classification.md](references/classification.md).

## Tuning

All settings, the widget controls, `testq doctor` checks and the machine-level
optimizations (Docker VM memory, idle stacks, worker counts) are described in
[references/configuration.md](references/configuration.md). Quick reference:

```sh
testq status              # running and waiting jobs with estimates, free memory, swap, load
testq doctor              # setup check plus concrete tuning suggestions
testq history 20          # finished jobs with wait and run time and exit code
testq config max.heavy 2  # change a limit (also from the widget)
testq init --force        # reset limits to the values tuned for this machine
testq pause | resume      # stop / allow new starts; running jobs continue
testq enable | disable    # turn the queue and the hook on or off
testq stop <id>           # stop a running job or cancel a waiting one
testq rewrite '<cmd>'     # show how the hook would rewrite a command
testq vm restart --memory 5  # resize Colima, restart its containers (also in the widget)
```

## Limits

- The hook only covers Claude Code. Other harnesses (Codex and others) must call
  `testq run -c <class> -- <cmd>` themselves. Add the snippet from
  [references/configuration.md](references/configuration.md#other-agents) to the agent's
  instructions.
- Claude Code checks permissions on the **rewritten** command. A rule such as
  `Bash(pnpm test:*)` does not match `~/.local/bin/testq run -c medium -- pnpm test`, so
  such a command asks for approval again.
- Stopping a `docker compose exec` job ends the client. The process inside the container
  may finish on its own.
- Tests: `python3 -m unittest discover -s skills/test-queue/scripts -p 'test_*.py'`.
