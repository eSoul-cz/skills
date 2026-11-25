<!-- esoul-guidelines:begin index -->
# Project guidelines - Index

Read the guidelines that cover the code you are about to change. These rules take precedence over generic framework documentation and generated advice.

Layers: `general`, `profile/internal`.

| Guideline | Covers | Layers |
|---|---|---|
| [Code review](code-review.md) | Who reviews, finding severity and default critical findings, what a reviewer checks, how findings are written and answered. | `general`, `profile/internal` |
| [Testing](testing.md) | Which tests the project keeps and how many per risk tier, how error messages and authorization are tested, regression and test-writing rules, the cost of integration tests, the suite time budget, test groups, flaky tests and the testing workflow. | `general` |
| [Documentation](documentation.md) | Where each kind of knowledge lives, ADR vs guideline, the TBD rule, authoring rules and keeping documentation in the same pull request as the code. | `general` |
| [Domain](domain.md) | Authority of domain sources, ADR statuses, vocabulary, open points, and the rules for money, time and languages. | `general` |
| [Dependencies](dependencies.md) | pnpm repositories - where settings live, the install hardening in pnpm-workspace.yaml (release age, build allow-list, audit with dated ignores) and how dependencies are added. | `general` |
| [Security and data](security-and-data.md) | Secrets, personal and client data, real data and anonymized dumps, production access, authorization and its tests, sessions and accounts. | `general` |
| [Deployment](deployment.md) | How an eSoul application is built, released, deployed and run for every stack - the path from merge to running, manifests, environments and the release lifecycle, monitoring a deployment, the production start entrypoint (migrations, seeders, a quick start), local development, shared database, cache, search and storage, proxy, configuration and secrets, observability, backups, and what not to introduce. | `general` |
| [Workflow](workflow.md) | Tasking basics, branch naming, commit convention, repository rules, pull request rules and the path from issue to merge. | `general`, `profile/internal` |
| [Public websites](public-website.md) | Rules for any application with public pages that crawlers and AI assistants read - crawling and indexing, sitemap, llms.txt, Markdown versions, the preview gate before launch, redirects from an old site and exceptions. | `general` |

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end index -->
