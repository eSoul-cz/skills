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
   files next to the rendered ones (step 5); they add to the guidelines. A `Project exception`
   paragraph under a heading is the one place a project overrides a rule (step 6).
3. Cite a rule as `docs/project_guidelines/<file>.md` › Heading: the flat file name as rendered
   into the repository, no layer folder (`docs/project_guidelines/workflow.md` › Commits).
4. A heading a skill cites that the project's files lack means the project's guidelines are older
   than the skill: compare `package_version` in `esoul-guidelines.lock` with the latest release
   and offer the update (step 3) instead of guessing the rule. Compatibility: the skills cite
   sections that exist only from guidelines 0.5.0 (`Hotfix`, the standing small-admin record in
   `workflow.md`, and project exceptions with the installer's `exceptions` key, step 6); a
   project on 0.4.x or older needs guidelines ≥ 0.5.0 for them.

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
- **Project without PHP** (Astro static or SSR, the CMS frontend, a Node-only repository): the
  command comes from the machine, not from `vendor/`; see "Without PHP in the project" below.

Done when `esoul-guidelines list` runs.

## Without PHP in the project

A repository without a `composer.json` has nothing to `composer require` the package into. The
command runs from the machine, in the project root; `init`, `sync`, `check` and `list` never
read `vendor/` and work without a `composer.json`. The guidelines README ›
[Repositories without PHP](https://github.com/eSoul-cz/guidelines#repositories-without-php) is
the source of truth; this is the short form.

1. **Install** (PHP 8.4+ and Composer on the machine; ask first, step 1):
   `composer global require esoul-cz/guidelines:^0.6`, and put the global bin directory on the
   `PATH` once: `export PATH="$(composer global config bin-dir --absolute):$PATH"`.
2. **Use** from the project root: `esoul-guidelines init` (step 2), `esoul-guidelines sync`
   (step 3), `esoul-guidelines check`. Commit the files of step 3; nothing else is added to the
   project (no `package.json` entry, no hook).
3. **Without Composer**: the PHAR of the GitHub release whose version is `package_version` in
   `esoul-guidelines.lock` (download `esoul-guidelines.phar` and its `.sha256`, verify the
   checksum), run as `php esoul-guidelines.phar <command>` or put on the `PATH`. Or the Docker
   image `rg.fr-par.scw.cloud/testing-images/esoul-guidelines:<release>`, once the README says it
   is published: `docker run --rm -v "$PWD:/app" -w /app --user "$(id -u):$(id -g)" <image>
   <command>` (`-it` for `init`; an image carries exactly one release).
4. **Update**: the global install is per machine and a caret on 0.x stops at the minor, so raise
   it the same way, `composer global require esoul-cz/guidelines:^0.X -W` (`X` the latest minor;
   a patch release is `composer global update esoul-cz/guidelines`; a PHAR or image update is the
   newer release), then `esoul-guidelines sync` in the project and commit as in step 3.
5. **CI** needs no install: the pipelines run `check` themselves with the version in
   `esoul-guidelines.lock` (`package_version`), step 4.

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

eSoul builds new frontends in Vue; the React layer is for a project that already uses React,
not a choice for a new one. Such a Laravel + Inertia project takes `package/laravel-inertia-react` after
`package/laravel-inertia`, not `package/inertia-vue`. `init` from guidelines 0.6.0 adds it when
`package.json` has `@inertiajs/react`. On an older version the React project raises the
constraint (step 3) instead of keeping a project exception for its frontend; a project that
recorded such an exception drops it once the layer is selected (step 6, "Keep it valid").

Done when every stack and package of the repository has its layer, or a missing layer is raised
as a request to `esoul-cz/guidelines`.

## 3. Sync and commit

```bash
esoul-guidelines sync
```

Commit `esoul-guidelines.json`, `esoul-guidelines.lock`, `docs/project_guidelines/` and
`AGENTS.md` (the managed block). `sync` refuses to overwrite a block that was edited locally;
move the edit below the block instead of using `--force`. A new guideline version arrives with
`composer update esoul-cz/guidelines` (or the newer PHAR) followed by `sync`; another minor needs
the constraint raised first, because on 0.x `^0.3` never reaches 0.4 (`composer require --dev
esoul-cz/guidelines:^<new minor> -W`). A project several versions behind, or one whose skills lock and skill
names are old too, takes the setup update of `esoul-project-update`
(`references/setup.md`: skills lock, constraint, `sync`, reconcile, retired names).

A changed guideline rule is a change to `esoul-cz/guidelines`, never to the project: its own PR
there.

Done when `esoul-guidelines sync --dry-run` reports nothing to write and the files above are
committed.

## 4. Check in CI

`esoul-guidelines check` is a read-only pipeline step: exit 1 means drift (a managed block was
edited), outdated content (run `sync`) or an invalid project exception (step 6). It finds drift,
not violations: whether a change follows the guidelines is `esoul-review` (its standards-only path).

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

## 6. Project exceptions

A project may deviate from a rule only with the **owner's approval** (the developer may obtain it
and say so) and an **accepted ADR**. The agent proposes and prepares; it never decides an
exception alone, and never records one without the person's confirmation. The mechanism and the
format are in the guidelines README › Project exceptions; do not copy it.

1. **Decide.** Name the rule (`docs/project_guidelines/<file>.md` › Heading), what the project does
   instead, and why. A project rule that only adds to the guidelines is no exception (step 5). A
   new project follows the rules closely and asks before deviating; a migration is lenient and
   settles each conflict with the person (`esoul-project-lifecycle` › `references/retrofit.md` §4).
2. **Refuse the hard rules.** The security and production-data rules (`security-and-data.md`:
   secrets, personal and client data, anonymized dumps, production access, authorization,
   sessions and accounts) cannot be excepted; `check` refuses them. Offer the guideline's way or a
   guideline change instead.
3. **Record it.** The ADR (accepted) says the rule, the alternative, the reason and the approval.
   Then add the entry to `esoul-guidelines.json`:
   `{"rule": "<layer>/<file>.md#<heading-anchor>", "instead": "<one sentence>", "adr": "docs/adr/<file>.md"}`.
   The rule is the **source** file in the layer, not the rendered one (`package/lunar/architecture.md#money`;
   `esoul-guidelines list` shows the layers and their files). The layer is the one whose text it is: a
   `<!-- from: <layer> -->` comment precedes text from a later layer, text without one is from the first
   layer that defines the file (usually `general`). The anchor is the GitHub slug of its heading. Run
   `sync`: the managed file now carries `Project exception: …` with the ADR link under that heading.
4. **Read it.** While reading the rules (above), a `Project exception` paragraph under a heading
   means the text under the marker applies instead of the rule, and the ADR explains why.
5. **Keep it valid.** `esoul-guidelines check` fails when the rule's heading is renamed or removed in
   a new guideline version, the layer is no longer selected, or the ADR file is missing. Re-decide
   with the person: update the anchor if the rule only moved, drop the exception if the guideline
   now covers it, or fix the ADR path.

Done when the exception is in the ADR and in `esoul-guidelines.json`, `sync` rendered the marker and `check` exits 0.
