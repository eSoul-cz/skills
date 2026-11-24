---
name: esoul-guidelines
description: Read, install, sync and check the eSoul engineering guidelines of a repository (`esoul-guidelines` command, `docs/project_guidelines/`, managed block in `AGENTS.md`). Use before changing code to find the rules of the area, when a repository has no or outdated guidelines, when asked to init, update, sync or check them, or to add project-specific rules.
---

# eSoul guidelines

The engineering rules of an eSoul project are the guidelines of `esoul-cz/guidelines`, rendered
into `docs/project_guidelines/` and a managed block of `AGENTS.md` by the `esoul-guidelines`
command. The guidelines are the source of truth; a skill holds agent procedure and points to a
rule instead of restating it. The README of `esoul-cz/guidelines` documents the command (layers,
install routes, drift); read it there and do not copy it.

## Read the rules (before changing code)

1. Read `docs/project_guidelines/index.md` and the files that cover what you touch.
2. Project-specific rules sit below the managed block of `AGENTS.md` and in the project's own
   files next to the rendered ones (step 5); they add to the guidelines.
3. Cite a rule as `docs/project_guidelines/<file>.md` › Heading: the flat file name as rendered
   into the repository, no layer folder (`docs/project_guidelines/workflow.md` › Commits).

Done when you can name the file and heading for each rule the change depends on. A repository
without `docs/project_guidelines/` needs the install below.

## 1. Get the command

```bash
command -v esoul-guidelines || test -x vendor/bin/esoul-guidelines
```

When one succeeds, use it as `esoul-guidelines` (or `vendor/bin/esoul-guidelines`). When both
fail, installing a tool needs the user's approval; ask, then install by project kind:

- **PHP project** (a `composer.json` at the root): `composer require --dev esoul-cz/guidelines`,
  and add the hook to the project's `composer.json` scripts: `post-update-cmd` →
  `esoul-guidelines sync`, placed after `@php artisan boost:update --ansi` when Laravel Boost is
  installed.
- **Project without PHP** (Astro, other Node projects), the three routes of the guidelines
  README › "Repositories without PHP":
  - Composer global: `composer global require esoul-cz/guidelines`;
  - the PHAR of a GitHub release: download `esoul-guidelines.phar` with its `.sha256` and verify
    the checksum before use;
  - the Docker image `rg.fr-par.scw.cloud/testing-images/esoul-guidelines:<tag>` (pin the tag to
    the release; an image carries exactly one release). Every command becomes
    `docker run --rm -it -v "$PWD:/app" -w /app --user "$(id -u):$(id -g)" <image> <command>`
    (`-it` only for `init`).

  On a developer machine prefer Composer global or the PHAR of the version recorded in
  `esoul-guidelines.lock` (`package_version`); the image is a local convenience. CI runs the
  recorded version (step 4).

Done when `esoul-guidelines list` runs.

## 2. Initialise and review the layers

```bash
esoul-guidelines init
```

`init` is interactive: it asks whether the repository is a **client/application** repository or
an **internal** one (guidelines, templates, libraries, infrastructure). Ask the user; the kind is
never detected, and `--no-interaction` silently keeps client.

Then review the detected layers in `esoul-guidelines.json` against the stack in
`CONTEXT.md › Project profile`. Detection reads only the root `composer.json` and
`package.json`; add by hand what it cannot see: a monorepo with the application in a sub-folder,
a stack or package without detection (`esoul-guidelines list` shows the layers). Keep the order
`general`, `profile/*`, `framework/*`, `package/*`. Light projects use the same layers as full
ones.

Done when every stack and package of the repository has its layer, or a missing layer is raised
as a request to `esoul-cz/guidelines`.

## 3. Sync and commit

```bash
esoul-guidelines sync
```

Commit `esoul-guidelines.json`, `esoul-guidelines.lock`, `docs/project_guidelines/` and
`AGENTS.md` (the managed block). `sync` refuses to overwrite a block that was edited locally;
move the edit below the block instead of using `--force`. A new guideline version arrives with
`composer update esoul-cz/guidelines` (or the newer PHAR) followed by `sync`.

A changed guideline rule is a change to `esoul-cz/guidelines`, never to the project: its own PR
there.

Done when `esoul-guidelines sync --dry-run` reports nothing to write and the files above are
committed.

## 4. Check in CI

`esoul-guidelines check` is a read-only pipeline step: exit 1 means drift (a managed block was
edited) or outdated content (run `sync`).

- PHP project: `esoul-guidelines check` joins the other read-only checks of `tools.md`.
- Project without PHP: CI runs the version recorded in `esoul-guidelines.lock`
  (`package_version`), not an image: it downloads that release's `esoul-guidelines.phar` and
  `.sha256` from GitHub, fails on a checksum mismatch and runs
  `php esoul-guidelines.phar check` in the PHP test image. `astroPipeline` (eSoul Jenkins
  libraries) does this as the stage `Guidelines check` whenever the lock exists. Any other
  Jenkinsfile that loads the `testing` library calls `esoulGuidelinesCheck()` after the registry
  login for the test images.

Done when `esoul-guidelines check` exits 0 locally and the pipeline runs it.

## 5. Project-specific rules

Write only what the guidelines do not already say, as files next to the managed ones
(`docs/project_guidelines/<topic>.md` with no managed block, for example `calculations.md` or
`integrations.md`) or below the managed block, never inside it. Form: English, H1
`# Project guidelines - <Topic>`, RFC 2119 keywords, every rule checkable; a rule the code does
not follow yet is written as `**Target.**` with the gap named (`docs/project_guidelines/documentation.md` › Authoring rules). Calculations: every formula
with its source (`file › sheet › cell`) and the known defects of that source; changing a formula
needs a recorded client decision, an updated guideline and an updated parity test. Keep
`AGENTS.md` short: the managed block points to the index, the project part lists only what an
agent applies on every task.

Done when each new rule is checkable and no rule restates a managed one.
