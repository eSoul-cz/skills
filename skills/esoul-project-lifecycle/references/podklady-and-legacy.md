# Podklady and legacy evidence (P1, `intake`)

Podklady are what the client gave us. Legacy is how the previous system behaved. Both are
**evidence, never requirements**: a requirement exists only once a question is answered and an
ADR, the plan or an issue says so.

## Where things go

| What | Where |
|---|---|
| Original client files (pdf, docx, xlsx, images, exports) | `assets/klient/<topic>/…` via Git LFS, never edited |
| Markdown note per file or topic | `docs/podklady/<file-or-topic>.md` (flat, so template links work) |
| Index and binding table | `docs/podklady/README.md` |
| Dated client answers and meeting notes | `docs/podklady/odpovedi-klienta-YYYY-MM-DD.md` |
| Design review feedback exports | `docs/podklady/pripominky-mockup-revize-N-YYYY-MM-DD.md` |
| Previous system "as it was" | `docs/legacy/<area>.md` |
| Raw legacy evidence (dumps, crawls) | gitignored `_reference/` or `assets/` when anonymized |

Never store client data in gitignored folders such as `storage/`, `tmp/` or Downloads. The single
exception is unanonymized legacy evidence in the gitignored `_reference/`, which never reaches
an agent unless anonymized.

## Writing a podklad note

Start from `assets/templates/docs/podklady/_poznamka.md`.

- Frontmatter: `status: podklady-as-is`, `source:` (path in `assets/`), `snapshot:` (date received).
- `## Co v podkladu je`, then one section per sheet or chapter, then `## Otevřené otázky`
  (links to `Q-nn`), then `## Ověřeno` (how each claim was checked, e.g. extracted with
  openpyxl, compared with the PDF).
- Describe, do not decide. No future tense. Point to the target only as
  „Cílové řešení: ADR-00NN“.
- Spreadsheet formulas: record sheet, cell and formula. Known defects in the client's workbook
  are numbered and turned into questions, never silently fixed.
- Update `docs/podklady/README.md` with the file, what it is binding for, and what it is not
  binding for (formula defects, layout, scope, sample data).

## Legacy documents

Start from `assets/templates/docs/legacy/_template.md`.

- Frontmatter: `status: legacy-as-is`, `source:`, `snapshot:`.
- Only the headings `Jak to bylo`, `Ověřeno`, `Otevřené otázky`.
- Aggregates only; never personal data. Write „nelze určit“ instead of guessing.
- No sentence in legacy creates a requirement.

## Personal data

- Dumps are anonymized before an agent reads them. Keep the anonymization script and the vetted
  column list in `scripts/` and say in the PR which dump version agents may use.
- An agent that receives an unanonymized dump stops and reports it.
- Issues, PRs, fixtures and tests contain only synthetic or anonymized values. Parity fixtures
  may contain numbers and cell references, never names.

## After intake

Each gap or ambiguity becomes a question in the register ([questions-and-client.md](questions-and-client.md)).
Each decision with real alternatives becomes a `proposed` ADR ([adr.md](adr.md)). Open one PR per
intake batch.
