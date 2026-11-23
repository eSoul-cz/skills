# Retrofit an existing project

Use for a project that already has code but not the eSoul structure. Doglead 3.0 went through
this in one week. Plemenná kniha has most of the engineering rules but no written tasking
convention or issue templates. The order matters: make CI trustworthy first, then the rules,
then the decisions.

## 1. Audit (read-only)

Run `node <skill>/scripts/conformance.mjs <repo> --github <owner/repo>` and read
[audit.md](audit.md). Also inventory, with evidence:

- what the code actually does per area (modules, integrations, money, auth, data);
- existing specs, plans, client files and where they live;
- runtime bugs and risky behaviour found while reading (each becomes a bug pair);
- CI state, existing gates, and what is skipped;
- the guidelines state: is there an `esoul-guidelines.json`, and is there a `docs/project_guidelines/`
  from the old lifecycle bundle (section 3 below);
- the original site: whether `Original site` is in the profile and `assets/case-study/pred/` exists; if the site is still unchanged, capture it ([case-study.md](case-study.md)).

Legacy files, specs and client files are summarized by `esoul-skills:scout` (Haiku) per area,
with `file:line` evidence, instead of the session reading them. The audit only produces a
report, returned to the user. Do not write it to a PR, Freelo or the repository; any such
write goes through `esoul-tasking` preview and explicit approval (for example as the PR
description of the first retrofit PR or a Freelo-only `pm` task).
Do not create report files in the repository.

## 2. Plan the retrofit as pairs

Create the retrofit work as issue + Freelo pairs up front, via `esoul-tasking`, with native
`blocked_by` so the order is visible. The default order:

1. Critical bugs found in the audit.
2. CI green and required on `main` (ruleset).
3. Root files and agent rules: the missing common files from the template
   ([root-files.md](root-files.md)), issue templates, `CONTEXT.md`, the project part of
   `AGENTS.md`, LFS.
4. Guidelines: `esoul-guidelines init` and `sync`, `esoul-guidelines check` in CI
   ([guidelines.md](guidelines.md)); migrate an existing `docs/project_guidelines/`.
5. Linters, strict types, formatter, one local check command. Existing violations go into a
   ratchet (baseline or suppressions file) mapped to gap issues, so the list only shrinks.
6. Glossary from the code and the client's language.
7. ADRs written retroactively. Each one states the target, then `Implementation status as of
   <date>` with the files and tests that implement it and every gap with its issue or
   "No issue". Verify every claim against the code; never describe intent as implemented.
8. Project-specific guideline files with `**Target.** … The code does not do this yet: <where> (#issue)`.
9. `docs/data-model.md`, `docs/legacy/` when a previous system exists, frozen old specs with a
   warning header (moved under `docs/plan/` and marked as historical).
10. Plan and slices derived from three sources only: ADR gaps, open issues, and newly proposed
    feature pairs. See [plan-and-slices.md](plan-and-slices.md).
11. Vendored skills and the skills lock; mutation testing where the project's guideline layers
    include `package/mutation-testing`.

## 3. Migrate an existing `docs/project_guidelines/`

A project that took the old lifecycle bundle has generic guideline text of its own. That text is
**migrated, not overwritten**. The old bundle stays readable at the tag `plugin-0.24.0` of
`eSoul-cz/skills`
(`git show plugin-0.24.0:skills/esoul-project-lifecycle/assets/templates/docs/project_guidelines/<path>`).

1. Run `esoul-guidelines init` and review the layers
   ([guidelines.md](guidelines.md)), then `esoul-guidelines sync`. The installer writes its managed
   block into each file and keeps the old text below it.
2. For each file, compare the old text below the block with the block. **Delete generic text the
   block now carries.** Keep what is specific to this project (named exceptions, `**Target.**`
   blocks with their gap issues, calculations, integrations, a project's own architecture files)
   below the block, or in its own project file.
3. Files the installer does not produce (old stack files such as `cqrs.md` kept for the project)
   stay as project files when they hold project rules.
4. The PR description lists every section removed or moved, per file, with a one-line reason
   ("carried by the block: testing.md › Test groups").
5. A rule the project needs and the guidelines lack is not added to the block: it goes below it,
   and a change of the guidelines themselves is its own PR in `esoul-cz/guidelines`.
6. Verify: `esoul-guidelines check` exits 0 and the conformance script has no errors.

## 4. Rules during retrofit

- One retrofit step per PR. Do not fix product code in passing; open a pair instead.
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
  into `question` issues, one per open item, through `esoul-tasking` with an approved preview;
  the file is removed afterwards.
- Retire project-local tasking skills once `CONTEXT.md` records the convention.
