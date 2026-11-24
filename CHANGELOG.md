# Changelog

All notable changes to `eSoul-cz/skills` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The documentation tool has its own changelog in [tooling/CHANGELOG.md](tooling/CHANGELOG.md). The reasons for the changes of the 2026-11-24 content review are in [docs/decisions/2026-11-24-content-review.md](docs/decisions/2026-11-24-content-review.md).

## Unreleased

### Added

- `layers.json` `skillRequires` (layer level): naming a skill with `--skill` also installs the skills it needs; `esoul-website-launch` requires `esoul-quality-gates`. The helper validates the map and a test covers it.
- `esoul-mockup-authoring`: `preview` runs standalone (unvalidated, announced) when no application checkout is available; `validate` and publishing still need it.
- `esoul-project-lifecycle`: the stack profiles' pitfalls and the "numbers only from podklady" rule point at the guidelines (new text in `eSoul-cz/guidelines` Unreleased: `general/domain.md`, `tools.md` known pitfalls of the Laravel, LSR, Astro and Laravel Inertia layers).
- `esoul-offer-authoring` and `esoul-office-documents`: offers live in the private repository `eSoul-cz/sales`; the office template README names the owners (Tomáš Drvota, Tomáš Vojík) and the embedded fonts (Poppins and Syne, SIL OFL 1.1).
- `esoul-task-create`: a minimal path for S work (outcome, one acceptance criterion, one category label, one duplicate search, a one-line preview).
- `esoul-task-create`: `question` issues are known to the skill (not a task: no `## UAT`, no category label, no estimate; body per the `question` issue form; issue only in `github-freelo`).
- `esoul-task-create`: the recipe table lists the Freelo MCP tool and the CLI command of every write step; the GitHub `blocked_by` recipe (moved from `docs/agents/issue-tracker.md`) is complete in `references/github-freelo.md`.
- `esoul-task-work`: the work-report script reads omp and Codex session transcripts next to Claude Code (format detected per record), with anonymised fixtures and tests.
- `question.yml` issue form for open client questions (label `question`, sections Otázka / Proč na tom záleží / Možnosti / Doporučení / Blokuje / Co platí do odpovědi), copied at bootstrap; `conformance.mjs` exempts `question` issues from the category, UAT and Freelo checks and warns about missing form sections.
- `references/labels.md` in `esoul-project-lifecycle`: the single source for the GitHub label set and the `ready-for-agent` rule.
- `esoul-quality-gates` skill (project layer): Lighthouse budgets, axe, link prefetch, security headers and the AI-readiness checker as gates that run at any time, with a rule for what a failing gate does (LC-D1).
- `lighthouse-gate.mjs`, a mobile Lighthouse gate with eSoul budgets, `--staging` and `--budget` overrides, and a shared `web.mjs` helper module.
- `esoul-website-launch` skill (project layer): go-live procedure in the order of the public-website guideline, evidence rule, case-study snapshots (LC-D6).
- `esoul-project-update`: a `declined` list in `.esoul/template.json` — entries the project never takes are skipped, shown with their reason, no longer hold back the recorded commit, and the user is offered to add an entry when declining it (`changelog.mjs select/record --template`) (PU-D1).
- `esoul-project-update`: the trailing difference after the newest changelog entry is checked and offered as an "unlisted changes" entry (`changelog.mjs unlisted`) (PU-D2).
- `esoul-uat/scripts/sweep.test.mjs` covering the secrets-file mode check and the run/base-URL origin check; `sweep.mjs` exports `readSecrets` and `assertSameOrigin`.
- `tooling/CHANGELOG.md` (release notes of the documentation tool, Jenkins reads the section of the tag) and `tooling/MAINTAINERS.md` (renderer internals, tests, release procedure and checklist in one document; replaces `docs/hosted-image-plan.md`).
- Documentation tool: per-guide `language` in `documentation.toml`, a math check in `validate` that names the file and command, and tests for screenshot redaction, the `commit_pdf_outputs` wiring and the Git ignore check (unreleased; the tool is released once, at the end of the review).
- `esoul-office-documents`: `--lang cs|en` on `md_to_docx.py`, `build_xlsx.py` and `build_pptx.py` and `--currency` on `build_xlsx.py` (defaults unchanged: Czech, CZK); English example files; `assets/templates/README.md` (origin, owner, fonts, re-export); pinned `scripts/requirements.txt`; smoke tests including a check that the template footers hold the current IČ.
- `esoul-offer-authoring`: `check_offer.py` gained `--lang`, `--currency`, a reserve check (10 %, last row before the total) and a "rate check skipped" note, and prints the statements to verify yourself; Python tests; `references/` (research briefs, offer structure, terms and pricing with the sales-policy owner named).
- `esoul-mockup-authoring`: `references/from-pencil.md` (building the bundle from a Pencil design through the Pencil MCP); `scripts/mockup.test.mjs` (CLI and example-bundle checks that need no application).
- `tooling/scripts/build_readme_skills.mjs`: the README layer and skill list is generated from `layers.json` and the SKILL.md frontmatter (one line and a link per skill); `--check` runs in the contract tests.
- `tooling/scripts/check_upstream.mjs`: reports pinned third-party sources (`ref` in `layers.json`) with a newer release; the weekly scheduled Jenkins build runs it and turns unstable on drift.
- Jenkins runs the Python tests of the skills in a `python:3` step (`tooling/scripts/test_python`), and reads the release notes of a tooling tag from the `## <version>` section of `tooling/CHANGELOG.md` (`tooling/scripts/release_notes.mjs`); a missing section fails the tag build.
- Tests for the Codex generator and installer (`test_codex_agents.mjs`), the Jenkinsfile stages (`test_jenkinsfile.mjs`), the upstream check and the release-notes reader.
- `docs/skill-purposes.md` (purpose, use cases and coverage check of every skill) and `docs/decisions/2026-11-24-content-review.md` (every change of the content review with its reason and decision ID, including every dropped third-party pick).

