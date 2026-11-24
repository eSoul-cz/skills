#!/usr/bin/env python3
"""Check an offer's Markdown source before rendering.

Usage: python3 check_offer.py OFFER.md [--rate 1300] [--lang cs|en] [--currency CZK]

Standard library only, read-only. --lang selects the language of the offer text
(default cs); --currency the one currency the offer uses (default: any single one).
Reports:
  - price tables whose total row ("Celkem" / "Total") does not equal the sum of the rows
    above it (every numeric column: hours, prices),
  - tables with a total row but no reserve row, a reserve row that is not the last row
    before the total, or a reserve that is not 10 % of the work hours (whole hours),
  - rows where hours times the hourly rate does not equal the price (with --rate); a
    table without a recognisable hours column is named as skipped,
  - several currencies in one offer, or a currency other than --currency,
  - leftover placeholders and internal remarks (TBD included),
  - mandatory statements that are missing (VAT, validity, due date, issue date,
    warranty, reserve line, operation variant C).
The output ends with the statements the script cannot judge: you verify those.

Exit code 1 when anything is reported.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

PLACEHOLDERS = re.compile(
    r"XXXX|TODO|TBD|placeholder|lorem ipsum|k diskuzi|\?\?\?|\[\s*\]", re.IGNORECASE
)
CURRENCIES = {"Kč": "CZK", "CZK": "CZK", "EUR": "EUR", "€": "EUR", "USD": "USD", "$": "USD", "GBP": "GBP", "£": "GBP"}
CURRENCY_UNIT = "|".join(re.escape(unit) for unit in CURRENCIES)
HOURS_UNIT = r"h|hrs?|hours?|hod\."
RATE_HEADER = re.compile(r"sazb|za hodin|per hour|hourly|\brate\b", re.IGNORECASE)
MONTHS_EN = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?"

# Statements the script cannot check; they are printed so the checklist is the output.
JUDGE_YOURSELF = (
    "client identification from public sources",
    "payment schedule",
    "who owns the source code",
    "what is out of scope",
    "assumptions",
    "operation variants A and B (the script checks only C)",
)

LANGUAGES = {
    "cs": {
        "total": "celkem",
        "hours": re.compile(r"hodin|rozsah|pracnost", re.IGNORECASE),
        "price": re.compile(r"\bcena|částka", re.IGNORECASE),
        "reserve": re.compile(r"rezerv", re.IGNORECASE),
        "thousands": " \u00a0\u202f",
        "mandatory": {
            "prices excl. VAT": re.compile(r"bez DPH"),
            "offer validity": re.compile(r"[Nn]abídka platí|[Pp]latnost nabídky"),
            "invoice due date": re.compile(r"[Ss]platnost"),
            "issue date": re.compile(r"\b\d{1,2}\. ?\d{1,2}\. ?20\d{2}\b"),
            "free repairs or warranty": re.compile(r"[Zz]áru|[Oo]pravy vad"),
            "reserve as a separate line": re.compile(r"[Rr]ezerva"),
            "operation run by the client (variant C)": re.compile(r"vlastní režii"),
        },
    },
    "en": {
        "total": "total",
        "hours": re.compile(r"hours|effort", re.IGNORECASE),
        "price": re.compile(r"\bprice|\bcost|\bamount", re.IGNORECASE),
        "reserve": re.compile(r"reserve|contingency", re.IGNORECASE),
        "thousands": " \u00a0\u202f,",
        "mandatory": {
            "prices excl. VAT": re.compile(r"(?:excl(?:uding|\.)?|exclusive of|without|net of) VAT", re.IGNORECASE),
            "offer validity": re.compile(r"offer (?:is )?valid|validity of (?:the |this )?offer", re.IGNORECASE),
            "invoice due date": re.compile(r"due date|due within|payable within|payment (?:is )?due", re.IGNORECASE),
            "issue date": re.compile(
                rf"\b\d{{1,2}}[./ ]\d{{1,2}}[./ ]20\d{{2}}\b|\b20\d{{2}}-\d{{2}}-\d{{2}}\b"
                rf"|\b\d{{1,2}} (?:{MONTHS_EN}) 20\d{{2}}\b|\b(?:{MONTHS_EN}) \d{{1,2}},? 20\d{{2}}\b"
            ),
            "free repairs or warranty": re.compile(r"warrant|free (?:of charge )?(?:repair|bug)", re.IGNORECASE),
            "reserve as a separate line": re.compile(r"reserve|contingency", re.IGNORECASE),
            "operation run by the client (variant C)": re.compile(
                r"(?:operated|run|hosted) by the client|client(?:'s)? own operation|operat\w+ (?:on|by) (?:their|its) own", re.IGNORECASE
            ),
        },
    },
}


def number_pattern(thousands: str) -> re.Pattern[str]:
    separators = re.escape(thousands)
    return re.compile(
        rf"^\**\s*(?:{CURRENCY_UNIT})?\s*(\d{{1,3}}(?:[{separators}]\d{{3}})+|\d+)\s*(?:{CURRENCY_UNIT}|{HOURS_UNIT})?\s*\**$"
    )


def cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def number(cell: str, pattern: re.Pattern[str]) -> int | None:
    match = pattern.match(cell)
    return int(re.sub(r"\D", "", match.group(1))) if match else None


def currency(cell: str) -> str | None:
    for unit, code in CURRENCIES.items():
        if re.search(rf"(?<![A-Za-z]){re.escape(unit)}(?![A-Za-z])", cell):
            return code
    return None


def tables(lines: list[str]):
    block: list[tuple[int, list[str]]] = []
    for index, line in enumerate(lines, 1):
        if line.lstrip().startswith("|"):
            block.append((index, cells(line)))
        elif block:
            yield block
            block = []
    if block:
        yield block


def hours_column(header: list[str], body: list[tuple[int, list[str]]], pack: dict, price_col: int | None,
                  pattern: re.Pattern[str]) -> int | None:
    """A header naming hours whose cells hold numbers, else a column whose cells all end in an hours unit."""
    for index, name in enumerate(header):
        if index == price_col or not pack["hours"].search(name) or RATE_HEADER.search(name):
            continue
        if any(index < len(row) and number(row[index], pattern) is not None for _, row in body):
            return index
    unit = re.compile(rf"^\**\s*[\d\u00a0\u202f ,]+\s*(?:{HOURS_UNIT})\s*\**$", re.IGNORECASE)
    for index in range(1, len(header)):
        values = [row[index] for _, row in body if index < len(row) and row[index]]
        if values and all(unit.match(value) for value in values):
            return index
    return None


def check(text: str, rate: int | None, lang: str, expected_currency: str | None) -> tuple[list[str], list[str]]:
    """Return (problems, notes). Notes are informational and do not fail the check."""
    pack = LANGUAGES[lang]
    pattern = number_pattern(pack["thousands"])
    lines = text.splitlines()
    problems: list[str] = []
    notes: list[str] = []
    found_currencies: set[str] = set()

    for block in tables(lines):
        header = block[0][1]
        rows = block[2:]
        total = next((r for r in rows if pack["total"] in r[1][0].lower()), None)
        body = rows[: rows.index(total)] if total else rows
        price_col = next((i for i, h in enumerate(header) if pack["price"].search(h)), None)
        hours_col = hours_column(header, body, pack, price_col, pattern)
        for _, row in rows:
            for value in row:
                code = currency(value)
                if code and number(value, pattern) is not None:
                    found_currencies.add(code)
        if total:
            for col in range(1, len(header)):
                expected = number(total[1][col], pattern) if col < len(total[1]) else None
                values = [number(r[1][col], pattern) for r in body if col < len(r[1])]
                if expected is None or not values or any(v is None for v in values):
                    continue
                if sum(values) != expected:
                    problems.append(
                        f"line {total[0]}: column '{header[col]}' total {expected}, rows sum to {sum(values)}"
                    )
        if total and hours_col is not None:
            reserve_rows = [r for r in body if pack["reserve"].search(r[1][0])]
            if not reserve_rows:
                problems.append(f"line {total[0]}: no reserve row before the total (10 % of the work hours)")
            else:
                reserve = reserve_rows[0]
                if reserve is not body[-1]:
                    problems.append(f"line {reserve[0]}: the reserve is not the last row before the total")
                work = sum(number(r[1][hours_col], pattern) or 0 for r in body if r not in reserve_rows and hours_col < len(r[1]))
                hours = number(reserve[1][hours_col], pattern) if hours_col < len(reserve[1]) else None
                if hours is None:
                    problems.append(f"line {reserve[0]}: the reserve hours are not a number")
                elif abs(hours - work * 0.1) > 0.5:
                    problems.append(
                        f"line {reserve[0]}: reserve {hours} h, 10 % of {work} work hours is {work * 0.1:.1f} h"
                    )
        if rate:
            if price_col is None or hours_col is None:
                if total:
                    notes.append(f"line {total[0]}: rate check skipped, no hours column or no price column")
                continue
            for line_no, row in rows:
                if max(hours_col, price_col) >= len(row):
                    continue
                hours, price = number(row[hours_col], pattern), number(row[price_col], pattern)
                if hours is not None and price is not None and hours * rate != price:
                    problems.append(f"line {line_no}: {hours} h x {rate} = {hours * rate}, stated {price}")

    if expected_currency and found_currencies - {expected_currency}:
        problems.append(f"currency: found {', '.join(sorted(found_currencies))}, expected {expected_currency}")
    elif not expected_currency and len(found_currencies) > 1:
        problems.append(f"currency: several currencies in one offer ({', '.join(sorted(found_currencies))})")
    for index, line in enumerate(lines, 1):
        found = PLACEHOLDERS.search(line)
        if found:
            problems.append(f"line {index}: leftover '{found.group(0)}'")
    for label, statement in pack["mandatory"].items():
        if not statement.search(text):
            problems.append(f"missing: {label}")
    return problems, notes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("offer", type=Path)
    parser.add_argument("--rate", type=int, help="hourly rate; checks hours x rate = price")
    parser.add_argument("--lang", choices=sorted(LANGUAGES), default="cs", help="language of the offer text (default cs)")
    parser.add_argument("--currency", type=str.upper, choices=sorted(set(CURRENCIES.values())), help="the one currency the offer uses")
    args = parser.parse_args()
    problems, notes = check(args.offer.read_text(encoding="utf-8"), args.rate, args.lang, args.currency)

    for problem in problems:
        print(problem)
    for note in notes:
        print(f"note: {note}")
    print(f"{len(problems)} problem(s) in {args.offer.name}")
    print("You verify: " + "; ".join(JUDGE_YOURSELF))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
