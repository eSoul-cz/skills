---
name: gitmoji-commit
description: Split, stage, verify, and create focused Git commits using one Gitmoji shortcode per intention. Use whenever the user asks to commit, stage and commit, commit the current work, split work into commits, or write a commit message, and whenever an agent is about to create a normal agent-authored commit. First honor a repository-specific convention in AGENTS.md or CONTEXT.md; otherwise establish this Gitmoji convention in CONTEXT.md. Do not rewrite existing, generated, or automatic commits.
---

# Gitmoji commit

Create a readable history by separating work according to intention and assigning exactly one Gitmoji to each commit. A request such as “commit your work” authorizes the complete inspect, split, stage, verify, and commit workflow without another confirmation.

## Resolve the repository convention

Before planning commits, read the applicable `AGENTS.md` files and the repository-root `CONTEXT.md`.

1. Treat an applicable commit convention in `AGENTS.md` as authoritative.
2. Otherwise use the commit convention in the root `CONTEXT.md`.
3. Otherwise establish the default convention below in the root `CONTEXT.md`.

When `AGENTS.md` defines a commit convention:

- copy only that convention into the root `CONTEXT.md` under `## Commit convention`;
- replace a conflicting commit-convention section while preserving all unrelated context;
- make the edit idempotent;
- commit this context synchronization separately using the effective `AGENTS.md` convention;
- follow that convention, not Gitmoji, if it differs from this skill.

When only `CONTEXT.md` defines a different convention, respect it and do not overwrite it.

When neither file defines a convention, create or update the root `CONTEXT.md` with this block, preserving all existing content:

````md
## Commit convention

Use the `gitmoji-commit` skill for normal agent-authored commits.

```text
:emoji: [optional-context] imperative message

optional explanatory details
```

Use one Gitmoji shortcode per commit and split commits by intention. Context is optional. Keep the complete subject line at 72 characters or fewer when practical.
````

Commit that policy separately before the task commits:

```text
:memo: [git] define gitmoji commit convention
```

Do not create a commit merely because this skill was loaded. A commit still requires user authorization, but an explicit request such as “commit your work” supplies that authorization for the whole workflow.

## Inspect and delimit the work

Inspect the repository state and both staged and unstaged diffs before changing the index. Identify:

- work known to have been produced for the current task;
- pre-existing, unrelated, or user-authored changes;
- generated files and changes made by hooks or automation;
- natural intention boundaries within the authorized work.

By default, commit only the agent's known work. Inspect the rest, preserve it, and ask only when ownership cannot be determined safely. Never stage the entire worktree blindly.

Do not amend, rebase, reset, squash, or otherwise rewrite existing commits. Do not reformat generated, merge, revert, release-tool, dependency-bot, or other automatic commit messages.

## Plan commits by intention

Use one coherent intention and one Gitmoji per commit. Related work can still require separate commits when its intentions differ. In particular, separate:

- implementation from tests;
- refactoring from behavior changes;
- documentation from implementation;
- configuration or tooling from the feature that consumes it;
- dependency changes from application changes;
- unrelated fixes discovered during the task.

Keep a change together when dividing it would make either commit unintelligible, but never combine distinct Gitmoji intentions merely because the files or feature are related. A commit is a coherent change, not necessarily one file.

Keep each commit valid and verifiable where practical. For normal work, commit implementation before its passing tests; use `:white_check_mark:` for the test commit. In an explicitly test-first workflow, a deliberately failing `:test_tube:` commit may precede the implementation and is the documented exception to independently passing checks.

Briefly announce the intended commit sequence, then proceed without seeking another confirmation. Ask only when change ownership or a safe split is materially ambiguous.

## Select the Gitmoji

Read [references/gitmojis.json](references/gitmojis.json) for the complete bundled official catalog and [references/catalog.md](references/catalog.md) for provenance and eSoul extensions.

- Use exactly one shortcode from the catalog, such as `:sparkles:`; never use the Unicode glyph in the stored subject.
- Select the narrowest intention that describes the commit's primary purpose.
- Use an eSoul extension only when it is explicitly listed and does not conflict with an official meaning.
- Split the commit if more than one Gitmoji is needed to describe it accurately.

## Compose the message

Use exactly this structure:

```text
:emoji: [optional-context] message

optional details
```

Subject rules:

- start with one Gitmoji shortcode and one space;
- include a literal `[context]` only when it materially narrows the subsystem, package, application, or workflow;
- write context in concise lowercase kebab-case;
- use an imperative message with a lowercase initial letter;
- omit the trailing period;
- keep the complete subject at 72 characters or fewer when practical.

Examples:

```text
:sparkles: [checkout] add delivery selection
:bug: prevent duplicate payment callbacks
:white_check_mark: [checkout] cover delivery selection
```

Add a body only when the subject is not explanatory enough. Separate it with one blank line. Use it to explain reasoning, relevant context, trade-offs, or the parts of a larger coherent change; do not merely repeat the subject.

```text
:recycle: [pricing] isolate discount calculation

Move rule selection behind a single boundary so callers no longer depend on
campaign-specific classes. Preserve the existing rounding behavior.
```

## Stage, verify, and commit

For each planned commit:

1. Stage only its files or hunks. Use partial staging when one file contains multiple intentions.
2. Inspect the complete staged diff and confirm it contains no unrelated changes.
3. Run `git diff --cached --check` and proportionate project checks.
4. Create the commit with the planned subject and optional body.
5. Respect repository hooks. Never use `--no-verify` without explicit user authorization.
6. Re-inspect the worktree because hooks may modify files.
7. Record the resulting commit hash and subject before continuing.

After the sequence, report the commits created, checks run, and any preserved uncommitted changes.
