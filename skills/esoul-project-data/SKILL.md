---
name: esoul-project-data
description: Use whenever you save, back up, unpack or prepare project data (client files, photos, media, SQL dumps, backups, import files, exports) or a guide for colleagues. Source material without personal data and anonymised dumps go to assets/ via Git LFS, guides to docs/; non-anonymised exports, backups with personal data and generated PDFs are never committed (non-anonymised client material may sit only in the gitignored `_reference/`, never shared); never to gitignored storage/, *.nosync, tmp/ or Downloads.
---

# Project data belongs in Git, not in storage

Project data in `storage/`, `*.nosync` or another ad hoc gitignored folder exists on one computer
only. A colleague cannot find it, and it disappears with the disk. Therefore:

| What | Where |
| --- | --- |
| Client source files without personal data (XLSX, DOCX, PDF, original photos from file transfers) | `assets/<topic>/…` in the main repository, Git LFS |
| Admin media without personal data; **anonymised** SQL dumps for transfer and backups before an import | `assets/…`, Git LFS |
| Case-study screenshots and Lighthouse reports | `assets/case-study/…`, Git LFS (owner: `esoul-project-lifecycle` case-study reference) |
| Processed files for an import (resized photos, caches) | `assets/…`, Git LFS |
| Guides, runbooks, procedures for colleagues | `docs/…` (plain Git), linked from the README |
| Scripts and manifests (small text files) | next to the data or in `docs/`, plain Git |

Real client data stays out of code, tests, fixtures, issues and PRs; agents work with anonymised
dumps. Non-anonymised client material needed for the work (legacy evidence) MAY sit in one
gitignored local folder, by convention `_reference/` (guidelines `general/security-and-data.md`,
Anonymized dumps for agents): the project's `.gitignore` names it; it is never committed and
never shared (not in LFS, issues or PRs, not copied into code, fixtures or tests), and what is
derived from it is anonymised. Anonymised dumps never live there. Repository rules (`AGENTS.md`,
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
  copy or an anonymised dump meant for handover goes to `assets/`.
- **Never committed, not even to LFS:** non-anonymised exports and database backups and dumps
  that hold personal data (except data recorded as public, below), and generated PDFs (build
  artifacts, reproducible from their sources; one already committed is removed with
  `git rm --cached`, guidelines `documentation.md`).
- **Public data** (a public register, data the application is meant to publish) is not covered by
  the personal-data ban, and neither are exports of it, which need no anonymisation (guidelines
  `security-and-data.md`, Personal and client data); whether data counts as public is recorded
  per application in `CONTEXT.md` or an ADR.
- **Data is reviewed before it is committed:** the author checks that it holds nothing personal or
  private beyond the recorded exceptions, and a reviewer confirms it.
