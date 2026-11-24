# Update a project's eSoul setup

For a project that already follows the eSoul structure but lags the current one: the guidelines package is on an older minor, `skills-lock.json` lists skills that were renamed, moved or removed, and project files name skills that no longer exist. It is one PR with one commit per mechanical step, and it comes before the template update of `SKILL.md` (the template's "Render guidelines" entries then find the project already up to date).

Not a retrofit (a project without the eSoul structure: `esoul-project-lifecycle` › `references/retrofit.md`) and not a template update (`SKILL.md`). Commands: `esoul-guidelines` (skill `esoul-guidelines`) and the helper `npx @esoul-cz/skills` (`esoul-skills`). The agent never merges.

## 1. Preconditions and measurement (read-only)

1. The worktree is clean and on an up-to-date default branch. An issue or task exists, or the user said in this conversation that it is small administrative work without one (ask; never assume, unless `CONTEXT.md › ## Tasking convention` records the standing decision). Branch: `chore/<issue-number>-update-setup`, without an issue `chore/update-setup` (`docs/project_guidelines/workflow.md` › Branches).
2. Measure and show the user the findings in one message:
   - **Guidelines:** `package_version` in `esoul-guidelines.lock` against the latest release (`composer outdated esoul-cz/guidelines`; without Composer the PHAR or image tag of `esoul-guidelines` step 1), and the constraint in `composer.json`.
   - **Skills:** `npx @esoul-cz/skills status`: installed skills with a retired name, `skills-lock.json` entries whose skill is gone or whose path moved, and the commands that fix them. A project that never ran `project init` shows missing `core`, `dev` and `upstream-core`.
   - **Names in files:** the `git grep` that `npx @esoul-cz/skills retired` prints.

Done when the old and the latest guidelines version, the stale skills and the files naming retired skills are listed.

## 2. Guidelines

1. On 0.x a caret constraint stops at the minor: `^0.3` never reaches 0.4. Raise it with `composer require --dev esoul-cz/guidelines:^<latest minor>` (without Composer, take the newer PHAR or image and pin the version CI runs, `esoul-guidelines` step 4), then `esoul-guidelines sync --dry-run -vv`, read what would change, `esoul-guidelines sync`.
2. Read the guidelines changelog between the old and the new `package_version` (`vendor/esoul-cz/guidelines/CHANGELOG.md`; otherwise the repository's). Note renamed headings, new rules and moved files, because the project's own files and skills cite headings.
3. List the project's own files (below the managed block, project guideline files) that contradict a new rule. Reconcile them with `esoul-guidelines` step 5: a rule the code does not follow yet is a `**Target.**` block with its gap issue (`esoul-task-create`, approved preview); product code is not fixed here.
4. Commit the regenerated `esoul-guidelines.json`, `esoul-guidelines.lock`, `docs/project_guidelines/` and `AGENTS.md` as their own mechanical commit; `esoul-guidelines check` exits 0.

Done when `esoul-guidelines sync --dry-run` writes nothing, `check` exits 0 and the reconcile list is in the PR.

## 3. Skills lock

1. Run the project-scope removals that `esoul-skills status` printed (`npx -y skills remove <names> -y`; it also deletes a lock entry of a skill that is not installed). Skills installed for the person (`user` rows) are their own machine: tell the user the commands and run them only when asked.
2. `npx @esoul-cz/skills project init` installs `core`, `dev` and `upstream-core` plus the stack groups the project's layers call for (`--stack` and `--no-stack` as the helper's usage says), and rewrites the lock entries of those skills. It never deletes an entry.
3. `esoul-skills status` shows no retired or moved entry. Commit `skills-lock.json` (and `.agents/skills/` when the project commits the skill folders). Teammates restore the set with `npx skills experimental_install`.

Done when `esoul-skills status` reports no stale entry and `skills-lock.json` is committed.

## 4. Retired names in project files

The map is `layers.json` › `retired` (one place); `npx @esoul-cz/skills retired` prints it, with the `git grep` over the names that were renamed. For each hit in the project's own files (`AGENTS.md` below the managed block, `CONTEXT.md`, `CONTRIBUTING.md`, `docs/agents/`, `.github/`, project guideline files):

- Replace the name with the skill the map gives. A name with two replacements is decided by the sentence: creating, revising or splitting a task is `esoul-task-create`; picking one up, moving it and closing it is `esoul-task-work`.
- A sentence that described the old skill's behaviour is checked against the new skill, not only renamed; a rule the guidelines now own becomes a pointer to the guideline.
- A project-local skill that duplicates a retired one (for example its own tasking skill) is reported to the user, not rewritten: retiring it is `retrofit.md` › Rules during retrofit.
- Historical records keep the name of their day: ADRs, changelogs, closed plans.

`test-queue` and `freelo` entries of the map concern installs and the lock only (the same name now comes from another source); no text changes for them.

Commit as its own step. Done when the `git grep` finds only historical records.

## 5. Verify and open the PR

Run the project's checks as `esoul-workflow` and `testing.md` define them. The PR (repository template; title in the commit standard, for example `:arrow_up: [setup] Update guidelines to <x.y.z> and the skills lock`) lists: guidelines version old → new and the changelog items that matter, the skills removed and added, the files whose names changed, the reconcile list with its gap issues, and `none` under Deploy notes unless the changelog names a deploy action. Finish with `esoul-review` Path B; the human owner merges.

Done when the PR carries those lists and the issue link.
