---
name: esoul-project-update
description: "Use to bring a template-born eSoul project up to the latest app-templates: applies the changelog entries added since the commit in `.esoul/template.json`, one commit each, in one PR; skips the entries the project declined; also adopts a project that has no `.esoul/template.json`. Not for new projects or retrofits (esoul-project-lifecycle)."
---

# eSoul project update

A project built from `eSoul-cz/app-templates` records `{variant, commit, declined}` in `.esoul/template.json`: the variant it follows, the last app-templates commit it has caught up with, and the changelog entries it deliberately never takes. The template has no versions or tags: the entries of `CHANGELOG.md` in `eSoul-cz/app-templates` (newest first, each with `Affects:` and `Migration:`) are the update interface, and `main` of `eSoul-cz/template-<variant>` is the latest template. This skill carries the project from the recorded commit to `main` in one reviewable PR and never overwrites what the project made its own. Template facts: the builder's README, "Publishing flow" and "Updating existing projects".

Requires `esoul-workflow` (branch, checks, PR), `esoul-review` (finish the PR), authenticated `gh`, `git`, Node 22 for the helper. Commits follow the project's commit standard; the recommended Gitmoji format is written by `gitmoji-commit` when installed, otherwise by hand. `$SKILL_DIR` is this skill's directory. The agent never merges.

## 1. Preconditions

1. The worktree is clean and on an up-to-date default branch; the project has `AGENTS.md` and `docs/project_guidelines/`.
2. An issue or task for the update exists, or the user has said in this conversation that it is small administrative work without one (ask; never assume). Name the branch by the branch rule of `docs/project_guidelines/workflow.md`: `chore/<issue-number>-update-template-<variant>`, and without an issue `chore/update-template-<variant>`.
3. Read `.esoul/template.json`:
   - missing, or present without `commit` (an old record with a `version` key): adopt it first ([references/adopt.md](references/adopt.md), a retrofit action of `esoul-project-lifecycle` done here only for the update), then continue with the commit it recorded;
   - `commit: null`: [references/adopt.md](references/adopt.md), "commit: null" replaces steps 3 to 5 with a per-file comparison;
   - `{variant, commit}`: continue; `declined` is optional and read in step 3.
4. The variant exists as `variants/<variant>.json` in app-templates `main`; otherwise stop and ask the user (renamed or split variant, as `astro-laravel-cms` was).

Done when the variant, the recorded commit and the branch name are known.

## 2. Fetch both states

Work in a temporary directory outside the project; nothing is vendored or cached, every run reads current state:

```bash
TMP=$(mktemp -d); PROJECT=$PWD; VARIANT=<variant>; COMMIT=<commit from .esoul/template.json>
AT=$TMP/app-templates; TV=$TMP/template-$VARIANT
gh repo clone eSoul-cz/app-templates "$AT" -- --filter=blob:none
gh repo clone eSoul-cz/template-$VARIANT "$TV" -- --filter=blob:none
git -C "$AT" cat-file -e "$COMMIT^{commit}"   # fails: the commit is mistyped or its history was rewritten; stop and ask the user
```

Done when both clones exist and `$COMMIT` resolves in `$AT`.

## 3. Select the entries

```bash
if git -C "$AT" cat-file -e "$COMMIT:CHANGELOG.md" 2>/dev/null; then git -C "$AT" show "$COMMIT:CHANGELOG.md" > "$TMP/base.md"; else : > "$TMP/base.md"; fi   # no changelog at that commit yet: every entry is new
node "$SKILL_DIR/scripts/changelog.mjs" select --head "$AT/CHANGELOG.md" --base "$TMP/base.md" \
  --variant "$VARIANT" --variant-file "$AT/variants/$VARIANT.json" --template "$PROJECT/.esoul/template.json" > "$TMP/selection.json"
```

