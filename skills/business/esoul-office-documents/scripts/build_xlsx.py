#!/usr/bin/env python3
"""Fill the eSoul Excel template from a JSON description.

Usage: python3 build_xlsx.py INPUT.json OUTPUT.xlsx [--template TEMPLATE.xlsx] [--lang cs|en] [--currency CZK]

Standard library only. The template (default ../assets/templates/esoul-spreadsheet.xlsx)
keeps its styles, logo, column widths and fonts; the sample content and the sample chart
are replaced. JSON:

  {
    "zhotovitel":   {"firma": "...", "ic": "...", "dic": "...", "osoba": "...", "email": "...", "datum": "..."},
    "objednavatel": {"firma": "...", "ic": "...", "dic": "...", "osoba": "...", "email": "...", "datum": "..."},
    "title": "Kalkulace ceny", "subtitle": "Verze 1.0",
    "widths": [40, 14, 14, 18],                     (optional column widths)
    "tables": [{
      "caption": "Cenová kalkulace",
      "columns": [{"name": "Položka"},
                  {"name": "Hodiny", "type": "number"},
                  {"name": "Sazba", "type": "money"},
                  {"name": "Cena", "type": "money"}],
      "rows": [["Analýza", 8, 1500, "=B{r}*C{r}"]],
      "total_label": "Celkem",
      "totals": {"Hodiny": "sum", "Cena": "sum"},   ("sum" or a formula)
      "note": "Ceny jsou bez DPH."
    }]
  }

Column types: text (default), integer, number (2 decimals), money (the currency), percent
(value 0.21 shows 21,00 %). A string starting with "=" is a formula; {r} is the row
number, {first} and {last} the first and last data row of the table. The "datum" of a
party is appended to the signature line "Datum:" on the sheet Údaje. All keys are optional.

Language and currency: --lang (default cs) or the key "lang" translates the party labels, the
sheet names and the table names of the template to English; --currency (default CZK) or the key
"currency" sets the money format to the ISO code (CZK, EUR, USD and GBP get their symbol). The
flag wins over the key. "supplier" and "client" are accepted for "zhotovitel" and "objednavatel".
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from math import ceil
from pathlib import Path
from xml.sax.saxutils import escape

DEFAULT_TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "templates" / "esoul-spreadsheet.xlsx"
TEMPLATE_STRINGS = 9  # shared strings 0-8 (party labels, logo link text) stay as they are
PARTY_FIELDS = ["firma", "ic", "dic", "osoba", "email"]  # rows 7-11
BASE_WIDTHS = [52.38, 37.75, 20.38, 16.0, 19.13]
ROW_HEIGHT = 22.5
STYLE_TEXT, STYLE_TITLE, STYLE_CAPTION, STYLE_HEADER, STYLE_MONEY, STYLE_PERCENT = 16, 12, 13, 14, 20, 22
COLUMN_STYLE = {"text": (STYLE_TEXT, 36), "integer": (33, 38), "number": (34, 39), "money": (STYLE_MONEY, 37), "percent": (STYLE_PERCENT, 40)}
PARTIES = (("zhotovitel", "supplier", "B", "A15"), ("objednavatel", "client", "E", "D15"))
# The template is Czech. "labels" replace shared strings 0-7 (party labels), "sheets" rename the two sheets.
LANGUAGES = {
    "cs": {"labels": None, "date": "Datum:", "sheets": {}, "table": "Tabulka"},
    "en": {
        "labels": ["Supplier", "Client", "Company:", "Company ID:", "VAT ID:", "Contact person:", "E-mail:", "Date:"],
        "date": "Date:",
        "sheets": {"Údaje": "Details", "Projekt": "Project"},
        "table": "Table",
    },
}
TEMPLATE_CURRENCY = "[$Kč-405]"  # number format 164 (money) of the template
CURRENCY_FORMATS = {"CZK": TEMPLATE_CURRENCY, "EUR": "[$€-2]", "USD": "[$$-409]", "GBP": "[$£-809]"}


def col_letter(index: int) -> str:
    """0 -> A, 26 -> AA."""
    out = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        out = chr(65 + rem) + out
    return out


class Strings:
    def __init__(self, xml: str, labels: list[str] | None = None):
        items = re.findall(r"<si>.*?</si>", xml, re.S)
        self.items = items[:TEMPLATE_STRINGS]
        for index, label in enumerate(labels or []):
            self.items[index] = f"<si><t>{escape(label)}</t></si>"
        self.index: dict[str, int] = {}

    def add(self, text: str) -> int:
        if text not in self.index:
            self.index[text] = len(self.items)
            self.items.append(f'<si><t xml:space="preserve">{escape(text)}</t></si>')
        return self.index[text]

    def xml(self) -> str:
        n = len(self.items)
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{n}" uniqueCount="{n}">'
                + "".join(self.items) + "</sst>")


def extend_styles(xml: str) -> str:
    """Append 8 cell formats (ids 33-40): numbers, centred subtitle and bold gold total cells."""
    xml = xml.replace('<fonts count="9">', '<fonts count="10">')
    xml = xml.replace("</fonts>", '<font><b/><sz val="12.0"/><color rgb="FF1B1B1D"/><name val="Roboto"/></font></fonts>')
    align = '<alignment shrinkToFit="0" vertical="center" wrapText="0"/>'

    def xf(num: int, font: int = 5, fill: int = 0, extra: str = "") -> str:
        apply = ' applyFill="1"' if fill else ""
        return (f'<xf borderId="0" fillId="{fill}" fontId="{font}" numFmtId="{num}" xfId="0" applyAlignment="1"'
                f' applyFont="1" applyNumberFormat="1"{apply}>{extra or align}</xf>')
    new = [
        xf(3),                       # 33 integer
        xf(4),                       # 34 number, 2 decimals
        xf(0, extra='<alignment horizontal="center" vertical="center"/>'),   # 35 subtitle
        xf(0, 9, 2),                 # 36 total text
        xf(164, 9, 2),               # 37 total money
        xf(3, 9, 2),                 # 38 total integer
        xf(4, 9, 2),                 # 39 total number
        xf(10, 9, 2),                # 40 total percent
    ]
    xml = re.sub(r'<cellXfs count="(\d+)">', lambda m: f'<cellXfs count="{int(m.group(1)) + len(new)}">', xml)
    return xml.replace("</cellXfs>", "".join(new) + "</cellXfs>")


def evaluate(formula: str, values: dict[str, float]):
    """Cached value for simple formulas (+ - * / parentheses, cell refs, SUM of a range); else None."""
    def cell(ref: str) -> float:
        return values[ref]

    def total(match: re.Match) -> str:
        col1, row1, col2, row2 = match.group(1), int(match.group(2)), match.group(3), int(match.group(4))
        if col1 != col2:
            raise KeyError(match.group(0))
        return repr(sum(values.get(f"{col1}{r}", 0) for r in range(row1, row2 + 1)))
    try:
        expr = re.sub(r"SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)", total, formula[1:])
        expr = re.sub(r"\b([A-Z]+\d+)\b", lambda m: repr(cell(m.group(1))), expr)
        if not re.fullmatch(r"[\d\s.+\-*/()e]+", expr):
            return None
        return eval(expr, {"__builtins__": {}})  # noqa: S307 - expression restricted by the regex above
    except (KeyError, SyntaxError, ZeroDivisionError, TypeError):
        return None


class Sheet:
    """Rows of the sheet Projekt built from the JSON."""

    def __init__(self, strings: Strings, ncols: int):
        self.strings, self.ncols = strings, ncols
        self.rows: list[str] = []
        self.merges: list[str] = []
        self.tables: list[tuple[str, list[str]]] = []  # (ref, column names)
        self.values: dict[str, float] = {}
        self.row = 4

    def text_cell(self, ref: str, text: str, style: int) -> str:
        return f'<c r="{ref}" s="{style}" t="s"><v>{self.strings.add(text)}</v></c>'

    def emit(self, cells: str, height: float | None = ROW_HEIGHT) -> None:
        ht = f' ht="{height}" customHeight="1"' if height else ""
        self.rows.append(f'<row r="{self.row}"{ht}>{cells}</row>')
        self.row += 1

    def blank(self, count: int = 1) -> None:
        self.row += count

    def title(self, title: str | None, subtitle: str | None) -> None:
        last = col_letter(max(self.ncols, 5) - 1)
        self.row = 5
        if title:
            self.emit(self.text_cell("A5", title, STYLE_TITLE), height=28)
            self.merges.append(f"A5:{last}5")
        if subtitle:
            self.emit(self.text_cell("A6", subtitle, 35))
            self.merges.append(f"A6:{last}6")
        self.row = 8

    def table(self, spec: dict, widths: list[float]) -> None:
        columns = spec["columns"]
        n = len(columns)
        names: list[str] = []
        for col in columns:  # table header cells must be unique
            name, k = col["name"], 2
            while name in names:
                name, k = f'{col["name"]} {k}', k + 1
            names.append(name)
        if spec.get("caption"):
            self.emit(self.text_cell(f"A{self.row}", spec["caption"], STYLE_CAPTION), height=28)
        head = self.row
        self.emit("".join(self.text_cell(f"{col_letter(i)}{head}", names[i], STYLE_HEADER) for i in range(n)))
        first = self.row
        data = spec.get("rows", [])
        last = first + len(data) - 1
        for values in data:
            cells, lines = "", 1
            for i, (col, value) in enumerate(zip(columns, values)):
                ref, kind = f"{col_letter(i)}{self.row}", col.get("type", "text")
                style = COLUMN_STYLE[kind][0]
                out: list[str] = []
                lines = max(lines, self.fill_cell(out, ref, value, kind, style, first, last, widths[i]))
                cells += out[0]
            self.emit(cells, height=max(ROW_HEIGHT, 16 * lines + 6))
        if data:
            self.tables.append((f"A{head}:{col_letter(n - 1)}{last}", names))
        totals = spec.get("totals")
        if totals:
            cells = ""
            for i, col in enumerate(columns):
                ref, kind = f"{col_letter(i)}{self.row}", col.get("type", "text")
                style = COLUMN_STYLE[kind][1]
                value = totals.get(col["name"])
                if value == "sum":
                    value = f"=SUM({col_letter(i)}{first}:{col_letter(i)}{last})"
                if value is None:
                    value = spec.get("total_label", "") if i == 0 else None
                if value is None:
                    cells += f'<c r="{ref}" s="{style}"/>'
                else:
                    out: list[str] = []
                    self.fill_cell(out, ref, value, kind, style, first, last, widths[i])
                    cells += out[0]
            self.emit(cells)
        if spec.get("note"):
            ref = f"A{self.row}"
            lines = ceil(len(spec["note"]) / (sum(widths[:self.ncols]) * 1.0))
            self.emit(self.text_cell(ref, spec["note"], STYLE_TEXT), height=max(ROW_HEIGHT, 16 * lines + 6))
            self.merges.append(f"A{self.row - 1}:{col_letter(self.ncols - 1)}{self.row - 1}")
        self.blank(2)

    def fill_cell(self, out: list, ref: str, value, kind: str, style: int, first: int, last: int, width: float) -> int:
        """Append the cell XML to out; return how many text lines the cell needs."""
        if value is None or value == "":
            out.append(f'<c r="{ref}" s="{style}"/>')
            return 1
        if isinstance(value, str) and value.startswith("="):
            formula = value[1:].format(r=self.row, first=first, last=last)
            result = evaluate("=" + formula, self.values)
            cached = "" if result is None else f"<v>{result!r}</v>"
            if result is not None:
                self.values[ref] = result
            out.append(f'<c r="{ref}" s="{style}"><f>{escape(formula)}</f>{cached}</c>')
            return 1
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            self.values[ref] = value
            out.append(f'<c r="{ref}" s="{style}"><v>{value!r}</v></c>')
            return 1
        out.append(self.text_cell(ref, str(value), style))
        return ceil(len(str(value)) / max(width * 1.05, 1)) if kind == "text" else 1


def build_sheet2(xml: str, strings: Strings, spec: dict, widths: list[float]) -> tuple[str, list[tuple[str, list[str]]]]:
    ncols = len(widths)
    sheet = Sheet(strings, ncols)
    sheet.title(spec.get("title"), spec.get("subtitle"))
    for table in spec.get("tables", []):
        sheet.table(table, widths)
    head = xml[: xml.index("<sheetData>") + len("<sheetData>")]
    top = re.search(r'<row r="1".*?(?=<row r="4")', xml, re.S).group(0)  # logo and link rows stay
    head = re.sub(r"<cols>.*?</cols>", "<cols>" + "".join(
        f'<col customWidth="1" min="{i + 1}" max="{i + 1}" width="{w}"/>' for i, w in enumerate(widths)) + "</cols>", head, flags=re.S)
    head = head.replace('<outlinePr summaryBelow="0" summaryRight="0"/>', '<outlinePr summaryBelow="0" summaryRight="0"/><pageSetUpPr fitToPage="1"/>')
    merges = ["A1:D3", "E1:E3"] + sheet.merges
    tail = (f'</sheetData><mergeCells count="{len(merges)}">' + "".join(f'<mergeCell ref="{m}"/>' for m in merges) + "</mergeCells>"
            '<hyperlinks><hyperlink r:id="rId1" ref="E1"/></hyperlinks>'
            '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
            '<pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/>'
            '<drawing r:id="rId2"/>')
    if sheet.tables:
        tail += f'<tableParts count="{len(sheet.tables)}">' + "".join(f'<tablePart r:id="rId{10 + i}"/>' for i in range(len(sheet.tables))) + "</tableParts>"
    return head + top + "".join(sheet.rows) + tail + "</worksheet>", sheet.tables


def build_sheet1(xml: str, strings: Strings, spec: dict, date_label: str) -> str:
    def put(ref: str, text: str) -> None:
        nonlocal xml
        xml, count = re.subn(rf'<c r="{ref}" s="(\d+)"/>', lambda m: f'<c r="{ref}" s="{m.group(1)}" t="s"><v>{strings.add(text)}</v></c>', xml, count=1)
        if not count:
            sys.exit(f"template cell {ref} not found")
    for zhotovitel, supplier, col, _ in PARTIES:
        data = spec.get(zhotovitel) or spec.get(supplier) or {}
        for offset, field in enumerate(PARTY_FIELDS):
            if data.get(field):
                put(f"{col}{7 + offset}", str(data[field]))
    for zhotovitel, supplier, _, ref in PARTIES:
        date = (spec.get(zhotovitel) or spec.get(supplier) or {}).get("datum")
        if date:
            xml = re.sub(rf'<c r="{ref}" s="(\d+)"(?: t="s")?(?:/>|>.*?</c>)', f'<c r="{ref}" s="8" t="s"><v>{strings.add(f"{date_label} {date}")}</v></c>', xml, count=1)
    return xml


def table_xml(index: int, ref: str, names: list[str], prefix: str) -> str:
    cols = "".join(f'<tableColumn name="{escape(n, {chr(34): "&quot;"})}" id="{i + 1}"/>' for i, n in enumerate(names))
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            f'ref="{ref}" displayName="{prefix}{index}" name="{prefix}{index}" id="{index}">'
            f'<tableColumns count="{len(names)}">{cols}</tableColumns>'
            '<tableStyleInfo name="Projekt-style 2" showColumnStripes="0" showFirstColumn="1" showLastColumn="0" showRowStripes="1"/></table>')


def main(template: str, source: str, target: str, lang: str | None = None, currency: str | None = None) -> None:
    with open(source, encoding="utf-8") as handle:
        spec = json.load(handle)
    language = LANGUAGES[lang or spec.get("lang") or "cs"]
    currency = (currency or spec.get("currency") or "CZK").upper()
    if not re.fullmatch(r"[A-Z]{3}", currency):
        sys.exit(f"currency must be an ISO 4217 code such as CZK or EUR, got {currency!r}")
    ncols = max([5] + [len(t["columns"]) for t in spec.get("tables", [])])
    widths = list(spec.get("widths") or [])
    widths += (BASE_WIDTHS + [16.0] * ncols)[len(widths):ncols]
    with zipfile.ZipFile(template) as src:
        strings = Strings(src.read("xl/sharedStrings.xml").decode("utf-8"), language["labels"])
        parts = {i.filename: src.read(i.filename) for i in src.infolist() if not i.is_dir()}
    text = lambda name: parts[name].decode("utf-8")
    parts["xl/worksheets/sheet1.xml"] = build_sheet1(text("xl/worksheets/sheet1.xml"), strings, spec, language["date"]).encode()
    sheet2, tables = build_sheet2(text("xl/worksheets/sheet2.xml"), strings, spec, widths)
    parts["xl/worksheets/sheet2.xml"] = sheet2.encode()
    parts["xl/sharedStrings.xml"] = strings.xml().encode()
    styles = extend_styles(text("xl/styles.xml")).replace(TEMPLATE_CURRENCY, CURRENCY_FORMATS.get(currency, f"[${currency}]"))
    parts["xl/styles.xml"] = styles.encode()
    # sample chart out (it reads the sample table), logo drawing stays
    drawing = re.sub(r"<xdr:oneCellAnchor>(?:(?!</xdr:oneCellAnchor>).)*?<xdr:graphicFrame>.*?</xdr:oneCellAnchor>", "", text("xl/drawings/drawing2.xml"), flags=re.S)
    parts["xl/drawings/drawing2.xml"] = drawing.encode()
    parts["xl/drawings/_rels/drawing2.xml.rels"] = re.sub(r'<Relationship Id="rId1"[^>]*chart[^>]*/>', "", text("xl/drawings/_rels/drawing2.xml.rels")).encode()
    del parts["xl/charts/chart1.xml"]
    types = re.sub(r'<Override[^>]*PartName="/xl/(?:charts/chart1|tables/table\d)\.xml"/>', "", text("[Content_Types].xml"))
    rels = re.sub(r'<Relationship Id="rId[56]"[^>]*table[^>]*/>', "", text("xl/worksheets/_rels/sheet2.xml.rels"))
    for name in [n for n in parts if n.startswith("xl/tables/")]:
        del parts[name]
    for i, (ref, names) in enumerate(tables, 1):
        parts[f"xl/tables/table{i}.xml"] = table_xml(i, ref, names, language["table"]).encode()
        types = types.replace("</Types>", f'<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml" PartName="/xl/tables/table{i}.xml"/></Types>')
        rels = rels.replace("</Relationships>", f'<Relationship Id="rId{9 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table{i}.xml"/></Relationships>')
    parts["[Content_Types].xml"] = types.encode()
    parts["xl/worksheets/_rels/sheet2.xml.rels"] = rels.encode()
    workbook = text("xl/workbook.xml").replace("<calcPr/>", '<calcPr fullCalcOnLoad="1"/>')
    for czech, translated in language["sheets"].items():
        workbook = workbook.replace(f'name="{czech}"', f'name="{translated}"')
    parts["xl/workbook.xml"] = workbook.encode()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as dst:
        dst.writestr("[Content_Types].xml", parts.pop("[Content_Types].xml"))
        for name, data in parts.items():
            dst.writestr(name, data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fill the eSoul Excel template from JSON.")
    parser.add_argument("source", help="JSON description")
    parser.add_argument("target", help="output XLSX")
    parser.add_argument("--template", default=str(DEFAULT_TEMPLATE))
    parser.add_argument("--lang", choices=sorted(LANGUAGES), help="language of the template labels (default: the key lang or cs)")
    parser.add_argument("--currency", help="ISO 4217 code of the money columns (default: the key currency or CZK)")
    args = parser.parse_args()
    main(args.template, args.source, args.target, args.lang, args.currency)
