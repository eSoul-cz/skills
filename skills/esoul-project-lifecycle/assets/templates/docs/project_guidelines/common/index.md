# Project guidelines - Index

<!-- Copy common/* and the files of the project's stack flat into docs/project_guidelines/.
     Keep only the stack section that applies below and delete the others. -->

Implementation starts from the prepared issue and its acceptance criteria. Read the issue, the
short rules in [AGENTS.md](../../AGENTS.md), the guidelines below that cover the code you are about
to change, and the ADRs the issue links. Then inspect the affected code and tests, implement the
change and verify it with the checks in [tools.md](tools.md).

Issue preparation, triage, domain modelling and planning happen before implementation and are not
a preflight stage of it. There is no mandatory sweep of every ADR or of the whole glossary before
each task; read what the issue references and what the change touches.

If a topic is not covered here, follow the conventions of the framework and its community.
Project rules always take precedence over generic framework documentation and skill examples.

## How the guidelines relate to the other documents

| Document | Owns | Relation to the guidelines |
|---|---|---|
| [GLOSSARY.md](../../GLOSSARY.md) | The domain language: one term, one word, the Czech original, the avoided synonyms | Guidelines use its terms and never redefine them |
| [CONTEXT.md](../../CONTEXT.md) | Project conventions: profile, Freelo, tasking, commits, languages, sources of truth | Guidelines follow it |
| [docs/adr/](../adr/index.md) | Decisions with real alternatives, their status and implementation gaps | An `accepted` ADR is the target contract; a guideline says how to implement it and never weakens it |
| [AGENTS.md](../../AGENTS.md) | The engineering rules in short form, loaded by every agent | Guidelines add the reasons, the examples and the detail; they link instead of repeating |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | The process: branches, commits, checks, review, Definition of Done | Guidelines never restate the process |
| [docs/plan/](../plan/README.md) | What is built next and what blocks it | Guidelines never schedule work |

- A rule that could reasonably have gone the other way, with consequences, is an ADR. A rule that
  is simply how this project is written is a guideline. See [documentation.md](documentation.md).
- If a guideline contradicts `AGENTS.md`, `CONTRIBUTING.md`, `CONTEXT.md`, the glossary or an
  `accepted` ADR, report the conflict instead of choosing one silently.
- Company-wide standards live at https://dev.docs.esoul.cz and are referenced, never copied.

## Normative language and targets

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are used in the sense of RFC 2119.

Every rule is true of the code today unless it is marked as a target:

> **Target.** What the code should do. The code does not do this yet: where it differs
> (#issue or ADR-NNNN).

Write "No issue" when the gap has none yet. Do not copy a gap into new code, and do not fix it in
passing outside its issue. The pull request that closes a gap removes or rewrites its **Target**
block in the same pull request.

<!-- optional: new project without application code yet -->
At the time of writing the repository holds the skeleton, the tooling and the documentation; no
application code has been written yet. These documents therefore describe the target standard
for the code that will be written.

## Quality and process (every stack)

- [Code review](code-review.md) — severity, default Blockers, finding states, CodeRabbit
- [Testing](testing.md) — what belongs in the suite, error messages, regression and mutation
  testing
- [Documentation](documentation.md) — what belongs where, the ADR-or-guideline rule, `TBD`,
  same-PR updates
- [Domain](domain.md) — reading order, ADR status authority, vocabulary, money and time
- [Security and data](security-and-data.md) — secrets, personal data, anonymized dumps,
  production access, authorization tests

<!-- optional: stack laravel -->
## Laravel stack

- [Tools](tools.md) — versions, where tools run, read-only checks, formatters, mutation testing,
  Laravel Boost
- [Architecture](architecture.md) — layers, modules, dependency rules, persistence, money
- [CQRS](cqrs.md) — commands, queries, handlers, DTOs, the reference module
- [Requests and validation](requests-and-validation.md) — form requests, input normalisation,
  mapping to commands and queries
- [Frontend](frontend.md) — Inertia + {{FRONTEND_FRAMEWORK}}, locality, design system, Wayfinder
- [Deployment and runtime](deployment.md) — images, local stack, Jenkins, Komodo, environments

<!-- optional: stack medusa-nuxt -->
## Medusa and Nuxt stack

- [Tools](tools.md) — versions, root scripts, `pnpm check`, lint suppressions, structure check,
  mutation testing
- [Architecture](architecture.md) — backend layers, modules, links, metadata, storefront layers
- [Workflows, events and jobs](workflows.md) — business logic in workflows, compensation,
  idempotent subscribers
- [Admin](admin.md) — Medusa Admin extensions in React and `@medusajs/ui`
- [Frontend](frontend.md) — Nuxt storefront, `Ui` primitives, tokens, i18n, data fetching
- [Deployment and runtime](deployment.md) — local infrastructure, environment files, Jenkins

<!-- optional: stack astro -->
## Astro stack

- [Tools](tools.md) — versions, pnpm hardening, local checks and the Jenkins `Checks` stage
- [Architecture](architecture.md) — archetype, render mode, islands, forms
- [Content](content.md) — where every text lives, how the client edits it, the content contract
- [Frontend](frontend.md) — design tokens, fonts, images, motion, the Pencil → component map
- [SEO](seo.md) — meta, canonical, structured data, sitemap, robots, `llms.txt`, redirects
- [Deployment and runtime](deployment.md) — image or static deploy, preview protection, build
  arguments

<!-- optional: project-specific guidelines -->
## Project-specific

- [{{GUIDELINE_TITLE}}]({{GUIDELINE_FILE}}) — {{GUIDELINE_SUMMARY}}

## Language

These guidelines, the glossary, ADRs, `AGENTS.md`, code, identifiers, commit messages and branch
names are written in **English**. A domain term keeps its Czech original in parentheses on first
use, as the glossary records it, so that a document can be checked against the client's own
vocabulary.

User-facing text, the client's material in `docs/podklady/`, the plan in `docs/plan/` and the
issue and pull request templates in `.github/` are **Czech**. The full rule is in
[CONTEXT.md](../../CONTEXT.md), *Languages*.
