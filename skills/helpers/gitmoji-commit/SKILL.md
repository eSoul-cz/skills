---
name: gitmoji-commit
description: "Commit work split by intention, in the developer's own commit standard, or as Gitmoji commits (`:sparkles: [context] Message`) when none is stated. Use when the user asks to commit, stage and commit, split work into commits or write a commit message, and at the commit step of any task. Messages are English and descriptive. Leaves existing, generated and automatic commits untouched."
---

# Gitmoji commit

Turn the agent's finished work into a readable history: one coherent intention per commit, the message in the developer's standard (Gitmoji when none is stated). A request to commit, ship or finish the work authorizes the whole inspect, split, stage, verify, commit sequence; otherwise ask once. Loading this skill alone authorizes nothing.

The format and the split rules are the guideline's: `docs/project_guidelines/workflow.md` › Commits. Without that file the fallback is `:emoji: [optional-context] Imperative message`: English, one Gitmoji shortcode per commit, subject up to 72 characters, optional body after a blank line.

## Resolve the convention

Take the first that applies:

1. The commit standard the developer stated: in the request, in the applicable `AGENTS.md` already in context, or in a personal instruction. A developer's own standard wins; the guideline only requires English and a descriptive message.
2. The `## Commit convention` section of the repository-root `CONTEXT.md`, falling back to the root `GLOSSARY.md` for repositories that renamed it. Read only that section, with `for f in CONTEXT.md GLOSSARY.md; do awk -v h='## Commit convention' '$0==h{p=1;s=$0 ORS;next} /^## /{p=0} p{s=s $0 ORS; if(NF)n=1} END{if(n)printf "%s",s; exit !n}' "$f" 2>/dev/null && break; done`. Write conventions only to `CONTEXT.md`, never to `GLOSSARY.md`.
3. Gitmoji, the recommended format, and record that choice in `CONTEXT.md`.

Read [references/convention-bootstrap.md](references/convention-bootstrap.md) when step 2 and `AGENTS.md` disagree or step 3 applies. With a non-Gitmoji standard, skip the catalog and the subject shape below; inspection, splitting, staging and verification still apply.

## Inspect and delimit the work

Inspect the repository state and the staged and unstaged diffs before touching the index. Separate:

- work known to belong to the current task;
- pre-existing, unrelated or user-authored changes;
- generated files and changes made by hooks or automation.

Commit the agent's known work; inspect and preserve the rest; ask only when ownership cannot be determined safely. Stage named files and hunks of the known work.

Never amend, rebase, reset or squash existing commits, and leave generated, merge, revert, release-tool and dependency-bot messages as they are.

## Plan the commits

One coherent intention per commit; the guideline lists the intentions that are always separate (implementation, tests, refactoring, documentation, configuration, dependencies). Keep a change together when dividing it would leave either commit unintelligible. Use partial staging when one file holds several intentions.

Order each commit so it stays valid: implementation before its passing tests (`:white_check_mark:`). In an explicitly test-first workflow a deliberately failing `:test_tube:` commit may precede the implementation.

Announce the planned sequence (subjects and files) in one message, then proceed. Intention boundaries are decided by the session that knows the work; a subagent offered for chores only executes a finished plan (`esoul-model-routing`).

## Write the message

List the catalog (one projection, 75 lines) and pick the narrowest shortcode for the commit's primary purpose; two shortcodes mean two commits:

```bash
jq -r '.gitmojis[] | "\(.code)\t\(.description)"' references/gitmojis.json
```

Open the JSON itself only for `semver` or `entity`. Store the shortcode, never the Unicode glyph. Add a body only when the subject cannot carry the reasoning; the body adds the why and trade-offs and does not repeat the subject.

A hotfix (`docs/project_guidelines/workflow.md` › Hotfix) is the one case where the narrowest shortcode is not the type of the change: the commit that fixes the production defect takes `:ambulance:`, not `:bug:`, in a project that uses Gitmoji (the format is recommended, never required; another standard is followed as it is). Its regression test, documentation and the follow-up for the root cause are their own commits with their own shortcodes.

## Stage, verify, commit

For each planned commit:

1. Run the stack's formatter (its `tools.md`) before staging, so the staged diff is the formatted result.
2. Stage exactly the commit's files or hunks.
3. Read the full staged diff; it holds nothing unrelated.
4. Run `git diff --cached --check` every time (it inspects the index, which no receipt covers). Then the checks of the touched area, once per tree: reuse a passing verification receipt (`receipt · tree <tree> · <command> → pass`) for the worktree being committed; with the `esoul-testing` skill installed its receipt procedure applies, otherwise run the touched area's narrow tests once and note the result. Run checks for an intermediate commit whose content was never verified alone. The whole suite and static analysis run once on the tree that will be pushed, never per commit.
5. Create the commit with the planned subject and body.
6. Respect repository hooks; use `--no-verify` only on the user's explicit instruction.
7. Re-inspect the worktree, because hooks may modify files.
8. Record the resulting hash and subject.

Done when `git log` lists the planned subjects and `git status` shows only the changes you deliberately preserved. Report the commits, the checks run (or the receipts reused) and the preserved changes.
