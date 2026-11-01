---
name: test-queue
description: Shared queue (`testq`) that stops parallel agent sessions on one machine from running test suites, E2E, mutation tests and builds all at once and driving it into swap. Installs the CLI, a Claude Code hook that queues test commands, and a macOS menu bar widget. Use when installing or tuning the queue or widget, when tests time out because several sessions run them together, when output contains `[testq]`, or when the user asks about machine load or the TestQ widget.
---

# Test queue

`testq` is one queue for all agent sessions on the machine. It lets cheap checks run at once, admits test suites and builds in a limited number, runs E2E and mutation testing one at a time, and starts nothing new while memory is short.

Read [references/setup.md](references/setup.md) when installing, updating or tuning the queue or widget, or when the user asks why it exists. It holds the motivation, the parts table, install steps, tuning and the CLI cheat sheet (`testq status`, `doctor`, `history`, `config`, `stop`). Installing changes global user configuration, so do it only when the user asks.

## Working in a session with the queue

- **Do not remove or bypass the prefix.** The hook rewrites commands like
  `docker compose exec app php artisan test` into
  `~/.local/bin/testq run -c medium -- docker compose exec app php artisan test`.
  Bypass it with `TESTQ_BYPASS=1` only when the user asks.
- Run full suites, E2E and mutation tests with `run_in_background`. Time spent waiting in the
  queue otherwise counts towards the Bash tool timeout. Wait for the completion notification
  instead of polling with `sleep`. Delegate the run to `esoul-skills:test-runner`, so the main
  session does not hold context while it waits.
- Prefer targeted runs: a single test file or `--filter` is `light` and does not wait.
- `[testq] waiting (...)` on stderr is queue state, not an error. `testq status` shows what
  the job waits for. Do not start the same suite again because it waits.
- The exit code is the command's own. `143` means someone stopped the run from the widget
  or with `testq stop`.
- Waiting in the queue costs no tokens. What costs usage is a main session that stays open and polls, so run long suites in the background through `test-runner`.

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
