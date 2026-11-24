# Workflow: Verify

Shared evidence policy, outlines, and the publication contract are in [workflow.md](workflow.md).

Use for read-only assessment unless the user separately authorizes fixes. Verify mode changes no tracked file; report findings in the chat.

1. PDF projects only: check managed-tool version and drift (`docs/documentation doctor`).
2. Validate configuration, sources, links, assets, accessibility basics, ignore rules, and likely sensitive data (`docs/documentation validate` when installed, otherwise by hand as listed in SKILL.md). PDF projects also validate math.
3. Compare claims against implementation, tests, configuration, observed UI, and approved external sources.
4. Report stale content, omissions, evidence conflicts, due attestations, intended/implemented mismatches, screenshot drift, and, for PDF projects, PDF problems.
5. PDF projects: build and visually inspect when the environment permits; otherwise identify exactly which gates remain unverified. `build` writes disposable PDFs and review artifacts, so in a strictly read-only review use a temporary project copy or obtain authorization for those generated files.
