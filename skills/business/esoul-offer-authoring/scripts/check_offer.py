#!/usr/bin/env python3
"""Check an offer's Markdown source before rendering.

Usage: python3 check_offer.py OFFER.md [--rate 1300]

Standard library only, read-only. Reports:
  - price tables whose "Celkem" row does not equal the sum of the rows above it
    (every numeric column: hours, prices),
  - rows where hours times the hourly rate does not equal the price (with --rate),
  - leftover placeholders and internal remarks,
  - mandatory statements that are missing (VAT, validity, due date, date,
    reserve line, operation variant C).

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
MANDATORY = {
    "ceny bez DPH": re.compile(r"bez DPH"),
    "platnost nabídky": re.compile(r"[Nn]abídka platí|[Pp]latnost nabídky"),
    "splatnost faktur": re.compile(r"[Ss]platnost"),
    "datum vystavení": re.compile(r"\b\d{1,2}\. ?\d{1,2}\. ?20\d{2}\b"),
    "opravy vad nebo záruka": re.compile(r"[Zz]áru|[Oo]pravy vad"),
    "rezerva 10 % jako samostatná položka": re.compile(r"[Rr]ezerva"),
    "provoz ve vlastní režii (varianta C)": re.compile(r"vlastní režii"),
}
NUMBER = re.compile(r"^\**\s*(\d[\d  ]*)(?:\s*(?:Kč|h|EUR))?\s*\**$")


def cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def number(cell: str) -> int | None:
    match = NUMBER.match(cell.replace(" ", " "))
    return int(re.sub(r"\D", "", match.group(1))) if match else None


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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("offer", type=Path)
    parser.add_argument("--rate", type=int, help="hourly rate; checks hours x rate = price")
    args = parser.parse_args()
    text = args.offer.read_text(encoding="utf-8")
    lines = text.splitlines()
    problems: list[str] = []

    for block in tables(lines):
        header = block[0][1]
        rows = [r for r in block[2:]]
        total = next((r for r in rows if "celkem" in r[1][0].lower()), None)
        hours_col = next((i for i, h in enumerate(header) if "hodin" in h.lower()), None)
        price_col = next((i for i, h in enumerate(header) if h.lower().startswith("cena")), None)
        body = rows[: rows.index(total)] if total else rows
        if total:
            for col in range(1, len(header)):
                expected = number(total[1][col]) if col < len(total[1]) else None
                values = [number(r[1][col]) for r in body if col < len(r[1])]
                if expected is None or not values or any(v is None for v in values):
                    continue
                if sum(values) != expected:
                    problems.append(
                        f"line {total[0]}: column '{header[col]}' total {expected}, rows sum to {sum(values)}"
                    )
        if args.rate and hours_col is not None and price_col is not None:
            for line_no, row in rows:
                if max(hours_col, price_col) >= len(row):
                    continue
                hours, price = number(row[hours_col]), number(row[price_col])
                if hours is not None and price is not None and hours * args.rate != price:
                    problems.append(
                        f"line {line_no}: {hours} h x {args.rate} = {hours * args.rate}, stated {price}"
                    )

    for index, line in enumerate(lines, 1):
        found = PLACEHOLDERS.search(line)
        if found:
            problems.append(f"line {index}: leftover '{found.group(0)}'")
    for label, pattern in MANDATORY.items():
        if not pattern.search(text):
            problems.append(f"missing: {label}")

    for problem in problems:
        print(problem)
    print(f"{len(problems)} problem(s) in {args.offer.name}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
