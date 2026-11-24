# Adopt a project without `.esoul/template.json`

Projects created before the record existed (before 2026-11-18 in the template changelog), or created without a template, have no `.esoul/template.json`. Writing it is a retrofit action of `esoul-project-lifecycle`; this skill does it only so that an update can run, and does nothing else of a retrofit (no `AGENTS.md`, `CONTEXT.md` or process documents).

1. **Variant.** Ask the user to pick the closest variant from the candidates (`variants/*.json` in app-templates lists them with a description). A project that fits none is not updatable: stop and say so.
2. **Commit.** Choose the oldest commit that can be justified, so the update offers every entry that might not have landed:
   - the project's first commit date against the changelog dates: the app-templates commit that added the newest entry dated before it (`git -C "$AT" log --reverse --format=%H -S"<title>" -- CHANGELOG.md | head -1`), or an earlier entry when the user cannot say the project started from the template of that day; an entry that cannot be shown to have landed stays after the recorded commit and is offered;
   - a dependency or file that proves a later state (for example `esoul-cz/guidelines` in `composer.json`, `esoul-guidelines.lock`, a `Jenkinsfile` one-call pipeline) moves the commit to the entry that introduced it, when the user confirms the project has it;
   - nothing can be justified (no history, heavily rewritten project): `null`.
3. **Write** `.esoul/template.json` as `{"variant": "<variant>", "commit": "<sha>", "declined": []}` (`null` without quotes for the unknown commit), four-space JSON with a trailing newline, and commit it as `:wrench: [template] Record the template this project came from` (the project's commit standard applies). An old record with `version` and no `commit` is replaced by this form.
4. Say in the PR description that the file was added by this update as a retrofit action (one sentence), with the commit chosen and why.

## `commit: null`

There is no base state and no entry list to select. The update becomes a comparison with the latest template:

1. In the variant clone `$TV`, for each file of `main` (`git ls-tree -r --name-only main`) compare it with the project file; skip generated files (see `apply.md`) and the files of a group already in `declined` (below).
2. Group differences by changelog entry where possible (the newest entries of `$AT/CHANGELOG.md` that name the variant explain most of them) and show the user the groups; every file the user wants to take is applied by hand or with `git merge-file` using the project file as "ours" and an empty base, project side kept on conflicts.
3. One commit `:arrow_up: [template] Align <area> with template-<variant>` per group the user accepts; groups the user declines are listed in the PR as skipped. A group the project will never take (a short reason is enough, a link to the decision when there is one) MAY be recorded in `declined` of `.esoul/template.json` as `{"title": "<group name>", "reason": "<why>", "files": ["<path>", "<folder>/"]}`: the next comparison then skips those files, and the record can keep or advance `commit`. Without such a record the group is offered again.
4. Record `main`'s HEAD (`git -C "$AT" rev-parse origin/HEAD`) only when every group was applied or declined on purpose; otherwise keep `null`, so the next run repeats the comparison for what is left.
