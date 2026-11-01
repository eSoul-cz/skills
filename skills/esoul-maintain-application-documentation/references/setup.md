# Setup and upgrade

Read when `docs/documentation` is absent and setup or rendering was requested, or when upgrading installed tooling.

When `docs/documentation` is absent and the user requested documentation setup or rendering, confirm the absolute project root and run:

```bash
curl -fsSL https://github.com/eSoul-cz/skills/releases/latest/download/install.sh |
  sh -s -- /absolute/project/root
```

The GitHub Release bootstrap requires Docker, resolves a digest-pinned installer from the matching `release.env`, pulls the installer and renderer from the public Scaleway registry, installs the remote profile, creates a missing `docs/documentation.toml`, records the immutable renderer digest in local Git configuration, and runs `doctor`. It does not clone the tooling repository or install Go, Lua, Pandoc, or LaTeX on the host.

When tooling is already installed, use the same bootstrap to preview an upgrade from the latest GitHub Release:

```bash
curl -fsSL https://github.com/eSoul-cz/skills/releases/latest/download/install.sh |
  sh -s -- /absolute/project/root --upgrade
```

Review the plan and run it again with `--apply` only after explicit approval.
