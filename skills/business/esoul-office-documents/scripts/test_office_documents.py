"""Smoke tests for the Office renderers and the bundled templates.

Run from this directory: python3 -m unittest test_office_documents -v
DOCX and XLSX need only the standard library; the PPTX tests are skipped without python-pptx
(install scripts/requirements.txt into a virtual environment to run them).
"""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.etree import ElementTree

SCRIPTS = Path(__file__).resolve().parent
SKILL = SCRIPTS.parent
EXAMPLES = SKILL / "references" / "examples"
TEMPLATES = SKILL / "assets" / "templates"
sys.path.insert(0, str(SCRIPTS))

import build_xlsx  # noqa: E402
import md_to_docx  # noqa: E402

# The company ID printed in the template footers. When it changes, re-export the templates and
# update this constant and assets/templates/README.md together.
COMPANY_ID = "17582571"
VAT_ID = "CZ17582571"
CONTACT = "info@esoul.cz"


def read_parts(path: Path) -> dict[str, str]:
    """Every XML part of an Office file as text; fails when the archive or an XML part is broken."""
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, f"{path.name}: corrupt archive member"
        parts = {name: archive.read(name).decode("utf-8") for name in archive.namelist() if name.endswith((".xml", ".rels"))}
    for name, text in parts.items():
        ElementTree.fromstring(text.encode("utf-8"))  # raises on malformed XML
    return parts


class TemplateTest(unittest.TestCase):
    def test_docx_footers_hold_the_current_company_data(self) -> None:
        parts = read_parts(TEMPLATES / "esoul-document.docx")
        for name in ("word/footer1.xml", "word/footer2.xml"):
            self.assertIn(f"IČ: {COMPANY_ID}", parts[name], name)
            self.assertIn(f"DIČ: {VAT_ID}", parts[name], name)
            self.assertIn(CONTACT, parts[name], name)

    def test_xlsx_header_holds_the_current_company_data(self) -> None:
        strings = read_parts(TEMPLATES / "esoul-spreadsheet.xlsx")["xl/sharedStrings.xml"]
        self.assertIn(f"IČ: {COMPANY_ID}", strings)
        self.assertIn(f"DIČ: {VAT_ID}", strings)
        self.assertIn(CONTACT, strings)

    def test_pptx_footer_holds_the_contact_line(self) -> None:
        parts = read_parts(TEMPLATES / "esoul-presentation.pptx")
        footers = [text for name, text in parts.items() if name.startswith("ppt/slideLayouts/slideLayout")]
        self.assertTrue(any(f"esoul.cz  |  {CONTACT}" in text for text in footers))


class DocxTest(unittest.TestCase):
    def build(self, source: str, lang: str | None) -> str:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "out.docx"
            md_to_docx.main(str(md_to_docx.DEFAULT_TEMPLATE), str(EXAMPLES / source), str(target), *([lang] if lang else []))
            return read_parts(target)["word/document.xml"]

    def test_czech_default_keeps_czech_labels_and_no_language_override(self) -> None:
        xml = self.build("document.md", None)
        self.assertIn("Poznámka:", xml)
        self.assertIn("Shrnutí", xml)
        self.assertNotIn("<w:lang ", xml)

    def test_english_uses_english_labels_and_proofing_language(self) -> None:
        xml = self.build("document.en.md", "en")
        self.assertIn("Note:", xml)
        self.assertNotIn("Poznámka", xml)
        self.assertIn('<w:lang w:val="en-GB"/>', xml)

    def test_a_second_czech_build_after_an_english_one_is_czech_again(self) -> None:
        self.build("document.en.md", "en")
        self.assertIn("Poznámka:", self.build("document.md", "cs"))


class XlsxTest(unittest.TestCase):
    def build(self, source: str, **options: str) -> dict[str, str]:
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "out.xlsx"
            build_xlsx.main(str(build_xlsx.DEFAULT_TEMPLATE), str(EXAMPLES / source), str(target), **options)
            return read_parts(target)

    def test_czech_default_is_czech_and_crowns(self) -> None:
        parts = self.build("spreadsheet.json")
        self.assertIn('name="Údaje"', parts["xl/workbook.xml"])
        self.assertIn("Zhotovitel", parts["xl/sharedStrings.xml"])
        self.assertIn("Datum: 1. 1. 2000", parts["xl/sharedStrings.xml"])
        self.assertIn("[$Kč-405]", parts["xl/styles.xml"])
        self.assertRegex(parts["xl/worksheets/sheet2.xml"], r"<f>B\d+\*C\d+</f>")
        self.assertRegex(parts["xl/worksheets/sheet2.xml"], r"<f>SUM\(D\d+:D\d+\)</f>")
        self.assertIn('displayName="Tabulka1"', parts["xl/tables/table1.xml"])

    def test_english_euro_workbook(self) -> None:
        parts = self.build("spreadsheet.en.json")  # lang and currency come from the keys
        self.assertIn('name="Details"', parts["xl/workbook.xml"])
        self.assertNotIn("Údaje", parts["xl/workbook.xml"])
        strings = parts["xl/sharedStrings.xml"]
        self.assertIn("Company ID:", strings)
        self.assertIn("Date: 1 January 2000", strings)
        self.assertIn("Sample Supplier Ltd.", strings)
        self.assertNotIn("Zhotovitel", strings)
        self.assertIn("[$€-2]", parts["xl/styles.xml"])
        self.assertNotIn("Kč-405", parts["xl/styles.xml"])
        self.assertIn('displayName="Table1"', parts["xl/tables/table1.xml"])

    def test_flags_override_the_keys_and_other_iso_codes_are_accepted(self) -> None:
        parts = self.build("spreadsheet.en.json", lang="cs", currency="chf")
        self.assertIn("[$CHF]", parts["xl/styles.xml"])
        self.assertIn('name="Údaje"', parts["xl/workbook.xml"])

    def test_invalid_currency_is_refused(self) -> None:
        with self.assertRaises(SystemExit):
            self.build("spreadsheet.json", currency="crowns")


@unittest.skipUnless(importlib.util.find_spec("pptx"), "python-pptx is not installed (scripts/requirements.txt)")
class PptxTest(unittest.TestCase):
    def build(self, source: str, **options: str):
        import build_pptx
        from pptx import Presentation

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "out.pptx"
            import json

            outline = json.loads((EXAMPLES / source).read_text(encoding="utf-8"))
            build_pptx.build(outline, str(build_pptx.DEFAULT_TEMPLATE), str(target), **options)
            read_parts(target)
            return Presentation(str(target))

    def test_czech_deck_has_every_outline_slide_and_no_language_override(self) -> None:
        deck = self.build("presentation.json")
        self.assertEqual(len(deck.slides), 6)
        self.assertNotIn("lang=", deck.slides[0].shapes[0]._element.xml if deck.slides[0].shapes else "")

    def test_english_deck_sets_the_proofing_language(self) -> None:
        deck = self.build("presentation.en.json")  # the key lang
        self.assertEqual(len(deck.slides), 4)
        xml = "".join(shape._element.xml for slide in deck.slides for shape in slide.shapes)
        self.assertIn('lang="en-GB"', xml)


if __name__ == "__main__":
    unittest.main()
