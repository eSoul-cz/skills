# eSoul Skills

Reusable agent skills and companion tools for eSoul projects.

## The eSoul workspace (Claude Code / Claude in VS Code)

The fastest way to set a colleague up with the full eSoul workflow is the bundled
Claude Code marketplace in this repo. It installs eSoul's own skills plus the
third-party engineering and design skills the workflow relies on.

**One-time setup per person:**

```bash
# add the eSoul marketplace (only once per machine)
claude plugin marketplace add eSoul-cz/skills

# install the workflow set
claude plugin install esoul-skills@esoul          # esoul-workflow + all eSoul skills
claude plugin install esoul-awesome-picks@esoul   # WordPress, Laravel, SEO, data, ...
claude plugin install mattpocock-skills@esoul      # tdd, code-review, diagnosing-bugs, grilling
claude plugin install frontend-design@esoul        # distinctive, non-templated UI
```

The same install works in the terminal and in Claude in VS Code: both read the
same `~/.claude` configuration, so a plugin installed once is available in both.

`mattpocock-skills` and `frontend-design` are referenced from their upstream
repositories, so their updates come from the original authors. `esoul-skills`
and `esoul-awesome-picks` are maintained here.

Start any real task with the router:

```text
$esoul-workflow build, fix, review or analyse this eSoul task
```

**Optional, situational skills** (install per person only when needed, not part of
the core workflow):

```bash
npx skills add remotion-dev/skills                                   # video in React
npx skills add https://github.com/coleam00/excalidraw-diagram-skill  # Excalidraw diagrams
npx skills add https://github.com/browser-use/browser-use            # local Chrome control
npx skills add https://github.com/valyuai/skills --skill valyu-best-practices  # paid search API
```

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

Uses `gitmoji-commit` for commits and `code-review` for local review when available, and falls back to `pre-pr-review` when local CodeRabbit is unavailable or out of quota. When CodeRabbit is rate-limited or out of credits on the PR, it posts a `pre-pr-review` fallback review and accepts that skill's approval instead of waiting for CodeRabbit (`wait-pr.mjs --skip-reviewer` stops the poller from waiting for it). Requires authenticated GitHub access and the repository's CodeRabbit integration; automatic CodeRabbit approval requires `reviews.request_changes_workflow` to be enabled.

Usage:

```text
$final-pr-review create the PR, run local review before pushing, and iterate until CI passes and CodeRabbit approves
$final-pr-review finish this GitHub stack bottom-up; skip local CodeRabbit review
```

Install from this checkout:

```bash
npx skills add . --skill final-pr-review --agent codex --global --yes
```

Waiting for CI and remote review uses the bundled read-only poller, so agents do not write their own polling loops. It needs Node.js 18+ and authenticated `gh`, and works on one PR at a time. From the installed skill directory, run:

```bash
node scripts/wait-pr.mjs https://github.com/OWNER/REPO/pull/123 --expect-head HEAD_SHA --since LAST_INVENTORY_TIME
```

It exits with a JSON snapshot when CI fails, discussion or review activity appears, the revision changes, or CI and review settle on the current head. Run `node scripts/wait-pr.mjs --help` for all options and exit codes. Its regression tests use a fake `gh` and need no network:

```bash
node --test tooling/scripts/test_wait_pr.mjs
```

### `pre-pr-review`

Reviews a branch locally before a PR is opened or updated, in place of CodeRabbit's pre-push review when its CLI is missing, rate-limited, or out of credits. Resolves the exact diff against the real base (committed, staged, unstaged, and untracked changes), applies `.coderabbit.yaml` path filters, path instructions, and profile, scans every changed file for credentials, runs the repository's own linters and tests, and reviews the change through four lenses: correctness, security and data boundaries, tests and contract, and maintainability. Larger changes run the lenses as parallel subagents. Every candidate finding is verified against the code before it is reported, using the project's severity scale, with evidence, a proposed fix, and verification. Fixes valid findings and re-reviews incrementally when asked.

