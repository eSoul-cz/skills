# Office templates

Three binary templates the scripts in `../../scripts/` fill. Everything that is not body content
(fonts, logo, header, footer, page setup, company data) lives inside them.

| File | Used by | Company data inside |
| --- | --- | --- |
| `esoul-document.docx` | `md_to_docx.py` | Footers: `esoul.cz`, `info@esoul.cz`, `IČ: 17582571`, `DIČ: CZ17582571` (`word/footer1.xml`, `word/footer2.xml`) |
| `esoul-spreadsheet.xlsx` | `build_xlsx.py` | Header cell (shared string 8): the same four lines |
| `esoul-presentation.pptx` | `build_pptx.py` | Footer strip of the layouts: `esoul.cz \| info@esoul.cz` (no IČ) |

The scripts replace the body of the DOCX; the supplier block and `XXXX` placeholders that remain
in its sample body never reach an output.

## Origin and owner

- Origin: eSoul brand templates. The layout names (`TITLE_AND_BODY`, ...) and the table style
  `Projekt-style 2` point to a Google Workspace export; the editable original is not kept in this
  repository. **TBD:** confirm the original and where it lives.
- Owner: Tomáš Drvota (primary) and Tomáš Vojík (secondary); they approve changes to the company data
  and the look.

## Fonts

The DOCX and the PPTX embed **Poppins** and **Syne** (Syne SemiBold in the DOCX). The name tables of
the embedded font files carry the licence URL `https://scripts.sil.org/OFL`, so both are under the
SIL Open Font License 1.1, which allows embedding and redistribution (checked on the files in
this directory; Open Sans does not occur in any template). The XLSX refers to Roboto by name and
embeds no font (Roboto is Apache-2.0 licensed and is not distributed here).

## Changing a template

1. Edit the file in place in Word, Excel or PowerPoint (a Google export renames styles and layouts
   and breaks the scripts): `build_xlsx.py` relies on fixed cell references (party block rows 7-11,
   signature row 15), style ids and the first nine shared strings; `build_pptx.py` on the layout
   names in its `LAYOUTS` table.
2. When the company data changes, update the footers of all three files, then the constant
   `COMPANY_ID` (and the related lines) in `../../scripts/test_office_documents.py` and the table above.
3. Run `python3 -m unittest test_office_documents` in `../../scripts/` (the PPTX tests need
   `python-pptx` from `requirements.txt`) and open one built file of each kind.
