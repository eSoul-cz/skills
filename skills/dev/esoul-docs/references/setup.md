# Setup and upgrade

Read when `docs/documentation` is absent and setup or rendering was requested, or when upgrading installed tooling.

**First install.** The install adds a committed wrapper, managed files and a renderer image pin, so it is a new dependency (`docs/project_guidelines/workflow.md` › Repository rules). Before running it, confirm the absolute project root and make sure the maintainer's approval exists (an approval or recorded decision the pull request will link); without it, stop and ask the user to obtain it. Then run:

```bash
curl -fsSL https://github.com/eSoul-cz/skills/releases/latest/download/install.sh |
  sh -s -- /absolute/project/root
```

If `docs/documentation` is absent but `docs/.documentation-tools/managed-files.json` exists, the bootstrap without `--upgrade` fails ("already installed"). Recover with the `--upgrade` preview below, then `--apply` after the user's confirmation.

The GitHub Release bootstrap requires Docker, resolves a digest-pinned installer from the matching `release.env`, pulls the installer and renderer from the public Scaleway registry, installs the remote profile, creates a missing `docs/documentation.toml`, records the immutable renderer digest in local Git configuration (Git projects only; in a non-Git project export `DOCUMENTATION_REMOTE_RENDERER_IMAGE` with the digest the installer prints), and runs `doctor`. It does not clone the tooling repository or install Go, Lua, Pandoc, or LaTeX on the host.

When tooling is already installed, use the same bootstrap to preview an upgrade from the latest GitHub Release:

```bash
curl -fsSL https://github.com/eSoul-cz/skills/releases/latest/download/install.sh |
  sh -s -- /absolute/project/root --upgrade
```

Both runs resolve the latest release independently. To apply exactly the previewed version, note the planned version and set `DOCUMENTATION_TOOLS_VERSION=<x.y.z>` (semantic version) on both the preview and the `--apply` run.

**Upgrade.** Review the previewed plan with the user and run it again with `--apply` only after the user's explicit confirmation; no further maintainer approval is needed.
