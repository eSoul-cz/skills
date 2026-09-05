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

## Tools

- `docs/documentation` validates and renders application documentation. Install it in an application repository with:

  ```bash
  curl -fsSL https://github.com/eSoul-cz/skills/releases/latest/download/install.sh | sh
  ```

- `freelo` is the authenticated CLI used by the Freelo skills. Authenticate it with `freelo auth login`.

Tooling source and release automation live under `tooling/`, `install.sh`, and `Jenkinsfile`.
