# Agent instructions

<!-- esoul-guidelines:begin agents -->
## Project guidelines

Before changing code, read [docs/project_guidelines/index.md](docs/project_guidelines/index.md) and the guidelines that cover what you touch. They take precedence over generic framework documentation and generated advice. This block is managed by `esoul-guidelines`; do not edit it, run `esoul-guidelines sync` (`vendor/bin/esoul-guidelines sync` where the package is a Composer dependency of the project) instead.

Rules for every task:

- [Testing](docs/project_guidelines/testing.md) - Which tests the project keeps and how many per risk tier, how error messages and authorization are tested, regression and test-writing rules, the cost of integration tests, the suite time budget, test groups, flaky tests and the testing workflow.
- [Security and data](docs/project_guidelines/security-and-data.md) - Secrets, personal and client data, real data and anonymized dumps, production access, authorization and its tests, sessions and accounts.
- [Workflow](docs/project_guidelines/workflow.md) - Tasking basics, branch naming, commit convention, repository rules, pull request rules and the path from issue to merge.
<!-- esoul-guidelines:end agents -->
