## Project profile

Internal repository: reusable agent skills, worker agents and companion tools for eSoul projects. It follows the guidelines with the `profile/internal` layer (`esoul-guidelines.json`, rendered into `docs/project_guidelines/`); it is not a client application and has no PHP project.

## Tracker

Changes start from the owner's request, a plan slice or a GitHub issue of `eSoul-cz/skills`, as `profile/internal` allows (`docs/project_guidelines/workflow.md`). There is no Freelo project and no `## Freelo` cache.

## Commit convention

Use the `gitmoji-commit` skill for normal agent-authored commits.

```text
:sparkles: [checkout] Add delivery selection

optional explanatory details
```

Use one Gitmoji shortcode per commit and split commits by intention. Context is optional. The message is imperative and starts with an uppercase letter. Keep the complete subject line at 72 characters or fewer when practical.

## Maintainers

- Maintainer of the skills, the guidelines and the app templates: Tomáš Vojík (@Heroyt).
- Secondary maintainer of the skills: Tomáš Drvota (@esoul-cz-user).
- There is no `CODEOWNERS` file; internal repositories do not need one (`docs/project_guidelines/workflow.md`).

## Sources of truth

- The engineering and work rules are the guidelines in `docs/project_guidelines/`, managed by `esoul-guidelines` (never edited by hand). A skill states only rules for agent work and points to the guideline for a project rule.
- The eSoul skills build on mattpocock's skills (layer `upstream-core` of `layers.json`, pinned to a tag, installed from source and never copied here); a skill adds only the eSoul procedure. Bump the pinned tag in `layers.json` deliberately on a skills release and re-read the upstream changes; the `Verify skills` check proves every source and skill name in `layers.json` still resolves.
- A release of the guidelines names the skills it affects (`Skills affected:` in its changelog); review them in this repository after that release.
- Layout: `skills/<layer>/<skill>/` with the layers defined in `layers.json` (core, dev, project, helpers, business, upstream-core, upstream-picks). Every own skill is in exactly one layer; a test checks it. Layers 1 and 2 are project installs, the others user installs.
- Distribution: the helper package `@esoul-cz/skills` (`bin/`, `lib/`) installs layers on top of `npx skills`, which stays the underlying mechanism. The Claude Code plugin, `agents/`, `hooks/` and `codex/` are an optional convenience; no skill depends on them, and `skills/helpers/esoul-model-routing/references/roles.md` is generated from `agents/*.md`. The plugin version is in `.claude-plugin/plugin.json`, and each plugin release is tagged `plugin-<version>`.
- WordPress has no guideline layer; `esoul-workflow` › `references/wordpress.md` carries the eSoul WordPress rules until a WordPress project adopts `esoul-guidelines` and a layer is written from it.
- `test-queue` lives in its own repository, `eSoul-cz/test-queue`; skills only hint at it as optional.
