# Agent instructions

<!-- esoul-guidelines:begin agents -->
## Project guidelines

Before changing code, read [docs/project_guidelines/index.md](docs/project_guidelines/index.md) and the guidelines that cover what you touch. They take precedence over generic framework documentation and generated advice. This block is managed by `esoul-guidelines`; do not edit it, run `esoul-guidelines sync` (`vendor/bin/esoul-guidelines sync` where the package is a Composer dependency of the project) instead.

Rules for every task:

- [Testing](docs/project_guidelines/testing.md) - Which tests the project keeps and how many per risk tier, how error messages and authorization are tested, regression and test-writing rules, the cost of integration tests, the suite time budget, test groups, flaky tests and the testing workflow.
- [Security and data](docs/project_guidelines/security-and-data.md) - Secrets, personal and client data, real data and anonymized dumps, production access, authorization and its tests, sessions and accounts.
- [Workflow](docs/project_guidelines/workflow.md) - Tasking basics, branch naming, commit convention, repository rules, pull request rules and the path from issue to merge.
<!-- esoul-guidelines:end agents -->

## Working in this repository

- Tests: `tooling/scripts/test_skills` (every Node test; `contract`, `review` or a skill folder narrows it) and `tooling/scripts/test_python`. `ESOUL_SKIP_NETWORK=1` skips the source check offline. Jenkins runs each group only when its files changed; add a stage to the `Jenkinsfile` for a new skill folder with tests (a test checks it).
- Generated files, never edited by hand: after editing `agents/` run `node tooling/scripts/build_codex_agents.mjs` (Codex agents, `codex/AGENTS.md`, `hooks/session-rules.md`) and `node tooling/scripts/build_roles.mjs`; after adding or changing a skill or a layer run `node tooling/scripts/build_readme_skills.mjs`. Each has `--check`.
- Skills: edit them with `writing-for-agents`; a skill holds agent procedure and points to the guideline for a rule. A change to `agents/reviewer.md`, `agents/critical-reviewer.md` or the review briefs needs the eval run in `tooling/review-evals/README.md`.
- Third-party skills are never copied here: `layers.json` lists them, pinned to a release tag where one exists. `node tooling/scripts/check_upstream.mjs` reports newer releases (the weekly Jenkins build runs it).
- Release: the plugin version is in `.claude-plugin/plugin.json` and the README, tagged `plugin-<version>`; the documentation tooling is released by a bare `<version>` tag whose notes come from the `## <version>` section of `tooling/CHANGELOG.md`; the helper package is published by hand (`README.md`).