When CodeRabbit hits its rate limit or runs out of credits on an open PR, the skill reviews the published head and posts the findings to the PR the way CodeRabbit would: one review with event `COMMENT`, inline comments with one-click suggestions on lines in the diff, everything else in the review body, and no duplicates on later heads. `final-pr-review` does this automatically when it sees the limit and then continues with the fallback review in CodeRabbit's place: once every finding is resolved, the skill posts its approval of the current head, so the PR is approved either by CodeRabbit or by `pre-pr-review`, and a rate-limited or out-of-credits CodeRabbit no longer blocks finishing it. The approval is a `COMMENT` review, not a GitHub approval, so it never counts toward the required human review.

The code never leaves the agent's own model. The verdict is not an approval: it is reported as a CodeRabbit substitution, and the human review is still required.

Usage:

```text
$pre-pr-review review my branch against origin/main before I open the PR
$pre-pr-review CodeRabbit is out of limit; review and fix the uncommitted changes only
$pre-pr-review CodeRabbit is rate-limited on https://github.com/OWNER/REPO/pull/123; post the review to the PR
```

Resolving the scope uses the bundled read-only script (Node.js 18+, no dependencies). Run it from the repository under review (or pass `--repo <path>`), with `SKILL_DIR` set to the installed skill's directory:

```bash
node "$SKILL_DIR/scripts/review-scope.mjs" --base origin/main
```

It prints the reviewed and excluded files with reasons, the matching path instructions, redacted credential hits, and warnings about stale bases or large changes. Its regression tests build throwaway git repositories and need no network:

```bash
node --test tooling/scripts/test_review_scope.mjs
```

Detecting the limit and posting use the second bundled script (Node.js 18+ and authenticated `gh`). `check` is read-only; `post` is a dry run that prints the exact payload unless `--post` is given:

```bash
node "$SKILL_DIR/scripts/post-review.mjs" check https://github.com/OWNER/REPO/pull/123
node "$SKILL_DIR/scripts/post-review.mjs" post https://github.com/OWNER/REPO/pull/123 --findings findings.json [--post]
```

The findings format is in `references/pr-comments.md`. Its regression tests use a fake `gh` and need no network:

```bash
node --test tooling/scripts/test_post_review.mjs
```

### `esoul-maintain-application-documentation`

Creates, refreshes, verifies, reviews, and renders application user, developer, and operator documentation from repository evidence.

Usage:

```text
$esoul-maintain-application-documentation verify the documentation in this repository
```

### `freelo`

Operates Freelo projects, tasks, comments, time records, and related entities through the authenticated `freelo` CLI. Work reports record active work only, never waiting for tests, builds, CI or the test queue; `references/work-reports.md` computes the minutes from the session transcript.

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

Resolves the tasking convention from applicable `AGENTS.md` instructions first, then root `CONTEXT.md`, then root `GLOSSARY.md` for repositories that renamed `CONTEXT.md` while migrating to glossaries. If none defines a mode, asks once and records the choice under `## Tasking convention` in `CONTEXT.md`. An authoritative `AGENTS.md` convention is synchronized into that section without overwriting unrelated context. Explicit one-off overrides do not change the stored policy. Neither choosing a mode nor recording it approves remote writes.

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

Bundle JavaScript runs on a separate, automatically allocated loopback port. The UI pins that origin and validates measurement messages by sender, origin, per-load nonce, declared identity, and bounded height. Both ports close when the preview stops; the measurement probe is injected locally and is not part of published bundles.

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

The browser security regression uses the real application validator and a disposable Chrome profile:

```bash
ESOUL_MOCKUP_APP_ROOT=/path/to/application \
PHP_BINARY=/path/to/compatible/php \
CHROME_BINARY=/path/to/chrome \
node --test tooling/scripts/test_mockup_preview.mjs
```

