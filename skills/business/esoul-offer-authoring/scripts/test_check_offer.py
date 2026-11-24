"""Tests for check_offer.py. Standard library only: python3 -m unittest test_check_offer (from this directory)."""
from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import check_offer  # noqa: E402

STATEMENTS_CS = (
    "Verze 1.0, 1. 2. 2026. Ceny jsou uvedeny bez DPH. Nabídka platí 30 dní. Splatnost faktur je 14 dní.\n"
    "Opravy vad jsou zdarma po dobu 3 měsíců. Varianta C: provoz ve vlastní režii klienta.\n"
)
TABLE_CS = (
    "| Položka | Hodiny | Cena |\n| --- | --- | --- |\n"
    "| Analýza | 20 h | 26 000 Kč |\n"
    "| Vývoj | 60 h | 78 000 Kč |\n"
    "| Rezerva na nepředvídané práce (10 %) | 8 h | 10 400 Kč |\n"
    "| **Celkem** | **88 h** | **114 400 Kč** |\n"
)
STATEMENTS_EN = (
    "Version 1.0, 1 February 2026. All prices are exclusive of VAT. The offer is valid for 30 days.\n"
    "Invoices have a due date of 14 days. Free repairs of defects for 3 months. Variant C: operated by the client.\n"
)
TABLE_EN = (
    "| Item | Hours | Price |\n| --- | --- | --- |\n"
    "| Analysis | 20 h | EUR 2,600 |\n"
    "| Development | 60 h | EUR 7,800 |\n"
    "| Contingency reserve (10 %) | 8 h | EUR 1,040 |\n"
    "| **Total** | **88 h** | **EUR 11,440** |\n"
)


def run(text: str, rate: int | None = None, lang: str = "cs", currency: str | None = None):
    return check_offer.check(text, rate, lang, currency)


class CheckOfferTest(unittest.TestCase):
    def test_clean_czech_offer_passes(self) -> None:
        self.assertEqual(run(STATEMENTS_CS + TABLE_CS, rate=1300), ([], []))

    def test_clean_english_offer_passes(self) -> None:
        self.assertEqual(run(STATEMENTS_EN + TABLE_EN, rate=130, lang="en", currency="EUR"), ([], []))

    def test_wrong_total(self) -> None:
        text = (STATEMENTS_CS + TABLE_CS).replace("**114 400 Kč**", "**115 000 Kč**")
        problems, _ = run(text)
        self.assertEqual(len(problems), 1)
        self.assertIn("total 115000, rows sum to 114400", problems[0])

    def test_wrong_line_against_the_rate(self) -> None:
        text = (STATEMENTS_CS + TABLE_CS).replace("78 000 Kč", "80 000 Kč")
        problems, _ = run(text, rate=1300)
        self.assertTrue(any("60 h x 1300 = 78000, stated 80000" in p for p in problems), problems)

    def test_missing_statement_is_named(self) -> None:
        problems, _ = run((STATEMENTS_CS + TABLE_CS).replace("Splatnost faktur je 14 dní.", ""))
        self.assertEqual(problems, ["missing: invoice due date"])

    def test_reserve_that_is_not_ten_percent(self) -> None:
        text = (STATEMENTS_CS + TABLE_CS).replace("| 8 h | 10 400 Kč |", "| 24 h | 31 200 Kč |").replace("88 h", "104 h").replace(
            "114 400 Kč", "135 200 Kč"
        )
        problems, _ = run(text, rate=1300)
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("reserve 24 h, 10 % of 80 work hours is 8.0 h", problems[0])

    def test_reserve_must_be_the_last_row_before_the_total(self) -> None:
        table = (
            "| Položka | Hodiny | Cena |\n| --- | --- | --- |\n"
            "| Rezerva na nepředvídané práce (10 %) | 8 h | 10 400 Kč |\n"
            "| Analýza | 20 h | 26 000 Kč |\n| Vývoj | 60 h | 78 000 Kč |\n"
            "| Celkem | 88 h | 114 400 Kč |\n"
        )
        problems, _ = run(STATEMENTS_CS + table, rate=1300)
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("not the last row", problems[0])

    def test_table_with_total_but_without_reserve_row(self) -> None:
        table = (
            "| Položka | Hodiny | Cena |\n| --- | --- | --- |\n"
            "| Analýza | 20 h | 26 000 Kč |\n| Celkem | 20 h | 26 000 Kč |\n"
        )
        problems, _ = run(STATEMENTS_CS + table + "Rezerva je zmíněna v textu.\n")
        self.assertEqual(problems, ["line 6: no reserve row before the total (10 % of the work hours)"])

    def test_hours_column_found_by_unit_when_the_header_does_not_name_hours(self) -> None:
        table = TABLE_CS.replace("Hodiny", "Rozsah").replace("78 000 Kč", "79 000 Kč")
        problems, _ = run(STATEMENTS_CS + table, rate=1300)
        self.assertTrue(any("60 h x 1300 = 78000, stated 79000" in p for p in problems), problems)

    def test_rate_check_reports_when_it_has_no_hours_column(self) -> None:
        table = (
            "| Položka | Cena |\n| --- | --- |\n| Analýza | 26 000 Kč |\n| Celkem | 26 000 Kč |\n"
        )
        problems, notes = run(STATEMENTS_CS + table + "Rezerva je zmíněna v textu.\n", rate=1300)
        self.assertEqual(problems, [])
        self.assertEqual(len(notes), 1)
        self.assertIn("rate check skipped", notes[0])

    def test_placeholders_including_tbd_are_reported(self) -> None:
        problems, _ = run(STATEMENTS_CS + TABLE_CS + "Splatnost: TBD\n")
        self.assertEqual(problems, ["line 9: leftover 'TBD'"])

    def test_several_currencies_in_one_offer(self) -> None:
        text = STATEMENTS_CS + TABLE_CS.replace("10 400 Kč", "400 EUR")
        problems, _ = run(text)
        self.assertTrue(any(p.startswith("currency: several currencies") for p in problems), problems)

    def test_currency_other_than_expected(self) -> None:
        problems, _ = run(STATEMENTS_EN + TABLE_EN, lang="en", currency="CZK")
        self.assertEqual(problems, ["currency: found EUR, expected CZK"])

    def test_command_line_exit_code_and_judge_yourself_list(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            good = Path(directory) / "good.md"
            good.write_text(STATEMENTS_CS + TABLE_CS, encoding="utf-8")
            bad = Path(directory) / "bad.md"
            bad.write_text(TABLE_CS, encoding="utf-8")
            script = str(HERE / "check_offer.py")
            ok = subprocess.run([sys.executable, script, str(good), "--rate", "1300"], capture_output=True, text=True)
            self.assertEqual(ok.returncode, 0, ok.stdout)
            self.assertIn("0 problem(s) in good.md", ok.stdout)
            self.assertIn("You verify:", ok.stdout)
            failed = subprocess.run([sys.executable, script, str(bad)], capture_output=True, text=True)
            self.assertEqual(failed.returncode, 1)
            self.assertIn("missing: prices excl. VAT", failed.stdout)


if __name__ == "__main__":
    unittest.main()
