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
| Screenshots and Lighthouse of the original and launched site | `assets/case-study/pred\|po/<date>/` (skill `esoul-website-launch`) |
| Previous system "as it was" | `docs/legacy/<area>.md` |
| Raw legacy evidence (dumps, crawls) | A gitignored local folder, by convention `_reference/`, or `assets/` when anonymized |

Client data does not live in other gitignored folders such as `storage/`, `tmp/` or Downloads.
What may be committed, the one gitignored local folder for non-anonymised material and how it
is shared are the rules of `docs/project_guidelines/security-and-data.md`; the project's
`.gitignore` names that folder (by convention `_reference/`).

## Reading the files

Do not read podklady and legacy files in the orchestrating session. Give
a cheap read-only explorer subagent (when the harness offers one; otherwise read the files yourself, one at a time) the file list and ask for a summary per file (sheets, chapters,
figures, open points) with locations, and with `path:line` (or sheet/cell) evidence for every
number and formula. The session decides what becomes a note, question or ADR, and verifies the
numbers it relies on by targeted reads of those locations only.

## Writing a podklad note

Start from `assets/templates/docs/podklady/_poznamka.md`.

- Frontmatter: `status: podklady-as-is`, `source:` (path in `assets/`), `snapshot:` (date received).
- `## Co v podkladu je`, then one section per sheet or chapter, then `## Otevřené otázky`
  (links to the `question` issues, `#N`), then `## Ověřeno` (how each claim was checked, e.g. extracted with
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

Personal data, anonymised dumps and what agents may read follow
`docs/project_guidelines/security-and-data.md`. Local facts: keep the anonymisation script and the
vetted column list in `scripts/` and say in the PR which dump version agents may use. Parity
fixtures may contain numbers and cell references, never names.

## After intake

Each gap or ambiguity becomes a `question` issue ([questions-and-client.md](questions-and-client.md)).
Each decision with real alternatives becomes a `proposed` ADR ([adr.md](adr.md)). Deliver each
intake batch as one change, as the project's workflow guideline says.

Done when every file is in `assets/klient/` and has a note or legacy document (or a stated reason
it has none), every gap is a `question` issue, and `docs/podklady/README.md` lists each file with
what it is binding for.
