# eSoul application documentation

This repository contains two independently consumable parts:

- `skills/esoul-maintain-application-documentation/` is the agent skill. It contains `SKILL.md`, agent metadata, focused references, and project-owned Markdown/configuration starters.
- `tooling/` is the documentation tool distribution. It contains the Go installer and renderer, Lua filters, themes, fonts, Docker build, release catalog, managed project wrapper, fixtures, and release tests.

The skill deliberately does not contain or search for tooling source code. Once tooling is installed in an application repository, the skill interacts with it only through `docs/documentation`.

## Install the skill

List the skills discoverable from a local checkout:

```bash
npx skills add . --list
```

Install this skill from the checkout:

```bash
npx skills add . \
  --skill esoul-maintain-application-documentation \
  --agent codex \
  --yes
```

Install it from GitHub:

```bash
npx skills add eSoul-cz/documentation-skill
```

For a non-interactive global Codex installation:

```bash
npx skills add eSoul-cz/documentation-skill \
  --skill esoul-maintain-application-documentation \
  --agent codex \
  --global \
  --yes
```

Only the nested skill directory is installed. The repository README, Jenkins pipeline, Go/Lua sources, Dockerfiles, release data, fonts, fixtures, and visual baselines remain outside the agent skill.

## Install project tooling

Tool installation is an explicit, separate operation from installing the agent skill. From a trusted checkout of this repository:

```bash
tooling/scripts/install_project_tools /absolute/project/root --remote
```

Use `--check` to verify managed files. Use `--upgrade` only after reviewing local changes. Local mode remains available for renderer development and recovery:

```bash
tooling/scripts/install_project_tools /absolute/project/root --local
```

Preview a cataloged hosted upgrade:

```bash
tooling/scripts/upgrade_project_tools /absolute/project/root --to VERSION
```

Append `--apply` only after reviewing the plan. Application repositories keep their authored Markdown, assets, specification, decisions, and `docs/documentation.toml`; managed runtime files are recorded in `docs/.documentation-tools/managed-files.json`.

## Develop and validate

Run installer unit and integration tests:

```bash
cd tooling/install-project-tools
go test ./...
go vet ./...
```

Run renderer unit tests:

```bash
cd tooling/project-tools/docs/.documentation-tools/pdf
go test ./...
go vet ./...
```

Run the complete Docker-first renderer and visual-regression fixture:

```bash
tooling/scripts/test_renderer_smoke
```

Validate skill discovery:

```bash
npx skills add . --list
```

## Releases

The root `Jenkinsfile` validates the tooling and publishes multi-architecture renderer images to `rg.fr-par.scw.cloud/esoul-internal-tools/documentation-tools`. The semantic version in `tooling/project-tools/docs/.documentation-tools/VERSION` is the primary tag.

After publication, review and commit the generated release-catalog candidate. See [the hosted image release notes](docs/hosted-image-plan.md) for the publication and migration contract.
