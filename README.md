# eSoul application documentation

This repository contains two independently consumable parts:

- `skills/esoul-maintain-application-documentation/` is the agent skill. It contains `SKILL.md`, agent metadata, focused references, and project-owned Markdown starters.
- `tooling/` is the documentation tool distribution. It contains the Go installer and renderer, Lua filters, themes, fonts, Docker build, release catalog, managed project wrapper, fixtures, release tests, and the default project configuration.

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

Tool installation is an explicit, separate operation from installing the agent skill. From the application repository, run:

```bash
curl -fsSL https://raw.githubusercontent.com/eSoul-cz/documentation-skill/1cd2054e8ced15bdee52b3ec6bf412fb88ed972d/install.sh | sh
```

An explicit project path is also supported:

```bash
curl -fsSL https://raw.githubusercontent.com/eSoul-cz/documentation-skill/1cd2054e8ced15bdee52b3ec6bf412fb88ed972d/install.sh |
  sh -s -- /absolute/project/root
```

The command downloads the script from an immutable source commit. The script requires Docker, resolves the latest published GitHub Release, reads both digest-pinned images from its `release.env` manifest, and pulls the public images from `rg.fr-par.scw.cloud/esoul-internal-tools`. It installs the remote profile, creates `docs/documentation.toml` only when missing, pins the renderer by its immutable digest, stores that digest in local Git configuration, and runs `docs/documentation doctor`. It does not clone this repository or install Go, Lua, Pandoc, or LaTeX on the host.

The installed agent skill can perform the same setup when asked to configure documentation tooling. Existing managed installations are not overwritten; use the reviewed upgrade workflow for them.

To select a published tooling version:

```bash
curl -fsSL https://raw.githubusercontent.com/eSoul-cz/documentation-skill/1cd2054e8ced15bdee52b3ec6bf412fb88ed972d/install.sh |
  DOCUMENTATION_TOOLS_VERSION=0.6.1 sh
```

For CI or a non-Git working directory, provide the configured renderer digest through `DOCUMENTATION_REMOTE_RENDERER_IMAGE`. Local Git configuration is deliberately untracked and is not transferred to CI.

### Tooling development and managed upgrades

From a trusted checkout of this repository, install a local or remote development bundle with:

```bash
tooling/scripts/install_project_tools /absolute/project/root --remote
tooling/scripts/install_project_tools /absolute/project/root --local
```

Use `--check` to verify managed files. Use `--upgrade` only after reviewing local changes. Preview a cataloged hosted upgrade with:

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
tooling/scripts/test_bootstrap_install
tooling/scripts/test_release_catalog
```

Validate skill discovery:

```bash
npx skills add . --list
```

## Releases

The root `Jenkinsfile` validates the tooling and publishes multi-architecture renderer and installer images to the public `rg.fr-par.scw.cloud/esoul-internal-tools` registry. Publication runs only for a semantic Git tag, which is the authoritative release version. Jenkins injects that tag into the installer bundle; the committed `0.0.0` `VERSION` value is only an untagged-development placeholder. Both images include BuildKit SBOM and provenance attestations.

After resolving the immutable image digests, Jenkins uses the `dockerHelpers` shared library to generate and sign standalone SPDX, provenance, and Trivy reports. It publishes the verified artifact set and canonical `release.env` bootstrap manifest through a GitHub Release, then records the renderer artifact URLs in the generated release-catalog candidate. Jenkins requires the pinned Cosign, Syft, GitHub CLI, and Trivy versions documented by `publishContainerReleaseArtifacts`, plus these credentials:

- `github-documentation-skill-release-token` — repository-scoped GitHub Secret Text with `Contents: read and write`;
- `cosign-documentation-skill-private-key` — encrypted Cosign private-key Secret File;
- `cosign-documentation-skill-key-password` — Cosign key-password Secret Text;
- `scaleway_secret_key` — existing Scaleway registry Secret Text.

After publication, review and commit the generated release-catalog candidate. See [the hosted image release notes](docs/hosted-image-plan.md) for the publication and migration contract.
