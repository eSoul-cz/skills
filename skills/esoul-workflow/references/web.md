# Web applications

Applies to eSoul web applications and their frontends. Repository `AGENTS.md` / `CONTEXT.md` override everything here.

## Known stack (verify per repository)

- PHP 8.4 / 8.5, Laravel and Symfony applications, Composer.
- eSoul packages (GitHub `eSoul-cz/`): `cqrs` and `laravel-cqrs` (commands and queries), `laravel-ott-jwt`, `laravel-rabbitmq-roadrunner-driver`. Follow the existing command/query split when a project uses CQRS: writes go through commands and handlers, reads through queries. Do not call repositories directly from controllers if the project routes them through the bus.
- Runtime: Docker images from `eSoul-cz/ci-images` (PHP FPM, RoadRunner, Node 24/26/LTS, Playwright). CI runs in Jenkins (`Jenkinsfile`).
- Mockups live in the eSoul mockups module (`esoul-mockup-authoring`); desktop frame 1440px, mobile 390px.

## Before coding

1. Find how the project runs locally: `docker-compose*.yml`, `Makefile`, `composer.json` / `package.json` scripts, `README.md`. Use those commands; do not invent new ones.
2. Find the test, static-analysis, and style commands the CI actually runs (read the `Jenkinsfile`). Run the same ones locally.
3. For a change to existing behavior, map the blast radius first (`codegraph_explore "what calls <symbol>"` or Grep): routes, jobs, listeners, and scheduled commands that reach it.

## Building

- Backend: keep controllers thin; put rules in domain services, handlers, or models as the project already does. Validate input at the boundary (form requests / validators). Every schema change is a migration, reversible where the project's migrations are.
- Frontend visual direction (new UI or redesign): use the `frontend-design` skill when installed to avoid templated output.
- Frontend build: reuse existing components and design tokens before adding new ones. Semantic HTML, keyboard access, visible focus, alt text, and sufficient contrast are part of done.
- Performance: avoid N+1 queries (eager load), paginate lists, cache only with a clear invalidation rule, and keep images sized and lazy-loaded.
- Security: authorize every action server-side, escape output, use parameterized queries, protect forms against CSRF, and never log secrets or personal data.

## Verifying

- Run the affected test file while iterating, then the full suite and the static analysis used in CI.
- For UI changes, open the page in a browser at 1440px and 390px, check the console and network tab for errors, and compare against the mockup when one exists.
- For API changes, exercise the endpoint with a real request (curl or a test) and check status codes and error shapes, not only the happy path.
