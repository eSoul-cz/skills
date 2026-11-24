#!/usr/bin/env python3
"""Render a Markdown file into the eSoul Word template.

Usage: python3 md_to_docx.py INPUT.md OUTPUT.docx [--template TEMPLATE.docx] [--lang cs|en]

The template defaults to ../assets/templates/esoul-document.docx. --lang (default cs) sets the
callout labels and the proofing language of the text; the template itself is language-neutral
apart from its footer (company name, IČ, DIČ).

Standard library only. The template supplies fonts, styles, headers, footers
and page setup; this script replaces the document body.

Markdown subset:
  #        document title (template style Title)
  ##       Heading 1          ###  Heading 2          ####  Heading 3
  paragraphs, **bold**, *italic*, `code`
  - item   bullet list        1. item   numbered list
  | a | b |                   table with a dark header row
  | | |                       header row of empty cells: borderless key-value table
  > [!NOTE] ...               callout box
  <!-- pagebreak -->          page break
  <!-- spacer N -->           N empty lines (cover page layout)
"""
from __future__ import annotations

import argparse
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

DEFAULT_TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "templates" / "esoul-document.docx"
TEXT_WIDTH = 9000  # dxa, A4 with the template's 1 inch margins
HEAD_FILL = "1b1b1d"
BORDER = "bebebe"
TABLE_FONT_SIZE = 20  # half-points
HEADINGS = {1: "Title", 2: "Heading1", 3: "Heading2", 4: "Heading3"}
LANGUAGES = {
    "cs": {  # the template's own language: no run-level language override
        "tag": None,
        "callouts": {"NOTE": "Poznámka", "TIP": "Tip", "IMPORTANT": "Důležité", "WARNING": "Upozornění", "CAUTION": "Pozor"},
    },
    "en": {
        "tag": "en-GB",
        "callouts": {"NOTE": "Note", "TIP": "Tip", "IMPORTANT": "Important", "WARNING": "Warning", "CAUTION": "Caution"},
    },
}
language = LANGUAGES["cs"]  # replaced by main()
NBSP = " "


def typography(text: str) -> str:
    """Keep numbers and their units on one line."""
    text = re.sub(r"(?<=\d) (?=\d{3}\b)", NBSP, text)
    text = re.sub(r"(?<=\d) (?=(Kč|CZK|EUR|USD|GBP|h|%)\b)", NBSP, text)
    return text


INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|(?<![\*\w])\*[^\*\s][^\*]*?\*(?![\*\w]))")


