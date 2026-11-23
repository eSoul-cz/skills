# Project guidelines (P4, `guidelines`)

The engineering rules of an eSoul project are the guidelines of `esoul-cz/guidelines`, installed
by the `esoul-guidelines` command into `docs/project_guidelines/` and the managed block of
`AGENTS.md`. This skill runs the installer and carries no copy of the rules. The installer's
README (commands, layers, install routes, drift) is the source of truth; read it instead of
restating it.

Done when `esoul-guidelines check` exits 0 and the config, lock, `docs/project_guidelines/` and
`AGENTS.md` are committed.

## 1. Get the command

```bash
command -v esoul-guidelines || test -x vendor/bin/esoul-guidelines
```

When one of them succeeds, use it as `esoul-guidelines` (or `vendor/bin/esoul-guidelines`) below.
When both fail, installing a tool needs the user's approval; ask, then install by project kind:

- **PHP project** (a `composer.json` at the root): `composer require --dev esoul-cz/guidelines`,
  and add the hook to the project's `composer.json` scripts: `post-update-cmd` →
  `esoul-guidelines sync`, placed after `@php artisan boost:update --ansi` when Laravel Boost
  is installed.
- **Project without PHP** (Astro, other Node projects): the installer's three routes, in the
  guidelines README, "Repositories without PHP": Composer global
  (`composer global require esoul-cz/guidelines`), the PHAR of a GitHub release (download it with
  its `.sha256` and verify the checksum before use), or the Docker image
  `rg.fr-par.scw.cloud/testing-images/esoul-guidelines:0.3`. On a developer machine prefer Composer
  global or the PHAR of the version recorded in `esoul-guidelines.lock` (`package_version`); the Docker
  image is an optional local convenience. CI never uses an image: it runs the recorded version (section 4).

## 2. Initialise and review the layers

```bash
esoul-guidelines init
```

With the Docker image every command is `docker run --rm -it -v "$PWD:/app" -w /app --user "$(id -u):$(id -g)" rg.fr-par.scw.cloud/testing-images/esoul-guidelines:0.3 <command>`
(`-it` only for `init`).

`init` is interactive: it asks whether the repository is a **client/application** repository or
an **internal** one (guidelines, templates, libraries, infrastructure). Ask the user; the kind is
never detected, and `--no-interaction` silently keeps client.

Then **review the detected layers** in `esoul-guidelines.json` against the stack in
`CONTEXT.md › Project profile`. Detection reads only the root `composer.json` and `package.json`,
so add by hand what it cannot see:

- a monorepo with the application in a sub-folder (nothing there is scanned);
- a stack or package without detection (list the available layers with `esoul-guidelines list`).

Layers in use today: `framework/laravel`, `framework/lsr`, `framework/astro`; packages such as
`package/lunar`, `package/filament`, `package/inertia-vue`, `package/laravel-inertia`,
`package/lsr-cqrs`, `package/mutation-testing`, `package/test-evidence`; `profile/internal` for
internal repositories. Keep the order `general`, `profile/*`, `framework/*`, `package/*`. Light
projects use the same layers as full ones ([tiers.md](tiers.md)). A stack with no layer is
handled by [stacks/new-stack.md](stacks/new-stack.md).

## 3. Sync and commit

```bash
esoul-guidelines sync
```

Commit `esoul-guidelines.json`, `esoul-guidelines.lock`, `docs/project_guidelines/` and
`AGENTS.md` (the managed block). `sync` refuses to overwrite a block that was edited locally;
move the edit below the block instead of using `--force`.

Project rules go **below** the managed block or in project files next to it
(`docs/project_guidelines/<topic>.md` with no managed block, for example `calculations.md` or
`integrations.md`), never inside the block. A changed guideline rule is a change to
`esoul-cz/guidelines`, not to the project: it is its own PR there.

## 4. Check in CI

`esoul-guidelines check` is a read-only pipeline step: exit 1 means drift (a managed block was
edited) or outdated content (run `sync`).

- PHP project: add `esoul-guidelines check` next to the other read-only checks of `tools.md`.
- Project without PHP: CI runs the version the project recorded in `esoul-guidelines.lock`
  (`package_version`), not an image: it downloads that release's `esoul-guidelines.phar` and
  `.sha256` from GitHub, fails on a checksum mismatch and runs `php esoul-guidelines.phar check` in the
  PHP test image. `astroPipeline` (eSoul Jenkins libraries) does it by itself as the stage
  `Guidelines check` whenever the lock exists, so an Astro `Jenkinsfile` needs no configuration. Any
  other Jenkinsfile that loads the `testing` library calls the step, after the registry login for the
  test images:

  ```groovy
  esoulGuidelinesCheck()
  ```

## 5. Project-specific rules

Write only what the guidelines do not already say, as files next to the managed ones, in the
guideline style: English, H1 `# Project guidelines - <Topic>`, RFC 2119 keywords, every rule
checkable. When the code does not follow a rule yet, write it as `**Target.**` and name the gap
(`documentation.md`, Authoring rules). Calculations: every formula with its source
(`file › sheet › cell`) and the known defects of that source; changing a formula needs a recorded
client decision, an updated guideline and an updated parity test. Keep `AGENTS.md` short: the
managed block points to the index; the project part lists only what an agent applies on every
task ([root-files.md](root-files.md)).
