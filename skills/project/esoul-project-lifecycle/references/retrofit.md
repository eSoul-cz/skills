# Retrofit an existing project

Use for a project that already has code but not the eSoul structure. The order matters: make CI
trustworthy first, then the rules, then the decisions. A retrofit is lenient: we do not rewrite a
running application to fit the guidelines or the templates, and compromises are expected. Where a
project deviates, the deviation is decided with the person and recorded (section 4), not erased.
New projects follow the rules more closely ([bootstrap.md](bootstrap.md)).

## 1. Audit (read-only)

Start from the current default branch: `git fetch`, then `git pull --ff-only` on it (a clean work
tree is the precondition). When the checkout is behind and cannot fast-forward (local commits, a
dirty tree, another branch), stop and tell the user: an audit of a stale checkout reports problems
that are already fixed and misses new ones. Until the user resolves it, read the remote state
instead (`gh api repos/<owner>/<repo>/contents/<path>`, `Jenkinsfile` and tree of the default
branch) and say so in the report.

Run `node <skill>/scripts/conformance.mjs <repo> --github <owner/repo>` and read
[audit.md](audit.md). Also inventory, with evidence:

- what the code actually does per area (modules, integrations, money, auth, data);
- existing specs, plans, client files and where they live;
- runtime bugs and risky behaviour found while reading (each becomes a bug pair);
- CI state, existing gates, and what is skipped;
- the guidelines state: is there an `esoul-guidelines.json`, and is there a `docs/project_guidelines/`
  from the old lifecycle bundle (section 4 below);
- the original site: whether `Original site` is in the profile and `assets/case-study/pred/` exists; if the site is still unchanged, capture it (skill `esoul-website-launch`, case study).

Legacy files, specs and client files are summarized by a read-only explorer per area (a cheap
one, when the harness offers subagents; otherwise read them yourself), with `file:line` evidence,
instead of the session reading them. The audit only produces a report, returned to the user; it
is not a file in the repository (`workflow.md` › Repository rules). Any write of the report to a
PR, Freelo or the repository goes through `esoul-task-create` preview and explicit approval (for
example as the PR description of the first retrofit PR or a Freelo-only `pm` task).

## 2. Plan the retrofit as pairs

Create the retrofit work as issue + Freelo pairs up front, via `esoul-task-create`, with native
`blocked_by` so the order is visible. The default order:

1. Critical bugs found in the audit.
2. CI green and required on `main` (ruleset), and the merge settings of bootstrap step 12 (squash merging only), both after the person approves the exact `gh api` calls.
3. **R1, the project's skills** (`npx @esoul-cz/skills project init`, `skills-lock.json`); a
   project that already has a lock from before the 0.26.0 layout, retired skill names in its files
   or an older guidelines minor takes the setup update first (`esoul-project-update` ›
   `references/setup.md`).
4. **R2, guidelines:** `esoul-guidelines init` and `sync`, reconciliation of the existing
   `docs/project_guidelines/` and `AGENTS.md` (section 4), `esoul-guidelines check` in CI
   (skill `esoul-guidelines`).
5. **R3, pipeline:** the `Jenkinsfile` becomes one call of the shared pipeline library (skill
   `esoul-jenkins-libraries`); the `Guidelines check` stage is built in while the lock exists.
6. Root files and agent rules: the missing common files from the template
   ([root-files.md](root-files.md)), the issue forms (`task`, `bug`, `question`), `CONTEXT.md`,
   the project part of `AGENTS.md`, LFS, the `_reference/` ignore, and the old conventions retired
   as §5 lists them.
7. Linters, strict types, formatter, one local check command; mutation testing where the project's
   guideline layers include `package/mutation-testing`. Existing violations are mapped to
   gap issues, so the list only shrinks. PHPStan gets no baseline (`docs/project_guidelines/tools.md` ›
   Static analysis: the baseline stays empty, a new error is fixed, not baselined): raise the
   level one step per PR, fixing what each step finds, and record the distance to the guideline's
   level as a `**Target.**` block with a gap issue. A suppressions file is for a tool whose own
   guideline allows one.
8. Glossary from the code and the client's language.
9. ADRs written retroactively. Each one states the target, then `Implementation status as of
   <date>` with the files and tests that implement it and every gap with its issue or
   "No issue". Verify every claim against the code; never describe intent as implemented.