The output lists `selected` entries oldest first, the `declined` ones with the project's reason, the `notApplicable` ones with their reason, and `order`: every added entry with its kind. Find each entry's commit with `git -C "$AT" log --reverse --format=%H -S"<title>" -- CHANGELOG.md | head -1`, for every entry in `order` (the deltas need all of them). Selection is a superset: read each selected entry's `Affects:` and move the ones that do not touch this project to the not-applicable list, saying why.

Show the user the selected, declined and not-applicable titles with their reasons before the first commit. For a selected entry the project will never take, offer to add it to `declined` with a one-sentence reason (title without the date); it leaves the selection and goes into `declined` of the plan in step 5.

Then offer the trailing difference as one more entry, "unlisted changes" ([references/apply.md](references/apply.md), "Unlisted changes"): variant changes committed after the newest changelog entry. The user may take it like any entry or skip it; declining it is not recorded in `declined` (its title changes with every head).

The plan written in step 5 (`plan.json`) lists the entries to apply (selected and unlisted), oldest first; declined and not-applicable entries are not part of it.

Done when every changelog entry added after the recorded commit is in exactly one of `selected`, `declined` or `notApplicable`, and the trailing difference is empty or offered.

## 4. Apply, entry by entry

Follow [references/apply.md](references/apply.md): per entry, the template delta of that entry, a 3-way merge into the project, the entry's `Migration:` notes, one commit `:arrow_up: [template] <entry title>` (recommended format). Project customisations win every conflict, and each one is reported. An entry that raises the guidelines version runs `composer update esoul-cz/guidelines` and `esoul-guidelines sync` (ask before installing a tool; the installer's README names the routes).

Every entry ends as `applied`, `skipped` (with the reason) or `conflict` (with the files). A `skipped` entry the project will never take is offered for `declined`. Nothing is dropped without a status.

## 5. Record

Write the plan (`{base, head, entries:[{title, commit, status}], declined:[{title, reason}]}`; `entries` oldest first and without the entries declined in this run, `declined` only the titles declined in this run, `head` = `git -C "$AT" rev-parse origin/HEAD`) and run:

```bash
node "$SKILL_DIR/scripts/changelog.mjs" record "$TMP/plan.json" --template "$PROJECT/.esoul/template.json"
```

It prints the `commit` and rewrites `.esoul/template.json` with it and the extended `declined` list (a four-space JSON file with a trailing newline). Commit the file as `:arrow_up: [template] Record app-templates <short sha>`. The record advances over the leading run of applied entries, so a skipped or conflicting entry is offered again by the next run, together with everything after it; declined entries never hold it back.

Done when `.esoul/template.json` holds the printed `commit`, every declined title is in its `declined` list, and the commit list matches the `applied` statuses.

## 6. Verify and open the PR

Run the project's checks as `esoul-workflow` and the project's `testing.md` define them. Fill the repository's PR template (the checks, `No test:` and Deploy notes lines are its fields, `docs/project_guidelines/workflow.md` › Pull requests) and add:

- the applied entries (title and what changed in this project), the skipped ones with the reason, the conflicting ones with the files and the side kept (project), the declined ones (new ones marked) with their reason, the not-applicable ones as one line;
- under Deploy notes, the notes assembled from the entries' `Migration:` lines (new variables, secrets, a migration that needs a backup), or `none`;
- the next step when entries remain: "the next run re-offers the listed entries".

Title: an English commit-style title of the result (guidelines `workflow.md`, Tasking), for example `:arrow_up: [template] Update to app-templates <short sha>` in the recommended format; link the issue. Then finish the PR with `esoul-review` (Path B). The human owner merges.

Done when the PR carries the applied, skipped, conflicting, declined and not-applicable lists and the issue link.

## Rules

- Template-owned generated files (`docs/project_guidelines/`, the `AGENTS.md` guidelines block, `esoul-guidelines.lock`, lock files) are regenerated by their tool, never merged by hand.
- Ask before running anything that installs software, deploys, or touches a remote other than the PR and the issue.
- Keep one intention per commit; an entry that finds the project already up to date makes no commit and counts as `applied`.