### Changed

- `esoul-task-work`: an unassigned `To Do` task is ready for anyone; the pick-up flow lists them, lets the user choose, assigns the user and moves the task to `In progress`. `To Do` means complete, estimated and unblocked — no assignee needed.
- `esoul-task-work`: the Freelo working rules own the estimate (the person's time, 15-minute steps, split above 4 h) and define a work report as the person's active time, measured from the session when one exists; the one-week sprint sentence is dropped.
- `esoul-task-work` / `esoul-task-create`: the PR title is derived from the task title by procedure (Gitmoji `[context]` mapping or the developer's own standard); the title rule itself is the guideline's and is no longer restated in the skills.
- `esoul-project-lifecycle`: shorter trigger-first description, simplified load rules, "Rules that live elsewhere" pointer table instead of the company-rules copy, shrunk guardrails, "Done when" lines for bootstrap, retrofit, intake, glossary, ADR, design and plan; `esoul-project-update`, `esoul-office-documents`, `esoul-quality-gates` and `esoul-website-launch` named as companions.
- `bug.yml`: the Impact description maps to Critical/Major/Minor/Nitpick, the UAT field is labelled `UAT`.
- `conformance.mjs`: the light tier requires `## Commit convention`; messages cite guideline sources instead of "company rule".
- the light-tier decision register `docs/rozhodnuti.md` to English with the ADR status vocabulary and "at least one rejected alternative when there is one"; plan, sitemap and AGENTS/CONTEXT templates trimmed to pointers at the guidelines (`public-website.md`, `workflow.md`).
- `ai-readiness` reference split into a core and a reference loaded on demand; crawler table no longer duplicates the checker's `BOTS` (LC-D3).
- `ai-readiness.mjs`, `snapshot.mjs`, their tests and the `docs/ai-readiness.md` template are in English; the exceptions parser accepts both the English `## Exceptions` and the Czech `## Výjimky` header sets (LC-D4).
- one launch checklist: `docs/nasazeni.md` holds the boxes (launch order and forms wording follow `public-website.md`), `launch.md` holds the procedure (LC-M21).
- `snapshot.mjs` tests now cover `discover` (local HTTP server) and `capture` (consent handling, failures, manifest; needs Playwright and Chrome).
- `esoul-project-update`: stops and asks when the recorded commit does not resolve in app-templates instead of silently re-applying every entry; an old `version`-only record is adopted; branch name follows the workflow guideline (`chore/<issue>-update-template-<variant>`); the PR step points at the repository's PR template; description leads with the trigger; commits follow the project's standard (Gitmoji recommended) (PU-M1..M7, PU-M10).
- `esoul-data`: the "just do it" override now requires the owner's approval written in the data issue before the agent changes application code or the data model; description trimmed to the two triggers; case-study row dropped from the placement table (DG-D1, PD-M1, PD-M3).
- app-templates builder writes `"declined": []` into `.esoul/template.json`; documented in its README and CHANGELOG (Unreleased).
- `esoul-uat` bug template `bug-issue.md` is now the Czech rendering of the `bug.yml` form (same fields, same order); one table in `references/bugs.md` maps the form's Impact options onto Critical/Major/Minor/Nitpick, and design findings use it too (UT-D1, UT-D2).
- `esoul-uat` no longer requires the Claude extension: it asks for "a browser tool that can use a dedicated profile" (Claude in Chrome by default, or a CDP session of a dedicated Chrome); human setup is split from agent checks in `references/chrome.md` (UT-D7, UT-M12).
- UAT secrets now live in one directory, `~/.config/esoul-uat/`. The Google Doc bridge file moves from `~/.config/esoul/<projectKey>-uat-gdoc.env` to `~/.config/esoul-uat/<projectKey>.gdoc.env`; existing projects move it once with `mv` (UT-D5).
- `esoul-uat` states that UAT accounts are test-only, that browser-tool runs expose the role's password to the model, and that UAT writes on staging are the one exception to "agents SHOULD NOT write to staging data" (production stays read-only) (UT-D4, UT-D5).
- `esoul-uat` Google Doc bridge guide is split into human setup and agent use, adds "no client data in the Doc" and a token-rotation reminder (UT-D6).
- `esoul-uat` modes have a "done when" criterion; the rules in `SKILL.md` are one line each with a pointer; the evidence branch is `test/uat-<run-id>`; the description leads with the trigger; model and agent names are gone (UT-M1..M15).
- `esoul-uat` scripts and tests use English developer-facing text (scenario field tokens and tester-facing report stay Czech); `gdoc.test.mjs` titles are English.
- `esoul-docs`: one `workflow.md` with Create, Refresh and Verify sections replaces the three mode files; the description states it owns client-facing application guides as PDF (DOCX/XLSX/PPTX business documents stay with `esoul-office-documents`).
- `esoul-docs`: the first install of the PDF tool needs the maintainer's approval (a new dependency), an upgrade only the user's confirmation; `pdf-pipeline.md` no longer carries renderer internals.
- Documentation tool: `commit_pdf_outputs = true` only prints a notice (default `false`, behaviour unchanged); the installer reminder says generated PDFs are not committed; "catalog" wording replaced by "release".
- Offers live in an internal sales repository or folder outside the project repositories; Markdown is committed, the DOCX is a build artifact; the skill asks the user for the supplier block and payment terms and writes `TBD` for what stays unknown.
- Mockups can be published to any configured branch (pull-request-only branches get a pull request); the dedicated-sharing-branch advice is gone.
- Skill descriptions and bodies trimmed to the single owner of each artifact: office documents own DOCX/XLSX/PPTX, `esoul-docs` owns application guides as PDF, offer authoring owns offer content; examples are fictional layout samples.
- Jenkins runs each test group (repository contract, review scripts, one stage per skill folder, Python, guidelines, documentation tool) only when its files changed; a tag, the scheduled build and a build after a non-green one run everything. `tooling/scripts/test_skills [contract|review|<skill folder>]` and `node_run` replace the hard-coded file list.
- `ops` is limited to shell, read, search, `Skill` and the Freelo MCP server (`mcp__freelo__*`); `implementer` quality rules match the guidelines and the shortened self-check list; `uat-runner` needs "a browser tool that can use a dedicated profile".
- The session rules (`hooks/session-rules.md`, `codex/AGENTS.md`) shrank to the guard-relevant lines and are generated from one template together with the Codex agents (`build_codex_agents.mjs --check` covers all of them); read-only Codex agents get their connectors switched off (a Codex agent file cannot set a sandbox).
- `upstream-picks` pruned to the picks that do not conflict with the guidelines: accessibility, sql-optimization-patterns, seo-technical, seo-schema, frontend-lighthouse, frontend-design, the `wordpress` bundle and `esoul-jenkins-libraries`.
- Guideline link: the title shape `Context: Result` and the English pull request title are now stated by `docs/project_guidelines/workflow.md` (guidelines main, Unreleased); `esoul-task-work` holds the mapping into the developer's commit standard and `esoul-workflow` points at it.

### Removed

- `docs/agents/` templates (issue-tracker, triage-labels, domain), `references/company-rules.md`, client names and project stories, and version pins (`skills@1.7.2`, PHPStan level, Inertia/Vue versions) from the lifecycle skill; the `launch` mode and the guidelines mode are gone (`esoul-website-launch`, `esoul-quality-gates`, `esoul-guidelines`).
- `references/launch.md`, `ai-readiness.md`, `case-study.md`, `snapshot.mjs`, `ai-readiness.mjs` and `nasazeni.md` from `esoul-project-lifecycle` (moved to the two new skills).
- `skills/dev/esoul-docs/references/workflow-create.md`, `workflow-refresh.md`, `workflow-verify.md` and `docs/hosted-image-plan.md` (their content lives in `workflow.md` and `tooling/MAINTAINERS.md`).
- Brand facts and the template layout index from `presentation-layouts.md`, `metadata` version fields and MCP sediment from the mockup skill, numeric schema limits that the validator reports.
- Picks `laravel-expert`, `laravel-security-audit`, `php-pro`, `docker-expert`, `mysql`, `e2e-testing`, `e2e-testing-patterns`, `seo-audit`, `web-performance-optimization`, `data-storytelling`, `frontend-architecture` and the three specialised WordPress skills (reasons in the review record); the groups `laravel`, `devops` and `testing` of `upstream-picks`.
