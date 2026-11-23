---
name: esoul-project-update
description: Update a template-born eSoul project to the latest app-templates (template-<variant>), applying the CHANGELOG entries added since the commit recorded in `.esoul/template.json`, one commit per entry, in one PR. Also adopts a project that has no `.esoul/template.json` so it can be updated. Not for new projects or retrofits (esoul-project-lifecycle).
---

# eSoul project update

A project built from `eSoul-cz/app-templates` records `{variant, commit}` in `.esoul/template.json`. The template has no versions or tags: the entries of `CHANGELOG.md` in `eSoul-cz/app-templates` (newest first, each with `Affects:` and `Migration:`) are the update interface, and `main` of `eSoul-cz/template-<variant>` is the latest template. This skill carries the project from the recorded commit to `main` in one reviewable PR and never overwrites what the project made its own. Template facts: the builder's README, "Publishing flow" and "Updating existing projects".

Requires `esoul-workflow` (branch, checks, PR), `gitmoji-commit` (commits), `esoul-review` (finish the PR), authenticated `gh`, `git`, Node 22 for the helper. `$SKILL_DIR` is this skill's directory. The agent never merges.

## 1. Preconditions

1. The worktree is clean and on an up-to-date default branch; the project has `AGENTS.md` and `docs/project_guidelines/`.
2. An issue or task for the update exists, or the user has said in this conversation that it is small administrative work without one (ask; never assume). Name the branch `chore/update-template-<variant>` after the issue rules of `docs/project_guidelines/workflow.md`.
3. Read `.esoul/template.json`:
   - missing: adopt it first ([references/adopt.md](references/adopt.md), a retrofit action of `esoul-project-lifecycle` done here only for the update), then continue with the commit it recorded;
   - `commit: null`: [references/adopt.md](references/adopt.md), "commit: null" replaces steps 3 to 5 with a per-file comparison;
   - `{variant, commit}`: continue.
4. The variant exists as `variants/<variant>.json` in app-templates `main`; otherwise stop and ask the user (renamed or split variant, as `astro-laravel-cms` was).

Done when the variant, the recorded commit and the branch name are known.

## 2. Fetch both states

Work in a temporary directory (`mktemp -d`), outside the project. Clone with `gh repo clone eSoul-cz/app-templates -- --filter=blob:none` and the same for `eSoul-cz/template-<variant>`; the base changelog is `git show <commit>:CHANGELOG.md` in the app-templates clone (an empty file when it did not exist yet). Nothing is vendored or cached: every run reads current state.

## 3. Select the entries

```bash
git -C "$AT" show "$COMMIT:CHANGELOG.md" > "$TMP/base.md" 2>/dev/null || : > "$TMP/base.md"
node "$SKILL_DIR/scripts/changelog.mjs" select --head "$AT/CHANGELOG.md" --base "$TMP/base.md" \
  --variant "$VARIANT" --variant-file "$AT/variants/$VARIANT.json" > "$TMP/plan.json"
```

The output lists `selected` entries oldest first and `notApplicable` ones with the reason. Find each selected entry's commit with `git -C "$AT" log --reverse --format=%H -S"<title>" -- CHANGELOG.md | head -1`. Selection is a superset: read each entry's `Affects:` and drop the ones that do not touch this project, saying why. Show the user the selected and not-applicable titles, with the not-applicable reasons, before the first commit.

Done when every changelog entry added after the recorded commit is in exactly one of the two lists.

## 4. Apply, entry by entry

Follow [references/apply.md](references/apply.md): per entry, the template delta of that entry, a 3-way merge into the project, the entry's `Migration:` notes, one commit `:arrow_up: [template] <entry title>` through `gitmoji-commit`. Project customisations win every conflict, and each one is reported. An entry that raises the guidelines version runs `composer update esoul-cz/guidelines` and `esoul-guidelines sync` (ask before installing a tool; the installer's README names the routes).

Every entry ends as `applied`, `skipped` (with the reason) or `conflict` (with the files). Nothing is dropped without a status.

## 5. Record

Write the plan (`{base, head, entries:[{title, commit, status}]}`, oldest first, `head` = `git -C "$AT" rev-parse origin/HEAD`) and run `node "$SKILL_DIR/scripts/changelog.mjs" record plan.json`. Put its `commit` into `.esoul/template.json` and commit it as `:arrow_up: [template] Record app-templates <short sha>`. The record advances only over the leading run of applied entries, so a skipped or conflicting entry is offered again by the next run, together with everything after it.

Done when `.esoul/template.json` holds the printed `commit` and the commit list matches the `applied` statuses.

## 6. Verify and open the PR

Run the project's checks as `esoul-workflow` and the project's `testing.md` define them. Fill the PR template with:

- the applied entries (title and what changed in this project), the skipped ones with the reason, the conflicting ones with the files and the side kept (project), the not-applicable ones as one line;
- the checks run with their results, or the `No test:` line;
- a **Deploy notes** line assembled from the entries' migration notes (new variables, secrets, a migration that needs a backup), or `none`;
- the next step when entries remain: "the next run re-offers the listed entries".

Title: an English commit-style title of the result (guidelines `workflow.md`, Tasking), for example `:arrow_up: [template] Update to app-templates <short sha>`; link the issue. Then finish the PR with `esoul-review` (Path B). The human owner merges.

## Rules

- Template-owned generated files (`docs/project_guidelines/`, the `AGENTS.md` guidelines block, `esoul-guidelines.lock`, lock files) are regenerated by their tool, never merged by hand.
- Ask before running anything that installs software, deploys, or touches a remote other than the PR and the issue.
- Keep one intention per commit; an entry that finds the project already up to date makes no commit and counts as `applied`.
