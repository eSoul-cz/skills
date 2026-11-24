# Skill purposes: main purpose, use cases and coverage

The owner's question for every skill (content review 2026-11-24): what is its main purpose, what are its use cases, and does the content cover them and only them? Each entry gives the purpose in one sentence, the use cases, the result of the coverage check (missing coverage, content outside the purpose, what was moved to another skill and what was done about it) and the verdict with the open points. `esoul-project-lifecycle` comes first, as the owner asked; the others follow in layer order. The decisions that follow from the checks are listed with their reasons in [decisions/2026-11-24-content-review.md](decisions/2026-11-24-content-review.md).

Layers: core (every developer, every project), dev, project, helpers, business. Third-party skills are not part of this repository and are not listed.

## Cross-skill findings that need the owner

These came out of the purpose checks and are not decided by the ledger. Each names options and a recommendation; nothing was changed for them.

1. **Split `esoul-project-lifecycle` by purpose?** Eleven modes fall into repository setup (`bootstrap`, `retrofit`, `handover`, `audit`) and documentation upkeep (`intake`, `client-update`, `glossary`, `adr`, `design`, `plan`, `tasking`). Recommendation: not now (a second description in every session for little gain); revisit if `design` or `plan` keep growing. `design` is thin and overlaps `esoul-mockup-authoring` only at publishing.
2. **Stack profile pitfalls and ADR topics** (`esoul-project-lifecycle/references/stacks/*`) are stack knowledge, not lifecycle procedure. Recommendation: move the pitfalls into the guidelines (`framework/<stack>`, `tools.md` known pitfalls) in the next guidelines release; keep the ADR topics in the skill.
3. **"Numbers only from podklady"** stays in the lifecycle skill and the AGENTS template for now (owner); `documentation.md` covers part of it. Candidate for one guideline sentence.
4. **Skill-side budgets** in `esoul-quality-gates` (Lighthouse thresholds, axe threshold, link prefetch rule, `Permissions-Policy`) have no guideline home; the owner ruled they stay skill-side until a guideline carries them.
5. **`snapshot.mjs` imports `web.mjs` from `esoul-quality-gates`** so `esoul-website-launch` needs it installed. Options: keep and declare it (done), duplicate ~170 lines, or move `snapshot.mjs` into quality-gates. Recommendation: keep while the project layer is installed as a unit.
6. **Receipts procedure** lives in `esoul-workflow` (core) although `esoul-testing` (dev) uses it. Moving it would make the core depend on a dev skill. Recommendation: leave.
7. **`esoul-review`** holds two jobs (local review, PR loop). Recommendation: keep one skill; the loop runs the local review once.
8. **Question issues have no Freelo counterpart** (`esoul-task-create`, lifecycle conformance): the issue is the register. Options: issue only (applied) or a labelled Freelo task for the client board. Recommendation: issue only.
9. **Language of light-tier documents**: `rozhodnuti.md` is now English, `nasazeni.md`, `plan.md`, `sitemap-a-meta.md`, `design-log.md`, `obsah-*.md` stay Czech (client-read). Confirm the line.
10. **UAT evidence and Google Doc env file**: the Doc env file moved to `~/.config/esoul-uat/<projectKey>.gdoc.env` without a shim; existing projects need a one-time `mv`. Confirm.
11. **Codex cannot enforce read-only or tool limits per agent** (agent files cannot set `sandbox_mode` or MCP servers, checked against the Codex subagent docs); the read-only agents have connectors off and instruction-only rules. Option: document a read-only profile for review sessions.
12. **Offers repository**: the skill asks for the sales repository or folder; the real location is not named. The office-document template owner and the font licence (OFL) are `TBD` in `assets/templates/README.md`.
13. **Mockup skill depends on the private application checkout** (MK-D3, no ledger decision); `references/from-pencil.md` could not be exercised against a live Pencil session.

The per-part "Owner decisions needed" in the decisions record lists the smaller items (for example the `declined[].reason` requirement, the `ops` Freelo server name, the session-title line, the weekly upstream-check schedule).

## `esoul-project-lifecycle` (project)


### Purpose
Take an eSoul client project from first client material to a repository whose decisions, vocabulary, design, plan and prepared issues an agent can work from, and keep that preparation true after every client session; it ends where `esoul-workflow` implements one issue.

### Use cases
- Start a project: `bootstrap` (root files from the app template, guidelines, lifecycle docs, issue forms, labels, CI green on the scaffold).
- Bring an existing project to the standard: `retrofit` (audit, plan as pairs, migrate `docs/project_guidelines/`).
- Client files arrive: `intake` (podklady notes, legacy documents, `question` issues).
- After a client session or answers: `client-update` (one PR that propagates the change: transcript, questions, ADRs, glossary, design, plan, issues).
- Name a term or record a decision: `glossary`, `adr`.
- Design brief and review rounds: `design`.
- Phases, gates, scope, slices, risks: `plan`; make the codebase safe for agents: `handover`.
- Turn ready slices into issue + Freelo pairs and flip them to `ready-for-agent`: `tasking`.
- Check completeness and conformance: `audit` (read-only, `conformance.mjs`).

