# Stack profile: LSR

PHP application on the LSR packages (`lsr/*`), served by RoadRunner, with an Inertia and Vue
frontend. The rules live in the guideline layer `framework/lsr` (`architecture.md`, `frontend.md`,
`tools.md`, `testing.md`, `deployment.md`), plus `package/lsr-cqrs` when `lsr/cqrs` is installed
and `package/inertia-vue`, rendered into the project's `docs/project_guidelines/`. This profile
holds only the bootstrap specifics. Examples: `esoul-internal`, `code-hunt-game`.

## When this profile applies

`composer.json` requires `lsr/core` (usually also `lsr/routing`, `lsr/roadrunner`, `lsr/inertia`);
a `.rr.yaml` at the root. Record `Stack: lsr` in `CONTEXT.md › ## Project profile`. The process
tier follows the product: `full` for an application with domain logic.

## Bootstrap specifics

On top of the root files and the docs tree ([bootstrap.md](../bootstrap.md)):

1. Start from the published template variant `lsr-inertia`
   ([root-files.md](../root-files.md) explains how to read a `template-<variant>` repository).
   It carries the RoadRunner and Docker setup, the `/up` health route, the Vite, Tailwind and
   shadcn-vue frontend, strict static analysis, the network guard of the tests and a `Jenkinsfile` on
   the `lsrPipeline` step; do not rebuild them by hand. The template ships no locks: run
   `composer install && pnpm install` and commit both locks right after creating the project.
2. `esoul-guidelines init` detects `lsr/core`, `lsr/cqrs` and the Inertia packages; confirm the
   layers and add `package/mutation-testing` when the project uses Infection
   (skill `esoul-guidelines`). It is a PHP project: `composer require --dev
   esoul-cz/guidelines` and the `post-update-cmd` entry `esoul-guidelines sync`.
3. Optional LSR modules (`lsr/auth`, `lsr/otel`, others) get their own `package/lsr-<module>`
   layer only where one exists; `framework/lsr` never describes an optional module.
4. Agent context: vendored skills in `.agents/skills/` with `.claude/skills/<name>` symlinks,
   pinned in `skills-lock.json`; MCP servers as for the Laravel profile where they apply. There is
   no Laravel Boost.
5. The business time zone goes into `CONTEXT.md`; the application clock stays UTC (`tools.md` and
   `architecture.md` of the layer).

## Development handover checklist

- [ ] Jenkins green on the scaffold with the checks of `tools.md` plus `esoul-guidelines check`,
      required check `Jenkins` in the ruleset.
- [ ] `composer.lock` and `pnpm-lock.yaml` committed (the Docker build needs both).
- [ ] The checks of `tools.md` pass (static analysis without a baseline, code style, tests and the
      frontend checks).
- [ ] `GET /up` answers 200 and the compose smoke test passes.
- [ ] Tests run with the network guard and no external system on.
- [ ] One reference slice implemented end to end that agents copy.
- [ ] Anonymized data for local work; agents never get a real dump by default.

## Pitfalls

- Locks missing after creating a project from the template: the Docker build fails until
  both are committed.
- Per-request data in memoized or static worker state: correctness must not depend on the
  recycling by `max_jobs` (`architecture.md › Long-running worker state`).
- `lsr/*` documentation newer than the locked versions: read the installed `vendor/lsr/*` source
  before concluding that a feature is unavailable.
