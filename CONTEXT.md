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
- The upstream skills adapted here are pinned in `tooling/upstream/mattpocock-skills.json`; `node tooling/scripts/check_upstream.mjs <checkout>` shows drift. Check it on every skills release.
- A release of the guidelines names the skills it affects (`Skills affected:` in its changelog); review them in this repository after that release.
- Distribution: `npx skills add eSoul-cz/skills` is the canonical install and the way projects pin skills; the Claude Code and Codex plugin is a convenience for colleagues on those setups. The plugin version is in `.claude-plugin/plugin.json`, and each plugin release is tagged `plugin-<version>`.
