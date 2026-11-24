---
name: esoul-office-documents
description: "Branded DOCX, XLSX or PPTX business documents (reports, contracts, price calculations, client presentations, rendered offers) from the eSoul company templates, in Czech or English. Offer content and pricing belong to esoul-offer-authoring; client-facing application guides as PDF belong to esoul-docs."
---

# Branded Office documents

Fill the bundled templates in `assets/templates/` with the scripts below; they carry the eSoul
fonts, logo, header and footer. Where the templates come from, who owns them and how to change
one: `assets/templates/README.md`.

## Pick the format

| Need | Format | Source you write | Script |
| --- | --- | --- | --- |
| Offer, contract, report, letter | DOCX | Markdown | `scripts/md_to_docx.py` |
| Price calculation, estimate, table with sums | XLSX | JSON | `scripts/build_xlsx.py` |
| Client presentation | PPTX | JSON outline | `scripts/build_pptx.py` |

## Commands

Resolve `SKILL_DIR` to the directory that contains this file; input and output paths are relative
to the working directory. DOCX and XLSX need only `python3`. PPTX needs python-pptx, installed
once into a virtual environment from the pinned requirements:

```bash
python3 -m venv ~/.cache/esoul-office-documents
~/.cache/esoul-office-documents/bin/pip install -r "$SKILL_DIR/scripts/requirements.txt"
```

```bash
python3 "$SKILL_DIR/scripts/md_to_docx.py" nabidka.md nabidka.docx
python3 "$SKILL_DIR/scripts/build_xlsx.py" kalkulace.json kalkulace.xlsx
~/.cache/esoul-office-documents/bin/python "$SKILL_DIR/scripts/build_pptx.py" prezentace.json prezentace.pptx
```

`--template FILE` overrides the bundled template. The scripts write only the output path and need
no network. Language and currency:

- `--lang cs|en` (default `cs`, on all three scripts): callout labels, workbook labels and sheet
  names, proofing language. The text itself is yours.
- `--currency CZK` (XLSX, ISO code, default `CZK`): the format of `money` columns.
- The footer and header of the templates keep the Czech company data (name, IČ, DIČ).

Start from `references/examples/` (`document.md`, `spreadsheet.json`, `presentation.json`, with
`.en` variants): layout samples with fictional figures, not offers. The Markdown subset and JSON
keys are in each script's docstring, the slide layouts in `references/presentation-layouts.md`.

## Authoring rules

- Write in the client's language (`--lang cs` or `en`) with proper diacritics.
- State assumptions, scope limits, validity and VAT (cs "ceny bez DPH", en "prices exclude VAT").
- Describe deliverables and outcomes; leave internal tooling, automation and AI out of the document.
- Unknown facts (legal names, IČ, prices) are written as `TBD` and asked about
  (`docs/project_guidelines/documentation.md` › The `TBD` rule); contact details come from the
  template footer.
- DOCX: `#` once as the title, `##` for chapters (type the numbers yourself: `## 1. Summary`),
  tables for prices; cover page layout with `<!-- pagebreak -->` and `<!-- spacer N -->`. The
  Markdown subset has no images: show a sitemap or flow as a table, or add a picture in Word after
  the build.
- XLSX: numbers as numbers (not text), totals as formulas, money as `money` columns. Set
  `widths` so narrow numeric columns do not inherit the wide template columns.
- PPTX: one message per slide, titles on one line, bullets as in the layouts file.

## Verify

1. Change the source and rebuild; the output is regenerated, not edited.
2. `python3 -m zipfile -t FILE` prints `Done testing` with no error.
3. Export to PDF and look at the pages: `soffice --headless --convert-to pdf --outdir DIR FILE`
   where LibreOffice is installed, the Pages, Numbers or Keynote export on a Mac, otherwise say in
   the reply that the layout was not checked. Logo present, no text cut off, tables within the
   margins, totals correct.
4. No sample text, `TBD` or internal remark is left, unless the reply names it.

## Where to save

Sales documents (offers, price calculations for a prospect) go where `esoul-offer-authoring`
says: the private repository `eSoul-cz/sales`, outside the project repositories. For other documents the
Markdown or JSON source is committed where the project keeps it; the generated DOCX, XLSX and PPTX
are build artifacts (`docs/project_guidelines/workflow.md` › Repository rules). Where project data
lives: `esoul-data`.
