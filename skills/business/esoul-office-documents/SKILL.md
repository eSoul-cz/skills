---
name: esoul-office-documents
description: Use to produce branded client documents as DOCX, XLSX or PPTX from the eSoul company templates - offers (nabídky), contracts, reports, price calculations, client presentations. Not for versioned application documentation (esoul-docs).
---

# Branded Office documents

The templates in `assets/templates/` carry the eSoul fonts (Poppins, Syne), logo, header and
footer. Never build a client document in a blank Office file or restyle the template; fill it
with the scripts below. Versioned application documentation (user, developer, operator guides)
stays with `esoul-docs`.

## Pick the format

| Need | Format | Source you write | Script |
| --- | --- | --- | --- |
| Offer, contract, report, letter | DOCX | Markdown | `scripts/md_to_docx.py` |
| Price calculation, estimate, table with sums | XLSX | JSON | `scripts/build_xlsx.py` |
| Client presentation | PPTX | JSON outline | `scripts/build_pptx.py` |

## Commands

DOCX and XLSX need only `python3` (standard library). PPTX needs python-pptx, installed once:

```bash
python3 -m venv ~/.cache/esoul-office-documents
~/.cache/esoul-office-documents/bin/pip install python-pptx
```

```bash
python3 scripts/md_to_docx.py nabidka.md nabidka.docx
python3 scripts/build_xlsx.py kalkulace.json kalkulace.xlsx
~/.cache/esoul-office-documents/bin/python scripts/build_pptx.py prezentace.json prezentace.pptx
```

Paths are relative to this skill directory. Each script takes `--template FILE` to override the
bundled template; the scripts write only the output path and need no network.

Start from `references/examples/` (`document.md`, `spreadsheet.json`, `presentation.json`); the
Markdown subset and JSON keys are documented in each script's docstring, the slide layouts in
`references/presentation-layouts.md`.

## Authoring rules

- Write in the client's language (Czech by default), with proper diacritics.
- State assumptions, scope limits, validity and VAT ("ceny bez DPH") explicitly.
- Never mention internal tooling, automation or AI in a client document.
- Use only public company data; take the contact details from the template and the
  repository, never invent legal names, IČ or prices.
- DOCX: `#` once as the title, `##` for numbered chapters, tables for prices; keep cover
  page layout with `<!-- pagebreak -->` and `<!-- spacer N -->`.
- XLSX: numbers as numbers (never text), totals as formulas, money as `money` columns. Set
  `widths` so narrow numeric columns do not inherit the wide template columns.
- PPTX: one message per slide, at most about 6 short bullets, titles on one line.

## Verify

1. Rebuild from the source file, never hand-edit the output.
2. Open the result: `python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).testzip()" FILE`
   catches a broken archive; then open it in Pages, Numbers, Keynote, Word or LibreOffice.
3. On macOS export to PDF through AppleScript (`tell application "Pages"` ... `export d to
   outFile as PDF`; Keynote works the same for PPTX) and look at the pages: logo present,
   no text cut off, tables within margins, totals correct.
4. Confirm no sample text is left and no internal remarks remain.

## Where to save

Client-facing sales documents go to the project's `Sales/` folder next to their Markdown or
JSON source, for example `Sales/nabidka/nabidka-<topic>.md` and the generated `.docx`. Other
projects follow their repository rules; project data rules are in the `esoul-data` skill (project layer).
