# Command classification

The hook parses the Bash command (quotes, comments, heredocs, pipes, `&&`/`;`/`&`,
redirections, `$( )`) into simple commands. A simple command is considered only when its
command word, after env assignments and `time`/`nohup`/`exec`/`env`, is a known runner or
carrier (`docker`, `pnpm`, `npm`, `npx`, `yarn`, `bun`, `php`, `node`, `composer`, `make`,
`timeout`, `sh -c`, the test tools themselves…). Words inside quotes, heredoc bodies,
`grep`/`sed`/`git` arguments and file paths such as `vendor/infection/...` never trigger it.

`testq` is inserted **before** the simple command (after env assignments, `time` and
`nohup`, before `timeout`), so queue waiting never counts towards `timeout N`. Pipes and
redirections keep working.

## Rules (first match in the simple command wins)

| Pattern | Class | Injected flag (unless already set) |
|---|---|---|
| `playwright test` (not `--ui`, `--list`, `--debug`) | heavy | `--workers=N` after `test` |
| `cypress run`, `stryker run`, `artisan dusk` | heavy | — |
| `infection` / `infection.phar` | heavy | `--threads=N` |
| `artisan test`, `phpunit`, `pest`, `paratest` | light with a `.php` file or `--filter`, else medium | `--processes=N` after `--parallel`; always for `paratest` |
| `vitest` (not watch/UI/`list`) | light with a `*.spec/test.*` file or `-t`, else medium | `VITEST_MAX_THREADS/FORKS=N` env |
| `jest` (not watch) | light with a spec file or `-t`, else medium | `--maxWorkers=N` (skipped with `--runInBand`/`-i`/`-w`) |
| `pytest`, `python -m pytest` | light with a `.py` file or `::`, else medium | — |
| `go test`, `cargo test` | medium | — |
| `astro`/`vite`/`nuxt`/`nuxi`/`next`/`ng` `build`/`generate` | medium | — |
| `tsc`, `vue-tsc`, `svelte-check`, `astro check`, `phpstan`, `psalm`, `eslint` | light | — |
| `npm`/`pnpm`/`yarn`/`bun`/`composer` script, `make` target | by name: `*e2e*`, `*playwright*`, `*cypress*`, `*infection*`, `*mutat*`, `*stryker*`, `*dusk*` → heavy; `check`, `lint`, `typecheck`, `stan`, `analyse` → light; `test*`, `*:test`, `build*`, `generate`, `ci`, `qa`, `coverage` → medium | — |
| `pnpm exec …`, `npx …`, `pnpm dlx …`, `composer exec …` | classified by the wrapped tool | as for the tool |
| `sh -c "…"`, `bash -c "…"` | highest class found in the string | — |

Other package-manager commands (`install`, `add`, `dev`, `preview`, `start`) and long-running
servers are never queued, because they would hold a slot for hours.

## Not covered on purpose

- Scripts whose name hides what they run (`pnpm verify` running Playwright). Rename the
  script, or call it as `testq run -c heavy -- pnpm verify`.
- Nested runs: a command already inside `testq` (`TESTQ_JOB` set) runs immediately, so a
  `composer test` that calls `pnpm test` holds a single slot.

## Changing the rules

The rules live in `classify()` in `scripts/testq`. Add a case to `RewriteTest` in
`scripts/test_testq.py` first, then change the rule, run the tests, and re-run `install.sh`
so the installed copy picks it up.
