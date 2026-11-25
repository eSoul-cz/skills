# Skills content review, 2026-11-24: what changed and why

Record for a later reviewer. Each part lists, per skill, what changed, why (one sentence) and the decision or audit ID. Where a change is the result of an owner decision the ID is the one used in the review ledger (reproduced in the appendix); `<ID>-M<n>` are the mechanical items and `<ID>-D<n>` the decisions of the content audit (`esoul-infrastructure/docs/research/2026-11-24-skills-content-audit.md`, per-skill findings with file and line before the restructure). Short IDs: WF workflow, RV review, GC gitmoji-commit, MR model-routing, TQ test-queue, TK tasking, FA freelo-task-authoring, FL freelo, LC lifecycle, PU project-update, PD project-data, DG data-task-guard, UT uat, DOC documentation skill, DT documentation tool, OD office-documents, OF offer-authoring, MK mockup-authoring, AG agents/codex/hooks, TL tooling, AP picks, RP repo-level files.

Principles applied (owner): the guidelines are the source of truth and skills hold agent procedure only; skills build on mattpocock's skills instead of fighting them; general skills never depend on the optional `esoul-skills:*` worker agents; every skill is checked for its purpose, use cases and coverage ([skill-purposes.md](../skill-purposes.md)).

Nothing was released: no tag, no npm publish, no plugin, guidelines, app-templates or documentation-tool release. Everything is listed under `## Unreleased` in [CHANGELOG.md](../../CHANGELOG.md) and [tooling/CHANGELOG.md](../../tooling/CHANGELOG.md).

The review ran as parallel slices, one per group of skills. Where a line says another "worker", "slice" or "contract" it means the part of this document that owns the named skill. Items a part handed over to the integration step ("Needs integrator") are resolved in Part 9 or are listed as owner decisions; they are not repeated.


## Where to find a change

| Skill or area | Part |
|---|---|
| `esoul-task-work`, `esoul-task-create` | Part 1 |
| `esoul-project-lifecycle` | Part 2 |
| `esoul-quality-gates`, `esoul-website-launch` | Part 3 |
| `esoul-project-update`, `esoul-data`, app-templates `declined` list | Part 4 |
| `esoul-uat` | Part 5 |
| `esoul-docs`, documentation tool | Part 6 |
| `esoul-office-documents`, `esoul-offer-authoring`, `esoul-mockup-authoring` | Part 7 |
| agents, hooks, Codex, Jenkins, tooling scripts, README, **every dropped third-party pick** (table in Part 8 under "layers.json") | Part 8 |
| guidelines change, cross-skill fixes, record and changelog | Part 9 |
| scenario gaps 2, 5, 6: setup update, `retired` map, `issue` and standards-only modes, standing small-admin decision, defects | Part 11 |
| hotfix: no `Backlog`, no estimate, task after the fix in the task skills | Part 13 |
| scenario re-check, mechanical gaps (no owner decision): create command and adopt checklist, retrofit fetch and retire rules, setup order, compatibility line, `:ambulance:`, browser tool, AGENTS.md skills list | Part 14 |
| `esoul-workflow`, `esoul-guidelines`, `esoul-review`, `esoul-testing`, `esoul-model-routing`, `gitmoji-commit` | applied by the group A review (earlier commits); this round only checked their purpose ([skill-purposes.md](../skill-purposes.md)) |

## Part 1: Task skills: `esoul-task-work`, `esoul-task-create` (group B)

### esoul-task-work (core)

- SKILL.md description rewritten to lead with the trigger ("Use when starting work…"), names the purpose in one sentence and points creation to `esoul-task-create` — writing-for-agents: trigger first, one branch per trigger — [TK-M1, FL-M1]
- Pick-up flow handles an unassigned `To Do` task: with no named task, list `To Do` tasks that have no worker or are already the assignee's and let the user choose; the assigned-task guard treats "no worker/assignee" as no conflict; step 4 assigns the session's assignee first, then moves to `In progress`; the moves table says "an unassigned task gets the assignee of step 0" — `To Do` no longer requires an assignee, so an unassigned task is ready for anyone — [FA-D2]
- Readiness check in pick-up now reads "acceptance criteria, an estimate, no open blocker; an open `question` issue counts as a blocker" and points at `references/freelo.md › States and estimates` (one definition) — a question blocks work per the guideline — [FA-D2, TK-M5, LC-D5]
- Section 3 gets the **Title** procedure: derive the PR title from the task title as `docs/project_guidelines/workflow.md` › Tasking / › Pull requests say; map into the developer's commit standard; for the recommended Gitmoji format the context becomes lowercase kebab-case `[context]` and the result the message (worked example `Order history: Add filter` → `:sparkles: [order-history] Add filter`); `gitmoji-commit` when installed, otherwise the developer's/repository's own standard. The rule itself (shape, English, same result) is not restated — the guideline owns it — [FA-D3, TK-D3, TK-M3, GC-D1]
- Section 0.2 now says `references/freelo.md` holds the CLI and MCP name of each operation used here — FL-D2 (both names in recipes) — [FL-D2]
- references/freelo.md: **tool-name table** (move, set worker, finish/reopen, work report, find user, list tasks) with CLI and MCP names; tool order stated once ("MCP tools when mounted, otherwise the CLI") — [FL-D2]
- references/freelo.md: `To Do` = complete + acceptance criteria + approved estimate + no open blocker, NO assignee ("an unassigned task in `To Do` is ready for anyone; whoever picks it up assigns themselves"); `Backlog` is the default for new work; the one-week sprint sentence is not present (confirmed dropped) — [FA-D2, FA-M11]
- references/freelo.md: estimate rule rewritten: "the person's time on the task … 15-minute steps, split above 4 hours; agent time is not estimated; the same measure a work report records: the person's active time, measured from the session when one exists" — [FA-D2, FL-D3]
- references/freelo.md › Work reports: opens with "A work report is the person's active time on the task, measured from the session when one exists, and never waiting" (the second place of FL-D3), and names MCP `manage_work_reports` next to `freelo reports` — [FL-D3]
- references/freelo.md › Computing the minutes: the three transcript layouts and their paths (Claude Code, omp, Codex), the extended wait/subagent lists, "a session that served several tasks needs `--from`/`--to` per task", and a concrete blind-spot rule for the spot-check (a wait command the script does not recognise, a long download → redo with the timeline) replacing "when it looks off" — [FL-D4, FL-M8, FL-M11]
- references/freelo.md: delete-target wording keeps `freelo api delete /task/<id>` (MCP `delete_task`) once; `labels create` by name is explained once ("a label created by name makes a duplicate") — already in place, reworded without a negation — [FL-M2, FL-M3]
- scripts/work-report-minutes.mjs: format is detected per record. New `toolEvents(record)` normalises Claude Code (`tool_use`/`tool_result`), omp (`toolCall` blocks; separate `toolResult` messages with `toolCallId`/`toolName`) and Codex (`response_item` `function_call`/`custom_tool_call` and their `*_output`; command from `arguments.cmd` / `input`). Tool names are compared lower-case. Waiting tools: `monitor`, `wait` (omp/Codex shell-job wait). Subagent tools (count in full): `agent`, `task`, `skill`, `workflow`, `wait_agent`, and an omp `wait` whose result lists `[task]` jobs. `compute`/`classify` keep their signatures — before this the script ran on an omp transcript but saw no tool names, so every gap was capped at 5 minutes and the number was silently wrong — [FL-D4(b), FL-M8]
- scripts/fixtures/omp-session.jsonl, codex-session.jsonl (new): 13 and 14 hand-written, anonymised records (synthetic ids, `/home/dev/example-app`, no real transcript content) in the real layouts, including non-message records (session header, model change, `session_meta`, `task_started`). Tests (existing test file, +4 cases): omp fixture totals, Codex fixture totals, `toolEvents` on the three layouts, the CLI on an omp file. 14/14 pass; also smoke-run on a real omp and a real Codex transcript of this machine (no output kept) — [FL-D4(b), FL-M11]
- Script header comment lists the three layouts and the new wait/subagent names — [FL-M8]
- `Task` in the documented subagent list now matches the code in freelo.md and the header (was missing in the docs) — [FL-M8]

Already in place from the restructure (verified, nothing to do): official-skill install pointer instead of `--agent codex` command (TK-M7); no awk one-liner copy (TK-M8, esoul-workflow owns it); install command and `esoul-freelo-task-authoring › cli-recipe` path ambiguity gone (FL-M10); review time reported when it happens (FL-M9); no model name or `esoul-skills:*` agent name (MR-D1).

### esoul-task-create (project)

- SKILL.md description rewritten: trigger first ("Use when asked to add, specify, split, revise or pair…"), both modes named, question trigger added, "builds on the official `freelo` skill; moving and closing tasks is esoul-task-work" — [TK-M1, FA-M1]
- New section **Minimal path (S work)**: outcome as title + one observable acceptance criterion + one existing category label; no interview, subtasks or `## UAT` (the criterion carries the verification); one duplicate search by the title words, once per system; one preview line to approve (`<tasklist> · <title> · <label> · <criterion> · duplicates: …`); tasklist `Backlog` unless an approved estimate is given; leaves the minimal path when a design choice, several results or a user-visible flow appears. §5 notes "the minimal path previews in one line" — [TK-D2(b)]
- Intro: the issue-first / small-admin / `profile/internal` restatement shrunk to the pointer + "this skill also serves S work through the minimal path; the exception is the user's decision" — [TK-M2]
- §3 **Title** bullet replaced by a pointer to `docs/project_guidelines/workflow.md` › Tasking (shape, no prefix, no slice ID, same title) + `task-content.md › Title` (choosing context and language) + "the PR title is derived when the PR is opened (`esoul-task-work`)" — the title rule is the guideline's — [FA-D3, TK-D3, TK-M3]
- §3 **Question** bullet rewritten per LC-D5: a question is not a task; issue labelled `question` (Freelo-only: a task with that label), titled as the decision asked, no category label, no `## UAT`, no estimate; body follows the repository's `question` issue form `.github/ISSUE_TEMPLATE/question.yml`; in `github-freelo` it has no Freelo counterpart; the answer is recorded as ADR/glossary/guideline and the question closed with a link; dependent work gets `blocked_by` — [LC-D5, TK-M5]
- §4 Metadata: `To Do` = complete + approved estimate + no blockers, no assignee needed; assignee only when the user wants one; a question needs no label — [FA-D2]
- §1.2 and the github-freelo reference: "projects, repositories, tasklists and labels are never created as a setup shortcut" is said once in SKILL.md; the other copies (github-freelo.md, project-mapping.md caption) were reduced — [single-source cleanup of "never create labels", TK §4]
- §0: tool order stated as "MCP tools when mounted, otherwise the CLI"; recipe pointer says it names both — [FL-D2]
- references/cli-recipe.md rewritten as a table: step → MCP tool → CLI (create task, description, label by UUID, estimate via `update_task`/raw route, relation via `manage_task_relations`/raw route, read back, search, files). The raw routes remain only where the CLI has no flag; the MCP names remove the dependence on raw endpoint knowledge — [FL-D2, FA §4 cli-recipe]
- references/github-freelo.md: blocked_by recipe completed (database `id` not number or `node_id`; POST; the list call `…/dependencies/blocked_by`; "unblocked when every blocker is closed") — moved here from the deleted `docs/agents/issue-tracker.md` (`git show HEAD:…/docs/agents/issue-tracker.md`); the paragraph after the classification step notes a `question` is issue-only; slice header is owned by the repository's `## Tasking convention`, title rule pointed to the guideline — [LC-D2, TK-M9, LC-D5]
- references/task-content.md: Title section reduced to the context choice and the title-language cases (examples kept); the PR-title wording and the Czech-project PR description were the guideline's and moved out; estimate paragraph now defers the unit to `esoul-task-work` (person's time, 15-minute steps, work report = the same measure) and keeps only the creation-side rules (confidence, split proposal, parent estimate) — [FA-D3, FA-D2, FL-D3]
- references/duplicates.md: `To Do` refinement re-checks "readiness (complete, estimated, no blockers) and the due date" — no assignee requirement — [FA-D2]
- references/interview.md: Question archetype aligned with the SKILL.md bullet (options with a recommendation; not a task); LTT archetype no longer says "one-sprint result" (sprint concept dropped) — [FA-M4, FA-M11]
- references/uat.md unchanged: the `## UAT` format stays skill-owned — [TK-D1, UT-D3]
- references/project-mapping.md, convention.md: unchanged in substance (already in the post-restructure form: `## Freelo` after `## Tracker`, no version string, no restated title rule beyond the value of `Title language`) — [FA-M5 (this half), FA-M7]

Already in place from the restructure (verified): description-language pointer to `## Language per place` and the security pointer with the anonymised-sample exception (FA-M2); acceptance criteria on every task/issue (FA-M3); Question and data/import (`data-migration`, separate code issue) archetypes (FA-M4); no "(verified with CLI 1.3)" (FA-M7); interview opening sentence and checkable bound (FA-M8); one lifecycle pointer and one delegation paragraph per skill (FA-M9); no "skills already loaded" no-op, positive phrasing, no "MCP/CLI currently supports" hedge (FA-M10); milestone and assignee in the preview (TK-M6).

### Not applied

- FL-M11 "false-positive command words" test (a commit message containing `test`, `ls tests/`) — the script's `WAIT_COMMAND` matches words anywhere in a command; pinning that with a test would assert a known defect, and changing the matching is a behaviour change nobody decided. The limitation is now named in `references/freelo.md` step 3 (spot-check). The other FL-M11 cases (`[testq] waiting`, `Monitor`, `Task`, record without timestamp, `main` via `spawnSync`: `--help` 0, missing file 1, `--json` shape) existed already.
- TK-M4 (`- Title language:` line in `CONTEXT-sections.md` and the README example) and FA-M5's CONTEXT-sections half (task-label UUID home) — files of the lifecycle skill / README; see Needs integrator.
- TK-M9 "verify once on a throwaway issue": the recipe is the one that the project's template already carried and the GitHub REST dependency endpoints; I did not run it against GitHub [INFERENCE until a first real use].
- FL-D1, FL-M3–M7 (copy of the CLI skill): the `freelo` copy no longer exists (FL-D1 settled by the restructure).

### Owner decisions needed

1. **Question issues in `github-freelo` have no Freelo counterpart** (applied as the default in SKILL.md §3 and github-freelo.md). Reason: a question is not work to estimate, move or report on; the issue is the register (K1). Options: (a) issue only (applied); (b) issue + a Freelo task labelled `question` so the client-facing project board shows them. Recommendation: (a); revisit if the Freelo board is used to chase client answers.
2. **Minimal path tasklist.** The S path creates in `Backlog` unless an approved estimate is given (then `To Do`), and `esoul-task-work` moves it to `In progress` on pick-up. Options: (a) as applied; (b) allow S tasks created at the moment of starting work to go straight to `In progress`. Recommendation: (a) — it keeps one readiness definition.
3. **Who chooses an unassigned `To Do` task.** Applied: when the user names no task, the agent lists the unassigned/own `To Do` tasks and the user chooses (an agent never self-selects). Alternative: the agent takes the first ready one. Recommendation: keep the user's choice.

## Part 2: `esoul-project-lifecycle` (group C)

### esoul-project-lifecycle