### Coverage check
- **Missing coverage found and added:** (1) the shape of a `question` issue lived only as prose → `question.yml` form, copied at bootstrap, known to the questions reference and to `conformance.mjs` (new `question-sections` check; question issues exempt from category/UAT/Freelo checks) [LC-D5, LC-M15]; (2) the label set and the `ready-for-agent` rule were spread over five files → one `references/labels.md` [LC-D1, LC-D2]; (3) no "done when" in `bootstrap`, `intake`, `glossary`, `adr`, `design`, `plan`, `retrofit` → one sentence each [LC-M24]; (4) `esoul-project-update` was not named although a template-born project's update is a lifecycle neighbour → named in the companion table, root-files, AGENTS.md template and `openai.yaml` [LC-M6]; (5) the questionnaire named no tool → `esoul-office-documents` [LC-M25]; (6) light tier did not require `Commit convention` in the checker although the template writes it [LC-M16].
- **Content outside the purpose, removed or moved:** (1) "Company rules this skill enforces" (SKILL.md §4 + `company-rules.md`): rules of the guidelines and of other skills; deleted, replaced by a pointer table [LC-M1]; (2) website go-live, case study, Lighthouse/axe/prefetch/security headers, AI readiness: pointed at `esoul-website-launch` and `esoul-quality-gates` and every mention of the moved files removed, `launch` mode removed [LC-D1, LC-D6]; (3) the `guidelines` mode: the installer is the core skill `esoul-guidelines`; the row only pointed at it, removed; (4) `docs/agents/` (issue-tracker, triage-labels, domain): written for the upstream tracker skills that the AGENTS.md template tells agents to ignore, restated `domain.md`; deleted, the `blocked_by` recipe lives in `esoul-task-create` [LC-D2]; (5) restated rules (title shape, estimates and 4 h split, Freelo states, merge rules, personal-data wording, ADR status table and change policy copies, testing group names and the 10-minute budget, `[FE]/[BE]` prefix pitfalls) replaced by pointers [audit §2]; (6) client names and project stories from a public repository [LC-M23]; (7) version pins and numbers that rot (`skills@1.7.2`, PHPStan level 10, Inertia/Vue versions, "autumn 2026").
- **Things moved to another skill:** website material → `esoul-website-launch` / `esoul-quality-gates`; issue/Freelo creation → `esoul-task-create`; Freelo working rules and states → `esoul-task-work`; guidelines installer → `esoul-guidelines`; template update → `esoul-project-update`.
- **Kept although borderline (owner may overrule):** gates B0–B5 and the phase table (the lifecycle's own process, owner LC-D1); "numbers only from podklady" (owner: keep for now); stack profiles including "Typical ADR topics" and "Pitfalls" (stack knowledge, not procedure; candidate for the guideline layers); `design` (thin, overlaps `esoul-mockup-authoring` only at publishing); `handover` checklists (mostly guideline/`tools.md` content that this skill sequences into gate B4); `tasking-batch` (the bridge from the slice table to `esoul-task-create`: it owns slice → issue header, milestone, triage labels, batching and the Issue column update, and points elsewhere for everything else); `plan` and its six Czech templates (the client reads the plan; the lifecycle owns its structure).

### Verdict / open points
- Verdict: needed; after the moves it is a router of **11 modes** with one SKILL.md of ~160 lines (about 20 lines of rules fewer than before; the table of owners and the companion table replaced them), 15 references (incl. 5 stack profiles) and one script. Its remaining purpose is coherent: preparation and upkeep of the pre-implementation record.
- Question for the owner — do `tasking-batch`, `plan` and `design` belong here? `tasking-batch` and `plan` do (they consume and produce the slice table and gates that only this skill defines); `design` is thin and could become its own `esoul-design` skill only if the Pencil/brief material grows (MK-D2 adds `from-pencil.md` to the mockup skill, which is the better place for the Pencil MCP part).
- Question for the owner — split by purpose into repository setup (`bootstrap`, `retrofit`, `handover`, `audit`) and documentation upkeep (`intake`, `client-update`, `glossary`, `adr`, `design`, `plan`, `tasking`)? Costs a second description in every session for little gain today; recommendation: not now.
- Question for the owner — the stack profiles' pitfalls/ADR topics belong to the guidelines long-term (record in Owner decisions needed #4 of the change record).
- Open points handled by the neighbouring skills: the English/Czech header sets and tests of `ai-readiness` (`esoul-quality-gates`), `esoul-task-create` handling of `question` issues, `bug-issue.md` as the Czech rendering of `bug.yml` (`esoul-uat`) — all done in this round.

## `esoul-workflow` (core)

### Purpose

Entry point that sizes any non-trivial eSoul task and routes each step to the skill that owns it.

### Use cases

- Start a feature, fix, bug diagnosis, plan or data analysis in an eSoul repository.
- Decide how much process a task needs (S/M/L/Bug/Analysis) and who does which step.
- Verify once with receipts, then commit and ship.
- Know what is off-limits (production, shared writes, destructive commands).

### Coverage check

- Covered: sizing, context loading, routing to task-work/task-create/testing/review/commit, guardrails, definition of done.
- Outside the pure routing purpose but kept (owner-decided or needed in the core layer): the verification receipt procedure (the core layer cannot depend on `esoul-testing`, which sits in `dev`); `references/wordpress.md` (WF-D2(b): no WordPress guideline exists); `references/data-analysis.md`; `references/web.md`.
- Duplicate: the `[testq]` hint sits in both `esoul-workflow` Verify and `esoul-testing`; the receipt format is owned here and referenced from `esoul-testing`.
- Missing: nothing found.

### Verdict / open points

Fits its purpose after the group A work. Owner question: should the receipt procedure move into `esoul-testing` and the core only point at it? Not done: `esoul-workflow` (core) would then depend on a `dev` skill for a rule every task needs.

## `esoul-guidelines` (core)

### Purpose

Tell an agent how to find, install, sync and check the managed project guidelines of a repository, and how to add project-specific rules next to them.

### Use cases

- Before changing code: find the guideline file and heading for the area.
- A repository has no or outdated guidelines: install the command, `init`, `sync`, commit.
- Add the CI `check` step.
- Write a project-specific guideline file.

### Coverage check

- Covered: all four use cases; the installer README stays the source for command details (the skill points to it).
- Outside the purpose: none; step 5 (project-specific rules) is the only authoring procedure and belongs with the guideline mechanics.
- Missing: nothing found. Note: the lifecycle skill's `bootstrap` mode calls this skill; the lifecycle no longer carries its own `guidelines.md` install routes (LC-M9).

### Verdict / open points

Fits its purpose; no change in this round.

## `esoul-task-work` (core)


### Purpose
Keep a tracked task (GitHub issue and/or Freelo task) in step with the development work on it: pick it up, set the assignee, move it through the states, link the PR, report the work and close it after merge.

### Use cases
- A developer starts work on a named issue or Freelo task (assignee, `In progress`, branch).
- A developer wants "the next task": an unassigned `To Do` task is ready for anyone, so it is listed, chosen, assigned and moved.
- A PR is opened: move to `Code review`, add the work report with the PR link.
- Review sends the task back, or the PR merges: move back / to `Testing` or `Done`, finish.
- Start-of-session sweep of tasks whose PR merged without a move.
- Computing the minutes of a work report from a session transcript (Claude Code, omp, Codex) or from a timeline; the Freelo working rules (states, estimate unit, label and delete gotchas, tool names CLI/MCP) that every Freelo-writing skill uses.

### Coverage check
- Missing: pick-up of an unassigned `To Do` task (FA-D2) — added to §1 and the moves table. The work-report script read only Claude Code transcripts — omp and Codex parsers added with fixtures and tests (FL-D4b).
- Outside the purpose: none left in the skill. Creation, revision and duplicate handling of tasks are `esoul-task-create`; the skill only points there (no task exists → create it; content writes need an approved preview).
- Moved in/out: the Freelo working rules (states, estimate unit, readiness) and the work-report method live here as the single source (FA-D2, FL-D3); `esoul-task-create` and the lifecycle copies point to `references/freelo.md`. The PR-title mapping into a commit format (procedure only) lives in §3; the title rule itself is the guideline's.
- Boundary with `esoul-task-create`: clean — task-work never writes content (title, description, estimate); task-create never moves, reports or assigns beyond the creation metadata.

### Verdict / open points
Fits its purpose; split from creation is clean. Open: the guideline `workflow.md` now states the title shape and the PR-title rule (done, guidelines main, Unreleased); the lifecycle copies of `To Do` / estimate text are pointers (done). Owner decision 3 in the record (the user chooses among unassigned `To Do` tasks).

## `esoul-review` (dev)

### Purpose

Review a change on two axes (Standards, Spec) before its PR and carry the PR through CI and CodeRabbit to a clean gate, without merging or approving.

### Use cases

- Review my branch, diff or WIP (Path A).
- CodeRabbit is limited: post a fallback review.
- Open the PR, take it through CI, answer review comments (Path B).

### Coverage check

- Covered: both paths, scope script, PR operations, comment replies and dispositions.
- Outside the purpose: none found; severity scale, finding states and PR rules are guideline-owned and only pointed at.
- Possible split: Path A (review) and Path B (PR loop) are two jobs in one 191-line skill with three scripts; both share the scope script and severity scale, which is why they were merged (K5).
- Missing: nothing found.

### Verdict / open points

Fits its purpose after group A (eval cases anonymised RV-D1, CodeRabbit left in Czech RV-D5). Owner question: split into two skills (`esoul-review` and `esoul-pr`) now that the installed upstream `pr` skill exists? Recommendation: no, keep one skill (the loop runs Path A once, a split would add a hand-off).

## `esoul-testing` (dev)

### Purpose

Decide when and how often checks run (run levels, receipts) and how to write tests with the upstream `tdd` and `diagnosing-bugs` skills under the eSoul testing guideline.

### Use cases

- Run the tests or a red CI build and choose which checks to run.
- Write a regression test for a bug fix; test-first work.
- Diagnose a failing or flaky test.

### Coverage check

- Covered: guideline sections by situation, run levels L0-L4, skip table, run-each-once rule, brief lines for implementer and test-runner.
- Outside the purpose: none; what a test contains and how many are guideline-owned and only pointed at.
- Missing: nothing found. The receipt tree-hash command lives in `esoul-workflow` (core) and is referenced here.

### Verdict / open points

Fits its purpose; no change in this round.

## `esoul-docs` (dev)


### Purpose

Produce and keep correct evidence-backed Markdown application guides (user guide, developer/operator guide) with a specification, screenshot manifest and review, and, optionally, render them to reproducible client-facing PDFs with the `docs/documentation` tool.

### Use cases

- Create a documentation set for an application: specification interview, guides, decision record.
- Refresh guides after a change (Git diff, issue, new evidence).
- Verify existing documentation read-only (stale content, drift, gaps, sensitive data).
- Plan, capture, redact and publish screenshots.
- Review a guide for correctness, completeness, privacy and accessibility before it is called publish-ready.
- Optional, PDF projects only: install or upgrade the tool, validate, build, inspect rendered pages, configure the theme, per-guide language and fonts, and wire the CI stage.

### Coverage check

- Missing coverage: none found. Per-guide language and the math check, which the guideline split between "project language" and "developer docs in English" could not express before, are now covered by the tool and by `SKILL.md` ("Theme, language and templates"). The gate that "privacy and accessibility review" had no owner is covered by `review.md` (DOC-M10, already applied).
- Outside the purpose: renderer internals (image contents, isolation flags, filter order, Dockerfile stages) lived in `pdf-pipeline.md`; moved to `tooling/MAINTAINERS.md` (DOC-D4/DT-D5). Client-document material for DOCX/XLSX/PPTX is not here (`esoul-office-documents`); the `esoul` PDF preset stays because it is the client-facing application-guide design (DOC-D5).
- Moved to another skill: glossary lookup is by pointer to `esoul-workflow` (DOC-M12); finding states and severities by pointer to the guideline.
- Layer fit (Q4): the Markdown half is general documentation instruction usable by any dev-layer project; the PDF half is gated by "only when the project builds PDFs" in the skill and in the description ("optional").
- Structure: SKILL.md 75 lines, `workflow.md` 88 lines with three mode sections (one read), `pdf-pipeline.md` 115 lines (down from ~15 KB of long lines).

### Verdict / open points

Fits its purpose; needed. Open: none in the skill. The per-guide `language` instruction applies to tool releases that contain the feature (an older installed renderer silently ignores the key); the owner decides the release timing. A warning for unknown keys in `documentation.toml` would make this visible (owner decision in the record).

## `documentation-tool` (dev (tooling))


### Purpose

Give a project one stable command, `docs/documentation`, that validates application documentation against the publication policy and renders it to reproducible PDFs inside a pinned, isolated Docker image, and an installer/upgrader that adds and migrates the managed files safely.

### Use cases

- `validate` the Markdown sources and configuration (links, images, alt text, Mermaid alternatives, secrets, emails, math, ignore rules, screenshot manifest).
- `build` / `render` guides to PDFs and check the result (structure, text, page images).
- `redact` screenshots into a quarantined, metadata-stripped copy.
- `doctor` the installation (version, drift, schema, renderer digest, Docker/registry).
- Install, preview an upgrade and apply it atomically (rollback on failure), via `install.sh`/`upgrade_project_tools`.
- Release the renderer and installer images with a signed GitHub Release (Jenkins).

### Coverage check

- Missing before this round: no maintainer document and no changelog (now `tooling/MAINTAINERS.md` and `tooling/CHANGELOG.md`); per-guide language (added); validate-time math check (added); tests for `redact` output, the `commit_pdf_outputs` wiring and the Git ignore check (added; coverage 64.5 % → 72.7 %).
- Outside the purpose: none found. The installer's closing reminder contradicted the guideline (allowed committed PDFs) and is fixed; "catalog" wording of the removed release catalog is fixed.
- Behaviour kept on the owner's instruction: `commit_pdf_outputs = true` still skips the ignore check, but only prints a notice; this is a deliberate, documented exception to the guideline's "never commit PDFs", not a rule of the tool.
- Not covered by tests: `loadConfig` error paths, `execute`, `inspectPDF` (Docker/Poppler-bound; the smoke build covers them).

### Verdict / open points

Needed and fit. Open: unknown-key detection and a Czech smoke fixture (see Owner decisions needed in `DocsTool.md`); the Docker smoke run and `test_bootstrap_install` were not run locally (Docker/network/emulation); Jenkins on the next master build covers them.

## `esoul-project-update` (project)


### Purpose
Carry a template-born eSoul project from the app-templates commit recorded in `.esoul/template.json` to the latest `template-<variant>` main, one commit per CHANGELOG entry in one reviewable PR.

### Use cases
- Regular catch-up of a project with new template changelog entries (merge deltas, follow `Migration:` notes, record the new commit).
- First update of a project without `.esoul/template.json` (or with an old `version`-only record): adopt it, then update.
- A project that deliberately never takes an entry: record it in `declined` so it stops being offered.
- Changes landed in a variant after the newest changelog entry: offered as "unlisted changes".
- A project that predates the published variant (`commit: null`): per-file comparison.

### Coverage check
- Missing coverage found and fixed: a mistyped or rewritten recorded commit silently re-applied everything (guard added); old `version`-only record had no branch; `declined` state absent; trailing variant changes without an entry were marked as landed; helper variables unassigned; no done criteria for fetch and PR steps.
- Outside the purpose: none. Restated guideline text (`No test:` / Deploy notes definitions, branch rule) replaced by pointers to `workflow.md`; the update-specific PR lists stay. Adopting a record is a retrofit action of `esoul-project-lifecycle`, kept here only as far as an update needs it (explicit in `adopt.md`).
- Moved: nothing; the builder-side contract (record shape) is documented in the app-templates README and CHANGELOG.
- Dependencies: `esoul-workflow`, `esoul-review` (both lower layers) and `gitmoji-commit` (helper, with a by-hand fallback). No agent names.

### Verdict / open points
Coherent, single trigger. Open: the later app-templates CI that enforces a CHANGELOG entry for variant-touching commits (PU-D2(c)) is a follow-up; declining "unlisted changes" is not remembered (title unstable), so they are offered again only while still unrecorded — by design they advance the record when the user skips them.

## `esoul-task-create` (project)


### Purpose
Turn a request into well-specified, previewed and approved tracked work: a Freelo task or a linked GitHub issue + Freelo task pair, per the repository's tasking convention.

### Use cases
- Create or revise a task or pair from a request, feature, bug, spike, data change or LTT.
- S work: a minimal issue/pair with one acceptance criterion, one label, one search and a one-line preview.
- Pair a lone issue with a Freelo task (or the reverse); refine an existing task by its state instead of duplicating it.
- Record an open question as an issue labelled `question` (not a task).
- Record the tasking convention and the `## Freelo` mapping/cache in `CONTEXT.md`.
- Write dependencies (`blocked_by` on GitHub mirrored as Freelo relations); the `## UAT` verification block.

### Coverage check
- Missing before: a defined minimal S path (TK-D2b) — added as its own section; `question` handling (LC-D5) — added (no UAT, no category label, no estimate, issue only in `github-freelo`, body per `question.yml`); the `gh api …/blocked_by` recipe (LC-D2) — complete in `github-freelo.md`; CLI/MCP names per recipe step (FL-D2) — `cli-recipe.md` is now a two-column table.
- Outside the purpose and removed or pointed away: the title rule and PR-title wording (guideline › Tasking / `esoul-task-work` §3), the estimate unit and `To Do` readiness (single source `esoul-task-work › references/freelo.md`), the repeated "never create labels" rule (said once in SKILL.md §1).
- Kept here on purpose: `## UAT` format (TK-D1), duplicate handling by state, the `## Freelo` cache mapping, convention recording.
- Boundary with `esoul-task-work`: clean — moves, assignment, work reports and closing stay there; the SKILL.md final line says so.

### Verdict / open points
Fits its purpose. Open: owner decision 1 (question issues have no Freelo counterpart in `github-freelo`) and decision 2 (the minimal path starts in `Backlog`) in the record. The guideline `workflow.md` holds the title shape, the lifecycle `question.yml` form exists and the CONTEXT-sections template has the `Title language` line (all done).

## `esoul-data` (project)


### Purpose
Keep project data (client files, media, dumps, import files, guides) in tracked `assets/` (Git LFS) and `docs/`, and keep data tasks from changing application code or the data model by proposing such changes as a new issue/task pair.

### Use cases
- An agent saves, backs up, unpacks or prepares client files, media, dumps or import files.
- An agent works on a `data-migration` task (import, fix, report, analysis) and finds that the solution needs code, schema, seeder or factory changes.
- The owner approves such a change in the data issue and the agent makes it (override).

### Coverage check
- Coverage: placement table and procedure (LFS rule check, save straight to `assets/`, config pointing, `assets/README.md`, size check) plus the data-task guard (when it applies, what is allowed, how to propose, what the new issue contains, override). Data rules themselves are pointers to `security-and-data.md` and `workflow.md`.
- Outside the purpose: the case-study row of the placement table (owned by lifecycle / website-launch) removed. Nothing else.
- Moved/merged: `esoul-project-data` + `esoul-data-task-guard` merged by the restructure (PD-D1); verified no duplicate guideline text remains.
- Gap closed: the "just do it" override contradicted the guideline without a recorded decision; now requires the owner's approval written in the data issue (DG-D1).

### Verdict / open points
The merge is coherent as one skill with two parts under a two-sided trigger: "saving project data" and "data task needing a code/schema change". The two parts share the same guideline anchor (`security-and-data.md`) and the same vocabulary (`assets/`, anonymised, `data-migration`), and neither part fires on the other's trigger in practice. Open: the override text is skill-only, beyond the guideline wording (DG-D1 as decided); the placement rule stays skill-owned (PD-D2(b)).

## `esoul-uat` (project)


### Purpose
Plan, verify, run and report end-user acceptance (UAT) of eSoul apps, e-shops and websites in a real browser, and turn failures into bugs through `esoul-task-create`.

### Use cases
- Create a UAT scenario catalogue for a new module or a new product type (`plan`).
- Check whether the catalogue still matches code, docs and design before a run (`verify`).
- Prepare an environment, accounts and the browser profile on a new machine (`setup`).
- Click through the scenarios as each role on desktop, tablet and mobile, with a layout and design comparison, recording evidence (`run`).
- Render the run report (Markdown, optionally PDF) and hand the manual remainder to a human tester (`report`).
- Turn failed results into issue + Freelo task pairs (or Freelo-only tasks) with one approved preview (`bugs`).
- Optionally keep scenarios and results in a living Google Doc for clients and testers (bridge).

### Coverage check
- **Missing coverage.** None found against the use cases. Gaps closed in this pass: a completion criterion per mode; a usable browser requirement outside the Claude-only extension (UT-D7); one bug severity vocabulary (UT-D1); one secrets location and an honest statement of password exposure (UT-D5); a staging-write rule that is explicit about its exception (UT-D4).
- **Content outside the purpose.**
  - The Google Doc bridge is about 60 % of the file mass (`gdoc.md`, `gdoc.mjs`, `Code.gs`, tests). It serves the use case "clients and testers fill results" and was kept in the skill by UT-D6(a) because `gdoc.mjs` imports the `uat.mjs` parser; it is now a clearly separated human setup + agent use section and is optional by wording.
  - The CMS-admin paragraph of `project-types.md` described one product's tabs; made generic ("when the admin has one").
  - Restated project rules (production read-only, client data, secrets, branch name, severity) were replaced by pointers or by the single table; what remains is agent procedure.
- **Moved to other skills.** AI-readiness, Lighthouse/performance budgets, axe depth: pointed at `esoul-quality-gates` (the checker itself lives there); the launch checklist `docs/nasazeni.md`: `esoul-website-launch`; bug title/category/Freelo form: `esoul-task-create`; PDF rendering: `esoul-docs`.
- **Third-party skill names** (`accessibility-compliance-accessibility-audit`, `frontend-lighthouse`, `seo-audit`) were dropped from the companion table because the owned `esoul-quality-gates` now covers the gates and AP-D1 removes `seo-audit`.

### Verdict / open points
- Needed and in the right layer (project, optional): the `## UAT` field is in every issue form and nothing else runs it; UAT stays skill-owned (UT-D3), consistent with TK-D1.
- Description is a trigger first (340 characters), body is 1 page, references are disclosed per mode.
- Open: whether the Google Doc bridge should one day become its own skill (decided now: stays, UT-D6(a)); whether existing Doc configs migrate with the manual `mv` (see record, Owner decisions 3); `Code.gs` stays Czech and untested offline (known, listed).
- Untested still: `layout-audit.js` (needs a browser) and the Apps Script half of `Code.gs` (needs a live Doc).

## `esoul-quality-gates` (project)


### Purpose
Verify the non-functional quality of a public eSoul website (or the public part of an application) with runnable gates, at any time and before launch, and say what a failing gate blocks.

### Use cases
- A developer finishes an AI-01…AI-06 slice, or changes markup, assets, headers or deployment, and runs the matching gate on the preview.
- A project adds Lighthouse budgets and axe to its pipeline.
- Before go-live `esoul-website-launch` runs every gate on staging and on production.
- An audit of a live site runs the AI-readiness checker on production.
- The case-study capture needs an AI-readiness report of the original site (commands live in `esoul-website-launch`).
- Planning or tasking AI slices needs the check ids, levels and the reference (crawlers, feeds, stack notes).

### Coverage check
- Missing coverage: the Lighthouse gate had no runner (prose only) → added `lighthouse-gate.mjs` with budgets, `--staging`, `--budget`. axe and prefetch have no script by design (axe belongs in the project's Playwright suite; prefetch is checked in the browser) → `gates.md` gives the spec snippet and the manual check.
- Outside the purpose: the go-live procedure, evidence rule, DNS switch and case-study snapshots → `esoul-website-launch`. The rules themselves (crawling, sitemap, preview gate, security headers list) → guidelines; the skill only verifies and points at them.
- Moved from lifecycle: AI-readiness core and reference, the `docs/ai-readiness.md` template, Lighthouse/axe/prefetch numbers (copied from `astro.md`, `company-rules.md`, `launch.md`).
- Heavy content split off: crawler/stack/content/contested material is in `ai-readiness-reference.md`, loaded only on demand (LC-D3(b)).

### Verdict / open points
Needed and distinct from launch: gates apply to applications and at any time; launch is a one-off procedure. Open: skill-side numbers (owner decision 1 in the change record), shared `web.mjs` with `esoul-website-launch` (decision 3), gates in CI templates (decision 4).

## `esoul-website-launch` (project)


### Purpose
Take a public eSoul website live in the order the public-website guideline prescribes, with one launch checklist and before/after case-study snapshots.

### Use cases
- Preparing and executing the go-live of a light-tier website or an application with public pages.
- Capturing "před" at bootstrap/retrofit and "po" at launch (Wayback fallback when the old site is gone).
- Filling `docs/nasazeni.md` for a full-tier project that has no light docs.
- Recording evidence and approved deviations for the launch.

### Coverage check
- Missing coverage: the old `launch.md` and `nasazeni.md` were two diverging checklists (forms-without-JS wording, switch order) → one checklist (`nasazeni.md`), `launch.md` is the procedure; the production gate run and the "po" snapshot were not boxes → added.
- Outside the purpose: the checks (Lighthouse, axe, headers, AI readiness) → `esoul-quality-gates`; phases and gates B0…B5 → `esoul-project-lifecycle`; the rules → guidelines.
- Kept here and not moved: `snapshot.mjs` (a launch/bootstrap evidence tool, not a gate); case-study storage and personal-data rules.
- Two skills instead of one (owner's open alternative `esoul-website-quality`): triggers differ (gates any time and for applications, launch once), and launch is a thin procedure (46 lines) that points at gates, so merging would put a one-off procedure into the description of an always-relevant gate skill. The cost is one shared helper (`web.mjs`) and a "needs esoul-quality-gates" note.

### Verdict / open points
Needed, small. Open: language of `nasazeni.md` (owner decision 2), cross-skill import (decision 3).

## `esoul-mockup-authoring` (project)


### Purpose
Builds, validates, locally previews and publishes a static mockup bundle for the eSoul mockups module, and iterates it from revision-bound client feedback.

### Use cases
- Turn a Pencil (`.pen`) design into a bundle through the Pencil MCP (the primary route).
- Adapt already built HTML or framework output into a bundle (linked states, image-only frames).
- Validate with the application's validator and inspect every frame in the local preview.
- Publish to the configured GitHub branch/directory with the user's authorization and prove the real review cycle.
- Apply the staff Markdown feedback export to the next revision.

### Coverage check
- Missing coverage: the Pencil-to-bundle route was promised ("adapt") but not described — added `references/from-pencil.md` (MK-D2). Feedback export location (MK-M11), data rule for bundle content (MK-M7), copy hazard of the Workshop Notes example (MK-M9), session handling in the review proof (MK-M10), no-app tests (MK-M15).
- Outside the purpose: the publish restriction to a dedicated sharing branch — removed, any configured branch (MK-D1); the MCP speculation about `mockups_*` tools (MK-M3); `metadata.version` (MK-M2); numeric schema limits that the validator owns (MK-M14); a second copy of the trusted-checkout and authorization text (MK-M5, MK-M6).
- Moved to another skill: nothing moved out; design work in Pencil itself stays with the lifecycle design step (named in the description as excluded), UAT chapters and throwaway prototypes are not served here.
- Delegation: browser inspection by job with a self-run fallback; no agent names.

### Verdict / open points
Keep; most mature of the three. Open: the dependence on the private application checkout (MK-D3, no decision in the ledger); the actual Pencil `execute` read API is documented by the Pencil MCP, not restated here, and could not be exercised in this environment (Pencil app not running) — verify `from-pencil.md` once against a live Pencil session.

## `gitmoji-commit` (helpers)


### Purpose
Turn an agent's finished work into a readable history: inspect, split by intention, stage, verify and commit, in the developer's own commit standard or, when none is stated, the recommended Gitmoji format.

### Use cases
- "Commit this", "stage and commit", "split into commits", "write a commit message", and the commit step of any task.
- Recording a commit convention in `CONTEXT.md` when none exists (`references/convention-bootstrap.md`).
- Picking the narrowest Gitmoji shortcode from the bundled catalog (`jq` projection).
- Not: rewriting existing, generated or bot commits.

### Coverage check
- Missing coverage: none. GC-D1 is reflected (developer's own standard wins; the guideline requires only English and a descriptive message; Gitmoji is the fallback). The format itself lives in `docs/project_guidelines/workflow.md` › Commits, not here.
- Outside the purpose: nothing left; the restated format rules and the "eSoul extensions" no-op were removed in the group-A pass. The 605-line `gitmojis.json` is a pinned offline catalog read through a 75-line projection (GC-D3 a), its hash and shortcodes verified by `tooling/scripts/test_gitmoji_catalog.mjs`.
- Moved: nothing in this pass; no leftovers from group A found (checked GC-M1..M10 and GC-D1..D4 against the files).

### Verdict / open points
Needed and within its purpose. Open: GC-D4 (Renovate `commitMessagePrefix`) is applied in the app-templates `renovate.json5`. Whether the catalog should follow upstream automatically stays a later question (GC-D3 c).

## `esoul-model-routing` (helpers)


### Purpose
Put the right model, effort and delegation behind each piece of eSoul work so usage stays low: roles by job, the brief a worker needs, the context budget and the usage report.

### Use cases
- Delegating to a subagent or a child chat (which role, which model alias, what the brief holds).
- Work that should be cheaper or faster, or usage that runs out too fast (context budget, size-based delegation).
- Briefing a generic subagent when the optional worker agents are not installed (`references/roles.md`, generated from `agents/*.md`).
- Measuring where usage goes (`tooling/scripts/usage-report.mjs`, run from a checkout).
- Human setup of models, settings, Zeron and Codex (`references/setup.md`).

### Coverage check
- Missing coverage: none found. Delegation by job with the three-step fallback (agent, generic subagent with `roles.md`, do it yourself) satisfies MR-D1: nothing in the skill needs `esoul-skills:*`.
- Outside the purpose: the human machine setup (models, `settings.json`, Zeron GUI, Codex install) is not agent procedure; it already sits behind a pointer in `references/setup.md`, each step marked person/agent. Kept there rather than a separate skill: it explains why the roles are what they are and is loaded only on request.
- Moved/changed here: `setup.md` now describes the shrunk hook rules (four guard lines + title), the `ops` tool allowlist and the Codex limit (agent files cannot set sandboxes). Roles file regenerated after the implementer/ops/uat-runner changes.
- Duplicated elsewhere: size-based delegation is stated in `esoul-workflow` too; this skill is the owner (MR-M3).

### Verdict / open points
Needed; purpose clear and content within it. Open: the usage report still depends on a repo checkout for its agent check (it prints "routing check skipped" otherwise, MR-M6); the session-title line lives in the injected rules and in `setup.md` (Zeron) — see Owner decision 1 in the record.

## `agents-hooks` (helpers (optional agents))


### Purpose
An optional convenience for people who run orchestrated subagents in Claude Code (plugin) or Codex: seven worker agents with pinned models, a SessionStart rule injection and a PreToolUse guard that keeps subagents off the main model, plus generated Codex equivalents.

### Use cases
- Claude Code plugin users: cheap, pinned workers (`scout`, `test-runner`, `ops` on Haiku; `implementer`, `reviewer`, `uat-runner` on Sonnet; `critical-reviewer` on Opus) and a guard that denies Explore, forks and model-less general-purpose/Plan agents.
- Codex users: the same roles as custom agents plus the rules block in `~/.codex/AGENTS.md`.
- Anyone without them: `esoul-model-routing/references/roles.md`, generated from the same `agents/*.md`, gives a generic subagent the same briefs.

### Coverage check
- Needed? Yes as an optional layer: the guard and the pinned models are the only enforcement of the routing (skills cannot pin a model). Optional and consistent with MR-D1: no skill names an agent (`test_skills.mjs` checks it); roles.md carries every brief; the skills' three-step fallback works without the plugin.
- Content outside the purpose: the injected rules were about 19 lines including context hygiene and CI waiting; reduced to the four guard-relevant lines plus the session-title line (AG-D2). The role -> agent list is not injected any more (descriptions and the routing skill carry it).
- Duplication: three hand-maintained copies of the rules (hook, Codex block, routing skill) are now two generated files from one template; the implementer's quality copy stays by decision (AG-D1) and matches the skill's question list.
- Boundaries: `ops` has an allowlist (Claude Code only; Codex cannot restrict tools or sandbox from an agent file); read-only agents are read-only by rule, with connectors off in Codex.
- Untested before: installer, generator error paths, receipt-command copy, rule drift: now covered by `test_codex_agents.mjs`.

### Verdict / open points
Keep as optional. Open: the title rule in the injected text (record, decision 1); Codex enforcement limits (decision 2); the `freelo` MCP server name assumption of `ops` (decision 3); any change to `agents/reviewer.md`/`critical-reviewer.md` still needs the review eval run (`tooling/review-evals/README.md`) — none was made in this pass.

## `esoul-office-documents` (business)


### Purpose
Renders business documents into the eSoul DOCX, XLSX and PPTX templates (fonts, logo, header, footer) through three stdlib/python-pptx scripts, in Czech or English.

### Use cases
- A report, contract, letter or questionnaire as a branded DOCX from Markdown (including a rendered offer handed over by `esoul-offer-authoring`).
- A price calculation or estimate as a branded XLSX with formulas, in a chosen language and currency.
- A client presentation as a branded PPTX from a JSON outline.
- Changing or auditing a template (company data in the footer, re-export).

### Coverage check
- Missing coverage: language and currency (Czech/CZK only before) — added `--lang`/`--currency` with English text, defaults unchanged (OD-D1(b)). Template provenance, owner, font licence and re-export procedure — added `assets/templates/README.md` and a footer smoke test (OD-D2(a)). Scripts without tests — added `scripts/test_office_documents.py`.
- Outside the purpose: sales location and offer content (offers live in a sales repository/folder; content and pricing belong to `esoul-offer-authoring`) — the skill points there; application guides as PDF belong to `esoul-docs` — both descriptions now say so (DOC-D5). Brand facts in `presentation-layouts.md` were a second copy of the template — deleted.
- Moved to another skill: the "no images in the Markdown subset" capability note came here from the offer skill (single owner of renderer capabilities).
- Boundary offer vs office documents: office documents own the renderers, the templates, the Markdown subset, verification of the file; offer authoring owns intake, research, pricing, terms, text and the content check. No overlap left in the SKILL texts.

### Verdict / open points
Keep as is, still needed; one skill per artifact family. Open: template owner and editable original (README says TBD); OFL confirmation of the fonts; Python tests need a Jenkins Python step (TL-D1).

## `esoul-offer-authoring` (business)


### Purpose
Takes an eSoul client offer from intake to handover: evidence research, scope and packages, pricing, the offer text and a content check, with rendering delegated to `esoul-office-documents`.

### Use cases
- Prepare a new offer for a client (site, e-shop, integration, information system), in Czech or English.
- Price or reprice an offer within a budget anchor and recompute every table.
- Revise an offer after feedback or changed scope.
- Check an offer's Markdown for wrong totals, wrong rate arithmetic, missing reserve, placeholders and missing statements before sending.

### Coverage check
- Missing coverage: first offer without a model (supplier block and payment terms were only taken from a previous offer) — now asked of the user, unknown ones `TBD` (OF-D2). Language/currency — `--lang`/`--currency` on the checker, language and currency asked at intake (OD-D1(b)). Where offers live — one internal sales repository or folder outside project repos, DOCX never committed (OF-D1). The checker had no tests and missed the reserve rule — added the reserve check and `test_check_offer.py` (OF-M7, OF-M8).
- Outside the purpose: renderer capabilities ("no images") and the AI/tooling rule — now only in the office skill's authoring rules (the offer skill keeps "describe deliverables and results"); the long research table, chapter order and business terms — moved to `references/` files rather than deleted. The "Common corrections" tail repeated earlier steps — cut to three items.
- Policy: reserve, variants and mandatory statements are sales policy, not guidelines — kept in `references/terms-and-pricing.md` with Tomáš Vojík named and "treated as current since 2026-11-24" (OF-D3).
- Boundary with office documents: this skill ends at a checked Markdown source plus the call to render and verify; it never restates template or Markdown-subset facts.
- Boundary with project skills: an offer is not a project artifact; no project data skill or lifecycle step is involved.

### Verdict / open points
Keep separate from office documents (content and process vs rendering). Open: name the real sales repository/folder (the skill uses `<sales>/<client>/…` and asks); optionally record the "offers live outside project repos" rule as one guideline line (owner decision); decimals and ranges in price cells are still skipped by the checker.
