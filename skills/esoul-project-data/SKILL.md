---
name: esoul-project-data
description: Project data (client files, photos, admin media, SQL dumps, backups, import files, exports) and guides for colleagues never go to gitignored folders (storage/, *.nosync, tmp/, Downloads) but into the tracked repository - data into assets/ through Git LFS, guides into docs/. Use whenever you save, back up, unpack or prepare any data file or document for handover, a backup before an import, or a dump or media for a server.
---

# Project data belongs in Git, not in storage

Whatever lies in `storage/`, `*.nosync` or another gitignored folder exists on one computer only.
A colleague cannot find it, and it disappears with the disk. Therefore:

| What | Where |
| --- | --- |
| Client files (XLSX, DOCX, PDF, original photos from file transfers) | `assets/<topic>/…` in the main repository, Git LFS |
| Admin media, SQL dumps for transfer, backups before an import | `assets/…`, Git LFS |
| Processed files for an import (resized photos, caches) | `assets/…`, Git LFS |
| Guides, runbooks, procedures for colleagues | `docs/…` (plain Git), linked from the README |
| Scripts and manifests (small text files) | next to the data or in `docs/`, plain Git |

Real client data stays out of code, tests, fixtures, issues and PRs; agents work with anonymized
dumps. Unanonymized legacy evidence the project keeps for reference goes to the gitignored
`_reference/` folder when the repository defines one. Repository rules (`AGENTS.md`,
`CONTEXT.md`) override this skill, for example a project that names another approved store for
sensitive originals.

## Steps

1. **LFS:** the repository root has a `.gitattributes` with
   `assets/** filter=lfs diff=lfs merge=lfs -text` (text files such as `*.md` excluded from LFS).
   Run `git lfs install --local` before the first commit.
2. **Save straight to `assets/`,** not to storage first. Point application configuration (media
   roots, script outputs) at `assets/` so the data does not drift apart.
3. **Describe it** in `assets/README.md` and the repository README: what is in `assets/` and why.
4. **Before pushing,** check the size (`du -sh assets`) and tell the user. LFS has a quota.

## Exceptions

- **Secrets** (`.env`, `.env` backups, passwords, tokens, keys) never go to Git, not even through
  LFS. They stay local or in the password manager; the README only says where to find them.
- **Purely temporary intermediates** that are thrown away right after (previews, contact sheets
  for a check) belong in the session scratchpad, not in the repository or storage.
- **Runtime data on the server** (volumes, databases) is not managed through Git; only a local
  copy or a dump meant for handover goes to `assets/`.