10. Project-specific guideline files with `**Target.** … The code does not do this yet: <where> (#issue)`.
11. `docs/data-model.md`, `docs/legacy/` when a previous system exists, frozen old specs with a
    warning header (moved under `docs/plan/` and marked as historical).
12. Plan and slices derived from three sources only: ADR gaps, open issues, and newly proposed
    feature pairs. See [plan-and-slices.md](plan-and-slices.md).
13. **R4, template adoption** (optional, its own PR): section 3.
14. **R5, test-suite cleanup** (optional, its own PRs): section 3.

The technical chain is the fixed order R1 → R5 above (items 3, 4, 5, 13, 14); the other items keep
their relative order around it. Every item is its own pair and its own PR.

## 3. The fixed order of the technical retrofit

| Step | What | Where it is described |
|---|---|---|
| R1 | Skills: `project init`, lock, retired names. First, because every later step needs `esoul-guidelines`, `esoul-task-create` and the lifecycle skill | `esoul-project-update` › `references/setup.md`; skills README › Install |
| R2 | Guidelines install and reconciliation | section 4 and skill `esoul-guidelines` |
| R3 | Pipeline: one call of the shared library replaces a hand-written `Jenkinsfile`; a hand-written `Guidelines check` stage is dropped, the library runs it while the lock exists. Extra stages need an ADR (`deployment.md` › Pipeline) | skill `esoul-jenkins-libraries`; guidelines `framework/*/deployment.md` |
| R4 | Template adoption: record the variant in `.esoul/template.json` and align files with the template. **Optional.** Own PR, after R1–R3. The person decides whether it pays off: a running project with its own layout is not rewritten to look like the template, and what it declines is recorded in `declined` with a reason | `esoul-project-update` › `references/adopt.md` |
| R5 | Test-suite cleanup to the testing tiers. **Optional**, only when the owner wants it (a suite over the time budget, or rules that break the tiers). Own PRs, one per wave | skill `esoul-testing` › `references/suite-cleanup.md` |

Skipping R4 or R5 is a named exception of the retrofit ("Done when" below), recorded in the retrofit
PR with the reason.

## 4. Migrate an existing `docs/project_guidelines/` (R2)

A project that took the old lifecycle bundle, or wrote its own rules, has guideline text of its
own. That text is **migrated, not overwritten**, and the migration is lenient: it ends with a
project that follows the guidelines where it can and says so where it does not. The old bundle
stays readable at the tag `plugin-0.24.0` of `eSoul-cz/skills`
(`git show plugin-0.24.0:skills/esoul-project-lifecycle/assets/templates/docs/project_guidelines/<path>`).

1. Run `esoul-guidelines init` and review the layers
   (skill `esoul-guidelines`), then `esoul-guidelines sync`. The installer writes its managed
   block into each file and keeps the old text below it.
2. For each file, compare the old text below the block with the block, and sort every difference
   by the **conflict policy**:
   - **A clear conflict with a guideline** (the project rule says the opposite of a guideline rule,
     or forbids what it requires): **always ask the user**, one question per conflict, with the
     project rule, the guideline rule (file › heading) and the options below. The agent never
     decides a conflict alone.
   - **A minor difference that agrees with the guideline** (same rule in other words, a detail the
     guideline states differently without changing the outcome): **migrated to the guideline
     version automatically**. Delete the project text; the block carries it.
   - **A project rule that does not conflict** with any guideline: a **minor** one (a naming habit,
     a command, a local convention) is **adopted automatically as a project-only rule** below the
     block or in its own project file; a **major** one (an architecture constraint, a gate, a
     process rule) **may be asked about** before it is kept.
   - The agent **notifies the user about both automatic outcomes**: say in the chat which rules
     were migrated to the guideline version and which were adopted as project-only rules, and list
     them in the PR description.
3. Options for a clear conflict, in the order to offer them:
   1. **Adopt the guideline** and delete the project rule. When the code does not follow it yet,
      keep a `**Target.**` block with a gap issue instead of rewriting the application now.
   2. **Keep the project rule as a recorded exception.** It needs the owner's approval (the
      developer gets it from the owner and says so), an accepted ADR, and an entry under
      `exceptions` in `esoul-guidelines.json` (`rule`, `instead`, `adr`), so the generated
      guideline shows the override and `esoul-guidelines check` keeps the reference valid (skill
      `esoul-guidelines` › Project exceptions). The security and production-data rules cannot be
      excepted: the only options for those are adopting the guideline or changing it.
   3. **The guideline is wrong for every project:** a change in `esoul-cz/guidelines`, its own PR
      there; until it lands, option 1 or 2 applies.
