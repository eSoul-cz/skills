# Web applications

Applies to eSoul web applications and their frontends. Repository `AGENTS.md` / `CONTEXT.md` override everything here.

## Known stack (verify per repository)

- The guideline layers for the stack (Laravel, LSR, Astro) are rendered into `docs/project_guidelines/`; versions, commands and packages are in the project's `tools.md`, `composer.json` and `package.json`, not copied here.
- Follow the project's existing command/query split when it uses CQRS: writes go through commands and handlers, reads through queries (`cqrs.md`).
- CI runs in Jenkins (`Jenkinsfile`) on the images the project names in `tools.md`.
- Mockups live in the eSoul mockups module (`esoul-mockup-authoring`); desktop frame 1440px, mobile 390px.

## Before coding

1. Find how the project runs locally: `docker-compose*.yml`, `Makefile`, `composer.json` / `package.json` scripts, `README.md`. Use those commands; do not invent new ones.
2. Find the test, static-analysis and style commands the CI runs (`Jenkinsfile`, `tools.md`) and run the same ones locally.
3. For a change to existing behaviour, map the blast radius first (`codegraph_explore "what calls <symbol>"` or Grep): routes, jobs, listeners and scheduled commands that reach it.

## Building

- Architecture, persistence, validation, authorization and data handling follow `docs/project_guidelines/architecture.md`, `requests-and-validation.md`, `security-and-data.md` and `frontend.md`; read the file for the area you touch.
- Frontend visual direction (new UI or redesign): use the `frontend-design` skill when installed to avoid templated output. Reuse existing components and design tokens before adding new ones.
- Semantic HTML, keyboard access, visible focus, alt text and sufficient contrast are part of done.

## Verifying

- While iterating, run the affected tests; stop at L1 and let the orchestrator run the full suite once (`esoul-testing` when installed, otherwise `docs/project_guidelines/testing.md` › Testing workflow).
- For UI changes, open the page in a browser at 1440px and 390px, check the console and network tab for errors, and compare against the mockup when one exists.
- For API changes, exercise the endpoint with a real request (curl or a test) and check status codes and error shapes, not only the happy path.