It checks that bundle JavaScript still executes, cannot modify the control UI, and cannot override layout with invalid measurement messages. The test is explicitly skipped when the application or Chrome location is not supplied; Jenkins's documentation-tooling checks do not replace this application-dependent browser test.

### `esoul-uat`

Plans, verifies, runs, and reports user acceptance testing of eSoul applications, e-shops, and websites as an end user. The scenario catalogue is Markdown in `docs/testing/uat/` of the project, built from the product type in the project profile (`esoul-project-lifecycle`). Runs use Claude in Chrome in a dedicated Chrome profile for functional scenarios and Playwright with the installed Google Chrome for device emulation, screenshots, and a layout audit (overflow, overlaps, clipped text, tap targets, broken images, font fallback). When a `.pen`, Figma, or mockup design exists, screens are compared with it. Failed scenarios become approved work through the repository's tasking skill (GitHub issue + Freelo pairs, or Freelo tasks only in `freelo-only` projects), with URL, screenshot, reproduction, and proposed fix. Credentials stay in `~/.config/esoul-uat/`, never in the repository.

Requires Node.js 18+. The sweep needs `playwright` (`npm install --prefix ~/.cache/esoul-uat playwright@1`) and Google Chrome; the catalogue and run tool has no dependencies.

```bash
npx skills add eSoul-cz/skills --skill esoul-uat --agent codex --global --yes
node --test skills/esoul-uat/scripts/uat.test.mjs
```

Usage:

```text
$esoul-uat verify whether the UAT scenarios match the current code
$esoul-uat run chapters AUT and NAV on the UAT instance, desktop and mobile, with design checks
```

### `esoul-workflow`

Default entry point for eSoul work on web applications, WordPress sites, and data analyses. Loads repository context, sizes the task (S, M, L, bug, analysis), and routes each step to the owning skill instead of repeating it: `esoul-tasking` for tracked work, `esoul-mockup-authoring` and `frontend-design` for UI, `gitmoji-commit` for commits, `pre-pr-review` and `final-pr-review` for PRs. Uses the Matt Pocock skills (`grilling`, `tdd`, `diagnosing-bugs`, `code-review`) and CodeGraph when installed, and degrades gracefully without them. Includes short references for the eSoul web stack, the WP-template WordPress deployment model, and reproducible data analysis.

Usage:

```text
$esoul-workflow add a newsletter signup to the WooCommerce checkout
$esoul-workflow analyse last quarter's orders by acquisition channel
```

### `esoul-model-routing`

Choose and set the right Claude model and effort level for a task, to balance cost and quality: Haiku for trivial mechanical work, Sonnet for contained changes, Opus for real engineering, and `best` (Fable where available, else Opus) for the hardest or most sensitive work. Covers the current lineup and the Claude Code aliases, and picks the model for subagents it dispatches. Advises and sets the model; it does not silently swap the running turn.

Usage:

```text
$esoul-model-routing which model should I use to refactor the checkout?
$esoul-model-routing make this quick and cheap
```

### `esoul-project-lifecycle`

The eSoul project process from first client materials to agent-ready work. Bootstraps or retrofits a repository with the standard rules (`AGENTS.md`, `CONTEXT.md` project profile, `GLOSSARY.md`, `CONTRIBUTING.md`, issue and PR templates, CodeRabbit, CODEOWNERS), keeps client podklady and legacy evidence, the question register, ADRs, project guidelines, the design brief and the plan with slices, prepares the codebase for agents (quality gates, reference module, parity tests), turns slices into GitHub issue + Freelo pairs through `esoul-tasking`, folds every client session back into the docs in one PR, and audits conformance and completeness.

Works for any stack. Ships stack profiles for the common eSoul stacks (Laravel + Inertia, Medusa + Nuxt, Astro) and a checklist for new ones, and two process tiers: `full` for applications and `light` for websites. Includes starter templates for every document and a read-only `scripts/conformance.mjs` checker. Implementation is handed to `esoul-workflow`.

