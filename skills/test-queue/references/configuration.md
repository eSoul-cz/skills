# Configuration, widget and tuning

## Settings

Effective configuration = built-in defaults ← limits tuned for the machine ← `~/.local/state/testq/config.json`.
`testq init` writes the tuned values into the file so the CLI and the widget show the same
numbers. Change a value with `testq config KEY VALUE` (dotted keys for nested values) or in
the widget. Every waiting job re-reads the file each poll (1.5 s), so changes apply at once,
without restarting anything.

| Key | Default (16 GB, 8 cores) | Meaning | When to change |
|---|---|---|---|
| `enabled` | `true` | Off: `testq run` runs immediately and the hook rewrites nothing. | Temporary switch-off, e.g. a demo on a quiet machine. |
| `paused` | `false` | No new job starts; running jobs finish. | Free the machine for a call or a build of your own. |
| `max.heavy` | 1 | Concurrent heavy jobs (E2E, mutation). | 2 on 32 GB+ once `doctor` shows long heavy waits with free memory. |
| `max.medium` | 2 | Concurrent medium jobs (suites, builds). | Raise when medium waits are long and memory stays above ~40 %. |
| `max.light` | 4 | Concurrent light jobs. | Rarely; lower on 8 GB machines. |
| `budget` | 8 | Shared capacity of medium + heavy jobs, using their weights. Never lower than each class limit alone needs (`max.heavy` 2 × weight 5 = 10); testq raises it to that. | Lower it to stop heavy and medium jobs from running side by side; raise it to allow more of them together. |
| `weights.{light,medium,heavy}` | 1 / 3 / 5 | Cost of a job against the budget. | Make heavy 6–8 when E2E runs several browsers per worker. |
| `mem_min_level` | 20 | Percent of RAM that must be available to start another medium/heavy job (macOS `kern.memorystatus_level`, Linux `MemAvailable`). A job always starts when nothing else runs. | Raise to 30 when swap keeps growing; lower to 10–15 on 64 GB machines. |
| `max_load` | 0 (off) | Optional load-average gate for medium/heavy starts. | Leave off on macOS: load counts threads stuck on swap and lags behind memory. |
| `settle_seconds` | 15 | Minimum gap between two medium/heavy starts, so memory readings catch up with the job that just started. | Raise to 30 for suites with slow container start-up. |
| `workers` | 2 | Worker cap injected into each run: `--workers` (Playwright), `--threads` (Infection), `--maxWorkers` (Jest), `--processes` (Pest/Paratest `--parallel`), `VITEST_MAX_THREADS`/`_FORKS`. Explicit flags in the command win. | 1 on 8 GB; 3–4 on 32 GB+ with heavy limit 1. |
| `nice` | 5 | Niceness of queued commands; keeps the desktop and the agents responsive. | 0 to disable. Processes inside Docker are not affected. |

Limits tuned by `testq init` (cores only set `workers` and `max.light`):

| RAM | heavy | medium | budget | workers |
|---|---|---|---|---|
| < 12 GB | 1 | 1 | 5 | cores / 4 (1–4) |
| 12–23 GB | 1 | 2 | 8 | ″ |
| 24–47 GB | 2 | 3 | 12 | ″ |
| ≥ 48 GB | 2 | 4 | 16 | ″ |

## Menu bar widget

Click the test-tube icon. The number next to it is `running·waiting`. A warning triangle
replaces the icon when memory or swap use is above 85 %, and a pause icon shows while the
queue is paused.

- **Rings**: CPU, memory in use (100 − available %), swap in use, load average. Green, orange
  and red follow the same thresholds as `testq doctor`.
- **Running / Waiting**: class badge (T heavy, S medium, L light), project, command, time, the
  estimate (time left, or expected start and run time; the tooltip names its source), a
  stop button. The waiting header shows when the whole queue should be empty. Stopping a waiting job cancels it; stopping a running one terminates its
  whole process tree (exit 143 for the agent).
- **Controls**: Pause/Resume, the queue on/off switch, and steppers for `max.heavy`,
  `max.medium`, `max.light`, `weights.heavy`, `weights.medium`, `budget`, `mem_min_level` and
  `workers`.
  They write `config.json`. The budget shows the value testq uses and cannot go below what the
  class limits need. Below it, the widget shows how much of the budget running jobs use and
  which mixes fit at once (for example `2S · 1T+1S · 2T`).
- **Docker VM (Colima)**, shown only when a Colima profile exists: the VM memory with a
  stepper (2 GB up to RAM − 2 GB) and a **Restart** button. After a confirmation it runs
  `testq vm restart --memory N` (see below) and shows each phase; the last result or error
  stays visible.
- **Recently finished**: exit status, wait and run time of the last jobs.
- **Open data** opens `~/.local/state/testq`; **Quit widget** stops the app until the next
  login (`launchctl kickstart gui/$(id -u)/cz.esoul.testq` starts it again).

