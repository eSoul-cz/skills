# Workflow: Verify

Shared evidence policy, outlines, and the publication contract are in [workflow.md](workflow.md).

Use for read-only assessment unless the user separately authorizes fixes.

1. Check managed-tool version and drift.
2. Validate configuration, sources, links, assets, math, accessibility basics, ignore rules, and likely sensitive data.
3. Compare claims against implementation, tests, configuration, observed UI, and approved external sources.
4. Report stale content, omissions, evidence conflicts, due attestations, intended/implemented mismatches, screenshot drift, and PDF problems.
5. Build and visually inspect when the environment permits; otherwise identify exactly which gates remain unverified. `build` writes disposable PDFs and review artifacts, so in a strictly read-only review use a temporary project copy or obtain authorization for those generated files.
6. Do not edit content in verify mode.