#### SKILL.md
- Description rewritten to lead with the trigger (starting/onboarding/auditing, after a client meeting, writing an ADR/glossary/design brief/plan), names what it does in one clause and ends "Prepares work for `esoul-workflow`; does not implement features" (415 characters) — the old one led with a vague verb and repeated the mode table and the installer detail — [LC-M3]
- Load rules (§1) replaced by one sentence: guidelines and CONTEXT.md override the skill and conflicts are reported; ADR index/plan README read when the mode touches decisions or the plan; GLOSSARY.md in full only in `glossary`, `audit`, `retrofit` — the five mode lists were not applicable — [LC-M2, audit §4 load rules]
- §4 "Company rules this skill enforces" (21 lines, a second copy of company-rules.md) replaced by "Rules that live elsewhere": one table row per topic with its owner (guideline file › heading, skill), plus the three things the lifecycle owns (tiers, gates B0–B5, label set) — the skill holds process, guidelines hold rules — [LC-M1, LC-D1]
- Removed from §4/§5: link-prefetch rule and its orphan `frontend.md` pointer, Lighthouse/axe, AI-readiness gate, Astro Checks restatement (one pointer row), case-study as a company rule — non-functional gates leave to `esoul-quality-gates`, case study is process pointed at `esoul-website-launch` — [LC-D1, LC-D6, LC-M13]
- Mode table: `company-rules` dropped from `plan`, `tasking`, `audit`; `labels` added to `bootstrap`, `tasking`, `audit`; `tiers` loaded only when the profile is missing; `case-study` no longer loaded by `bootstrap`/`retrofit`; the `guidelines` mode row removed (the installer is the core skill `esoul-guidelines`; residual row only pointed to it); the `launch` mode removed and replaced by a "Not modes of this skill" paragraph (go-live and case study → `esoul-website-launch`; Lighthouse/axe/prefetch/security headers/AI readiness → `esoul-quality-gates`; installer → `esoul-guidelines`; template update → `esoul-project-update`) — [LC-M1, LC-M24, LC-D6, LC-D1]
- Guardrails shrunk to pointers: documentation changes follow the project's workflow guideline (PR in client repos, direct push allowed under `profile/internal`, ask never assume); TBD/open questions → `domain.md` › Open points and conflicts; accepted ADRs → adr.md; data placement → `security-and-data.md` plus the local `assets/klient/`, `docs/podklady/`, `_reference/` facts. Kept: "a missing fact becomes a `question` issue", numbers only from podklady (owner: keep in lifecycle for now), remote-write limits, identifiers, placeholders, copy-only-missing — [LC-M4, LC-M5, LC-D1]
- `DOC-NNNN` dropped from the identifiers list (owned by `esoul-docs`) — [LC-M27]
- Subagent paragraph (§1.4): delegation by job, "otherwise do these steps yourself"; no agent names — [LC-M8, MR-D1]
- Companion table: added `esoul-task-work`, `esoul-guidelines`, `esoul-project-update` (what it does, "not a mode of this skill"), `esoul-website-launch`, `esoul-quality-gates`, `esoul-data`, `esoul-office-documents` (client questionnaire as `.docx`), `esoul-review`/`esoul-docs` kept; the "name the layer holding it" layer list (an environment cache that contradicted the README's dependency-resolving helper) replaced by "`npx @esoul-cz/skills layers` / `install <layer>` and do the part that needs no companion" — [LC-M6, LC-M25, LC-M7, LC-D6]
- Install pin: the old `skills@1.7.2` command is gone from SKILL.md; no version pin left anywhere in the skill — [LC-M7]
- P0 row names the case-study snapshot as `esoul-website-launch`; P9 row links `labels.md` for `ready-for-agent` — [LC-D1, LC-D6]

#### references/company-rules.md
- Deleted (`git rm`) — none of it was lifecycle-only; each rule is a pointer to a guideline or a skill (table in SKILL.md §4) and its heading contradicted "guidelines are the source of truth" — [LC-M1]

#### references/labels.md (new, 23 lines)
- One source for the GitHub label set: category labels (exactly one), add-ons `integration`/`bug`, `question` (not work: no category, no UAT), triage labels, Renovate `dependencies`, and the `ready-for-agent` readiness rule (UAT, verified paths, no open `blocked_by`, no open question/proposed ADR; flipped at B5) — replaces `triage-labels.md`, the copies in bootstrap step 12, tasking-batch and CONTEXT-sections, with `conformance.mjs` `CATEGORY_LABELS` as the checker — [LC-D1 (label set + `ready-for-agent` stay in the lifecycle only), LC-D2(a), LC-M29]

#### references/bootstrap.md
- Client/project stories removed ("Indcom and VONO did this…", "VONO skips PHPStan") — public repository — [LC-M23]
- Step 2: README sections "Odchylky od návrhu"/"Naměřeno" deleted (no guideline refers to them); commit example is the recommended-Gitmoji form with an English imperative — [LC-M12, GC-D1]
- Steps 3–4: issue forms are `task`, `bug`, `question`; `docs/agents/` and its light-tier edits removed; light tier takes `docs/nasazeni.md` from `esoul-website-launch` — [LC-D2(a), LC-D5, LC-D6]
- Step 9 rewritten as "Public website": case-study "před" snapshot → `esoul-website-launch`; baseline AI-readiness report and the project's `docs/ai-readiness.md` template → `esoul-quality-gates`; AI slices stay in the plan — [LC-D1, LC-D6]
- Step 12: merge/ruleset settings point at the guideline `workflow.md` › Pull requests (the `gh api` preview procedure stays); labels → `labels.md` — [LC-M1, LC-D1]
- Step 7: `gitmoji-commit` "when installed" confirms the commit convention — [GC-D1]
- "Done when" sentence for the whole step list; delivery sentence "follows the project's workflow guideline (a PR in client repositories)" instead of "one PR" — [LC-M24, LC-M4]
- Placeholder table: `{{TITLE_LANGUAGE}}` added next to `{{TASKING_MODE}}` — matches the compact `## Tasking convention` form of `esoul-task-create` — [LC-D5 follow-up, FA-D2]

#### references/retrofit.md
- Doglead/Plemenná kniha story removed — [LC-M23]
- Original-site check points at `esoul-website-launch`; the "no report files" sentence now cites `workflow.md` › Repository rules (one clause) — [LC-M1, audit §2]
- Step 3 includes the `question` issue form; step 11 uses `npx @esoul-cz/skills project init` and `skills-lock.json` instead of "Vendored skills" — [LC-D5, V4 layout]
- "One retrofit step per PR" → per change (PR in client repositories, `profile/internal` MAY push directly); "Done when" sentence added — [LC-M4, LC-M24]

#### references/audit.md
- AI-readiness live check delegated to `esoul-quality-gates` (the command line is its job); `question` issues exempt from category/UAT/Freelo checks and checked for form sections; light tier lists `Commit convention` — [LC-D1, LC-M15, LC-M16]
- Six testing rows (10-minute budget, group names, tier lists, CI cost details) collapsed to three: agent rules vs `testing.md`; suite meets the MUST/SHOULD rules of `testing.md` with named exceptions; CI cost per `tools.md` — [LC-M14]
- Questions row links `labels.md` for `ready-for-agent` — [LC-D1]

#### references/tasking-batch.md
- Step "Load company-rules.md" removed; labels → `labels.md` with the readiness rule; `docs/agents/issue-tracker.md` pointer for the `blocked_by` command replaced by `esoul-task-create` › `references/github-freelo.md` (recipe moved there by the TaskSkills worker); `To Do` wording no longer requires an assignee (points at the Freelo working rules of `esoul-task-work`) — [LC-M1, LC-D2(a), FA-D2]
- AI-ready slices paragraph points at `esoul-quality-gates`; ops/explorer text by job with fallback — [LC-D1, LC-M8]

#### references/plan-and-slices.md
- VONO phase codes → "a project may use its own phase codes"; 4 h human-time rule replaced by a pointer to the Freelo working rules of `esoul-task-work`; Titulek follows `Title language`; AI-slices section shortened to a pointer (guideline `public-website.md`, `esoul-quality-gates`); "Done when" added — [LC-M23, FA-D2, LC-D1, LC-M24]

#### references/podklady-and-legacy.md
- Data placement and "Personal data" sections shortened to a pointer at `security-and-data.md` plus the local facts (anonymisation script location, parity fixtures hold numbers only); case-study path row points at `esoul-website-launch`; "Open one PR" → deliver as the workflow guideline says; "Done when" added — [LC-M20, LC-D6, LC-M4, LC-M24]

#### references/questions-and-client.md
- A `question` issue is created from `.github/ISSUE_TEMPLATE/question.yml`; the six sections are listed once, title shape `Context: Decision asked`, "not a work item: no category label, no `## UAT`, in `github-freelo` mode no paired Freelo task"; questionnaire names `esoul-office-documents` (`.docx`); ops helper text by job — [LC-D5, LC-M25, LC-M8]

#### references/glossary.md, adr.md, design.md, dev-handover.md, tiers.md, root-files.md
- glossary: the "new term in the same PR" rule cites `documentation.md`/`domain.md`; "Done when" added — [LC-M5, LC-M24]
- adr: "ADR or guideline?" → pointer to `documentation.md` › ADR or guideline (keeps the light-tier `rozhodnuti.md` line); "sonnet" background subagent → read-only helper with fallback; "Done when" added; format, status lifecycle and change procedure kept — [LC-M19, LC-M8, LC-M24]
- design: "Done when" added — [LC-M24]
- dev-handover: Indcom/VONO sentence removed — [LC-M23]
- tiers: case study / AI readiness / go-live / L6 rows point at `esoul-website-launch` and `esoul-quality-gates`; `launch` mode wording removed; templates line says `docs/nasazeni.md` comes from `esoul-website-launch` — [LC-D1, LC-D6]
- root-files: `.esoul/template.json` "belongs to the update flow of `esoul-project-update`"; issue-forms row lists `question` — [LC-M6, LC-D5]

#### references/stacks/*.md
- astro: gates item 6 → `esoul-quality-gates` (Lighthouse numbers, axe, prefetch, AI readiness removed from the profile); launch.md link → `esoul-website-launch`; `skills@1.7.2` pin removed; "komfort-servis" removed (lesson kept) — [LC-D1, LC-M7, LC-M23, LC-M10]
- laravel: Indcom/SCHOK/VONO names and Vue 3/React 19 versions removed; "Three eSoul projects … autumn 2026" dropped (pitfall kept); the `[FE]/[BE]/[DATA]` prefix and `data-migration` PHP pitfalls deleted (guideline `workflow.md`, `security-and-data.md`); pin removed; AI-readiness pointer → `esoul-quality-gates` — [LC-M22, LC-M23, LC-M7, LC-D1]
- lsr: "PHPStan level 10", "Inertia 3 and Vue 3" replaced by "the checks of `tools.md`"/no versions — [LC-M22]
- lunar: "Inertia 3 and Vue 3" dropped; AI pointer → `esoul-quality-gates` — [LC-M22, LC-D1]
- new-stack: pin removed; public-website item points at `esoul-quality-gates` — [LC-M7, LC-D1]

#### scripts/conformance.mjs (+ test)
- `question` issues: exempt from `issue-category-label`, `issue-uat`, `issue-freelo-link` (decided: no Freelo pair for questions); title-prefix/slice-ID checks still apply; new warning `question-sections` when a question issue lacks one of the six form sections; `issue-summary` reports the count — [LC-M15, LC-D5]
- Light tier requires `Commit convention` (`CONTEXT_SECTIONS.light`) — [LC-M16]
- "company rule: …" in eight messages replaced by the guideline source (`workflow.md` › Tasking / Pull requests, `documentation.md`) or the owning skill (`esoul-task-create`, UAT format); messages for case study/AI readiness name `esoul-website-launch` / `esoul-quality-gates` instead of removed reference files — [LC-M28, LC-D6]
- Tests: `--github` question-issue test (exemption, `**Otázka**` bold form accepted, missing section warned, title rule still applied, work item still checked); light `Commit convention` test. Output and tests were already English — [LC-M15, LC-M16, LC-D4(a)]

#### assets/templates
- `docs/agents/` (issue-tracker, triage-labels, domain) deleted (`git rm`); the `blocked_by` recipe is in `esoul-task-create` already; labels in `references/labels.md` — [LC-D2(a), LC-M29]
- `root/.github/ISSUE_TEMPLATE/question.yml` created: English form text, label `question`, fields Otázka / Proč na tom záleží / Možnosti / Doporučení / Blokuje / Co platí do odpovědi (labels equal the existing prose section names, so existing question issues stay valid), no UAT, no Freelo field — [LC-D5(a)]
- `bug.yml`: Impact description carries the severity mapping (Blocks a key flow, Distorted data, Exposes personal or foreign data → Critical; Functional limitation → Major in a main flow, otherwise Minor; Cosmetic → Nitpick), options unchanged; UAT field label is `UAT` (was "UAT (regression check)") as agreed with the UAT worker — [UT-D1, UT-D2, LC-M26]
- `root/AGENTS.md`: data-migration and glossary-in-same-PR rules deleted (managed block carries them); skill list reduced to names with one job label and a pointer to `.agents/skills/<name>/SKILL.md`, `esoul-project-update` and `esoul-testing` named; `docs/agents/` pointer removed; the grilling pointer corrected to `esoul-workflow` › `references/upstream.md` (`grilling.md` no longer exists) — [LC-M18, LC-M6, LC-D2(a)]
- `root/CONTEXT-sections.md`: `## Tasking convention` rewritten to the compact form of `esoul-task-create` (`Mode`, `Title language`) plus project specifics only (repository, slice header and milestone, category label from the repository's own label set, UAT dimensions, dependency note); states, estimates, titles, dependencies point at `workflow.md` › Tasking and `esoul-task-create`/`esoul-task-work`; language matrix updated and made truthful (adds `docs/rozhodnuti.md` to English, names the Czech tokens of the English forms: `Slice/Fáze/Rozsah/mimo plán`, `Role/Předpoklad/vývojář eSoul/Bez uživatelsky viditelného dopadu`, the question sections); reading-order prose reduced to the list plus the guideline citation — [LC-M26, LC-M1, FA-D2, LC-D4(a)]
- `docs/adr/index.md`: status table and "When to write an ADR" replaced by pointers to `domain.md#adr-status-authority` and `documentation.md#adr-or-guideline`; `adr/0000-template.md`: change-policy comment → one line pointing at Rules in `index.md` (the one copy) — [LC-M19]
- `docs/podklady/README.md`: "bez osobních údajů" added, "reálná data" section renamed "Data v podkladech" (operational material, no personal data), gitignored-folder rule points at `security-and-data.md`; `docs/legacy/index.md` Zdroje section shortened the same way — [LC-M20]
- `docs/plan/README.md`, `docs/plan/seznam-slices.md`: estimate unit and 4 h rule removed ("Odhady patří do Freela"); `To Do` needs complete description, approved estimate, no blockers (no assignee) — [FA-D2, audit §2]
- `light/docs/rozhodnuti.md`: translated to English (the light-tier decision register ranks with ADRs, which are English; developer-facing); "at least one rejected alternative when there is one" (was "at least two"); statuses `proposed`/`accepted`/`superseded by D-nn` (ADR vocabulary, was `navrženo/platí/nahrazeno`); anchors changed accordingly — [LC-M11, LC-D4(a)]
- `light/docs/plan.md`, `light/docs/sitemap-a-meta.md`: the AI-readiness pointer names `esoul-quality-gates`; canonical-URL, HTML-content and 301/410 text point at `public-website.md` instead of restating it — [LC-D1, audit §2 row `launch.md:22-23,48`]

#### agents/openai.yaml
- Default prompt: "bootstrap, retrofit, plan, client-update or audit" (there is no `update` mode; template update is `esoul-project-update`) — [LC-M6]

### Moved or left to other workers (not edited here)
- `references/launch.md`, `ai-readiness.md`, `case-study.md`, `scripts/ai-readiness.*`, `scripts/snapshot.*`, `assets/templates/docs/ai-readiness.md`, `assets/templates/light/docs/nasazeni.md` were already moved (git rename) or are owned by the WebsiteQuality worker; I only removed every mention and pointed at the two new skills — [LC-D3, LC-D6, LC-M10, LC-M13, LC-M21]
- `references/guidelines.md` was already gone (the restructure moved it to `esoul-guidelines`) — [LC-M9]

### Not applied
- LC-M17 (wire the lifecycle tests into `tooling/scripts/test_skills`): not my file; the README already says Jenkins runs the lifecycle script tests — integrator to confirm the script paths after the moves (see Needs integrator).
- LC-M21 (one launch checklist), LC-M10 (case-study trim), LC-M13 launch/nasazeni prefetch wording, LC-D3 split, LC-D4 `ai-readiness` header sets/Czech test names: owned by the WebsiteQuality worker.
- LC-M9 (guidelines.md shrink): the file no longer exists in this skill.
- `task.yml` unchanged: its Czech tokens are the shared format (LC-M26 says keep and list them in CONTEXT-sections, done); its category hint stays as the form's one-sentence help.
- `light/docs/plan.md`, `sitemap-a-meta.md`, `design-log.md`, `obsah-*.md` stay Czech: client-read documents (LC-D4(a) "client-facing stays Czech"). `light/docs/nasazeni.md` language is the WebsiteQuality worker's.
- Gate B0–B5 table, label set, "numbers only from podklady" deliberately stay (LC-D1).
- LC-D3 (core/reference split of ai-readiness), LC-M17 and the Czech header-set parser: not mine.

### Owner decisions needed
1. **Freelo pair for `question` issues.** Options: (a) none, the issue alone is the register (implemented; conformance exempts them from the Freelo link); (b) pair each with a Freelo task for the client-facing board. Recommendation: (a) — a question is a register entry the questionnaire is generated from; `esoul-task-create` should follow (see Needs integrator).
2. **Labels of `question.yml` are Czech** (Otázka, …): the form text is English but the section names stay the existing prose names so retrofitted/existing question issues and the questionnaire grouping keep working. Alternative: English labels and a one-time rename of existing question issues. Recommendation: keep Czech (they are client-facing content, listed in the language matrix).
3. **Light-tier language.** `rozhodnuti.md` is now English (developer-facing decision register); `plan.md`, `sitemap-a-meta.md`, `design-log.md`, `obsah-*.md` stay Czech. Confirm the line, or translate more.
4. **Stack profiles' "Typical ADR topics" and "Pitfalls".** They are knowledge about the stack, not lifecycle procedure; the guidelines (`framework/<stack>`, `tools.md › Known pitfalls`) are their natural home. Options: keep (current), move pitfalls to the guideline layers, keep topics in the skill. Recommendation: move the pitfalls to the guidelines in the next guideline release; keep the ADR topics (they drive the `adr` mode).
5. **Split of the skill by purpose.** See `purpose-esoul-project-lifecycle.md`: the remaining 11 modes fall into repository setup (`bootstrap`, `retrofit`, `handover`, `audit`) and documentation upkeep (`intake`, `client-update`, `glossary`, `adr`, `design`, `plan`, `tasking`). Not split now (one description, one router); revisit if `design` or `plan` keep growing.
6. **"Numbers only from podklady"** stays in the lifecycle (SKILL.md Guardrails, AGENTS.md template); `documentation.md` › Evidence is not a specification covers only part. Candidate for a guideline sentence (`domain.md`/`security-and-data.md`).

## Part 3: `esoul-quality-gates` and `esoul-website-launch` (group C, new)

### esoul-quality-gates (new, project layer)

- Created the skill (`SKILL.md`, `agents/openai.yaml`, `references/gates.md`): when to run each gate (any time, in CI, mandatory before launch), how to run (scripts), what a failing gate does (blocks the go-live unless the project lead approves a deviation with a reason; reports otherwise; never lower a number to go green) — LC-D1 and its follow-up (name and scope suggested by the owner; kept separate from launch because gates apply at any time and to applications)
- Moved `references/ai-readiness.md` here and split it: core `ai-readiness.md` (126 lines: scope, principles, one checks-by-slice table AI-01…AI-06, checker, run moments, exceptions) and `ai-readiness-reference.md` (crawlers, real-bot proof, feed formats, stack notes, content rules, contested list), loaded only by the rows that need it — LC-D3(b)
- Dropped from the reference: UA strings, IP-list URLs and per-vendor facts that duplicate `BOTS` in the script or age (Seznam `Request-rate`/FreshBot, "24 hours" OpenAI note, the "researched on 2026-11-12" line, the 2024-study claim); crawler table now holds token, operator, type, and points at `BOTS` as the single source — LC-D3, audit sediment finding, LC-M23 spirit (no dated vendor facts)
- Kept the lifecycle-owned slice IDs AI-01…AI-06 in the core table (levels, check ids, G/S ownership, K7 levels `llms-txt` should / `markdown` info unchanged) — contract with the Lifecycle worker
- Moved `assets/templates/docs/ai-readiness.md` to `assets/templates/ai-readiness.md` (project target `docs/ai-readiness.md`) and translated it to English (`## Exceptions`, `Check | Scope | Reason | Confirmed by | Date`) — LC-D4(a)
- `scripts/ai-readiness.mjs`: all messages, report text, status words (`OK/FAIL/WARN/INFO/SKIPPED/EXCEPTED`), usage and errors translated to English; parser accepts `## Exceptions` and the Czech `## Výjimky` header sets (`Check`/`Kontrola` header row); detection patterns for Czech content (IČO, `obchodní podmínky`, …) deliberately stay Czech — LC-D4(a)
- `scripts/ai-readiness.test.mjs`: all 32 Czech test names and message assertions translated; added a test that the Czech `Výjimky` set is parsed too; imports `loadPlaywright` from `web.mjs` — LC-D4(a)
- New `scripts/web.mjs` (+ `web.test.mjs`): the URL/sitemap/link helpers, `importPackage`, `loadPlaywright`, `hasChrome`, `hasLighthouse`, `runLighthouse` extracted from the old `snapshot.mjs`, because both skills' scripts need them and a skill cannot import from a script that now lives in another skill; helper tests moved from `snapshot.test.mjs` — LC-D1/D6 consequence of the split
- New `scripts/lighthouse-gate.mjs` (+ tests in `web.test.mjs`): mobile Lighthouse on the key templates against the budgets, `--staging` skips SEO, `--budget metric=value` carries a project's own numbers, exit 0/1/2 — the Lighthouse gate had no runner (only prose in launch.md/astro.md/nasazeni.md) — LC-D1 follow-up ("how to run (scripts)")
- Link prefetch, axe and security headers are described in `gates.md`; security headers point at the stack's deployment guideline instead of restating the list (only `Permissions-Policy` is skill-side) — LC-M13 (orphan "lives in the project's frontend.md" pointer removed; the rule is now stated where it lives: this skill), LC-D1

### esoul-website-launch (new, project layer)

- Created the skill (`SKILL.md`, `agents/openai.yaml`): go-live procedure, evidence rule, the guideline's launch order, case-study snapshots, pointers to `esoul-quality-gates`; states that the switch itself is the project lead's call — LC-D6(b)
- `references/launch.md` rewritten as the procedure only (46 lines): nine ordered steps, evidence rule, done-when; no checklist boxes — LC-M21
- `assets/templates/docs/nasazeni.md` (moved from `light/docs/`) is now the ONE launch checklist: absorbed the boxes that only `launch.md` had (OG 1200 × 630, single trailing-slash form, 410 for removed media, backups restore tested, error/uptime monitoring, "před" snapshot, production gate run, "po" snapshot); fixed the order of "Přepnutí" to the launch order of `public-website.md` (auth off, switch off, deploy, verify headers/robots/sitemap/indexability, nothing else in the deploy); forms wording follows `public-website.md:15` (page renders without JS, a reCAPTCHA form needs JS to submit and has a contact alternative); anchor `#výjimky` → `#exceptions`; Astro `Checks` list replaced by a pointer to `tools.md` — LC-M21, LC-M13, audit conflict `launch.md:35`
- `references/case-study.md` trimmed (104 → 99 lines; tables dominate): no Node version, no `lighthouse@12`, CLI block and manifest field list replaced by a pointer to the script header and `buildManifest`, commit example in English imperative (`Capture the original site`), the AI-readiness case-study commands moved here from the old ai-readiness core, plain-text helper delegation (job + "otherwise run it yourself"), personal-data pointer to `security-and-data.md` — LC-M10, LC-M8, LC-D3
- `scripts/snapshot.mjs`: imports the shared helpers from `../../esoul-quality-gates/scripts/web.mjs` (clear error when the sibling skill is missing); messages, manifest notes and usage in English; `TOOL_NAME` is now `esoul-website-launch/snapshot.mjs`; `discover` and `capture` refactored into testable functions (`discoverSite`, `formatDiscovery`, `parseCaptureOptions`, `captureSite`) with identical behaviour — LC-D4(a), audit "untested ~50 %"
- `scripts/snapshot.test.mjs`: 13 → 9 tests (helper tests moved to `web.test.mjs`) plus new ones for the untested parts: `discoverSite` against a local HTTP server (robots → sitemap index → urlset, asset/junk/foreign filtering, template grouping, fallback to home links, `--max`), the discover/capture CLI exit codes, `parseCaptureOptions`, and with Playwright + Chrome `captureSite` (both devices, consent button clicked, consent container hidden, failed 404 page recorded, manifest) and the capture CLI — audit §5 table, LC-D1

### Not applied

- `launch.md:22-23,48`, `nasazeni.md:56-60,117-123` "keep checkboxes only as verify per guideline": the checklist boxes stay as concrete verification steps; the restated preview-gate prose in the checklist is now a pointer to `public-website.md`; the boxes themselves are not deleted because the checklist is the project's launch record
- Lighthouse numbers "in three files": reduced to two: `BUDGETS` in the script (also listed in `gates.md`) and the boxes of `nasazeni.md`. The boxes keep the numbers on purpose: the checklist is the project's own record and a project may carry other numbers (`--budget`)
- `astro.md:46-49` and `company-rules.md` Lighthouse/axe/prefetch text: only COPIED into `gates.md`; deletion and the pointer in `stacks/astro.md` belong to the Lifecycle worker
- `ai-readiness.md` reached 126 lines, not ~110: the single checks table is the content; trimming further would cut check requirements. `case-study.md` stays at 99 lines for the same reason (page-selection table)
- "Merge into one skill `esoul-website-quality`" (owner's alternative): not done, per the contract; rationale in `purpose-esoul-website-launch.md`

### Owner decisions needed

1. **Skill-side numbers until a guideline carries them** (owner ruled they stay skill-side): Lighthouse budgets (performance ≥ 90; accessibility, best practices, SEO 100; LCP < 2.5 s; CLS < 0.05), axe threshold (no serious/critical), keyboard/focus/reduced-motion manual pass, link prefetch rule (stack mechanism; exclusions), `Permissions-Policy` header (no guideline lists it; the other headers are in the stack deployment guidelines). Options: (a) keep skill-side; (b) a short "Performance and accessibility" section in `general/public-website.md` with the numbers and the prefetch rule. Recommendation: (a) now (as decided), (b) when the first project needs a different number.
2. **Language of `docs/nasazeni.md`** (Czech, light-tier document now owned by `esoul-website-launch`): LC-D4 decided tests, script output and `docs/ai-readiness.md` only. Options: (a) keep Czech with the other light docs; (b) English as developer documentation (`workflow.md:50`). Recommendation: (a); decide together with all `light/docs/*`.
3. **Shared helper across two skills**: `snapshot.mjs` imports `../../esoul-quality-gates/scripts/web.mjs`. Options: (a) as done: website-launch declares it needs quality-gates, error message when missing; (b) duplicate ~170 lines in both skills; (c) move `snapshot.mjs` into quality-gates. Recommendation: (a), valid as long as the project layer installs both; if single-skill installs are common, take (c).
4. **Gates in CI templates**: the app-templates carry Playwright but no axe and no Lighthouse budgets. `gates.md` recommends them in CI; adding them is a template change (DataUpdate worker's area) and needs dependency approval. Recommendation: decide after the first project runs the gate scripts.

## Part 4: `esoul-project-update`, `esoul-data` and app-templates (group C)

### esoul-project-update

- `SKILL.md` description rewritten to lead with the trigger ("Use to bring a template-born eSoul project up to the latest app-templates…"), mentions skipping declined entries; 355 chars — the mechanics (one commit per entry) left the description for the body — [PU-M5]
- Branch name: `chore/<issue-number>-update-template-<variant>`, issue-less form only for the administrative exception, pointing at `workflow.md` — the old text said "after the issue rules" and produced the issue-less form — [PU-M1]
- Step 2 now assigns `TMP`, `PROJECT`, `VARIANT`, `COMMIT`, `AT`, `TV` and has a done line ("both clones exist and `$COMMIT` resolves in `$AT`"); `apply.md` setup points at that step — the helper variables were used but never assigned — [PU-M2]
- Recorded-commit guard: `git cat-file -e "$COMMIT^{commit}"` before anything else, stop and ask when it fails; the base changelog is empty only when the commit exists and has no `CHANGELOG.md` — a mistyped or rewritten commit silently re-applied every entry ever written — [PU-M3]
- Step 1 handles a record present without `commit` (old `version` key) as missing → `adopt.md` — that case had no branch — [PU-M4]
- `plan.json` lists the entries to apply only; not-applicable and declined entries are not part of it (stated in step 3, step 5 and `apply.md` statuses) — the agent had to guess — [PU-M6]
- PR step: the `No test:`/Deploy-notes definitions replaced by "fill the repository's PR template" (pointer to `workflow.md` › Pull requests); update-specific lists kept and extended with the declined list; done line added — restated guideline content — [PU-M7]
- `adopt.md:5` and `apply.md` conflict sentence reworded positively ("Ask the user to pick…", "write the project side clean") — writing-for-agents — [PU-M10]
- Commit wording: commits follow the project's commit standard, the Gitmoji format is the recommended default and `gitmoji-commit` is used "when installed, otherwise by hand" (SKILL.md, `apply.md`); `adopt.md` likewise — Gitmoji is only recommended, general skills carry a fallback — [GC-D1, principle]
- Declined entries: `select --template .esoul/template.json` reads the project's `declined` list; matching entries are reported as `declined` (with the project's reason), never selected, never offered again, and do not hold back the recorded commit (they are left out of the plan). The user is offered to add a selected or skipped entry to `declined` (title without date + one-sentence reason); `record … --template` rewrites `.esoul/template.json` with the new commit and the extended list (four-space JSON, trailing newline, other keys kept) — an entry the project never takes was re-offered on every run and blocked the record — [PU-D1(c)]
- `select` also prints `order` (every added entry oldest first with its kind) so the agent finds the commit of every entry; `apply.md` says the deltas need all of them — the deltas must add up and the trailing check needs the newest entry's commit — [PU-D2(a), PU-M6]
- Trailing difference: new `apply.md` section "Unlisted changes" and `changelog.mjs unlisted --commit <head> --delta <name-status file>`: the diff from the state of the newest entry (or `$COMMIT`) to the state of origin/HEAD, when non-empty, is offered as an "Unlisted changes up to <sha>" entry, applied like an entry, planned with `commit = head`, PR notes the missing changelog entry; declining it is not recorded in `declined` (its title changes with every head); `apply.md` delta claim now includes it — a variant change after the newest entry would have been marked as landed without being offered — [PU-D2(a)]
- Step 3 done line added and step 6 done line added ("the PR carries the applied, skipped, conflicting, declined and not-applicable lists and the issue link") — completion criteria — [audit §4]
- `scripts/changelog.mjs`: new `parseDeclined` (strict shape), `unlistedChanges`, `updatedRecord`, `selectEntries(…, declined)`; `scripts/changelog.test.mjs` 12 → 18 tests (declined selection, declined not holding back the record, strict `declined` shape, record rewrite, unlisted changes, CLI round trip including malformed `declined` → exit 2) — [PU-D1(c), PU-D2(a)]

### esoul-data

State found: the restructure had already merged the two skills and applied most mechanical items; verified in place: pointer to the guideline headings instead of restated rules, no policy in the body of the description of the old skill, `_reference/` and backup wording (PD-M2/M4/M5), `.gitattributes` check wording (PD-M6), DG-M2 (production reading rule as one agent behaviour), DG-M3, DG-M4. Changes made:

- Description: both triggers kept, trigger first, the placement policy ("never in storage/, tmp/ or Downloads") dropped from the description (stays in the body), second trigger tied to "whose work needs a change to application code, schema, seeders or factories" — [PD-M1, DG-M1]
- Case-study screenshots row removed from the placement table — that material is owned by the lifecycle/website-launch skills (single source) — [PD-M3, LC-D6]
- "Just do it" section rewritten: a user's word no longer overrides the guard; the owner's approval must be written in the data issue (description or comment) before the agent changes code; the agent asks where it is written, otherwise asks the user to have the owner add it (offers a one-sentence wording) or files the proposal as usual; the PR links the approval; reading production still needs its own approval. Skill only, no guideline change — [DG-D1]

### app-templates (`templates/source`, uncommitted on `main`)

- `src/Builder.php`: `.esoul/template.json` is written as `{variant, commit, declined: []}` — a fresh project carries the (empty) list so it is discoverable — [PU-D1(c)]
- `tests/BuilderTest.php`, `tests/BuildCommandTest.php`: expectations include `declined: []` — [PU-D1(c)]
- `README.md`: "Updating existing projects" documents the record shape (`variant`, `commit`, `declined: [{title, reason}]`, a record without the key means the same, an old `version` record is re-adopted), what the update skill does with it, and the unlisted-changes entry; the "planned, to be written" sentence replaced by `esoul-project-update`; usage/design notes mention `declined` — [PU-D1(c), PU-D2(a), PU-M9]
- `CHANGELOG.md` (Unreleased): entry `2026-11-24: .esoul/template.json gains a declined list` (`Affects: every variant`, `Migration: none`) — the update contract requires an entry for every variant-touching change — [PU-D1(c)]
- Ran `vendor/bin/phpunit` in templates/source: 65 tests, 251 assertions, OK. There is no separate schema file in the repository; the schema is the documented shape in the README plus the strict validation in `changelog.mjs` (`parseDeclined`).

### Not applied

- PU-D2(c), a CI check in app-templates that a variant-touching commit touches `CHANGELOG.md` — the owner scheduled it as a later round; follow-up in app-templates (not in this CHANGELOG).
- PU-M8 (add the three test files to `tooling/scripts/test_skills`) — nothing to do: `tooling/scripts/test_skills:14` now finds every `*.test.mjs`, so `changelog.test.mjs` runs in CI.
- Audit §4, low priority: replace the per-title `git log -S` with one pass over `git log -- CHANGELOG.md` — [INFERENCE] performance only, no failure; left unchanged.
- PD-D2: nothing to apply — option (b) settled, the placement rule stays skill-owned and no guideline text was added.
- Gitmoji subject `:arrow_up: [template] …` kept as the recommended-format default, not made mandatory — see the commit wording bullet.

### Owner decisions needed

- `declined[].reason` is required (non-empty) by `parseDeclined` so that a later reviewer can see why an entry is never taken. Options: require it (current); make it optional. Recommendation: keep required.
- The data-issue approval wording in `esoul-data` goes slightly beyond the guideline text, which has no exception for data tasks (DG-D1 chose skill-only). Options: keep (current); later add the exception to `security-and-data.md`. Recommendation: keep skill-only as decided, revisit if agents meet the case often.

## Part 5: `esoul-uat` (group D)

### esoul-uat

#### SKILL.md
- Description rewritten to lead with the trigger ("Use for UAT of eSoul apps, e-shops and websites - plan or verify ..."), one exclusion added (automated tests; Lighthouse/a11y/SEO gates → `esoul-quality-gates`); 340 characters — description was a verb list plus identity ("isolated Chrome", "functionality and design") — [UT-M1]
- `compatibility` now says "a browser tool that can use a dedicated profile (Claude in Chrome by default, or a CDP session of a dedicated Chrome)" and Playwright for the sweep — the skill no longer needs the Claude-only extension — [UT-D7]
- §1: the unreadable `awk` one-liner and "do not read them again" replaced by "read the sections `## Project profile` and `## Tasking convention` of `CONTEXT.md`, falling back to `GLOSSARY.md`"; added "Done when profile, product type, design source and tasking mode are known" — plain instruction, no no-op negation, completion criterion — [UT-M2, UT-M9]
- §2: new "Done when" column for all six modes (`plan` validate clean + every surface item has a scenario or gap; `verify` verdict per chapter + gap scan; `setup` `sweep.mjs --check` + browser profile check + secrets key check; `run` `uat.mjs next` empty + `stats` without `not-run`; `report` `report.md` exists and links bugs; `bugs` approved bugs exist, links in `results.json`, report regenerated) — steps had no completion criteria — [UT-M9]
- §3: removed the project name ("SCHOK generates them from `content/*.mjs`"), now "a project that generates `scenarios/*.md` commits the output and edits the generator" — skills are generic — [UT-M6]
- §4 Rules reduced to one rule per bullet with a pointer into the reference that owns it (credentials → access, browser → chrome, honesty/abort → execution, approval → bugs, stable IDs → scenario-format); the `test-runner` clause in the Abort bullet and the second PDF-owner statement removed (the PDF owner is `esoul-docs`, §5) — each rule lived twice and drifted — [UT-M3]
- Environments rule: writes on a test/staging/preview/UAT instance that `environment.md` marks writable, through the UI, named as the one exception to the guideline's "agents SHOULD NOT write to staging data" and valid on staging only; production stays read-only per `security-and-data.md` › Production access with approval each run; skill only, guideline untouched — owner decision — [UT-D4]
- Client-data rule is now one sentence with the pointer `security-and-data.md` › Personal and client data — was restated in three files — [UT-M5]
- Intro sentence: "The UAT rules (scenario format, priorities, devices, evidence) are owned by this skill; the guidelines hold no UAT section" — [UT-D3]
- §5 companions: accessibility/Lighthouse/SEO row now points at `esoul-quality-gates` (replaces the third-party names and the `esoul-project-lifecycle › scripts/ai-readiness.mjs` path, which moved) — contract with the website/quality worker, AP-D1 dropped `seo-audit` — [LC-D1, AP-D1]

#### references/chrome.md (rewritten)
- Driver model is now "a browser tool that can use a dedicated profile": Claude in Chrome default, CDP session of a dedicated Chrome as the alternative, Playwright sweep for devices; with neither browser tool the functional scenarios are `blocked` and only the sweep runs — removes the Claude-only dead end for `npx skills --agent codex` installs — [UT-D7]
- Human steps (create the profile, sign in, install the extension / start the CDP Chrome, install Playwright) moved into one "Human setup (once per machine)" checklist; agent verification lives in "Agent checks" — an agent cannot sign in or install extensions — [UT-M12]
- `sweep.mjs` example now has all required flags (`--config --secrets --run --role --device --url --shot`) — the old line failed when copied — [UT-M7]
- macOS-only `screencapture -l <windowid>` removed (no way to get the id); replaced by "use a tool that writes files; with a tool that only shows captures, describe the state and list the scenario under `## K ručnímu ověření`" — [UT-M12, audit §4 (iii)]

#### references/access.md
- One env-file location: everything under `~/.config/esoul-uat/` (`chmod 700`): `<repository>.<environment>.env` and `<projectKey>.gdoc.env` — two locations (`~/.config/esoul/…` for the Doc) unified — [UT-D5]
- States that UAT accounts are test accounts, never real users or production accounts, and "who reads the passwords": `sweep.mjs` in-process (never the model); a browser-tool run types the password so the model reads it — read only the one key of the role (`grep '^UAT_ROLE_B_PASSWORD='`), never print the file, never type where a screenshot shows it; change a password whose transcript is shared — [UT-D5]
- One pointer sentence to `security-and-data.md` › Secrets, concrete key check command added — pointer form + testable check — [UT-M3, UT-M9]

#### references/bugs.md (rewritten)
- ONE Impact → severity table (the five `bug.yml` Impact options → Critical/Major/Minor/Nitpick; "Functional limitation" is Major in a main flow, otherwise Minor); removes the Czech four-level scale; `results.json` records no severity; security findings point at Impact "Exposes personal or foreign data" instead of "marked important" — [UT-D1, UT-D2]
- Bug content is the Czech rendering of `bug.yml` (same fields, same order); the long restated field list is reduced to "what a UAT run puts into the fields" — [UT-D2]
- Title/category: "as `esoul-task-create` defines them" (restated format dropped) — [UT-M10]
- Evidence branch `test/uat-<run-id>` (was `uat/<run-id>`, not in the closed prefix list of `workflow.md` › Branches); deleted after the bugs that embed its images are closed — [UT-M4]
- Screenshot paragraph points at `security-and-data.md` › Personal and client data; approval sentence now names `esoul-task-create` — [UT-M5]

#### assets/templates/bug-issue.md (rewritten)
- Now the Czech rendering of `bug.yml`: sections Pozorované chování / Očekávané chování / Kroky k reprodukci / Dopad / Prostředí / Role / Dotčené oblasti / `## UAT` / Freelo, in the form's order; the own `Závažnost`, `Akceptační kritéria` and `Odkazy` sections are gone (scenario/run links moved into Dotčené oblasti; the Impact option list in a comment). The UAT block is `## UAT` (the `task.yml` form) — one artefact, one set of fields — [UT-D2, UT-M14]

#### references/execution.md
- Added the run's completion criterion (`uat.mjs next` says nothing left and `stats` shows no `not-run`) — [UT-M9]
- "Keeping context small": the uat-runner brief is referenced by job through `esoul-model-routing` (optional helpers layer); model names/tier ("mid-tier model with medium effort") removed; fallback "run the chapters yourself" kept; the runner reads only the role's password from the secrets file — [UT-M15, MR-D1, UT-D5]
- Sweep and report/PDF rendering: "a test runner subagent" replaced by "a fresh subagent when the harness offers one, otherwise yourself"; PDF line "the rendered PDF is a build artifact and is not committed" with pointer to `documentation.md` › Generated documentation; client-data sentence replaced by one with pointer — [UT-M15, UT-M11, UT-M5]

#### references/design.md
- Device matrix table (a copy of `sweep.mjs` `DEVICES`) replaced by the device IDs plus "defined in `scripts/sweep.mjs` (`DEVICES)`, overridable in `uat.config.json` `devices`" and the which-driver/which-scenario rules; tap-target and overlay thresholds removed from the checks table ("sizes/share in `layout-audit.js`") — stale-prone copies — [UT-M8]
- Design finding severity: `blocker/major/minor` replaced by the severity of the one Impact table in `bugs.md` — [UT-D1]
- `SCHOK.pen` in the `design-map.md` example → `app.pen`; Pencil/Figma MCP reads are "when available"; accessibility depth points at `esoul-quality-gates`; "extension's JavaScript tool" → browser tool — generic skill, no fixed tool — [UT-M6, UT-D7]

#### references/gdoc.md (restructured)
- Human setup (steps 1–7 and the redeploy after `Code.gs` changes) separated into "Human setup (once per project)" with the sentence that the agent starts at "Agent use"; agent use (first run, everyday commands, the run writes results, Playwright e2e) in its own section; `init` only on the user's explicit go-ahead — [UT-D6, UT-M12]
- Added "No client data in the Doc" (invented/anonymised scenarios, redacted results) and a token-rotation reminder (on leaving/leak, and remind the user after every setup) — [UT-D6]
- Env file moved to `~/.config/esoul-uat/<projectKey>.gdoc.env` (script, test, template header updated to match); project names `indcom/vono/doglead` and the install-path examples removed — [UT-D5, UT-M6]
- "Known limits" replaced by "First run on a copy": the unverifiable claim "proven only for `ping` and `read`" is dropped, the actionable first-run checks stay — [UT-M13]
- "UAT agent writes results" → "The run writes results" (no agent name) — [MR-D1]

#### references/project-types.md, verify.md, scenario-format.md
- project-types: AI-readiness/Lighthouse rows point at `esoul-quality-gates`, light-tier launch checklist at `esoul-website-launch`; the CMS-admin paragraph generic ("the media library, when the admin has one", "the admin's built-in guides, when it has them"); "Done when `validate` reports no errors ..." for `plan` — [LC-D1, LC-D6, UT-M9]
- verify: "implementer subagent" / "cheap read-only explorer" → "a fresh subagent that builds the change" / "a fresh read-only subagent, otherwise do it yourself"; done-when line — [UT-M15, UT-M9]
- scenario-format: rule 6 "real account e-mails, concrete ear tags, prices" → "test-account e-mails, invented or anonymised identifiers, prices and dates" with pointer — [UT-M5]

#### Templates
- `secrets.env`: header states the single directory, the gdoc file, "test accounts only, never real users" — [UT-D5]
- `environment.md` (Czech, project-facing): sentence that writes are allowed only on the environment marked writable, never on production; accounts test-only — [UT-D4, UT-D5]
- `agents/openai.yaml`: default prompt "dedicated Chrome profile" → "a browser with a dedicated profile" — [UT-D7]

#### Scripts
- `uat.mjs`: all developer-facing CLI/validation messages translated to English (`validate` errors, `init`/`record`/`next`/`stats` output, lock error); parsed Czech field tokens and the tester-facing `report.md` stay Czech — [LC-D4 principle, §6a "English developer-facing text"]
- `gdoc.mjs`: CLI usage, errors and progress output in English; config path now `~/.config/esoul-uat/<projectKey>.gdoc.env`; Doc content strings (`typeLabel`, e2e cell texts, tab names) and the protocol constants (`PREPSAT`) unchanged — [UT-D5, LC-D4 principle]
- `sweep.mjs`: messages in English; `readSecrets` (now throws) and new `assertSameOrigin` exported, `main()` guarded by an is-main check so the file can be imported by tests — the secrets-mode and origin checks were the untested safety net — [audit §5, UT-M9]
- `uat.test.mjs`: assertions follow the English messages; `gdoc.test.mjs`: all test titles/comments in English, project names removed (`acme`), `sekret` → `secret`, env-file path assertions updated, "kompatibilní se SCHOK sync.mjs" → "request body shape" — tests in English — [LC-D4 principle, UT-M6]
- NEW `sweep.test.mjs` (4 tests): secrets parsing, refusal of a world-readable file, missing file, origin check — closes the cheapest part of the untested-script gap — [audit §5]

### Not applied
- **UT-M4 "evidence branch deleted after the bugs are filed"**: applied as "deleted after the bugs that embed its images are closed" — deleting it when the bugs are filed would break every embedded `?raw=true` image in the issues.
- **UT-M13 "verify the live-Doc claim against the three projects"**: cannot be verified from this checkout (no access to the projects/Doc). The unproven sentence was removed instead of updated; see Owner decisions needed.
- **`assets/gdoc/Code.gs` comments and server messages stay Czech** (1791 lines; its strings are written into the client-facing Doc, and `gdoc.mjs` matches one server message, `Záložka t.… v dokumentu není`). Translating only the developer comments is possible but touches an untestable file that cannot be run offline; not worth the risk in this pass.
- **`layout-audit.js` test**: it is pure DOM code needing a browser (Playwright/Chrome) fixture; not cheap, skipped. Its finding `detail` strings stay Czech because they land in the tester-facing `report.md`.
- **UT-D3**: no guideline section added (decision is "skill-owned"); the skill now says so.
- **Czech UAT artefacts** (scenario field tokens, `report.md`, `environment.md`, `uat.config.json`, sample chapter, bug template): kept Czech by decision UT-D2(b).

### Owner decisions needed
1. **Live-Doc status of the bridge (UT-M13).** Options: (a) confirm with the three projects that `sync`/`result`/`e2e` ran against a live Doc and add one line "used in production by …" (none needed in the skill); (b) leave as now (only "run first on a copy"). Recommendation: (b) — the skill text is correct either way.
2. **Impact → severity of "Functional limitation (a workaround exists)".** I mapped it to Major in a main flow, otherwise Minor, so all four review levels are reachable from five options. Alternatives: always Minor (the old `střední` → Minor mapping), always Major. Recommendation: keep the current split.
3. **Migration of existing Doc configs.** The Doc bridge env file moved to `~/.config/esoul-uat/<projectKey>.gdoc.env` with no compatibility shim (clean cutover). Projects already using the bridge need a one-time `mv ~/.config/esoul/<projectKey>-uat-gdoc.env ~/.config/esoul-uat/<projectKey>.gdoc.env`. Confirm that is acceptable (recommended: yes, announced in the CHANGELOG).

## Part 6: `esoul-docs` and the documentation tool (group E)

### esoul-docs (`skills/dev/esoul-docs`)

- `references/workflow.md` now holds the shared policy plus three mode sections (Create, Refresh, Verify); `workflow-create.md`, `workflow-refresh.md`, `workflow-verify.md` deleted (`git rm`); `SKILL.md` step 2 and `pdf-pipeline.md` link to `workflow.md` (and its Refresh section) — every run read `workflow.md` plus one mode file anyway, so the split cost a read and four back-pointers for no disclosure gain — [DOC-D1]
- Create step 4 creates `docs/documentation-decisions.md` and names it under Sources of truth in `CONTEXT.md` (the same rule stays in `SKILL.md` "Specification first"); `docs/documentation-decisions.md` and its template kept — [DOC-D2]
- `SKILL.md` Install and `references/setup.md`: first install needs the maintainer's approval (a new dependency, linked in the PR, `workflow.md` › Repository rules), an upgrade needs only the user's confirmation of the previewed plan; setup trigger no longer stated twice — [DOC-D3, §4 duplicated trigger]
- `references/pdf-pipeline.md` lost the renderer internals (wrapper/Go-binary split, Dockerfile stages and image contents, AST and filter order, local-mode Dockerfile and Merman details, container isolation flags, token/staging design, doctor internals); it keeps layout, commands, what `validate`/`build` do for an author, image rules, configuration (theme, fonts, client identity, link policy, language, mode), the Markdown contract and lifecycle, and points at `tooling/MAINTAINERS.md` — the internals are stale-prone, owned by the Dockerfile and wrapper, and the skill itself forbids reconstructing the renderer from them — [DOC-D4, DT-D5]
- `description` rewritten to lead with the trigger and state "owns client-facing application guides as PDF"; DOCX/XLSX/PPTX business documents (contracts, reports, offers) point to `esoul-office-documents`/`esoul-offer-authoring` (473 of 600 characters) — [DOC-D5, DOC-M15]
- `SKILL.md` math bullet: `validate` now names the file and the command (`unsafe TeX math command \x`); the build still fails on it; rewrite with basic commands or a fenced block — the tool change DT-D2 made the old "fails the PDF build" text incomplete — [DT-D2, DOC-M3]
- `SKILL.md` Theme paragraph renamed "Theme, language and templates": set `language` on each `[[guides]]` block to the language the specification names; `primary_language` is the default — the skill's per-guide language rule (DOC-M6) can now be carried out by the tool — [DT-D2, DOC-M6]
- `SKILL.md`: `commit_pdf_outputs` "is deprecated and stays false (the template forces it)" → "stays `false` (the default; `true` only prints a notice)" — matches the changed tool behaviour — [DT-D1]
- `SKILL.md` Start step 4 and Create step 3: glossary lookup points at `esoul-workflow` instead of restating `GLOSSARY.md`/`GLOSSARY-MAP.md` — one place owns the lookup — [DOC-M12]
- `references/jenkins.md`: the dangling pointer to the (now removed) isolation paragraph of `pdf-pipeline.md` replaced by one sentence (no network, dropped capabilities) — [DOC-D4]
- Verified as already applied by the restructure commit (no change needed): DOC-M1 (pointer + gitignore snippet), DOC-M2 ("output tracking" gone), DOC-M4 (manifest rules and project-relative example row in `screenshots.md` and the template), DOC-M5 and DOC-M10 (guideline severity/finding states, privacy-and-accessibility pass in `review.md`, one gate list in `workflow.md`), DOC-M6 (language line in `SKILL.md`, per-guide language lines in `documentation-spec.md`), DOC-M7, DOC-M8 (`jenkins.md`), DOC-M9, DOC-M11, DOC-M13 (bump rule once), DOC-M14, DOC-M16 (completion criteria in Create/Refresh) — [DOC-M1..M16]

### Documentation tool (`tooling/`)

- `commit_pdf_outputs`: behaviour kept (`true` still skips the "PDF output directory is not ignored" check); `false` is the default; `true` now prints a `NOTICE` (was a `WARNING` "deprecated and must be false"); function renamed `noticeCommitPDFOutputs`; the template comment says "Keep false (the default) … true only prints a notice" — [DT-D1, K9]
- Installer reminder (`install-project-tools/main.go`): "Keep the PDF output directory (/docs/pdf/ by default, or the configured output_dir) ignored by Git: generated PDFs are build artifacts and are not committed." replaces "Ignore /docs/pdf/ unless documentation.toml intentionally commits PDF outputs." (stated the opposite of the guideline); new test `TestInstallReminderKeepsPDFOutputIgnored` — [DT-M1, DT-D1]
- Installer flag help and the upgrade-plan error: "catalog-resolved" / "catalog release" → "release-resolved" / "release" (the release catalog was removed) — [DT-M2]
- Per-guide `language` on `[[guides]]` (`guideConfig.Language`, `guideLanguage()` used for the PDF `lang` metadata and the Czech cover labels; falls back to `primary_language`, then `en`); `validate` rejects a guide `language` that is not a language tag (`cs`, `en-GB`); starter `documentation.toml` documents it. Schema stays 1; ~25 lines of Go, fully unit-tested, so implemented now — [DT-D2]
- `validate` checks math: new `math.go` (`checkMathFormula`, `validateMath`, `pandocMath`) reads Math nodes from the Pandoc AST and reports `file: unsafe TeX math command \x in formula …` (and `^^`/other control sequences), once per distinct message; the allow list copy is pinned to `filters/render.lua` by `TestMathAllowListMatchesRenderFilter` — turns a late build failure into a validate error naming the file — [DT-D2]
- Tests added (`policy_test.go`): `commit_pdf_outputs` wiring through `validateProject` (notice only, no error, no warning); `validateGitState` ignore check for `commit_pdf_outputs` false/true × output ignored 0/1; math formulas (valid, invalid, in-project, repeated); allow-list sync; guide language fallback and TOML parsing; invalid guide language; `redact` output (solid + mosaic region on a generated PNG, size kept, outside pixels unchanged, refusal to overwrite, original kept; skips when ImageMagick is absent) and refusals of sources/outputs outside the quarantine directories. Renderer coverage 64.5 % → 72.7 % — [DT-M3 a/b/c]
- `tooling/CHANGELOG.md` created (Keep a Changelog; `## Unreleased` holding this round's tool changes, K9 in its final notice-only form, then `## 0.6.7 - 2026-10-20` with the existing release-note text) — contract for the Tooling worker: the release notes of tag `x.y.z` are the section `## x.y.z - <date>` — [DT-D3, DT-M5 content]
- `tooling/MAINTAINERS.md` created: the one maintainer document — layout, renderer/wrapper/image internals moved out of the skill, profiles and upgrade, tests, how to change the tool, release procedure, version-bearing places, checklist; `docs/hosted-image-plan.md` (the release/migration content) is folded into it and removed (`git rm`) — [DT-D5, DOC-D4, DT-M4]
- Not touched: `tooling/scripts/*` (their tests pass unchanged), smoke fixtures (they keep `commit_pdf_outputs = false`, harmless)

### Not applied

- DT-D4 (tag 0.6.8 now): owner decided against; no tag, no version bump, `VERSION` stays `0.0.0`; all changes are under `## Unreleased` — [DT-D4]
- DT-M5 (replace `Jenkinsfile:152` `UPGRADE_NOTES`): the Jenkinsfile is not mine; superseded by DT-D3 (Jenkins reads the CHANGELOG section) — listed under Needs integrator — [DT-M5, DT-D3]
- Strict unknown-key check in `loadConfig` (a misspelled `primry_language` is silently ignored), and `doctor` reading `commit_pdf_outputs`: audit "low/optional", no ledger decision — see Owner decisions needed — [audit §4]
- Docker-backed checks `test_renderer_smoke` and `test_bootstrap_install` not run (need network and a linux/amd64 emulated Rust build on this arm64 host); the Go tests (which the renderer Dockerfile runs in its first stage) and the other tooling scripts ran locally — [DT-M3]
- Smoke fixture with a Czech guide beside an English one: not added (needs the Docker smoke run to validate the baselines)

### Owner decisions needed

- Reject unknown keys in `documentation.toml`: options (a) warn on undecoded keys (typos like `commit_pdf_output` surface), (b) error, (c) keep silent. Recommendation (a): cheap with the TOML decoder's `Undecoded()` and non-blocking; it also tells a project on an older renderer that `language` is not understood yet.
- Add a Czech/English two-guide smoke fixture (needs baseline images): options (a) now with the final release, (b) skip. Recommendation (a) when the final release is prepared, so the first real run of the language feature is in CI.

## Part 7: `esoul-office-documents`, `esoul-offer-authoring`, `esoul-mockup-authoring` (group E)

### esoul-office-documents

- Description rewritten to lead with the artifact (branded DOCX/XLSX/PPTX business documents), name the three exclusions (offer content → `esoul-offer-authoring`, client-facing application guides as PDF → `esoul-docs`) — one owner per artifact, both descriptions say so — [DOC-D5, OD-M1]
- Deleted the repeated exclusion sentence in the body and the "never build in a blank file" negation; intro now "fill the bundled template" — cost without a second statement, positive wording — [OD-M2, OD-M7]
- Setup stated once: `scripts/requirements.txt` pins `python-pptx==1.0.2` (the version the tests ran with here), `pip install -r`; `build_pptx.py` docstring shrank to one pointer, runtime error message kept and now names the requirements file — single source of truth, tested pin — [OD-M3]
- Commands use `$SKILL_DIR` and say that input/output paths are relative to the working directory; the "paths are relative to this skill directory" line is gone — ambiguity fix — [OD-M4]
- Verify: `python3 -m zipfile -t FILE` (prints `Done testing`) replaces the silent one-liner; PDF export is one portable step (`soffice --headless --convert-to pdf`, Pages/Numbers/Keynote on a Mac, otherwise "say the layout was not checked"); the half AppleScript fragment is deleted — checkable criterion, agents cannot drive a GUI — [OD-M5, OD-M6]
- Authoring rules positive ("describe deliverables and outcomes", "change the source and rebuild"); legal names/IČ/prices rule replaced by a pointer to the `TBD` rule of `documentation.md` plus "contact details come from the template footer"; "client's language" rule kept with the new `--lang` — [OD-M7, OD-M8, OD-D1]
- "Numbers typed by hand" stated for `##` chapters; the offer skill's capability sentence moved here: the Markdown subset has no images (table or add in Word) — one owner of renderer capabilities — [OD-M12]
- "Where to save" rewritten: sales documents go where `esoul-offer-authoring` says (sales repo/folder outside project repos); for other documents source committed, generated DOCX/XLSX/PPTX are build artifacts (`workflow.md` › Repository rules); `esoul-data` for project data — conflict resolved by OF-D1 — [OF-D1, OD-M13]
- `references/presentation-layouts.md`: brand/colour/footer/size/"11 sample slides" facts and the template layout index column deleted (the template and `LAYOUTS` in `build_pptx.py` are the source); the "about 6 bullets" rule lives once there and SKILL points at the layouts file — environment is the source of truth — [OD-M9]
- Examples are now fictional layout samples: no real IČ/DIČ, no real hourly rates (1000/1200), fixed date `1. 1. 2000`, closing e-mail `@example.com`, note "sample values, not an offer"; the SKILL says they are layout samples, not offers — [OD-M10]
- NEW `--lang cs|en` on `md_to_docx.py` (callout labels, `w:lang` proofing language on runs only for `en`), `build_xlsx.py` (party labels, sheet names, table names; JSON key `lang`; `supplier`/`client` aliases) and `build_pptx.py` (proofing language via python-pptx `language_id`; outline key `lang`); NEW `--currency CODE` on `build_xlsx.py` (money number format; CZK/EUR/USD/GBP symbols, any other ISO code as `[$CODE]`; JSON key `currency`; flag wins). Default behaviour unchanged: built DOCX, XLSX and PPTX from the old and the new scripts with default options are byte-identical in every part (checked) — add the parameters now, Czech/CZK stays default — [OD-D1(b)]
- NEW English example variants `document.en.md`, `spreadsheet.en.json`, `presentation.en.json` (fixtures for the tests and for the SKILL) — [OD-D1(b), OD-M11]
- NEW `assets/templates/README.md`: which company data sits in which file, origin (marked TBD: original not in the repo), owner (TBD), font licence (OFL, to confirm upstream), how to change a template and what to re-run — [OD-D2(a)]
- NEW `scripts/test_office_documents.py` (stdlib `unittest`): template smoke test (docx footers and xlsx header hold `IČ: 17582571`/`DIČ`/contact, pptx footer holds the contact line), builds of cs and en DOCX/XLSX (labels, sheet names, `Kč`/`€`/`CHF` number formats, formulas, valid ZIP and well-formed XML in every part, invalid currency refused), PPTX builds skipped without python-pptx; 12 tests — smoke test the audit asked for, plus coverage of the new parameters — [OD-D2(a), OD-M11]

### esoul-offer-authoring

- Description shortened, leads with the offer, names exclusions (rendering → `esoul-office-documents`, application documentation → `esoul-docs`); mentions Czech or English — [OF-M1, OD-D1]
- SKILL.md 174 → 124 lines: research table → `references/research-briefs.md`; chapter order, variations and client-text rules → `references/offer-structure.md`; reserve, operation variants, packages, mandatory statements → `references/terms-and-pricing.md`, each with a "Read when" opener — progressive disclosure — [OF-M2]
- Duplicated tail ("Common corrections", defect list) cut to the three items not stated elsewhere (shortest realistic schedule, platform wording, consistent facts); dropped as covered elsewhere: line 159-160 (step 5 and the intro), 163 (office skill), 164 and 165 (terms file), 169-172 (check script and structure), 174 (vague "hours too low") — single source of truth — [OF-M3]
- `check_offer.py` runs at the end of step 6 on the Markdown, before rendering; command uses `$SKILL_DIR`; prose recap of the checks removed ("the output is the checklist") — [OF-M4, OF-M6]
- Step 2 delegation named by job, not by agent: subagent per brief when the harness offers subagents, otherwise run the briefs yourself; step 3 yourself — [OF-M5, MR-D1]
- One list of mandatory statements, split into "checked by the script" and "verified by you"; the script now prints the "you verify" list itself — [OF-M6]
- Template-capability sentence deleted here (moved to office documents), the current-versus-proposed rule kept in `offer-structure.md` — [OF-M9]
- Negations turned positive ("research with read-only requests", "change the Markdown and rebuild", "describe deliverables and results", "remove placeholders and internal remarks before sending") — [OF-M10]
- Research brief points to the guideline criteria for AI readiness (`public-website.md`, Astro `seo.md`) instead of listing them — K7 owner of the rules — [OF-M11]
- The four client-text prohibitions replaced by one rule pointing to `security-and-data.md` › Personal and client data — [OF-M12]
- One path pattern for source and DOCX; offers live in the internal sales repository or folder outside project repos, Markdown committed, DOCX a build artifact never committed (the skill asks the user for the location and never creates offers in a project repo); the `Sales/` convention is gone — [OF-D1(a), OF-M13]
- Intake asks for offer language and currency; asks the user for the supplier block and payment terms when no previous offer exists, unknown ones `TBD` (flagged by the checker and listed in the handover); steps 1, 2 and 3 got "done when" criteria — [OF-D2(a), OD-D1]
- Sales policy (10 % reserve, three variants, mandatory statements, two-package rule) in `references/terms-and-pricing.md` with the owner Tomáš Vojík named and "treated as current since 2026-11-24" — [OF-D3(a)]
- `scripts/check_offer.py` rewritten: `--lang cs|en` (English patterns and header words), `--currency` (one currency per offer; mixed currencies reported even without the flag), reserve check (a reserve row exists in every table with a total, is the last row before the total, equals 10 % of the work hours within rounding), hours column found by header words (`hodin`, `rozsah`, `pracnost`, `hours`, `effort`; rate headers excluded) or by the `h` unit of its cells, a table without an hours column is reported as `note: rate check skipped` instead of staying silent, English labels in the output, prints the list the script cannot judge; exit code semantics unchanged — [OF-M7, OD-D1(b)]
- NEW `scripts/test_check_offer.py` (stdlib `unittest`, 14 tests): clean cs and en offers, wrong total, wrong line vs rate, missing statement, wrong reserve, reserve not last, missing reserve row, hours found by unit, skipped rate check, TBD placeholder, mixed currency, wrong currency, command-line exit codes — [OF-M8]

### esoul-mockup-authoring

- Description rewritten: leads with the artifact, keeps "adapt" (a Pencil design or built HTML), names the exclusions (design work in Pencil, throwaway prototypes); no MCP/environment negation — [MK-M1, MK-D2]
- Frontmatter `metadata.author`/`metadata.version` deleted (only skill with them; the plugin version is authoritative); `compatibility` kept and now names the Pencil MCP server for the `.pen` route — [MK-M2]
- MCP speculation removed (`mockups_*` sentence in `feedback.md`, "not MCP" in the description) — sediment about a feature never built — [MK-M3]
- Steps 4-6 and the "Delegate browser inspection" section merged into one step 4 with the managed-process start of `preview`; delegation by job ("a browser subagent when the harness offers subagents, otherwise do it yourself"), the brief replaces the subagent's default scenario format, no agent names — [MK-M4, MR-D1, UT-D7]
- Trusted-checkout paragraph kept in `references/security.md` only; SKILL and `cli.md` carry one sentence and a link — [MK-M5]
- Authorization rule stated once in `publish.md`; SKILL keeps the gate sentence plus pointer — [MK-M6]
- Data rule added to the bundle contract, `publish.md` and `example-provenance.md`: invented or public data, personal data and non-public client figures only under a recorded exception, screenshots redacted (`security-and-data.md`) — [MK-M7]
- "npm/Pencil/framework compilation" → "npm or framework compilation"; `.pen` read only through the Pencil MCP tools — [MK-M8]
- Copy-hazard step: replace every Workshop Notes string (titles, labels, alt text) and delete the schedule SVG if unused before validating; `example/` is a "starting bundle", no longer "ready-to-publish" — [MK-M9]
- Review-cycle sign-in: existing sessions only, passwords and tokens never asked for or stored — [MK-M10]
- Feedback export location `docs/podklady/pripominky-mockup-revize-N-<date>.md` with a pointer to the lifecycle design step — [MK-M11]
- Positive rewrites of the nine "no X" items and of "never copy either ..." — [MK-M12]
- SKILL reference list reduced to one short label per file; each reference keeps its "Read when" opener — [MK-M13]
- Numeric schema limits (ID pattern, 64 characters, width 240-3840, `formatVersion: 1`) removed: "the validator reports them"; authoring rules the validator cannot tell kept — [MK-M14]
- `publish.md`: dedicated-sharing-branch advice removed; the configured branch can be any branch, the default included; the user authorizes the push; a branch that takes changes only through pull requests gets one and the sync runs after the merge; the immediate-publication warning stays — [MK-D1]
- NEW `references/from-pencil.md`: a Pencil design is first created and kept in the repository; an agent with the Pencil MCP then creates the mockup from it; MCP is the primary way (`get_app_state`, `read_skill`, `execute` with read operations only on the `.pen`), mapping rules (screen/frame IDs from screen codes, one marked root per frame, `data-pencil-name` kept, tokens in one stylesheet, images exported to `assets/`), iteration through the design first — [MK-D2, MK-M8]
- NEW `scripts/mockup.test.mjs` (node:test, no app/PHP/browser needed; picked up by `tooling/scripts/test_skills`): `--help`/bare call, six bad-argument exits before PHP starts, every frame of `example/mockup.json` has its entry, one marked root with matching attributes and an integer width; 3 tests — [MK-M15]

### Not applied

- MK-D1 "in script + preview test": `scripts/mockup.mjs` and `tooling/scripts/test_mockup_preview.mjs` contain no branch restriction (grep for "branch" finds only skill text); the restriction lived in `references/publish.md` only. The manual preview test is untouched.
- OD-M10 (variant 1, make the examples pass `check_offer.py`): not done; the examples are marked as layout samples instead (the allowed variant). Reason: a test fixture shared between two skills would couple them, and skills may not link into each other.
- OD-M11 "wired into `tooling/scripts/test_skills`": the harness runs only `*.test.mjs`/`test_*.mjs`; the Python tests are plain `unittest` files run from their script directories (TL-D1 Jenkins Python step). See Needs integrator. Same for OF-M8.
- OF-M3: items 159-160, 163, 164, 165, 169-172, 174 of the old SKILL dropped, not moved (reasons above).
- `check_offer.py` still skips numbers with decimals or ranges silently (hours are whole numbers by policy); not in scope of OF-M7.
- OD-D2(b)/(c) (strip the docx sample body, supplier JSON): recommendation was (a) only; the dead supplier block in the docx body is documented in the templates README, not removed.
- MK-D3 (private application checkout): no decision in the ledger, left as is (see Owner decisions needed).

### Owner decisions needed

- Template owner and origin (`assets/templates/README.md` says `TBD`). Options: name a person (e.g. the maintainer who approves company-data changes), or the original design source if a Google/Figma original exists. Recommendation: name one owner and link the editable original.
- Font licence: README states Poppins and Syne are SIL OFL 1.1 "to confirm upstream" (not verified here). Recommendation: confirm once and drop the caveat.
- Real location of the internal sales repository or folder: the skill uses `<sales>/<client>/…` and asks the user. Options: name the repository (e.g. `eSoul-cz/sales`) in the skill, or keep asking. Recommendation: name it once the location exists; optionally one guideline line that offers live outside project repos (audit OF-D1 recommendation).
- MK-D3 dependence on the private application checkout (`esoul-internal`): (a) keep and name where it lives and what to report when absent, (b) publish the validator as a standalone package/PHAR, (c) documented Node-only structural check. Recommendation: (a) now, (b) later.
- Release-time: a Python test step in Jenkins is needed before these tests count (TL-D1).

## Part 8: Agents, hooks, Codex, tooling, Jenkins, third-party picks, README (group F)

### agents/ (implementer, ops, uat-runner)

- `agents/implementer.md`: the quality-rule copy stays (agents may run without the skill) but now matches the 12 questions of the shortened `esoul-workflow/references/quality-bar.md` and the guidelines headings: added "composable with module-level state says so and its tests reset it" (replaces the invented "no prop shadowing or lost reactivity in Vue"), "transformation/ETL/data-fix rules proven with a temporary test, not committed" (the old self-check asked for a fixture test of each rule, which contradicts `testing.md` Temporary tests) and "risk and what you did not do go to Open points = PR section Risks and what I did not do"; heading name of the partial-updates section corrected. The self-check line 3a no longer re-lists the rules: "one line per applicable quality-bar rule above, with evidence; answer the pasted checklist in order" — one list in the agent, one question list in the skill, both pointing at the guidelines — [AG-D1, WF-D1]
- `agents/ops.md`: `tools: Bash, Read, Grep, Glob, Skill, mcp__freelo__*` (shell, read, search, the Skill tool it needs to load the skill a brief names, and the Freelo MCP server). Syntax checked against the Claude Code sub-agent docs (fetched 2026-11-24, code.claude.com/docs/en/sub-agents): `tools` takes `mcp__<server>__*` for a whole server; plugin agents keep `tools` (only `hooks`, `mcpServers`, `permissionMode` are ignored). The Jenkins, Grafana and Cookbook MCP servers (Freelo delete, Jenkins trigger) are no longer reachable by the cheapest model — [AG-D3, AG-M5]
- `agents/uat-runner.md`: description "in the UAT Chrome" -> "in a dedicated browser profile"; the browser requirement is "a tool that can use a dedicated profile (Claude in Chrome by default, or a dedicated Chrome over CDP; esoul-uat references/chrome.md); without one stop and report". It stays generated into Codex — [AG-D4, UT-D7]

### codex/, hooks/ (generator)

- `tooling/scripts/build_codex_agents.mjs` rewritten: now also generates `codex/AGENTS.md` and `hooks/session-rules.md` from ONE template with a per-runtime phrase table (the Codex model ids come from the existing `MODELS`, so they exist in one place less); `--check` covers all 9 generated files; folded/literal (`>`/`|`) frontmatter values are rejected instead of becoming a literal `>`; the module exports `MODELS`, `convert`, `parseAgent`, `renderRules`, `expectedFiles` and only runs `main` as a script — [AG-M7, AG-M9, TL-M2]
- `hooks/session-rules.md` (still injected in every session, no repository restriction) and `codex/AGENTS.md` shrunk from 19 to 5 lines of rules: explicit model, never a fork (Explore -> scout), size S directly, take over after two failed attempts, plus the session-title line (see Owner decisions). Dropped: role -> agent list (agent descriptions and `esoul-model-routing` carry it), the Codex "Main session ... effort" line (config.toml carries the model), "one task per session / batch tool calls / wait for CI" (context-budget section of `esoul-model-routing`), the auto-compact/1M clause (user setting). The drift between the two copies ("or destructive data scripts") is gone with the list — [AG-D2, AG-M7, AG-M8]
- Read-only Codex agents: see Not applied (Codex cannot set a sandbox from an agent file). What is generated instead: `features.apps = false` for `scout`, `reviewer`, `critical-reviewer` (connectors off = the "no external services" half of their read-only rule) — [AG-D4]
- Regenerated `codex/agents/*.toml`, `codex/AGENTS.md`, `hooks/session-rules.md`, `skills/helpers/esoul-model-routing/references/roles.md` (the roles now show ops's `Tools:` line and the new implementer/uat-runner text) — [AG-D1, AG-D3]
- `codex/install.mjs` unchanged (stale-agent removal already present, AG-M11); new tests below cover it — [AG-M9, AG-M11]
- `skills/helpers/esoul-model-routing/references/setup.md`: hook description matches the shrunk rules, ops tool list and the Codex sandbox limit (person: start review sessions read-only) — [AG-D2, AG-D3, AG-D4]

### tooling/scripts: new and changed

- NEW `test_codex_agents.mjs` (12 tests): generated files committed as generated; negative cases (no frontmatter, wrong name, unmapped or `fable` model, `'''`, folded description); read-only agent list equals the agents whose rules start "Read only."; ops tool list; both rule files from one template with the four guard lines and no auto-compact text; the receipt command of `agents/test-runner.md` equals the one in `esoul-workflow/SKILL.md`; `codex/install.mjs` against a temp `CODEX_HOME` (empty home, in-place replace keeping surrounding text, unpaired markers change nothing, `--dry-run`, stale generated agent removed and a hand-written one kept) — [AG-M9, AG-M11]
- `test_skills.mjs`: model alias check uses the generator's `MODELS` (it accepted `fable`, the generator did not); the README test now requires the generated list (`build_readme_skills.mjs --check`) and a link per skill; README version equals `plugin.json` version; new test that every description is a valid YAML scalar (an unquoted `": "` made `npx skills` silently skip three skills during this review); the generated-agents test names the three generated outputs — [TL-M2, TL-M3, RP-D1]
- NEW `build_readme_skills.mjs` (+ `--check`, exported `renderBlock`/`applyBlock`): rewrites the block between `<!-- layers:begin ... -->` and `<!-- layers:end -->` in README.md from `layers.json` (layer title, description, scope, requires) and the first sentence of each own skill's SKILL.md description with a link; third-party sources and groups by repo, pin and skill names (a source over 18 skills is summarised by count). Fails when a listed skill has no SKILL.md — [RP-D1]
- NEW `check_upstream.mjs` (+ `test_check_upstream.mjs`, 6 tests, no network in tests): reports every pinned source (`ref` in layers.json, any layer or group) with a newer release tag (`git ls-remote --tags`, semver); exit 0 current, 1 drift, 2 unchecked (offline, non-semver pin). The old `tooling/upstream/mattpocock-skills.json` / old `check_upstream.mjs` were removed by the restructure (mattpocock is pinned by `ref` in layers.json, no vendored copies) — [TL-D2, TL-M4 moot]
- NEW `release_notes.mjs` (+ `test_release_notes.mjs`, 4 tests): prints the `## <version>` section of `tooling/CHANGELOG.md` as the one printable-ASCII line (<= 1024 characters) the release metadata accepts (checked in jenkins-lib `publishContainerReleaseArtifacts`); exit 1 when the file or section is missing/empty/too long/non-ASCII — [DT-D3]
- NEW `node_run` (sh): `node <args>` locally or in a `node:22` container with the tree streamed in; `test_skills` is rewritten on it and takes a group or path (`contract`, `review`, `skills/project/esoul-uat`, no argument = everything, the mockup preview test is excluded because it needs an application and Chrome and stays manual). The hard-coded tar subset of the old Docker fallback is gone — [TL-M1, TL-D1]
- NEW `test_python` (sh): finds the folders with `*_test.py` / `test_*.py` under `skills/` and runs `python3 -m unittest discover` in each; python3 locally or a `python:3` container. Verified locally (26 tests, 2 PPTX tests skipped) and in the `python:3` container (same result: the tests skip themselves without python-pptx) — [TL-D1]
- NEW `test_jenkinsfile.mjs` (5 tests): every skill folder with Node tests has a stage with `changeset '<folder>/**'`; every Verify stage also runs on a tag, on the timer and after a non-green build; Python/contract stages exist; the mockup preview test is not in CI; schedule + upstream check + release notes wired, no UPGRADE_NOTES string; scripts the Jenkinsfile calls exist and are executable — [TL conditional stages]
- `test_layers_manifest.mjs`: new test pins the picks groups and lists every dropped pick as absent — [AP-D1, AP-D4]

### Jenkinsfile

- Conditional stages: `Verify skills` = `test_skills contract` (changes in skills/, agents/, hooks/, codex/, lib/, bin/, layers.json, package.json, README.md, .claude-plugin/, tooling/scripts/, Jenkinsfile); `Verify review scripts` (esoul-review, review-evals); one stage per skill folder with Node tests (esoul-task-work, project-lifecycle, project-update, quality-gates, uat, website-launch, mockup-authoring); `Verify Python scripts` (skills/**/*.py, requirements*.txt); `Verify guidelines` (esoul-guidelines.json/lock, docs/project_guidelines, AGENTS.md, CLAUDE.md); `Verify tooling` (documentation tool files, wrapper/bootstrap scripts, install.sh). Every stage also runs on a tag, on the scheduled build and — my addition — when the previous build of the job was not successful or does not exist: a `changeset` only lists the commits since the previous build, so without this a red build would turn green by skipping the stage that failed — [TL (owner), TL-D1]
- Weekly cron on `master` (`H H(4-6) * * 1`); stage `Check upstream releases` only on the timer: exit 1 -> `unstable(...)`, exit 2 -> error. `master` builds use the `general` agent with a 45-minute limit (the full scheduled run does not fit the quick node's 15 minutes) — [TL-D2]
- Stage `Read release notes` on a tooling tag: `UPGRADE_NOTES` = `release_notes.mjs <tag version>` from `tooling/CHANGELOG.md`; a missing section fails the build before anything is built; the string in the Jenkinsfile is gone — [DT-D3]
- Pipeline messages neutral ("Pipeline completed successfully/unstable", "Pipeline failed") — [RP-M4]

### layers.json (upstream-picks)

Kept, with the guideline check per pick: `accessibility-compliance-accessibility-audit` (no guideline conflict; its CI snippet uses `npm ci`: the project's package manager applies, `dependencies.md:12`), `sql-optimization-patterns` (none), `seo-technical` (its AI-crawler section shows blocking GPTBot/Google-Extended; `public-website.md:19` needs an ADR for that, the guideline wins), `seo-schema` (none), `frontend-lighthouse` (adds `@lhci/cli`: a new dependency needs approval, `workflow.md` Repository rules), `frontend-design` (none), `wordpress` bundle as the ONE WordPress form (`esoul-workflow/references/wordpress.md` carries the eSoul rules and wins; "WordPress 7.0" claims unverified), `esoul-jenkins-libraries` (eSoul's own), `matt-extra` (unchanged, on request; owner question below). Stack groups lsr/vue/vue-options-api/laravel untouched. Groups removed: `laravel`, `devops`, `testing`.

Dropped picks (guidelines paths relative to `guidelines/resources/guidelines`; audit AP §1 and a fresh check):

| Dropped | Conflicts with / reason |
|---|---|
| `laravel-expert` | `framework/laravel/architecture.md:14,22,49` and `cqrs.md` (business logic in domain services/command handlers; it says "move business logic into Services", API Resources), `framework/laravel/tools.md:14` (Laravel 13, it targets 10/11), `general/dependencies.md:8` (use a maintained library; it prefers Laravel-native) |
| `laravel-security-audit` | `general/code-review.md:18-29` severity scale (Critical/High/Medium/Low vs Critical/Major/Minor/Nitpick); generic checklist overlapped by `critical-reviewer` and the guideline's Default Critical findings |
| `php-pro` | generic PHP advice, "Use PROACTIVELY" fires on every PHP task; stack rules live in `framework/*/tools.md`; dangling `resources/` pointer |
| `mysql` | `general/deployment.md:52-53` (shared database server run by devops, one login per application, no superuser), `general/security-and-data.md:43` (production read-only for agents); root/replication/`my.cnf` administration |
| `docker-expert` | `general/deployment.md:34` (only `main` pushes `latest`), `:80` and `:115` (host NGINX, Docker-published ports bypass the firewall; it publishes a debug port), `general/security-and-data.md:14` (secrets via 1Password/Komodo, not Docker secrets/Kubernetes), `general/dependencies.md:12` (npm) |
| `e2e-testing` | a router to nine skills that are not installed; cannot be followed |
| `e2e-testing-patterns` | `framework/astro/tools.md:74` (`retries: 1` in CI, `forbidOnly`), `general/testing.md:166` (no rerun-until-green); Cypress section; Astro `tools.md` owns Playwright |
| `seo-audit` | `general/public-website.md:12-58` (crawling, sitemap, `llms.txt`, preview gate) and the quality-gates AI-readiness checker; own scoring scale |
| `web-performance-optimization` | React/webpack examples vs `package/inertia-vue/frontend.md:8` (React not supported) and the Astro/Vite stacks; npm commands vs `general/dependencies.md:12`; overlaps `frontend-lighthouse`/`seo-technical` |
| `data-storytelling` | no eSoul stack tie, dangling `resources/` pointer; no guideline covers it (not conflicting, simply out of scope) |
| `frontend-architecture` | `package/inertia-vue/frontend.md:8,34` (Vue + Inertia, "React is not supported", its own project structure and no `components/shared`), `framework/astro/frontend.md`; the pick prescribes a React/RN module layout with barrels |
| `wordpress-plugin-development`, `-theme-development`, `-woocommerce-development` | AP-D4: one form only; the `wordpress` bundle covers the same topics (~1,700 overlapping lines) |
| `gdpr-compliance`, generic `jenkins` | were in the old vendored plugin, not in the manifest; listed because the owner named generic `jenkins`: `general/security-and-data.md:45`, `general/dependencies.md:12`; `gdpr-compliance` fires on every project and holds no PHP/eSoul rule |

### Repo-level files

- `README.md`: the layer table is replaced by the generated list (RP-D1); install example `upstream-picks:wordpress,web`; agents paragraph states what each agent may use and that Codex cannot sandbox; the "ignore upstream skills" section is one pointer to `esoul-workflow/references/upstream.md` (the single home, RP-D2); Checks section lists the new scripts and the conditional Jenkins behaviour. The per-skill usage sections were already gone from the restructure — [RP-D1, RP-D2, RP-M1, RP-M2]
- `AGENTS.md`: block below the managed block: how to test, which files are generated, edit skills with writing-for-agents + review eval gate, upstream check, release routes — [RP-M3]
- `CONTEXT.md`: sources-of-truth bullet names the scheduled upstream check and the pinned picks list — [TL-D2, AP-D1]
- `.claude-plugin/plugin.json`: description names `esoul-quality-gates` and `esoul-website-launch` (the contract test requires every skill) — [LC-D1, LC-D6]
- `package.json`: `npm test` runs `tooling/scripts/test_skills` (was two files) — [TL-M1]
- `lib/layers.mjs`: doc comment example `upstream-picks:wordpress` (the `laravel` group is gone) — [AP-D1]
- `skills/helpers/gitmoji-commit`: nothing left to apply: GC-M1..M10, GC-D1..D4 were already applied (jq projection, trigger-led description, guideline pointer, developer's own standard first, `convention-bootstrap` block = pointer, no "eSoul extensions" no-op, catalog hash test `test_gitmoji_catalog.mjs` present). — [GC-*]
- `skills/helpers/esoul-model-routing`: MR-M1..M10 and MR-D1..D3 were applied earlier (aliases only, setup split into `references/setup.md`, roles generated into `references/roles.md`, usage report in `tooling/scripts` with a test). Only `setup.md` touched here (above) — [MR-D1]

### Not applied

- Read-only Codex sandbox for `scout`/`reviewer`/`critical-reviewer`, and a Codex tool allowlist for `ops` (AG-D3/D4 "map to a read-only sandbox"): the Codex docs (developers.openai.com/codex/subagents, fetched 2026-11-24) say a custom agent file cannot override `sandbox_mode`, approvals, provider or `mcp_servers`; subagents inherit the parent session. Emitting `sandbox_mode` would be ignored. Done instead: `features.apps = false` for the read-only agents, a README/setup note, the read-only rule stays in the instructions.
- `uat-runner` skipped for Codex: NOT done on purpose — it stays (owner decision AG-D4).
- Settings snippet `codex/config.toml` still carries `model_auto_compact_token_limit` (AG-M8): that file is the person's settings snippet, not an agent rule; the clause was removed from the injected rules only.
- TL-M3 for the picks plugin and AP-M1..M7 (dangling pointers, `sources.md`, `LICENSE-CONTENT`, plugin version bump, plugin `repository`): moot, the `esoul-awesome-picks` plugin no longer exists (restructure); the manifest holds references only. AP-D2/D3 settled by it.
- TL-M5 (README test command): README now shows `tooling/scripts/test_skills`.
- RP-M5 (`docs/hosted-image-plan.md`): file already removed by another worker; not mine.
- `omitClaudeMd` question of the audit: verified supported (sub-agents docs, Claude Code 2.1.271+); no change.
- GC-D4 (Renovate prefix) belongs to the templates worker.

### Owner decisions needed

1. Session-title line in the injected rules. The ledger's four lines (explicit model, never a fork, S directly, two failures) do not include it; it is the only place that carries the rule before the first reply (`setup.md` mentions it for Zeron only). Options: (a) keep the line (done), (b) drop it, (c) move it to `esoul-workflow` and accept that it fires after the first reply. Recommend (a) until Zeron titles are re-checked.
2. Codex cannot enforce read-only or tool lists (see Not applied). Options: (a) accept (done: connectors off, instruction-only), (b) ship a `.codex/config.toml` profile recommendation for review sessions with `sandbox_mode = "read-only"` in the docs only. Recommend (a)+(b) later if review in Codex is used.
3. `ops` allowlist assumes the Freelo MCP server is named `freelo` (`mcp__freelo__*`). A differently named server (or a plugin-namespaced one such as `mcp__plugin_...`) leaves `ops` without Freelo MCP tools (the Freelo CLI via Bash still works). Options: (a) keep, (b) add a second entry per known name. Recommend (a), documented in the README.
4. `matt-extra` (on request): `pr` and `git-guardrails-claude-code` replace eSoul rules/tools (esoul-review writes the PR; the guardrail blocks pushes the internal profile allows). Options: keep as on request with `esoul-workflow` references/upstream.md saying when to leave them alone (current), or drop them from the manifest. Recommend keep (WF-D3 was declined: build on upstream).
5. Weekly check day/time and the 45-minute `master` limit (Monday 04-06h). Change in the Jenkinsfile if the schedule collides with other jobs.

## Part 9: Integration

### Integrator

- Guidelines (`eSoul-cz/guidelines`, `main`, Unreleased): `general/workflow.md` and `profile/internal/workflow.md` state the title shape `Context: Result` (for example `Cart: Recalculate shipping when the address changes`) and that the pull request title states the same result in English. The mapping into a commit standard (Gitmoji `[context]` or the developer's own) stays skill procedure in `esoul-task-work`. Nothing else goes into the guidelines in this round — [FA-D3, TK-D3]. The owner kept DG-D1, UT-D4, PD-D2, TK-D1 and UT-D3 skill-only: the override approval in the data issue, the UAT staging-write exception, the data placement rule and the UAT scenario format are written in the skills only.
- `esoul-workflow`: the commit-and-ship step points at `esoul-task-work` for the PR-title mapping (it said `esoul-task-create`, which no longer holds the mapping) — [FA-D3, TK-D3]
- `esoul-website-launch` `nasazeni.md`: anchors into the English light-tier decision register (`rozhodnuti.md#d-06-hosting-preview-and-noindex`, `#d-03-forms-and-anti-spam`) fixed after the register was translated — [LC-D4]
- `layers.json`: `esoul-quality-gates` and `esoul-website-launch` registered in the `project` layer — [LC-D1, LC-D6]
- `tooling/MAINTAINERS.md`: documents `tooling/scripts/release_notes.mjs` (the release notes of a tooling tag come from the `## <version>` section of `tooling/CHANGELOG.md`, one printable-ASCII line of at most 1024 characters) — [DT-D3]. When the tool is released, rename `## Unreleased` in that file and check it with the script: the unreleased section has about 1,300 characters today, so it needs a shorter release summary.
- README skill list: generated from `layers.json` and the SKILL.md descriptions (`tooling/scripts/build_readme_skills.mjs --check` is part of the contract tests) — [RP-D1]
- Tests wiring: Python tests, the moved script tests of `esoul-quality-gates` and `esoul-website-launch` and the new `esoul-uat` tests run in Jenkins through conditional stages (`test_jenkinsfile.mjs` checks that every skill folder with Node tests has a stage) — [TL-D1, TL conditional stages, LC-M17]
- Not changed in this round, by the owner's decision: no tag, npm publish, plugin release (version stays 0.26.0 and the "0.26.0 is a breaking change" README paragraph describes the restructure for the final release), guidelines release or tooling release (DT-D4).
- Decision on the website material (LC-D1 follow-up, open decision of the owner): **two skills, not one.** `esoul-quality-gates` holds the checks that apply to any web project at any time (Lighthouse budgets, axe, link prefetch, security headers, the AI-readiness checker); `esoul-website-launch` holds the once-per-site go-live procedure, the original-versus-launched case study and the light-tier deployment checklist, and points at quality-gates for every check. Reasons: different triggers (a gate can run on an application during development, a launch happens once), gates are not website-only, and the launch skill stays a thin procedure with its own short description. The only code dependency is the shared `web.mjs` helper that `snapshot.mjs` imports from quality-gates (open owner decision in part "quality-gates and website-launch").
- `CHANGELOG.md` (new, `## Unreleased`), `docs/skill-purposes.md` and this record were assembled from the workers' records. No release, tag or publish was made: the plugin, the documentation tool (`tooling/CHANGELOG.md` Unreleased), the guidelines and app-templates stay unreleased — [owner release policy].

## Part 10: Final open points (owner answers, 2026-11-24)

Applied after the owner answered the open points of Parts 1 to 9 (ledger section "Final open points" in the appendix).

### Guidelines (`eSoul-cz/guidelines`, `main`, Unreleased)

- `general/domain.md` › Open points and conflicts: one sentence, numbers, formulas and calculations come only from the client's materials or a recorded decision; spreadsheets are pinned with parity tests — [P3]. Why: the rule was skill-only ("numbers only from podklady" in the lifecycle skill and the AGENTS template); an agent-binding rule belongs in the guidelines. The lifecycle skill and the AGENTS template now point to it.
- The stack pitfalls of the lifecycle stack profiles were checked one by one against the guideline layers. Most were already rules (migration identifier length, Boost block, LFS and `.dockerignore`, reverse-proxy headers, Fonts API during the Docker build, arbitrary values, Playwright hydration, Lunar pins/extension points/calculation cost, worker state, installed `lsr/*` source, Node versions). The ones no layer carried were added — [P2]: `framework/laravel/tools.md` › Known pitfalls (strict-mode `timestamp()`, `ONLY_FULL_GROUP_BY`, PHPStan on an empty `app/`), `framework/lsr/tools.md` (lock files before the first Docker build), `framework/astro/tools.md` (dev toolbar in Playwright), `package/laravel-inertia/tools.md` (Wayfinder generation in CI).
- Checks: PHPUnit (49 tests), phpstan and php-cs-fixer pass; a Laravel (with Inertia-Vue) and an Astro project were rendered with `esoul-guidelines init` and `sync` and contain the new text.
- Not released: the lines sit under `## [Unreleased]` of the guidelines CHANGELOG.
- Skill side [P2, P3]: the `Pitfalls` sections of the Astro, Laravel, LSR and Lunar stack profiles are pointers to the guideline files; only the two or three pitfalls about project preparation stay (git-ignored `docs/`, LFS pointers in a mockup bundle, drifting project-local tasking skills, a project with many ADRs and no index). The "numbers" rule in the lifecycle `SKILL.md` and `assets/templates/root/AGENTS.md` is a pointer to `domain.md`.

### Skills
- `esoul-project-lifecycle` stays one skill — [P1]. Why: the website material and the quality gates are already separate skills, and the remaining modes share the same project state (slice table, gates, ADRs, questions, labels); a split would add a second description to every session for little gain. Revisit when documentation upkeep grows or real use shows separate triggers (`docs/skill-purposes.md`, finding 1).
- `esoul-website-launch` requires `esoul-quality-gates` — [P5]. `layers.json` gets a layer-level `skillRequires` map (`"esoul-website-launch": ["esoul-quality-gates"]`); the helper's `planInstall` adds the required skills when a skill is named with `--skill` (installing the whole layer already includes both), `validateManifest` rejects a `skillRequires` entry that is not an own skill; a test covers both. The skill description says "Requires the esoul-quality-gates skill". Why: `snapshot.mjs` imports `web.mjs` from quality-gates.
- Quality-gate thresholds stay skill-side — [P4], as the earlier decision.
- Confirmed as implemented, no change (recorded here as the owner's confirmation): `question` issues have no Freelo pair; the light-tier `rozhodnuti.md` is English and the other light documents Czech; the UAT Google Doc env file is `~/.config/esoul-uat/<key>.gdoc.env` with a one-time `mv` and no shim; Codex read-only agents use instruction-only rules; `declined[].reason` is required; the `ops` allowlist assumes the Freelo MCP server is named `freelo`; the session-title line stays in the injected rules; `matt-extra` keeps `pr` and `git-guardrails-claude-code` on request; the weekly upstream check runs Monday 04–06h on `master`.
- Offers: they live in the private repository `eSoul-cz/sales`. `esoul-offer-authoring` and `esoul-office-documents` name it instead of "the internal sales repository or folder"; the Markdown is committed there, the DOCX stays a build artifact — [OF-D1, owner follow-up].
- Office templates README: owners Tomáš Drvota (primary) and Tomáš Vojík (secondary). Fonts: the owner expected Open Sans, but the templates embed Poppins and Syne (and the XLSX names Roboto); Open Sans occurs in none of the three files. The name tables of the embedded Poppins and Syne files carry the licence `https://scripts.sil.org/OFL`, so the README now states SIL Open Font License 1.1, checked on the files — [OD-D2, owner follow-up].
- Mockup preview — [MK-D3]. The in-app validator is optional for looking at a bundle: without an application checkout (`vendor/autoload.php` and `config/mockups/manifest.schema.json`) `mockup.mjs preview` runs standalone, with a structural read of `mockup.json` only, and prints UNVALIDATED; `validate` and every publish step still need the checkout, so there is still no weaker schema implementation. Documented in `SKILL.md`, `references/cli.md` and `references/security.md`; a test starts the standalone preview.

## Part 11: Scenario gaps 2, 5 and 6 (setup update, missing modes, defects)

Source: `esoul-infrastructure/docs/scenarios/` (ten paper scenarios, `README.md` › Recurring gaps). The owner approved gaps 1, 2, 5 and 6 on 2026-11-24 (gaps 3 and 4 are decided separately and not touched here; gap 1 is a pipeline change in `eSoul-cz/jenkins-libraries`). SC-n below is the scenario file, `g<n>` its gap number.

### Gap 2: existing projects lag the new layout

- **Where the procedure lives: `esoul-project-update` (`references/setup.md`), not `esoul-guidelines`.** It spans the guidelines constraint, the skills lock and project text, needs the helper and the person's user-scope skills, and is run by whoever maintains the project. `esoul-guidelines` is a core skill in every project and stays about the guidelines package; it gets the one fact an agent needs on the spot (on 0.x another minor needs the constraint raised, `^0.3` never reaches 0.4) and a pointer. `esoul-project-update` already owns "bring the project up to date" and the "Render guidelines" template entries, which now find the project up to date when the setup update ran first. The skill description names both procedures. Linked from retrofit step 11, `esoul-guidelines` step 3 and `esoul-workflow` › Project-level work — SC-02 g2, SC-03 g1, g2, g11, SC-04 g1, SC-07 g4.
- `layers.json` › `retired`: the retired-name map as data in one place (`final-pr-review`, `pre-pr-review` → `esoul-review`; `esoul-tasking` → `esoul-task-create`, `esoul-task-work`; `esoul-freelo-task-authoring` → `esoul-task-create`; `esoul-maintain-application-documentation` → `esoul-docs`; `esoul-project-data`, `esoul-data-task-guard` → `esoul-data`; `test-queue` → `eSoul-cz/test-queue`; `freelo` → the official skill `freeloio/freelo-cli`). A name that came from `eSoul-cz/skills` and is now gone is retired; `test-queue` and `freelo` keep their name and change the source, so they are flagged by the lock/installed source and never produce a text replacement. The skill does not copy the map (writing-for-agents: one place); it points at `esoul-skills retired`. `validateManifest` checks the map (a retired name is not a current skill, every replacement exists in this repository or in the named source), and a test pins it — SC-03 g4.
- `esoul-skills status`: flags installed skills with a retired name (the installed record's source decides when the name is still current, as `freelo`) and `skills-lock.json` entries whose source is this repository and whose skill is gone or whose `skillPath` no longer matches `skills/<layer>/<name>/SKILL.md`, per scope (a user-scope old install is distinct from a project one), and prints `npx skills remove` and the `project init` / `install` commands. Third-party lock entries are not judged: their paths cannot be checked offline. `npx skills remove` was checked to delete a lock entry of a skill that is not installed. `project init` prints the same lock findings and says it never deletes a retired entry. New command `esoul-skills retired` prints the map and the `git grep` for the renamed names — SC-03 g4, SC-07 g4.
- `apply.md` (project update): the "Render guidelines" migration raises the constraint on another minor, and the regenerated output is its own mechanical commit (the PR size rule excludes mechanical commits) — SC-03 g1, SC-08 g5.

### Gap 5: missing modes

- `esoul-uat` `issue` mode (`references/issue.md`): runs one issue's `## UAT` block without a catalogue or run folder; without `## Project profile` it continues, says so and offers the lifecycle skill; asks for the environment when `environment.md` is missing; reports in the conversation; ticking the boxes or commenting on the issue is a GitHub/Freelo write and waits for approval (the existing "every write is an approved preview" rule). `esoul-task-work` and `esoul-workflow` name it — SC-04 g5.
- `esoul-review` standards-only run: diff against the base (A1, with the credential scan), guideline files only, no repository checks, no verifiers, one Standards reviewer, findings in the conversation, stated as no merge verdict; the description triggers on "does this follow our guidelines". The assignment's "no repository checks" replaces the scenario's "A3 when the diff touches config or migrations" — SC-05 g2, g5.
- `esoul-review` open PR: scope to `headRefOid` with `--base <baseRefOid>`, uncommitted changes listed separately, a different checkout is asked about, never switched silently; existing review threads are read once and passed as "already decided" — SC-05 g3.
- `esoul-review` without `docs/project_guidelines/`: say so under "Not covered", offer `esoul-guidelines init`, never install in Path A, use the general severity scale of `general/code-review.md` in `eSoul-cz/guidelines` and the project's own rules, upstream smells at Minor at most — SC-05 g1. Posting stays on request (A6) — SC-05 g4. `esoul-guidelines` § 4 says `check` finds drift, not violations — SC-05 g5.
- Standing small-admin decision: one bullet in `## Tasking convention` (`esoul-task-create` › `references/convention.md` › Standing decisions; optional line in `CONTEXT-sections.md`, placeholder in `bootstrap.md`). `esoul-workflow`, `esoul-task-work`, `esoul-review` B3, `esoul-task-create` and `esoul-project-update` apply it as written for the kinds it names; no line or `none` keeps the default (ask). Only the owner's words create it. `workflow.md` › Tasking says "the user decides"; the line is that decision made ahead, so no guideline change is required (a one-sentence pointer there is offered to the guidelines owner). A new stage or check in the push build is never small admin work (the Laravel/LSR `deployment.md` ADR rule) — SC-09 g1, g2.

### Gap 6 and other plain defects

- `esoul-skills <command> --help` / `-h` printed nothing and ran the install (`project init --help` installed). `main` prints the usage first; the test runs every command with both flags through the binary with an `npx` stand-in and asserts it was never called — SC-01 g1.
- Retrofit step 5 and the handover checklist allowed a PHPStan baseline against `tools.md` › Static analysis (the baseline stays empty): stepwise level raise and a `**Target.**` block with a gap issue instead — SC-02 g4.
- `esoul-task-create` / `esoul-task-work`: `Backlog` may lack an estimate, `To Do` requires it; a task named from `Backlog` gets the estimate asked from the person before `In progress`, or after pick-up when the person says so (the person decides; no incident exception was invented) — SC-06 g1 in the narrow form.
- Other plain defects fixed in the skills: `esoul-testing` mutation row and the 30-second measure (SC-04 g2, g3); label rule for work spanning layers in `task-content.md` (SC-04 g9, the project's `CONTEXT.md` line stays the project's); `esoul-data` named importer in scope and where approvals are recorded (SC-10 g1, g2); the version of cited headings (`esoul-guidelines` step 4, SC-04 g10); `conformance.mjs` reads the profile and tasking sections from `GLOSSARY.md` with a `convention-in-glossary` warning (SC-02 g6, first half).

### Not applied

- Gap 3 and gap 4 items (adopt step, retrofit order, exception rule, Seams checklists): decided separately.
- Items in other repositories: SC-01 g2, g3, g6, g8; SC-02 g7, g9; SC-03 g3, g5-g7; SC-06 g3, g4; SC-08; SC-09 g2-g5; SC-10 g3 (the `_reference/` line belongs to the template `.gitignore`, not to the skills' `assets/templates/root/`, which holds no `.gitignore`).
- SC-04 g6, g7, g8 (one PR owner, B2 determinism beyond the CLI/Spec sentence, merge-method check needing a guideline line), SC-06 g2 (incident case in the reviewer), SC-10 g5 (stack note in the Standards brief; it would need the review eval run of `tooling/review-evals/README.md`), SC-02 g6 second half (monorepo layout in `conformance.mjs`) and SC-07 g1-g3, g5 (onboarding block, needs an owner decision on commit-versus-restore): not part of the approved gaps or need a decision.

### Owner decisions needed

- Whether `workflow.md` › Tasking should mention the standing decision explicitly (recommendation: one sentence, a guidelines change; the skills work without it).
- Whether a production incident may start with an estimate-less `Backlog` task without asking (SC-06 g1 wider form; policy, not decided here).

## Part 12: Scenario gaps 3 and 4 (seams without an owner, recorded project exceptions)

Source: `esoul-infrastructure/docs/scenarios/` (SC-n is the scenario file, `g<n>` its gap number); the owner's decisions are the last block of the appendix. The installer, the `Hotfix` section and the exceptions principle are in `eSoul-cz/guidelines`, the `Getting started` text in `eSoul-cz/app-templates`; they are listed here because the skills depend on them.

### Gap 3: seams without an owner (skills)

- **New project infrastructure (3a; SC-01 g7, and the person's part of g8)** is a section of `esoul-project-lifecycle` › `references/bootstrap.md`, not a new skill: bootstrap already owns the order and the approvals. Each item names who does it: the agent with approval (repository, Freelo project from the template, repository settings, the manifest PR to `esoul-infrastructure`, the `Jenkinsfile` stack name) and what a person owes (the Jenkins job, secrets in 1Password, DNS, `make apply`, the B0 gate). The Jenkins job is worded "unless the organisation folder discovers it", because no document says whether it does (the Ansible role leaves jobs out, SC-01 step 12); the ruleset comes after the job reports, so a required check that never reports cannot block every merge. The agent never runs `make apply`.
- **Fixed retrofit order (3b; SC-02 g1, g2)**: `retrofit.md` §2 numbers the technical chain R1 skills, R2 guidelines, R3 pipeline, R4 template adoption, R5 test-suite cleanup and a new §3 describes it. R1 is first because every later step needs `esoul-guidelines`, `esoul-task-create` and the lifecycle skill (the old text put `project init` last). The other pair items keep their order around the chain, so the existing list was renumbered instead of replaced. R4 and R5 are optional, each its own PR, and skipping one is recorded with the reason; a project with its own layout records what it declines in `declined` (PU-D1) instead of being rewritten to look like the template.
- **Suite cleanup (3b; SC-02 g10)** is `esoul-testing` › `references/suite-cleanup.md`, not part of the lifecycle: the rules it applies are the testing guidelines and the skill that owns tests. It is the generic procedure of the first cleanup (decide with the owner, baseline protocol, cleanup rules, waves and ownership of files, ledger format, re-measure), with project and tool names removed and the guideline sections cited instead of copied. The source handoff stays in that project's folder; nothing was moved or deleted there. The owner's per-project decisions of that handoff (tier-1 list, dropping two pipeline checks, mutation testing, the `CalculateLines` exception) became the questions of section 1 of the reference.
- **Conflict policy (3c; SC-02 g5)** is `retrofit.md` §4 (the old §3, reconciliation), worded as the owner decided: a clear conflict is always asked; a minor difference that agrees with the guideline is migrated automatically; a non-conflicting project rule is adopted as project-only when minor and may be asked about when major; both automatic outcomes are announced in the chat and the PR. The options for a conflict are adopt the guideline (with a `**Target.**` block instead of a rewrite), keep it as a recorded exception (owner approval, accepted ADR, an entry in `esoul-guidelines.json`) or change the guideline. The pilot kept every conflicting rule and asked; the first Indcom migration deleted every one unless the owner named an exception (SC-02 §3, step 4): the policy replaces both defaults.
- **`esoul-guidelines` §6, Project exceptions (gap 4)**: when to record one, what the agent must not do (decide alone, record without confirmation, except the security and production-data rules), how to write the entry (source layer file and heading anchor, not the rendered file), how to read a `Project exception` marker, and what `check` does when the rule moves. The mechanism is the guidelines README's; the skill does not copy it. §4 now says `check` also fails for an invalid exception.
- **Getting started (3d; SC-07 g3)** is in the template (`app-templates`, a `## Getting started` in the common `CONTEXT.md` and a short one in each stack README), because that is where every project gets it; the skills only keep it: `root-files.md` and `CONTEXT-sections.md` say bootstrap and retrofit leave it in place and fill in the repository name and local setup, and the template changelog entry lets `esoul-project-update` offer it to older projects (optional, declinable). SC-07 g1, g2 and g5 (an onboarding block in the helper README, commit-versus-restore, an access checklist as a file) are not part of this decision.
- The lifecycle `SKILL.md` mode table names the strictness: `bootstrap` follows the guidelines closely, `retrofit` is lenient.

### Gap 4: recorded project exceptions (guidelines installer)

- **Rule reference = heading anchor of the source layer file** (`package/lunar/architecture.md#money`), not an explicit id. The H2 text is already the merge key and a stable contract of every layer; an anchor needs no change in the layer files and no second name per rule. A rename is exactly what `check` reports. Explicit ids stay possible if a rule that needs an exception has no heading of its own. The layer is part of the reference, so the same heading in two layers is two rules, and the marker goes under that layer's heading in the managed block.
- **Marker**: `> **Project exception:** <instead> ([ADR](../../<adr>))` directly under the heading, plus one explaining sentence in the index when any exception exists. Not in `AGENTS.md`: the managed block there only points to the index.
- **`check` fails** when the layer is not selected or the file excluded, the file or heading is gone, the ADR file does not exist, or the rule is protected. **`sync` warns** about the same and exits 0, so `composer update` is never stopped by an exception that a guideline release broke; a malformed entry stops both.
- **Protected rules**: every rule of a `security-and-data.md` (secrets, personal and client data, anonymized dumps, production access, authorization, sessions and accounts), by file name, not by a list of headings: the owner said the security and production-data rules stay hard, and a file-level rule cannot be bypassed by renaming a section.
- **Not validated**: that the ADR is `accepted`. ADR formats differ across projects and the status check belongs to `conformance.mjs`; the skill says to record only accepted ADRs.

### Not applied

- SC-07 g1, g2, g4, g5 (onboarding block in the helper README, commit-versus-restore, lock migration beyond retrofit R1, access checklist file): need an owner decision or are covered by the setup update.
- SC-06 g1 wider form (an incident may start without an estimate): the guideline `Hotfix` section (3e, `eSoul-cz/guidelines` Unreleased) says the task may skip `Backlog` and the estimate; the task skills follow it in Part 13. SC-06 g2 (incident case in the reviewer) stays outside this part; SC-06 g3 (audit `warnOnly`, a pipeline key) is the `audit` key of the Laravel and LSR pipelines (`eSoul-cz/jenkins-libraries` Unreleased).

## Part 13: Hotfix follow-ups (task skills)

Source: the owner's Hotfix decision, now `docs/project_guidelines/workflow.md` › Hotfix (`eSoul-cz/guidelines`, Unreleased). The owner's rule that formalities are shortened and never skipped decides the wording; the guideline owns the rule, so the skills only point at it.

- **`esoul-task-work`**: pick-up step 2 (readiness) names the hotfix as the exception to "an estimate before `In progress`": the task may go straight to `In progress` from `Backlog` or from nothing, may be created after the fix is pushed (before the PR merges) through `esoul-task-create`, and the estimate and work report follow once the fix is out, both recorded in the final summary. `references/freelo.md` › States says new work starts in `Backlog` except a hotfix. Before this the skill said an estimate is always asked first, which contradicts the guideline.
- **`esoul-task-create`**: §4 gets a `Hotfix` paragraph: the task may be written after the fix, may skip `Backlog` and the estimate (it goes to `In progress`, the estimate is added afterwards), and a workaround hotfix gets a follow-up issue (task) for the root cause created the normal way with a preview. The preview and the approval still apply: shortened formalities do not skip the owner's content approval.
- **`esoul-workflow`**: the `Diagnose (Bug)` step says a defect that harms production now is a hotfix, the Task step is shortened as the guideline says, and review and the green `Jenkins` check still apply. No second copy of the guideline's list (audit, rollback) was added.
- The skills' own installed copy of the guidelines (`docs/project_guidelines/`) is the earlier release and has no `Hotfix` section until the guidelines release is installed here; the pointer is by section name, like every other pointer in the skills.

## Part 14: Mechanical gaps of the scenario re-check

Source: the re-check of `esoul-infrastructure/docs/scenarios/` after the gap-fixing round (SC-n is the scenario file, `g<n>` its gap). The owner's rule for this round: gaps that need no decision are fixed directly, the others stay open and are asked. Every item below is such a gap; the reason is the gap itself.

- **Create command and adopt checklist (SC-01 g4, g5)**: `bootstrap.md` step 2 gave "start from the template" with no command, and nothing told a project to replace the template's `replace-with-…` values or to commit the lock files the template does not ship. Step 2 now has `composer create-project esoul-cz/template-<variant>:dev-main <dir>` (the variants exist only as `dev-main`), the three repositories of `astro-cms`, and a section "Adopt the template" with the values, the locks and what stays. `conformance.mjs` reports the leftovers as the error `template-leftover` so that bootstrap step 14 catches them; it reads only `Jenkinsfile`, `.env.example`, `composer.json` and `package.json`, so documentation that names `replace-with-` (this skill's) does not fail. `stacks/laravel.md` lost the `SKIP_DEPLOY`/PHPStan-guard/database-stage paragraph (the template `Jenkinsfile` is one `laravelPipeline` call; the pipeline sets the LFS variable; the empty-`app/` case is a guideline pitfall) and gained the lock-file step `lsr.md` already had.
- **Guidelines files in a template-born project (SC-01 g11)**: `root-files.md` and `bootstrap.md` step 5 said `esoul-guidelines.json` and the lock are created by `init`, while every variant ships them rendered. They now say verify, and `init` only for a project that has none.
- **Platform items (SC-01 g7)**: one line in `esoul-task-create` § 1: the Jenkins job, a Komodo stack and secrets are asked of devops or the lead, never created by the skill.
- **AGENTS.md project part (SC-01 g9)**: the template text said the skills it lists are pinned in `skills-lock.json`, but `project init` installs `core`, `dev` and `upstream-core` only (`PROJECT_INIT_LAYERS`); `esoul-task-create`, `esoul-project-lifecycle`, `esoul-project-update` and `gitmoji-commit` are user layers. The owner decided the `project` layer stays a user-global install for the people who set up and manage projects; the text says so.
- **Fetch before the audit (SC-02 g3)**: `retrofit.md` § 1 and `audit.md` start with `git fetch` and a fast-forward, and stop when the checkout cannot fast-forward (plemenna was 201 commits behind), because an audit of a stale checkout reports fixed problems and misses new ones.
- **Retire old conventions (SC-02 g8, SC-10 g3)**: `retrofit.md` § 5 gained one bullet each for Freelo IDs and label UUIDs (moved into `## Freelo` before the old home is deleted; `project-mapping.md` has the matching line), `docs/agents/`, `CONTEXT-MAP.md` to `GLOSSARY-MAP.md`, a git-ignored `CLAUDE.md` (`root-files.md` says a git-ignored file is not "existing"), `docs/documentation.toml` (project-owned, never replaced) and the `_reference/` ignore with `git rm -r --cached` when material was committed. The owner decision on `[BE]`-style prefix titles stays open.
- **Order of the setup update (SC-03 g12)**: `setup.md` now runs skills (§ 2) before guidelines (§ 3): following the guidelines step needs `esoul-guidelines` and `esoul-review`, and the rendered text names skills a project with an old lock lacks. § 4 (retired names) keeps its number.
- **`-W` (SC-03 g13)**: `esoul-guidelines` § 3 gave the constraint command without `-W`, the guidelines README with it; aligned (`setup.md` too).
- **Compatibility line (SC-03 g5)**: the skills cite `Hotfix`, the standing small-admin record and project exceptions, which exist only from guidelines 0.5.0. The README and `esoul-guidelines` step 4 say so, so an agent on 0.4.x reads a missing heading as "older guidelines" with a known cause.
- **PR title language (SC-04 g6, mechanical half)**: `esoul-task-work` § 3 says a Czech tracker title becomes an English PR title of the same result (`workflow.md` › Tasking). Which of the three skills owns "open the PR" is still the owner's decision.
- **Browser for the 1440/390 px check (SC-04 g11)**: `web.md` named none. It now points at the UAT browser rule (Claude in Chrome in a dedicated profile, or a CDP session of a dedicated Chrome) and says 390 px needs device emulation, which neither browser route does (`esoul-uat` › `references/chrome.md`). `esoul-workflow` Verify points to it.
- **Reviewer brief without guidelines (SC-05 g8)**: `review-passes.md` took its severities from the project's `code-review.md`; the brief now carries the general scale when the project has none, as `esoul-review` A2 already says.
- **Hotfix commit shortcode (SC-06 g8)**: `gitmoji-commit` says the commit that fixes a production defect takes `:ambulance:` where the project uses Gitmoji, with the format's "recommended, not required" status kept; `esoul-workflow` points to it.
- **Audit key in the guidelines (SC-06 g6; `eSoul-cz/guidelines`, not a skill)**: `workflow.md` › Hotfix named `audit: [warnOnly: true]` only for `astroPipeline` (`checks`); it now names `laravelPipeline` and `lsrPipeline` too, as the pipeline `.txt` files document.
- **New developer block (SC-07 g1)**: the README Install section had one sentence; it now has the commands for a project that commits `.agents/skills/` and the lock (owner decision of SC-07 g2): `git lfs pull`, `experimental_install` only to restore or refresh, optional user layers.

## Part 15: Decided gaps of the scenario re-check

Source: the owner's answers to the open gaps of `esoul-infrastructure/docs/scenarios/` (appendix, "Scenario re-check decisions"). The owner's principle for this round is to keep new text short and to leave decisions to the people using the skills, so each item is one clause or one small mechanism.

- **The developer's commit standard wins (SC-03 g9; also `eSoul-cz/guidelines`)**: `gitmoji-commit` ordered "the applicable `AGENTS.md`" first, which could make a project file override the developer, and `convention-bootstrap.md` said to follow the project's convention "not Gitmoji". The order is now the developer's stated standard (request or personal instructions), then the project's recorded convention as a recommendation, then Gitmoji. `esoul-workflow`, `esoul-review` (Path A and B3) and the project-update and bootstrap commit sentences say "the developer's own standard". The guidelines (`general` and `profile/internal` `workflow.md`) say a recorded convention is a recommendation and the pull request title follows the author's standard.
- **One owner of "open the PR" (SC-04 g6)**: the PR rules were described in three places (`esoul-workflow`, `esoul-task-work` § 3 and `esoul-review` B3). `esoul-task-work` § 3 owns it (reuse or create with explicit repository, head and base; the task link; assignee and reviewer; the template with checks, the `No test:` line, Deploy notes and "Risks and what I did not do"; the small-admin question). `esoul-workflow` and `esoul-review` B3 point to it and keep only what is theirs (B3 adds the stack, docs, changelog and ADR lines in the body). `esoul-task-work` is layer 1, so the dev layer may depend on it; without it B3 falls back to `workflow.md` › Pull requests.
- **Squash merge as a setting (SC-04 g8)**: `bootstrap.md` step 12 gives the exact repository call (squash only, PR title as the commit title, delete the branch on merge) and says it is a setting, not a guideline rule; `retrofit.md` item 2 sets it with the ruleset. The guideline sentence about a squash merge was already there and stays.
- **Hotfix review and incident note (SC-06 g2, g7; `eSoul-cz/guidelines`)**: `workflow.md` › Hotfix says the hotfix gets the normal review with priority by any available reviewer, a bypass is the owner's decision only, and the hotfix issue carries a short incident note (what happened, impact, fix, follow-up); telling the client is the project lead's call and is not policy. The skills only point at the section.
- **`.agents/skills/` is committed (SC-07 g2)**: the template READMEs and `CONTEXT.md`, the lifecycle texts and the README already said so; no template `.gitignore` ignores `.agents`, `.claude` or `skills-lock.json` (checked in every layer). What still said "restore" was the helper's closing line, its usage text and `setup.md`; they now say to commit the lock and the skill folders, and `experimental_install` restores or refreshes them.
- **A new push-build stage is not small admin work (SC-09 g2; `eSoul-cz/guidelines`)**: one clause in `workflow.md` › Tasking pointing at the deployment rule (an accepted ADR first).
- **`project init` installs `esoul-jenkins-libraries` (SC-09 g5)**: the skill lives in the private repository `eSoul-cz/jenkins-libraries`, group `jenkins` of `upstream-picks`. The group gets `detectFile: "Jenkinsfile"` in `layers.json` (new, validated, shown in the generated README list); `project init` adds it to the project install when the project has that file and `git ls-remote` can read the private source, and otherwise prints one line with the command to install it later. `layers.json` is where the data belongs because the file name and the source's `private` flag are already manifest data; the access check is injected into the function so the tests need no network. The lifecycle AGENTS.md project part, bootstrap step 10 and the `project init` usage mention it.
- **Declined groups of files (SC-03 g10, SC-02 g9)**: with `commit: null` there is no changelog entry to decline, so a group of files the project will never take could not be recorded and was offered at every run. `declined` items may carry `files` (paths, folders with a trailing `/`); `parseDeclined` validates and keeps them (before, a rewrite dropped every key but `title` and `reason`), the item matches no changelog title, and `adopt.md` says to skip such files in the comparison. The app-templates README documents the form. The builder writes `[]` and needed no change.
- **Variant chooser (SC-01 g6; `eSoul-cz/app-templates`)**: a table "Choosing a variant" in the app-templates README (kind of project to variant, LSR versus Laravel, Astro static versus SSR versus CMS), linked from `bootstrap.md` step 1. The LSR-versus-Laravel line is a default, not a hard rule (Laravel for a client application, LSR when the product is built on the eSoul LSR packages); the lead decides when nothing fits.
- **SQL and data scripts note (SC-10 g5)**: the note already existed in `review-passes.md` › Stack notes as "transactions, idempotent re-runs"; it now also says dry run or a count before the write, a `WHERE` on every `UPDATE`/`DELETE`, reported counts from affected rows, and that one-off scripts and their output are working material (`esoul-data`), not committed unless anonymised.
- **`_reference/` ignore for a project without a template (SC-10 g3)**: `retrofit.md` had the step, but `root-files.md` listed no `.gitignore`, so bootstrap of a non-template project never created the line. The table now has a `.gitignore` row: a template-born project has it with `/_reference/`; any other creates or extends its own with that line.

## Appendix: owner decisions as received

The review ledger (the owner's decisions of 2026-11-24), verbatim. The IDs above refer to it.

Base: docs/research/2026-11-24-skills-content-audit.md (258 decided/mechanical, 80 decisions).

### Group A (core workflow), 2026-11-24
- Principle (owner): eSoul skills BUILD ON mattpocock's skills and don't fight them or impose own conventions irrationally. General skills must not depend on the optional worker-agent setup.
- MR-D1: general skills must work without the `esoul-skills:*` worker agents; agents are an optional install for people who use them. Agent to propose concrete changes (how routing degrades without agents) → part of the restructure proposal.
- RV-D1: (b) anonymise the eval cases in place.
- WF-D1: owner not familiar with `quality-bar.md`; walk it through in detail before deciding.
- RV-D4: go through the rules one by one (risk/revert in PR body; ETL transformations tested).
- RV-D5: PR content is English per the guidelines; CodeRabbit is configured in Czech — don't touch it. (The fallback review follows `.coderabbit.yaml` as today; no guideline change.)
- GC-D1: GUIDELINE CHANGE — Gitmoji is only RECOMMENDED, not required. Each developer may choose their own commit standard; if they don't care, their agents use the recommended Gitmoji format. Required: commit messages in English and descriptive of what they do. (Revisit `general/workflow.md` Commits + PR title rule, `gitmoji-commit` skill, templates' CONTEXT/AGENTS commit text, K4 wording "PR title = commit format".)
- GC-D4: (a) Gitmoji `commitMessagePrefix` (e.g. `:arrow_up: [deps]`) in the templates' `renovate.json5`.
- TQ-D1/D2: move `test-queue` out of the skills repo into its own separate repository, optional install (it has nothing to do with skills). Keep only a short hint where useful.
- Accepted as recommended: WF-D2, WF-D4, WF-D5, RV-D2, RV-D3, RV-D6, GC-D2, GC-D3, MR-D2, MR-D3.
- NOT accepted: WF-D3 (don't add vendored upstream skills to an ignore list — prefer building on the upstream skills).

### Restructure request (owner)
Layers a developer picks from (each layer, and specific skills within it):
1. General workflow and rules — workflow, guidelines, our tasking (for development, not task creation).
2. Code dev work — code review, testing, documentation.
3. Optional extra project steps — project setup, updates, UAT, task creation, data/import work, design, mockups.
4. Optional helpers and tools — gitmoji, test queue, model routing.
5. Optional project-management skills — office documents, offer authoring, …
6. Core third-party skills we use — mattpocock, freelo (current copy from Freelo's website may be dated).
7. Optional third-party recommended skills — mostly esoul-awesome-picks, probably split into tool-specific categories.
Layers 1–2 installed per project (every developer gets them); others are global user installs. A helper on top of `npx skills` (itself `npx`-callable) helps install. Third-party layers are NOT copied into the repo: a reference manifest, installed from source (freelo may need a workaround if not `npx skills`-installable). Lower layers may depend on upper layers; upper layers reference lower ones in moderation, with fallbacks. → Draft a proposal.

### WF-D1 / RV-D4: quality-bar.md rule by rule (2026-11-24)
- §1 One intention per PR: DROP the skill extras (400-line budget, defaults rule, intention list); the guideline's "small and focused, one issue, ~30 files" is enough.
- §2 Server is the boundary: GUIDELINE — one stack-neutral rule in `general/code-review.md` default findings (every rule the UI shows is enforced and tested on the server); stack layers keep their specifics.
- §3 Fix the cause: GUIDELINE (`general/workflow.md` or `code-review.md`, for bugs): name the root cause before changing code; a workaround only with a follow-up; regression test fails on the cause.
- §4 One source of truth: GUIDELINE (general architecture or code-review default finding): a condition deciding visibility/eligibility/status lives in one place; search for an existing helper first.
- §5 Queries: GUIDELINE in `framework/laravel` (and LSR) data access: unique tiebreaker + decided NULL order on sorted/paginated lists; joins on mapping tables match at most one row (unique index; `_ci` collations); reported counts from affected rows. (Check-then-act already covered by the CQRS locking rule.)
- §6: GUIDELINE — no schema DDL in handlers/jobs/controllers (`framework/laravel`); "field not sent vs cleared" in `framework/laravel/requests-and-validation.md`.
- §7: GUIDELINE — composable with module-level state says so and its tests reset it → `package/inertia-vue`; drop §7 from the skill.
- §8: skill follows the guideline (comments English); "a comment explains a non-obvious why briefly; long rationale goes in the PR or ADR" → `general/documentation.md`.
- §9 Data transformations: FOLLOW THE GUIDELINES — transformation rules are proven with temporary tests and fixtures during development; they do not land in Git and do not run in the pipeline (the temporary-tests rule). Drop §9 from the skill (point to Temporary tests).
- RV-D4: the PR template's "Risks and what I did not do" covers risk; the skill points to it and stops requiring revert steps.
- `quality-bar.md` becomes a short agent self-check: the remaining questions, each pointing to the guideline section.

### Restructure decisions (2026-11-24) — proposal docs/plan/skills-restructure.md
- Q1: accept the 7 layers (core, dev, project, helpers, business, upstream-core, upstream-picks).
- Q2: split `esoul-tasking`: task work (pick up, states, linking, closing) → layer 1 `esoul-task-work`; creation → layer 3, MERGED with `esoul-freelo-task-authoring` into one creation skill.
- Q3: merge `esoul-project-data` + `esoul-data-task-guard` into one `esoul-data` skill (layer 3).
- Q4: `esoul-docs` in layer 2. Not every project builds the PDF documentation, but the skill contains general Markdown documentation instructions from which the documentation could be built at any moment; the PDF tool part is optional within it.
- Q5: the helper is a published npm package (e.g. `@esoul-cz/skills`), not `npx github:`.
- Q6: `test-queue` moves to `eSoul-cz/test-queue` (public, optional install).
- Q7: RESTRUCTURE FIRST, then continue the content review (groups B–F) in the new layout. Group A decisions and the guideline changes from quality-bar/GC-D1 are applied alongside.

### Group B (tracker), 2026-11-24 — skills now esoul-task-work (core), esoul-task-create (project), official freelo (upstream-core)
- Settled by the restructure: FL-D1 (copy gone, official skill installed), FA-D1 (creation + authoring merged).
- TK-D1: the `## UAT` scenario format stays owned by the skill (no guideline section).
- TK-D2: (b) a defined minimal path for S work in the skill: outcome + acceptance criteria + one category label; duplicate search once by title; a one-line preview to approve.
- FA-D3 + TK-D3: GUIDELINE states the title shape `Context: Result` and that the PR title is the same result in English; mapping into a commit format (Gitmoji or other) is skill procedure.
- FA-D2: the task skill owns the Freelo working rules (estimate unit: person's time, 15-minute steps, split above 4 h; drop the one-week sprint sentence; Backlog default). CHANGE: `To Do` no longer requires an assignee — an unassigned task in `To Do` is ready to be picked up by anyone. `To Do` = complete + estimated + unblocked. Lifecycle copies become pointers. (Check esoul-task-work's pick-up flow: it may pick an unassigned `To Do` task and assign itself/the user.)
- FL-D2: MCP tools when mounted, otherwise the CLI; recipes list both names.
- FL-D3: (a) a work report is "the person's active time on the task, measured from the session when one exists", stated in both places (estimate rule and work-report method).
- FL-D4: (b) add parsers for omp and Codex transcripts (with fixtures) to the work-report script.

### Groups C and D (project, quality), 2026-11-24
- Principle (owner): for EVERY skill, ask: what is its main purpose, what are its use cases, does the content cover them (and only them)? Revisit all skills this way, especially `esoul-project-lifecycle`.
- LC-D1: non-functional quality gates (Lighthouse budgets, axe, link prefetch, …) become a SEPARATE optional skill (suggest a name and scope — e.g. `esoul-quality-gates` in the project layer). "Numbers only from podklady" → [not answered separately; keep with the lifecycle for now]. The label set and `ready-for-agent` stay in the lifecycle skill only. Gates B0–B5 and the case study stay lifecycle process.
- LC-D2: (a) delete `docs/agents/`; the `blocked_by` recipe moves into `esoul-task-create`; the label set stays in the lifecycle.
- LC-D3: (b) split ai-readiness into a core (~110 lines) and a reference loaded only when needed.
- LC-D4: (a) English for tests, script output, `docs/ai-readiness.md` (parser accepts both header sets); client-facing documents stay Czech.
- LC-D5: (a) a `question.yml` issue form (English form, Czech content allowed, label `question`), copied at bootstrap, known to the task skill and conformance.
- LC-D6: (b) SPLIT website launch material into `esoul-website-launch` (project layer).
- PU-D1: (c) a `declined` list in `.esoul/template.json` (builder change in app-templates); update skips those entries.
- PU-D2: (a) the update skill checks the trailing difference and offers it as an "unlisted changes" entry; later app-templates CI enforces a CHANGELOG entry for variant-touching commits.
- PD-D1: settled (merged into `esoul-data`).
- PD-D2: (b) the placement rule stays skill-owned (no guideline change).
- DG-D1: keep the override; the owner's approval is written in the data issue before the agent changes code. SKILL ONLY, no guideline change.
- UT-D1/D2: (b) one mapping table bug.yml Impact → Critical/Major/Minor/Nitpick; `bug-issue.md` becomes the Czech rendering of `bug.yml` with the same fields; tester/client-facing UAT artefacts stay Czech.
- UT-D3: UAT stays skill-owned (consistent with TK-D1).
- UT-D4: UAT is an exception to "agents SHOULD NOT write to staging data", but ONLY on staging; production remains a hard rule. SKILL ONLY, no guideline change.
- UT-D5: (a) one env-file location; UAT accounts are test-only (never real users); extension runs expose the password to the model (stated).
- UT-D6: (a) keep the Google Doc bridge in `esoul-uat`; separate human setup from agent use; "no client data in the Doc"; token-rotation reminder.
- UT-D7: (b) "a browser tool that can use a dedicated profile" (Claude in Chrome default, or CDP of a dedicated Chrome), fallbacks without the plugin agents.

### Group E (documents and design), 2026-11-24
- Release policy (owner): ONE release at the end, once all skills are done — no tooling 0.6.8 now, no intermediate plugin/guidelines releases for this review.
- DT-D1: keep the current behaviour of `commit_pdf_outputs`; only change: `false` is the default and `true` shows a NOTICE only (not an error, not a behaviour change).
- DT-D4: NOT now — part of the single final release.
- DT-D2: per-guide `language` + math check in `validate` (in the final release, or later if heavy — report).
- DT-D3: `tooling/CHANGELOG.md` with Unreleased; Jenkins reads it for the release notes instead of the Jenkinsfile string.
- DT-D5 + DOC-D4: one maintainer document for the tool's internals, release procedure and checklist; the skill's `pdf-pipeline.md` loses its renderer internals.
- DOC-D1: one `workflow.md` with three mode sections.
- DOC-D2: keep `docs/documentation-decisions.md`; the skill adds it to `CONTEXT.md` Sources of truth when it creates it.
- DOC-D3: first install of the tool needs maintainer approval; upgrades only the user's confirmation.
- DOC-D5: `esoul-docs` owns client-facing application guides as PDF; `esoul-office-documents` owns DOCX/XLSX/PPTX business documents; both descriptions say so.
- OD-D1: (b) add language and currency parameters NOW (office documents + offers: `--lang`/currency, English template text where needed).
- OD-D2: (a) `assets/templates/README.md` (origin, owner, re-export, font licence) + a smoke test that the footer holds the current IČ.
- OF-D1: (a) offers live in one internal sales repository or folder outside the project repos; Markdown committed, DOCX a build artifact, never committed.
- OF-D2: ask the user for the supplier block and payment terms; missing ones `TBD`.
- OF-D3: the sales policy stays in the skill (`references/terms-and-pricing.md`) with the owner (Tomáš Vojík) named; owner did not object to the 10 % reserve and three variants (treat as current).
- MK-D1: allow ANY configured branch for mockup publishing (guideline updates mostly land through PRs).
- MK-D2: route (owner): a Pencil design is first created and kept in the repository; an agent with access to Pencil's MCP then creates the mockup from it — the MCP is the primary way. Write `references/from-pencil.md` describing this (read frames through the Pencil MCP, write the bundle; keep `data-pencil-name`), and keep "adapt" in the description.

### Group F (agents, tooling, picks) + open points, 2026-11-24
- AG-D1: KEEP the quality-rule copy in the `implementer` agent (agents may run without the skill); make it match the guidelines' rules (the moved quality-bar rules) and drop the duplicate in its self-check only where it repeats the same list.
- AG-D2: shrink `session-rules.md` to the guard-relevant lines (explicit model, never fork, S directly, two failures); keep injecting it in every session (no restriction to guideline repos).
- AG-D3/D4: `ops` gets an allowlist (shell, read, search, Freelo MCP server); read-only agents map to a read-only Codex sandbox; `uat-runner` STAYS in Codex (it can run there — adjust its browser requirement per UT-D7).
- TL-D1: Jenkins also runs the Python tests in a `python:3` step; the mockup preview test stays manual.
- TL-D2: a scheduled Jenkins check reports when a pinned upstream source has a newer release.
- TL (owner): optimise the skills Jenkins pipeline with CONDITIONAL STAGES — run each test group only when its relevant files change (e.g. Go tool tests only on tooling/ changes, a skill's script tests only on that skill), full run on a schedule/tag.
- AP-D1/D4: prune the picks manifest to the non-conflicting ones (accessibility, sql-optimization, seo-technical, seo-schema, frontend-lighthouse, one WordPress form = the `wordpress` bundle, frontend-design) plus `esoul-jenkins-libraries` and the stack groups (LSR, Vue, Boost). Drop `laravel-expert`, `docker-expert`, `mysql`, generic `jenkins`, `e2e-*`, `seo-audit` (and any other conflicting pick).
- RP-D1: generate the README skill list (one line + link) from SKILL.md frontmatter and layers.json; usage stays in each SKILL.md; adjust the test.
- LC-D1 follow-up: `esoul-quality-gates` (project layer) as suggested — Lighthouse/performance budgets, axe accessibility, link prefetch, AI-readiness checker, security headers — for any web project, not only at launch. Owner: consider MERGING it with `esoul-website-launch`, or one references the other → decide in implementation with a short rationale (recommendation: one skill `esoul-website-quality` if launch is mostly gates; else launch references gates).
- DOCUMENTATION (owner, mandatory): record every third-party drop and every other change with its reason, so a later reviewer (a colleague) can find why each change was made — a `docs/decisions/` (or CHANGELOG + a review record) in the skills repo citing these decision IDs.

### Final open points, 2026-11-24

- P1 lifecycle split: owner asked for a recommendation → KEEP one skill for now (website launch and quality gates already moved out; the remaining modes share the same project state); revisit once documentation upkeep grows or real use shows separate triggers.
- P2: move the stack pitfalls from the lifecycle stack profiles into the matching guideline layers (unreleased, ships with the final guidelines release).
- P3: "numbers and calculations come only from client materials (podklady)" → one sentence in `general/domain.md`.
- P4: quality-gate thresholds stay skill-side.
- P5: keep the dependency: `esoul-website-launch` requires `esoul-quality-gates` (layers.json + description).
- Confirmed: `question` issues have no Freelo pair; light tier `rozhodnuti.md` English, other light docs Czech; UAT gdoc env at `~/.config/esoul-uat/<key>.gdoc.env` (one-time mv, no shim); Codex read-only agents use instruction-only rules.
- Confirmed: `declined[].reason` required; `ops` allowlist assumes the Freelo MCP server is named `freelo`; keep the session-title line; `matt-extra` keeps `pr` and `git-guardrails-claude-code` on request; weekly upstream check Monday 04–06h on master.
- Sales: offers live in the private repo `eSoul-cz/sales` (created 2026-11-24).
- Office templates owner: Tomáš Drvota (primary), Tomáš Vojík (secondary); font: Open Sans (probably; SIL OFL — verify in the templates).
- MK-D3: the in-app preview is optional; without access to the application checkout the skill previews the bundle standalone.

### Scenario gaps 3 and 4 (owner, 2026-11-24)

- Principle (owner): rules can be overridden per project with the owner's approval (also indirect: a developer gets the owner's approval and makes the change). Especially for active projects that migrate: a migration should NOT be hard — we don't rewrite whole apps just to use our templates, compromises are expected. Skills are less strict on migration than on new projects; new projects follow the rules closely.
- 3a: a "new project infrastructure" checklist in the lifecycle bootstrap reference (agent does repo, Freelo with approval, manifest PR to infra; lists what a person must do: Jenkins job if not auto-discovered, secrets).
- 3b: one fixed retrofit order: (1) `project init` (skills), (2) guidelines install + reconciliation, (3) pipeline one-call, (4) template adoption (optional, own PR), (5) test-suite cleanup (own PRs; the Indcom procedure moves into a skill reference).
- 3c: during a migration: CLEAR CONFLICTS with the guidelines → always ask the user. Minor differences that agree with the guidelines → migrated to the guideline version automatically. Non-conflicting project rules → minor ones adopted as project-only rules automatically; major ones may be asked about; the agent notifies the user about both.
- 3d: a short "Getting started" section in the template README and the common `CONTEXT.md` (clone, `npx skills experimental_install`, optional user layers, local env, access to Freelo/Jenkins/1Password); the lifecycle keeps it in projects.
- 3e: a "Hotfix" section in `general/workflow.md`: an issue is still created (may be written after the fix), the task may skip Backlog/estimate, the audit may be warn-only for a hotfix build, rollback pointer (redeploy the previous image), follow-up issue for the root cause.
- 4: exceptions are listed in `esoul-guidelines.json` (rule id → ADR, with what applies instead); the renderer prints a marker next to each overridden rule in the managed block (needs stable rule ids/anchors: heading anchors or explicit ids); `check` validates that each referenced rule exists.
- 4b: any rule may have a recorded project exception with the owner's approval and an accepted ADR, except the security and production-data rules (they stay hard).

### Scenario re-check decisions (owner, 2026-11-24)

- Principle (owner): skills and scenarios don't need to be perfect; we iterate later. People running the skills can make decisions on their own, so not everything needs to be strictly defined; keep new text short.
- 01 g6: a variant chooser table in the app-templates README and the lifecycle bootstrap.
- 03 g9: the DEVELOPER's own commit standard wins; the project's recorded convention is only a recommendation.
- 04 g6: `esoul-task-work` owns "open the PR"; `esoul-review` and `esoul-workflow` point to it.
- 04 g8: squash merge is a repository setting only (lifecycle sets it), no guideline rule.
- 06 g2/g7: a hotfix gets the normal review with priority (any available reviewer); a bypass is the owner's decision only. An incident note goes in the hotfix issue (what happened, impact, fix, follow-up); a client message is the project lead's call, not policy.
- 07 g2: COMMIT `.agents/skills/` too (works offline, bigger diffs), plus `skills-lock.json`.
- 09 g2: `workflow.md` says a new stage in the push build is not small admin work (needs an ADR per the deployment rule). 09 g5: `project init` installs `esoul-jenkins-libraries` for projects with a `Jenkinsfile` when the developer has access (private repo; skipped otherwise).
- 03 g10 / 02 g9: a `commit: null` adoption may record declined groups of files in `declined`.
- 10 g5: yes, a "SQL and data scripts" note in `esoul-review` stack references.

### Helper selector (owner feedback, 2026-11-24, plugin 0.27.1)

- Interactive selector for `install` and `project init` in a terminal (target, layers, skills; third-party skills listed where `layers.json` names them), non-interactive behaviour for scripts and CI unchanged. Reason: people should see and trim what is installed without learning the layer names.
- Target choice (owner): `auto`, `project` or `user`, asked first so the layer step can show where each layer goes; `auto` (each layer to its own scope from `layers.json`) lets one command install project and user skills. Preselected from the command; `--target` plus the existing flags as aliases.
- One `npx skills add` per (source, scope) instead of per layer and source (fewer clones; 15 to 10 for a full install). The variadic `--skill a b c` form stays; `--skill a --skill b` was checked against `skills` 1.9.0 and works too.
- `@clack/prompts` chosen (as `npx skills`), lazy-loaded so tests and scripts need no `node_modules`; the helper test now allows exactly this one dependency.

### Helper update, README and guidelines without PHP (owner notes, 2026-11-25, plugin 0.27.2)

- `esoul-skills project init` does the full update of the project scope, not only the report (owner). It removes the retired skills and the lock entries whose skill their source dropped, then refreshes the lock. Detection: a lock entry from a third-party source of `layers.json` whose skill the source's `npx skills add <source>@<ref> --list` no longer names (one listing per source and ref, cached for the run); the own repository is judged by the manifest itself. Refresh: `npx skills update -p -y` (checked against `skills` 1.9.0: `-p` project only, `-y` skips the scope prompt; `update` reads the lock refs, so the pinned mattpocock tag holds, and it only reports an upstream deletion without a terminal, which is why the helper removes).
- Modes (owner): a terminal without `--yes` shows the removal list and confirms (default yes); `--yes` removes; `--dry-run` prints the commands; without a terminal and without `--yes` the old report-only behaviour plus a line to pass `--yes`, since scripts must not delete silently. The refresh runs in every mode except `--dry-run` (it prints it).
- Boundaries (owner): project scope only, the user's global skills are never touched by `project init` (`status` keeps reporting them); a skill the project took from a source outside `layers.json` stays (the lock names the source); removal goes through the real CLI (`npx skills remove … -y`), batched in one call. Decided on top: a source that cannot be listed is never judged (an empty or failed listing is "unknown", not "everything dropped"), and a skill the manifest still names is never removed (a manifest naming a skill its source lost is a `layers.json` error that the manifest test reports).
- Order inside `project init`: install, then remove, then refresh, so a cancelled selector or a failed install changes nothing, and `update` never meets an entry whose skill is gone.
- README (owner): the helper is not dependency-free; the claim was stated once, in the README Install section (package description, `CONTEXT.md` and these decisions did not make it) and is corrected there: `@clack/prompts` is the one runtime dependency, loaded only for the selector.
- Guidelines in a project without PHP (owner): `esoul-guidelines` gets a short section "Without PHP in the project" where it explains install and update: `composer global require esoul-cz/guidelines:^0.5` plus the global bin directory on the `PATH`, then `init|sync|check` from the project root; the PHAR of the version in `esoul-guidelines.lock` or the Docker image as alternatives; update by raising the global constraint with `-W`; CI runs `check` itself with the lock's `package_version`. The guidelines README stays the source of truth (linked, not copied); bootstrap step 5, retrofit R2 and `setup.md` point to the section.

### Production start, seeders and monitored deployments (owner notes, 2026-11-25)

- The guidelines gain rules for the production `start` entrypoint (quick, forward-only migrations whose failure does not block the deployment, no seeder, only a production seeder in staging and production, Faker seeders local-only) and for monitoring a production deployment (the person who started it; a SHOULD for staging), and the 0.5.2 command-construction wording is corrected (the constructor holds only promoted properties; a named static constructor builds from another object; a form request maps itself).
- Checked against the skills: no skill restated these rules (`esoul-project-lifecycle` stacks and bootstrap, `esoul-data`, `esoul-review` stack notes and `esoul-task-work` carry none of them), so the rules live only in the guidelines. The one pointer added is a Guardrails bullet in `esoul-workflow`: a production deployment is watched by whoever started it, and a production start script follows the start entrypoint rules. `esoul-review` stack notes are unchanged (the review reads the deployment guideline; its briefs need an eval run).