The popup scrolls when a long queue would not fit on the screen.

The widget reads the state files, sends signals and asks `testq status --json` for estimates
every 10 s; the queue works without it.

## Estimates

`testq status` (and `--json`, which the widget reads) shows how long each job should still
run or when it should start. A job's run time is the median of the last runs of the same
command (label) in the same project, else of the same class in the project, else of the class
anywhere, else 1 / 5 / 15 min for light / medium / heavy. Runs stopped with exit 130/143 do
not count. Start times replay the admission rules (limits, budget, order, settle time) with
these run times. The memory and load gates cannot be predicted, so on a machine short of
RAM the estimate is optimistic.

## `testq doctor`

Prints the hardware, current versus tuned limits, the queue state, whether the hook and the
widget are installed, memory, swap and load, the Docker VM memory and the number of running
containers. It also prints the median and longest waits per class from the history. Then it
lists suggestions:

- swap above a quarter of RAM: the machine is overcommitted, so free memory before raising limits;
- Colima or Docker Desktop reserving more than ~30 % of RAM: lower it to about 25 %;
- more than 8 running containers: stop stacks of projects not being worked on;
- medium/heavy median wait over 5 minutes while memory is free: raise that class's limit;
- missing hook, paused or disabled queue.

## Resizing Colima: `testq vm`

`testq vm` prints the Colima profile's memory and CPUs and the result of the last resize.
`testq vm restart [--memory GB] [--cpus N] [--profile P]` then:

1. refuses while queued jobs run, unless `--force` (they would lose their containers);
2. pauses the queue, so no test starts against a stopping VM;
3. records the running containers (`docker ps -q`);
4. runs `colima stop`, sets `memory`/`cpu` in `~/.colima/<profile>/colima.yaml` (other
   settings stay), and runs `colima start`;
5. starts the recorded containers again. Containers that exit right away, for example an
   nginx started before its upstream, get two more attempts. `docker start` does not follow
   compose dependencies.
6. restores the queue's previous paused state and writes the outcome to `vm.json`.

Expect about a minute without containers. Dev servers and database connections of running
sessions drop, while data in containers and volumes is kept. Only Colima is supported;
Docker Desktop has no CLI for its memory setting.

## Optimizing the machine

The queue keeps sessions from hurting each other. These steps add capacity:

1. **Docker VM memory.** Colima and Docker Desktop reserve their memory up front, and the
   host gets it back only when the VM restarts, not when containers stop. Size it from what
   the containers really use: `docker stats --no-stream` plus about 0.6 GB for the VM's
   kernel and Docker, plus headroom for tests. The VM has no swap, so when it runs out,
   Linux kills a process inside (often Elasticsearch or MySQL). On 16 GB, 4–5 GB fits a few
   PHP/MySQL stacks; an Elasticsearch + Kibana stack alone needs about 2 GB.
   For Colima use the widget or `testq vm restart --memory N`; for Docker Desktop use
   Settings › Resources.
2. **Idle stacks.** Each running project stack (database, Redis, queue workers, Node dev
   server) holds memory even when idle. `docker compose stop` the ones you are not using.
3. **Idle sessions and browsers.** Every agent session, MCP server and Chrome profile costs
   memory. Close the ones you are not using.
4. **Test settings.** Keep Xdebug off for test runs (`XDEBUG_MODE=off`), prefer targeted test
   files while iterating, and keep `workers` low rather than raising concurrency.
5. **Check after changes.** Run `testq doctor` and watch the swap ring: it should shrink and
   stay low.

## Other agents

Claude Code gets the hook. For Codex or other harnesses, add this to the global or project
agent instructions (for example `AGENTS.md`):

```md
## Test queue
This machine runs a shared test queue. Run test suites, E2E, mutation tests and builds
through it: `~/.local/bin/testq run -c <light|medium|heavy> -- <command>` (light: a single
test file or lint; medium: a full suite or build; heavy: Playwright, Infection, Dusk).
Lines starting with `[testq]` are queue status, not errors.
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Commands are not rewritten | Session started before the install: restart it. Check `testq doctor` (hook installed, queue enabled). |
| Test commands ask for approval again | Permission rules match the rewritten command; approve once or add a rule for the rewritten form. |
| A job stays "running" after its agent is gone | Liveness is checked by PID; stop it with `testq stop <id>` or from the widget. Entries of dead processes disappear on the next check. |
| A command is classified wrongly | `testq rewrite '<cmd>'` shows the decision; see [classification.md](classification.md). Force a class with `testq run -c <class> -- <cmd>`. |
| Everything waits on "low free memory" | Something outside the queue uses the RAM. Free memory, or temporarily lower `mem_min_level`. A job still starts when nothing else in the queue runs. |
| The widget does not show | The menu bar may be full (the notch hides items). Check `launchctl print gui/$(id -u)/cz.esoul.testq`; re-run the installer. |