4. Files the installer does not produce (old stack files such as `cqrs.md` kept for the project)
   stay as project files when they hold project rules.
5. The PR description lists every section removed or moved, per file, with a one-line reason
   ("carried by the block: testing.md › Test groups"), the project-only rules adopted, and one row
   per conflict: file, heading, old rule, decision, and the ADR when it is an exception.
6. A rule the project needs and the guidelines lack is not added to the block: it goes below it,
   and a change of the guidelines themselves is its own PR in `esoul-cz/guidelines`.
7. Verify: `esoul-guidelines check` exits 0 (it also validates the recorded exceptions) and the
   conformance script has no errors.

## 5. Rules during retrofit

- One retrofit step per change: a PR each in client repositories (`profile/internal` repositories
  MAY push directly). Do not fix product code in passing; open a pair instead.
- Existing ADRs or decision documents in another format stay valid. Do not rename files that
  are linked from issues; add new ADRs in the current format.
- If the project already uses `GLOSSARY.md` for both conventions and vocabulary, move the
  convention sections (Freelo, tasking, commits) into `CONTEXT.md` and leave vocabulary in
  `GLOSSARY.md`. `CONTEXT.md` gets the guideline's headings (`Project profile`, `Tracker`,
  `Tasking convention`, `Commit convention`).
- Czech issue and PR templates are replaced by the English ones; an existing
  `.github/dependabot.yml` is replaced by Renovate ([root-files.md](root-files.md)).
- Existing issue titles stay as they are. New titles follow the project's convention
  (`CONTEXT.md › Tasking convention`): an existing Czech project keeps Czech tracker titles.
- An existing Markdown register of open client questions is converted
  into `question` issues, one per open item, through `esoul-task-create` with an approved preview;
  the file is removed afterwards.
- Retire project-local tasking skills once `CONTEXT.md` records the convention.
- Move the Freelo data **before** retiring its old home: the tasklist IDs and label UUIDs kept in a
  project-local tasking skill, in `AGENTS.md` or in `docs/agents/` go into `## Freelo` of
  `CONTEXT.md` first (form and verification: `esoul-task-create` › `references/project-mapping.md`);
  then the old source is deleted.
- `docs/agents/` (`issue-tracker.md`, `triage-labels.md`, `domain.md`, written for the upstream
  tracker skills that the project part of `AGENTS.md` tells agents to ignore): what is still true
  moves into `CONTEXT.md` (`## Tracker`, `## Tasking convention`, `## Freelo`) or `GLOSSARY.md`;
  then the folder, the links to it in `AGENTS.md` and its `.gitignore` entry go.
- `CONTEXT-MAP.md` with a `CONTEXT.md` per context used as glossaries becomes `GLOSSARY-MAP.md`
  with a `GLOSSARY.md` per context ([glossary.md](glossary.md)); the root `CONTEXT.md` keeps the
  conventions.
- A `CLAUDE.md` that `.gitignore` excludes (often with `/.claude`) is not a missing file: remove
  the ignore lines in the same commit, commit `CLAUDE.md` as the one line `@AGENTS.md` and carry
  its useful rules below the managed block of `AGENTS.md`. The ignore of `/.claude` also hides the
  committed `.claude/skills/<name>` links of the project's skills.
- `docs/documentation.toml` is project-owned and never replaced: its `[[guides]]` list of PDFs
  stays. The tool install and the ignored `output_dir` and `work_dir` follow `esoul-docs` › PDF
  output; PDFs that Git already tracks leave the index in their own commit
  (`docs/project_guidelines/documentation.md` › Generated documentation).
- `_reference/` (non-anonymised client material kept locally, `security-and-data.md`): add
  `/_reference/` to `.gitignore`. When something under it is already committed, `git rm -r
  --cached _reference` in its own commit and tell the project lead: history still holds it, and
  what to do about that is their decision.

Done when every step above is a merged pair or a named exception (R4 and R5 are optional and are
recorded as skipped with the reason), `esoul-guidelines check` exits 0 and the conformance script
reports no error.