Usage:

```text
$esoul-project-lifecycle bootstrap this repository for the new client project
$esoul-project-lifecycle client-update from today's meeting notes
$esoul-project-lifecycle audit this project against the eSoul standard
```

It writes issues and Freelo tasks only through `esoul-tasking`, so install the chain together:

```bash
npx skills@1.7.2 add eSoul-cz/skills \
  --skill esoul-project-lifecycle esoul-tasking esoul-freelo-task-authoring freelo \
  --agent codex \
  --global \
  --yes
```

Check a project without changing anything (Node 20 or newer; `--github` also reads issues and repository settings through `gh`). Resolve `SKILL_DIR` to the installed skill's directory, for example `skills/esoul-project-lifecycle` in this checkout:

```bash
node "$SKILL_DIR/scripts/conformance.mjs" /path/to/project --github eSoul-cz/example-repo
```

Replace `/path/to/project` and `eSoul-cz/example-repo` with the project checkout and its repository.

### `esoul-data-task-guard`

On data tasks (label `data-migration`, legacy imports, data fixes, reports, analyses) the agent does not change application code or the data model beyond what the issue specifies. It finishes the independent data work, writes the needed change down as a proposal (finding, cause, fix as an example diff or SQL, impact on existing data) and creates a new issue/task pair through `esoul-tasking`. An explicit instruction from the user overrides it.

Usage:

```text
$esoul-data-task-guard the import found duplicate breeders; propose the fix
```

### `esoul-project-data`

Client files, photos, admin media, SQL dumps, backups and import files go to the tracked `assets/` folder through Git LFS, and guides to `docs/`, never to `storage/`, `*.nosync`, `tmp/` or Downloads, where only one computer has them. Secrets never go to Git; throwaway intermediates stay in the session scratchpad.

Usage:

```text
$esoul-project-data back up the media before the import
```

### `test-queue`

One shared queue for test runs across all agent sessions on a machine. Parallel sessions that each start a test suite, Playwright, Infection or a build push a laptop into swap and their tests time out. `testq` runs cheap checks at once, admits suites and builds in a limited number, runs E2E and mutation testing one at a time, and starts nothing new while memory is short. Limits are tuned to the machine's RAM and cores and can be changed at any time.

A Claude Code PreToolUse hook prefixes test and build commands with `testq run` and caps their worker counts automatically. On macOS a menu bar widget shows CPU, memory, swap and load, lists running and waiting jobs with stop buttons, pauses the queue or changes its limits, and resizes the Colima VM with a restart that brings its containers back. `testq doctor` checks the setup and suggests what to tune, including Docker VM memory and idle stacks.

Requires Python 3.8+. The widget needs macOS and Xcode Command Line Tools (`swiftc`). Installing changes `~/.claude/settings.json` (with a backup) and adds a login item, so run it on request. Resolve `SKILL_DIR` to the installed skill's directory:

```bash
sh "$SKILL_DIR/scripts/install.sh"              # CLI, hook and widget; re-run after updates
sh "$SKILL_DIR/scripts/install.sh" --uninstall  # remove everything (add --purge to drop history)
python3 -m unittest discover -s skills/test-queue/scripts -p 'test_*.py'
```

Usage:

```text
$test-queue install the test queue and the menu bar widget on this machine
$test-queue why do my tests keep timing out, and what should I tune?
```

## Tools

- `docs/documentation` validates and renders application documentation. Install it in an application repository with:

  ```bash
  curl -fsSL https://github.com/eSoul-cz/skills/releases/latest/download/install.sh | sh
  ```

- `freelo` is the authenticated CLI used by the Freelo skills. Authenticate it with `freelo auth login`.

Tooling source and release automation live under `tooling/`, `install.sh`, and `Jenkinsfile`.
