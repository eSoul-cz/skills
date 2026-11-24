# eSoul Skills

Reusable agent skills and companion tools for eSoul projects, installed in layers.

**Version.** The Claude Code plugin (`esoul-skills`) is at **0.26.0**; each release is tagged `plugin-<version>` (the bare `0.6.x` tags belong to the documentation tool). The helper package `@esoul-cz/skills` has its own version in `package.json`. Maintainers are listed in [`CONTEXT.md`](CONTEXT.md).

**Principles.** The guidelines (`eSoul-cz/guidelines`) are the source of truth; a skill holds only the procedure for an agent and points to the guideline by file and heading. The eSoul skills build on [mattpocock's skills](https://github.com/mattpocock/skills), which are installed from their source and never copied here. Every layer works without the optional ones; a skill that uses a more optional skill says what to do when it is missing. Agents, hooks and Codex files are optional.

## Layers

Each developer picks layers, and skills inside a layer. Layers marked *project* go into every project (committed with `skills-lock.json`, so every developer gets them); layers marked *user* are installed for the person.

| # | Layer | Scope | Requires | Skills |
|---|---|---|---|---|
| 1 | `core` | project | | `esoul-workflow` (entry point: size the task, route each step), `esoul-guidelines` (read, sync and check the managed guidelines), `esoul-task-work` (pick up a task, states, link the PR, close; includes the Freelo working rules) |
| 2 | `dev` | project | core, upstream-core | `esoul-review` (local review and the PR loop with CI and CodeRabbit), `esoul-testing` (running and writing tests, receipts), `esoul-docs` (application documentation in Markdown, optional PDF tool) |
| 3 | `project` | user | core | `esoul-project-lifecycle`, `esoul-project-update`, `esoul-uat`, `esoul-task-create` (issue and Freelo task creation), `esoul-data` (project data and data tasks), `esoul-mockup-authoring` |
| 4 | `helpers` | user | | `gitmoji-commit` (recommended commit format, never forced), `esoul-model-routing` (delegation by job, role briefs, usage report); optional source: [`test-queue`](https://github.com/eSoul-cz/test-queue) |
| 5 | `business` | user | | `esoul-office-documents`, `esoul-offer-authoring` |
| 6 | `upstream-core` | project | | manifest only, never copied: mattpocock (pinned tag) `code-review`, `tdd`, `diagnosing-bugs`, `grilling`, `grill-with-docs`, `grill-me`, `handoff`, `prototype`, `codebase-design`, `domain-modeling`, `improve-codebase-architecture`, `research`, `implement`, `to-questionnaire`, `teach`, `wait-what`, `writing-for-agents`; the official `freelo` skill (`freeloio/freelo-cli`); `find-skills` (`vercel-labs/skills`). **Stack groups**, installed by `project init` when the project's guideline layers match (`esoul-guidelines.json`, else detected from `composer.json`/`package.json` like `esoul-guidelines init`): `lsr` (all 23 skills of `Heroyt/lsr-skills`), `vue` (`vuejs-ai/skills` vue-best-practices, vue-debug-guides, create-adaptable-composable; `unovue/shadcn-vue`), `laravel` (**managed by Laravel Boost**: Boost installs its own skills from `boost.json`, nothing is duplicated here; `project init` checks `laravel/boost` and `boost:update` in `post-update-cmd`, `status` reports them as managed); `vue-options-api` (`vue-options-api-best-practices`) only on request |
| 7 | `upstream-picks` | user | | manifest only, by tool: `laravel`, `wordpress`, `web`, `frontend`, `devops`, `testing`, `data`, `jenkins` (`eSoul-cz/jenkins-libraries`, a private repository read over SSH: `esoul-jenkins-libraries`); community skills from their own repositories, the project guidelines win over their advice. `matt-extra` (on request, not part of a plain `install upstream-picks`): the rest of mattpocock's set (`to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement-spec`, `pr`, `setup-matt-pocock-skills`, `git-guardrails-claude-code` and the `in-progress/` and `misc/` skills) |

[`layers.json`](layers.json) is the single definition (scope, requires, own skills, third-party sources). The skills live in `skills/<layer>/<skill>/`.

## Install

The helper is a Node package on top of [`npx skills`](https://github.com/vercel-labs/skills) (no dependencies of its own):

```bash
# in a project: core, dev and upstream-core, plus the stack skills that match the project
# (LSR, Vue/Inertia; Laravel is checked for Boost); commit skills-lock.json afterwards
npx @esoul-cz/skills project init                 # --stack lsr,vue to choose, --no-stack to skip them

# layers, with the layers they require; project layers go into the project, user layers are global
npx @esoul-cz/skills install dev
npx @esoul-cz/skills install project helpers business
npx @esoul-cz/skills install upstream-picks:laravel,web
npx @esoul-cz/skills install upstream-picks:matt-extra       # the rest of mattpocock's set (off by default)
npx @esoul-cz/skills install helpers --optional                # also the test queue
npx @esoul-cz/skills install dev --skill esoul-review,esoul-testing   # chosen skills of the layers
npx @esoul-cz/skills install                                   # interactive: pick layers, then skills

npx @esoul-cz/skills layers      # what the layers contain
npx @esoul-cz/skills status      # which layers and skills are installed, project and user
npx @esoul-cz/skills agents claude|codex   # optional worker agents and hooks
```

Useful options: `--dry-run` prints the `npx skills add` commands, `--yes` adds required layers without asking, `--agent <name>` and `--copy` go to `npx skills`, `--global` / `--project` override the scope of every layer. The helper refuses to install a layer whose required layers are missing and offers to add them.

A new developer in a project restores the committed set with `npx skills experimental_install` and adds their own layers with `install`. Update with `npx skills update -p` (project) and `npx skills update -g` (user).

Without the helper, the raw `npx skills` commands work too:

```bash
npx skills add eSoul-cz/skills --list
npx skills add eSoul-cz/skills --skill esoul-workflow esoul-guidelines esoul-task-work
npx skills add mattpocock/skills@v1.3.2 --skill code-review tdd diagnosing-bugs grilling handoff prototype codebase-design domain-modeling
npx skills add freeloio/freelo-cli --skill freelo
```

Start any real task with the entry point:

```text
$esoul-workflow build, fix, review or analyse this eSoul task
```

## Optional: agents, hooks and Codex

No skill needs them. They are a convenience for people who use Claude Code or Codex with orchestrated subagents.

- **Agents and hooks.** `agents/` holds seven worker agents with pinned models (`scout`, `test-runner`, `implementer`, `reviewer`, `critical-reviewer`, `uat-runner`, `ops`); `hooks/` injects the usage rules at session start and denies Explore, forks and general-purpose agents without an explicit `model` (disable with `ESOUL_AGENT_GUARD=off`; needs Node 22+). Skills describe delegation by job, never by agent name. The role briefs are in `skills/helpers/esoul-model-routing/references/roles.md`, generated from `agents/*.md` (`node tooling/scripts/build_roles.mjs`; CI checks it is in sync), so an agent without the plugin can brief any subagent with the same rules.
- **Claude Code plugin** (agents, hooks and the skills as one plugin):

  ```bash
  claude plugin marketplace add eSoul-cz/skills
  claude plugin install esoul-skills@esoul          # eSoul skills (all layers) with agents and hooks
  claude plugin install mattpocock-skills@esoul     # optional: the full upstream set
  claude plugin install frontend-design@esoul       # optional: distinctive, non-templated UI
  ```

  The plugin reads the layer folders (`skills` in `.claude-plugin/plugin.json`). **0.26.0 is a breaking change:** the skills were renamed and moved between layers (`esoul-tasking` → `esoul-task-work` and `esoul-task-create`, `esoul-freelo-task-authoring` → `esoul-task-create`, `esoul-maintain-application-documentation` → `esoul-docs`, `esoul-project-data` and `esoul-data-task-guard` → `esoul-data`; new `esoul-guidelines` and `esoul-testing`); the `freelo` copy, `test-queue` and the `esoul-awesome-picks` plugin are gone (install `upstream-core`, [`eSoul-cz/test-queue`](https://github.com/eSoul-cz/test-queue) and `upstream-picks` with the helper). Install the third-party skills with `npx @esoul-cz/skills install upstream-core`.
- **Codex** (agents to `~/.codex/agents`, rules into `~/.codex/AGENTS.md`):

  ```bash
  git clone https://github.com/eSoul-cz/skills && cd skills
  node codex/install.mjs            # --dry-run shows what would change; merge codex/config.toml by hand
  ```

  Or `npx @esoul-cz/skills agents codex`. After editing `agents/`, regenerate with `node tooling/scripts/build_codex_agents.mjs` and `node tooling/scripts/build_roles.mjs`.

Usage report (where the weekly limit goes): `node tooling/scripts/usage-report.mjs --days 7`.

## Upstream skills the eSoul workflow does not use by default

The eSoul skills build on mattpocock's set and do not fight it. The tracker and setup skills (`to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement-spec`, `setup-matt-pocock-skills`), `pr` and `git-guardrails-claude-code` replace an eSoul rule or tool (work is tracked in Freelo, `CONTEXT.md` holds eSoul conventions, `esoul-review` writes the PR), so they are not part of `upstream-core`: they are the on-request group `upstream-picks:matt-extra`, and `esoul-workflow` › `references/upstream.md` says when an agent leaves them alone.

## Publishing the helper (owner)

`@esoul-cz/skills` is not published yet. `npm pack` and `npm publish --dry-run` pass in this repository. To publish:

1. Create the npm organisation `esoul-cz` (npmjs.com) and add the publishing account as owner.
2. `npm login`, then `npm publish --access public` from the repository root (the package is scoped; `publishConfig.access` is already `public`).
3. Later releases: bump `version` in `package.json` (semver: new layer or command = minor, breaking command change = major) and publish again. To publish from Jenkins instead, store an npm automation token as the credential `NPM_TOKEN` and run `npm publish --access public` in a tag-triggered stage.

Until then run the helper from a checkout: `node bin/esoul-skills.mjs <command>`.

## Checks

```bash
tooling/scripts/test_skills                # every Node test (needs git and the network for the source check)
ESOUL_SKIP_NETWORK=1 node --test tooling/scripts/test_skills.mjs tooling/scripts/test_layers.mjs tooling/scripts/test_layers_manifest.mjs
```

They cover: skill frontmatter and description budget, relative links, one layer per own skill and a valid `layers.json`, every source of `layers.json` resolving (`npx skills add <source> --list`, the pinned mattpocock tag included), generated Codex agents and `roles.md` in sync, no skill naming the optional agents, the review script tests and anonymised review eval cases, the lifecycle, UAT, update and Freelo work-report script tests, the gitmoji catalog and the usage report. Jenkins runs them all in the `Verify skills` stage.

## Tools

- `docs/documentation` validates and renders application documentation (the optional PDF part of `esoul-docs`). Install it in an application repository with:

  ```bash
  curl -fsSL https://github.com/eSoul-cz/skills/releases/latest/download/install.sh | sh
  ```

- `freelo` is the authenticated CLI behind the official Freelo skill (layer `upstream-core`). Authenticate it with `freelo auth login`.

Tooling source and release automation live under `tooling/`, `install.sh`, and `Jenkinsfile`.