def runs(text: str, size: int | None = None, color: str | None = None, bold: bool = False) -> str:
    out = []
    for part in INLINE.split(typography(text)):
        if not part:
            continue
        props = []
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            part, is_bold, italic, code = part[2:-2], True, False, False
        elif part.startswith("`") and part.endswith("`") and len(part) > 2:
            part, is_bold, italic, code = part[1:-1], bold, False, True
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            part, is_bold, italic, code = part[1:-1], bold, True, False
        else:
            is_bold, italic, code = bold, False, False
        if code:
            props.append('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>')
        if is_bold:
            props.append("<w:b/><w:bCs/>")
        if italic:
            props.append("<w:i/><w:iCs/>")
        if color:
            props.append(f'<w:color w:val="{color}"/>')
        if size:
            props.append(f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>')
        if language["tag"]:
            props.append(f'<w:lang w:val="{language["tag"]}"/>')
        rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
        out.append(f'<w:r>{rpr}<w:t xml:space="preserve">{escape(part)}</w:t></w:r>')
    return "".join(out)


def paragraph(text: str = "", style: str | None = None, ppr: str = "", **run_args) -> str:
    style_xml = f'<w:pStyle w:val="{style}"/>' if style else ""
    ppr_xml = f"<w:pPr>{style_xml}{ppr}</w:pPr>" if (style_xml or ppr) else ""
    return f"<w:p>{ppr_xml}{runs(text, **run_args) if text else ''}</w:p>"


def cell(text: str, width: int, *, header: bool = False, plain: bool = False, fill: str | None = None,
         borders: str = "") -> str:
    shade = HEAD_FILL if header else fill
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>' if shade else ""
    mar = ('<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>'
           '<w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>')
    tcpr = f'<w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{borders}{shd}{mar}<w:vAlign w:val="top"/></w:tcPr>'
    ppr = '<w:spacing w:before="0" w:after="0"/><w:jc w:val="left"/>'
    size = None if plain else TABLE_FONT_SIZE
    body = paragraph(text, ppr=ppr, size=size, color="ffffff" if header else None) if text else f"<w:p><w:pPr>{ppr}</w:pPr></w:p>"
    return f"<w:tc>{tcpr}{body}</w:tc>"


def column_widths(rows: list[list[str]]) -> list[int]:
    """Share the text width by content length, never narrower than the longest word."""
    count = max(len(r) for r in rows)
    weights, floors = [], []
    for i in range(count):
        cells = [re.sub(r"[*`]", "", r[i]) for r in rows if i < len(r)]
        longest = max((len(c) for c in cells), default=0)
        word = max((len(w) for c in cells for w in typography(c).split(" ")), default=0)
        weights.append(min(max(longest, 9), 60))
        floors.append(min(word * 125 + 260, TEXT_WIDTH // 2))
    spare = TEXT_WIDTH - sum(floors)
    if spare <= 0:
        return [TEXT_WIDTH // count] * count
    wanted = [TEXT_WIDTH * w / sum(weights) for w in weights]
    extra = [max(w - f, 0) for w, f in zip(wanted, floors)]
    scale = spare / sum(extra) if sum(extra) else 0
    widths = [int(f + e * scale) for f, e in zip(floors, extra)]
    widths[widths.index(max(widths))] += TEXT_WIDTH - sum(widths)
    return widths


def table(rows: list[list[str]], keyvalue: bool) -> str:
    count = max(len(r) for r in rows)
    rows = [r + [""] * (count - len(r)) for r in rows]
    if keyvalue:
        widths = [2970, 6030] if count == 2 else column_widths(rows)
        style, borders = "Table1", ""
    else:
        widths = column_widths(rows)
        style = "Table3"
        edge = "".join(f'<w:{side} w:val="single" w:sz="4" w:space="0" w:color="{BORDER}"/>'
                       for side in ("top", "left", "bottom", "right", "insideH", "insideV"))
        borders = f"<w:tblBorders>{edge}</w:tblBorders>"
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [f'<w:tbl><w:tblPr><w:tblStyle w:val="{style}"/><w:tblW w:w="{sum(widths)}" w:type="dxa"/>'
           f'<w:jc w:val="left"/>{borders}<w:tblLayout w:type="fixed"/><w:tblLook w:val="0600"/></w:tblPr>'
           f"<w:tblGrid>{grid}</w:tblGrid>"]
    for index, row in enumerate(rows):
        header = index == 0 and not keyvalue
        trpr = "<w:trPr><w:cantSplit/>" + ("<w:tblHeader/>" if header else "") + "</w:trPr>"
        cells = "".join(cell(text, widths[i], header=header, plain=keyvalue) for i, text in enumerate(row))
        out.append(f"<w:tr>{trpr}{cells}</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


def callout(kind: str, text: str) -> str:
    label = language["callouts"].get(kind.upper(), kind.capitalize())
    nil = "".join(f'<w:{s} w:val="nil"/>' for s in ("top", "bottom", "right"))
    borders = f'<w:tcBorders>{nil}<w:left w:val="single" w:sz="24" w:space="0" w:color="{HEAD_FILL}"/></w:tcBorders>'
    return (f'<w:tbl><w:tblPr><w:tblStyle w:val="Table1"/><w:tblW w:w="{TEXT_WIDTH}" w:type="dxa"/>'
            f'<w:tblLayout w:type="fixed"/><w:tblLook w:val="0600"/></w:tblPr>'
            f'<w:tblGrid><w:gridCol w:w="{TEXT_WIDTH}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>'
            f'{cell(f"**{label}:** {text}", TEXT_WIDTH, fill="f4f4f4", borders=borders)}</w:tr></w:tbl>')


class Numbering:
    BULLET, DECIMAL = 9001, 9002

    def __init__(self) -> None:
        self.nums: list[tuple[int, int]] = []
        self.next_id = 9001

    def new(self, abstract: int) -> int:
        num_id = self.next_id
        self.next_id += 1
        self.nums.append((num_id, abstract))
        return num_id

    def apply(self, xml: str) -> str:
        def level(fmt: str, text: str) -> str:
            return (f'<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="{fmt}"/><w:lvlText w:val="{text}"/>'
                    '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>')
        abstracts = (f'<w:abstractNum w:abstractNumId="{self.BULLET}"><w:multiLevelType w:val="singleLevel"/>'
                     f'{level("bullet", "•")}</w:abstractNum>'
                     f'<w:abstractNum w:abstractNumId="{self.DECIMAL}"><w:multiLevelType w:val="singleLevel"/>'
                     f'{level("decimal", "%1.")}</w:abstractNum>')
        nums = "".join(
            f'<w:num w:numId="{n}"><w:abstractNumId w:val="{a}"/>'
            f'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>'
            for n, a in self.nums)
        if re.search(r"<w:numbering\b[^>]*/>\s*$", xml):
            return re.sub(r"/>\s*$", ">", xml) + abstracts + nums + "</w:numbering>"
        first_num = re.search(r"<w:num\b", xml)
        if first_num:
            xml = xml[:first_num.start()] + abstracts + xml[first_num.start():]
        else:
            xml = xml.replace("</w:numbering>", abstracts + "</w:numbering>")
        return xml.replace("</w:numbering>", nums + "</w:numbering>")


def split_row(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def convert(markdown: str, numbering: Numbering) -> str:
    lines = markdown.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    last_was_table = False
    i = 0

    def emit(xml: str, is_table: bool = False) -> None:
        nonlocal last_was_table
        if is_table and last_was_table:
            out.append('<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>')
        out.append(xml)
        last_was_table = is_table

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        if stripped == "<!-- pagebreak -->":
            emit('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
            i += 1
            continue
        spacer = re.fullmatch(r"<!-- spacer (\d+) -->", stripped)
        if spacer:
            for _ in range(int(spacer.group(1))):
                emit("<w:p/>")
            i += 1
            continue
        heading = re.match(r"(#{1,4}) +(.*)", stripped)
        if heading:
            emit(paragraph(heading.group(2), style=HEADINGS[len(heading.group(1))], ppr='<w:jc w:val="left"/>'))
            i += 1
            continue
        if stripped.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                row = split_row(lines[i])
                if not all(re.fullmatch(r":?-{3,}:?", c) for c in row):
                    rows.append(row)
                i += 1
            keyvalue = not any(rows[0])
            emit(table(rows[1:] if keyvalue else rows, keyvalue), is_table=True)
            continue
        if stripped.startswith(">"):
            block = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                block.append(lines[i].strip()[1:].strip())
                i += 1
            text = " ".join(b for b in block if b)
            kind = re.match(r"\[!(\w+)\]\s*", text)
            emit(callout(kind.group(1) if kind else "NOTE", text[kind.end():] if kind else text), is_table=True)
            continue
        bullet = re.match(r"[-*] +(.*)", stripped)
        ordered = re.match(r"\d+\. +(.*)", stripped)
        if bullet or ordered:
            pattern = r"[-*] +(.*)" if bullet else r"\d+\. +(.*)"
            num_id = numbering.new(Numbering.BULLET if bullet else Numbering.DECIMAL)
            while i < len(lines) and re.match(pattern, lines[i].strip()):
                item = re.match(pattern, lines[i].strip()).group(1)
                ppr = (f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num_id}"/></w:numPr>'
                       '<w:spacing w:before="60" w:after="60"/><w:jc w:val="left"/>')
                emit(paragraph(item, ppr=ppr))
                i += 1
            continue
        block = [stripped]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"(#{1,4} |\||>|[-*] |\d+\. |<!--)", lines[i].strip()):
            block.append(lines[i].strip())
            i += 1
        emit(paragraph(" ".join(block)))
    return "".join(out)


def main(template: str, source: str, target: str, lang: str = "cs") -> None:
    global language
    language = LANGUAGES[lang]
    numbering = Numbering()
    with open(source, encoding="utf-8") as handle:
        body = convert(handle.read(), numbering)
    with zipfile.ZipFile(template) as src, zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            if info.is_dir():
                continue
            data = src.read(info.filename)
            if info.filename == "word/document.xml":
                xml = data.decode("utf-8")
                start = xml.index("<w:body>") + len("<w:body>")
                section = xml.rindex("<w:sectPr")
                data = (xml[:start] + body + xml[section:]).encode("utf-8")
            elif info.filename == "word/numbering.xml":
                data = numbering.apply(data.decode("utf-8")).encode("utf-8")
            dst.writestr(info.filename, data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Render Markdown into the eSoul Word template.")
    parser.add_argument("source", help="input Markdown file")
    parser.add_argument("target", help="output DOCX file")
    parser.add_argument("--template", default=str(DEFAULT_TEMPLATE), help="DOCX template (default: bundled eSoul template)")
    parser.add_argument("--lang", choices=sorted(LANGUAGES), default="cs", help="language of the text (default: cs)")
    args = parser.parse_args()
    main(args.template, args.source, args.target, args.lang)
