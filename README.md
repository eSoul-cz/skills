# eSoul Skills

Reusable agent skills and companion tools for eSoul projects.

## Install

List the skills available from GitHub:

```bash
npx skills add eSoul-cz/skills --list
```

Choose skills interactively:

```bash
npx skills add eSoul-cz/skills
```

Install one skill globally for Codex:

```bash
npx skills add eSoul-cz/skills \
  --skill <skill-name> \
  --agent codex \
  --global \
  --yes
```

The Freelo task-authoring workflow requires both Freelo skills:

```bash
npx skills add eSoul-cz/skills --skill freelo --agent codex --global --yes
npx skills add eSoul-cz/skills --skill esoul-freelo-task-authoring --agent codex --global --yes
```

For optional GitHub issue pairing and a repository-persisted tasking convention, install the complete dependency chain explicitly:

```bash
npx skills add eSoul-cz/skills \
  --skill freelo esoul-freelo-task-authoring esoul-tasking \
  --agent codex \
  --global \
  --yes
```

`esoul-tasking` directly requires `esoul-freelo-task-authoring`, which requires `freelo`. Do not assume dependencies are installed automatically. Replace `codex` with another supported agent, or omit `--agent` to choose interactively. Omit `--global` for a project-local installation.

To work from a local checkout, replace `eSoul-cz/skills` with `.`.

## Skills

### `gitmoji-commit`

Splits work into focused commits by intention, stages and verifies each change, and writes one Gitmoji shortcode per normal agent-authored commit while respecting repository-specific conventions.

Usage:

```text
$gitmoji-commit commit your work
```

### `final-pr-review`

Finishes individual GitHub PRs and native stacked PRs: optional local CodeRabbit review before pushing, CI and remote review monitoring, fixes for valid findings, evidence-backed replies to invalid findings, and repeated verification until the current revision is approved. Does not merge or bypass required human reviews.

Uses `gitmoji-commit` for commits and `code-review` for local review when available. Requires authenticated GitHub access and the repository's CodeRabbit integration; automatic CodeRabbit approval requires `reviews.request_changes_workflow` to be enabled.

Usage:

```text
$final-pr-review create the PR, run local review before pushing, and iterate until CI passes and CodeRabbit approves
$final-pr-review finish this GitHub stack bottom-up; skip local CodeRabbit review
```

Install from this checkout:

```bash
npx skills add . --skill final-pr-review --agent codex --global --yes
```

### `esoul-maintain-application-documentation`

Creates, refreshes, verifies, reviews, and renders application user, developer, and operator documentation from repository evidence.

Usage:

```text
$esoul-maintain-application-documentation verify the documentation in this repository
```

### `freelo`

Operates Freelo projects, tasks, comments, time records, and related entities through the authenticated `freelo` CLI.

Usage:

```text
$freelo show the active tasks in my project
```

### `esoul-freelo-task-authoring`

Prepares implementation-ready eSoul tasks, checks for duplicates, presents an exact preview, and writes to Freelo only after approval. Requires the `freelo` skill.

Usage:

```text
$esoul-freelo-task-authoring turn this feature request into an approved Freelo task
```

### `esoul-tasking`

Authors work in either `freelo-only` mode (a self-contained Freelo task) or `github-freelo` mode (a detailed GitHub issue paired with a management-oriented Freelo task). Requires `esoul-freelo-task-authoring` and its `freelo` dependency.

Resolves the tasking convention from applicable `AGENTS.md` instructions first, then root `CONTEXT.md`. If neither defines a mode, asks once and records the choice under `## Tasking convention`. An authoritative `AGENTS.md` convention is synchronized into that section without overwriting unrelated context. Explicit one-off overrides do not change the stored policy. Neither choosing a mode nor recording it approves remote writes.

Uses module or useful one-word context prefixes (`Context: Actionable result`) and existing labels in each system, not frontend/backend/data title prefixes. In split mode, titles match, GitHub owns the full specification and verification, and both entities link to each other. Every remote write requires an approved preview; creation is followed by read-back verification, with partial failures reported rather than blindly retried.

Usage:

```text
$esoul-tasking turn this feature request into approved work using this repository's convention
$esoul-tasking use github-freelo for this task only; keep the stored convention unchanged
```

Example stored policy (the other supported value is `github-freelo`):

```md
## Tasking convention

Use the `esoul-tasking` skill for task authoring.

- Mode: `freelo-only`
```

Requires authenticated Freelo access through the companion's supported tools. If using the CLI, install `freelo` separately and authenticate with `freelo auth login`. Split mode additionally requires authenticated GitHub access through an available integration or `gh` (`gh auth login`). Targets and labels are resolved from the consuming repository and accessible projects, never from bundled project IDs or workstation paths. Missing GitHub access blocks split mode rather than silently switching to Freelo-only.

Install the full chain from this checkout:

```bash
npx skills add . \
  --skill freelo esoul-freelo-task-authoring esoul-tasking \
  --agent codex \
  --global \
  --yes
```

### `esoul-mockup-authoring`

Authors self-contained static bundles for the eSoul mockups module, with desktop/mobile frames, directly addressable interaction states, and image-only designs. Includes an original, neutral five-frame Workshop Notes example and a loopback-only design preview.

Requires Node.js 20+, an application checkout containing `App\Services\Mockups\BundleValidator` and `config/mockups/manifest.schema.json`, and that checkout's Composer dependencies and compatible PHP runtime. The skill does not bundle a second validator or a checkout-relative schema symlink. Local preview does not implement comments, pinning, or persistence; those must be verified in the actual application.

```bash
npx skills add eSoul-cz/skills --skill esoul-mockup-authoring --agent codex --global --yes
```

Replace the repository with `.` to install from this checkout; choose another supported agent as needed.

Usage:

```text
$esoul-mockup-authoring prepare and validate a desktop/mobile mockup bundle, then inspect every frame locally
```

Resolve `SKILL_DIR` to the installed skill's directory, then validate or preview the bundled example:

```bash
node "$SKILL_DIR/scripts/mockup.mjs" validate --app-root /path/to/application --php /path/to/compatible/php
node "$SKILL_DIR/scripts/mockup.mjs" preview --app-root /path/to/application --php /path/to/compatible/php
```

An explicit bundle directory follows `validate` or `preview`. Application root defaults to `ESOUL_MOCKUP_APP_ROOT` or the current directory; PHP defaults to `PHP_BINARY` or `php`. Publishing requires a configured GitHub source and authorized staff UI access; do not infer a production destination from the sample.

## Tools

- `docs/documentation` validates and renders application documentation. Install it in an application repository with:

  ```bash
  curl -fsSL https://github.com/eSoul-cz/skills/releases/latest/download/install.sh | sh
  ```

- `freelo` is the authenticated CLI used by the Freelo skills. Authenticate it with `freelo auth login`.

Tooling source and release automation live under `tooling/`, `install.sh`, and `Jenkinsfile`.
