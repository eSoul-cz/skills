#!/usr/bin/env python3
"""Build an eSoul PowerPoint deck from a JSON outline.

Usage: python3 build_pptx.py OUTLINE.json OUTPUT.pptx [--template TEMPLATE.pptx] [--lang cs|en]

Needs python-pptx in a virtual environment (setup: SKILL.md, versions: requirements.txt).

The template (default ../assets/templates/esoul-presentation.pptx) supplies master,
fonts, logo and footer. Its sample slides are removed; slides are created from
the template layouts. Outline:

  {"slides": [
    {"layout": "title", "title": "Offer", "subtitle": "Prepared for Client, 2026"},
    {"layout": "section", "title": "Scope"},
    {"layout": "content", "title": "Deliverables", "bullets": ["A", "  sub-point", "B"]},
    {"layout": "two-column", "title": "Now vs. later", "left": ["A"], "right": ["B"]},
    {"layout": "big-number", "title": "120 h", "text": "estimated effort"},
    {"layout": "closing", "title": "Thank you", "subtitle": "info@esoul.cz"}
  ]}

Layouts: see references/presentation-layouts.md. Bullet lines indented by two
spaces per level become sub-bullets. "notes" (optional, any slide) sets speaker notes.
--lang (default cs) or the outline key "lang" sets the proofing language of all text; the
template has no language-dependent text, and amounts or currencies are written in the text.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

try:
    from pptx import Presentation
    from pptx.enum.lang import MSO_LANGUAGE_ID
    from pptx.oxml.ns import qn
except ImportError:
    sys.exit(
        "python-pptx is missing. Install it into a virtual environment:\n"
        "  python3 -m venv ~/.cache/esoul-office-documents\n"
        f"  ~/.cache/esoul-office-documents/bin/pip install -r {Path(__file__).with_name('requirements.txt')}\n"
        "and run this script with ~/.cache/esoul-office-documents/bin/python"
    )

DEFAULT_TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "templates" / "esoul-presentation.pptx"
LANGUAGES = {"cs": None, "en": MSO_LANGUAGE_ID.ENGLISH_UK}  # cs is the template's language: nothing to set

# name -> (layout name, {outline key: placeholder idx})
LAYOUTS = {
    "title": ("TITLE", {"title": 0, "subtitle": 1}),
    "closing": ("TITLE", {"title": 0, "subtitle": 1}),
    "section": ("SECTION_HEADER", {"title": 0}),
    "content": ("TITLE_AND_BODY", {"title": 0, "bullets": 1}),
    "two-column": ("TITLE_AND_TWO_COLUMNS", {"title": 0, "left": 1, "right": 2}),
    "title-only": ("TITLE_ONLY", {"title": 0}),
    "text": ("ONE_COLUMN_TEXT", {"title": 0, "bullets": 1}),
    "main-point": ("MAIN_POINT", {"title": 0}),
    "split": ("SECTION_TITLE_AND_DESCRIPTION", {"title": 0, "subtitle": 1, "bullets": 2}),
    "caption": ("CAPTION_ONLY", {"text": 1}),
    "big-number": ("BIG_NUMBER", {"title": 0, "text": 1}),
    "blank": ("BLANK", {}),
}


def set_language(frame, language_id) -> None:
    if language_id is not None:
        for paragraph in frame.paragraphs:
            for run in paragraph.runs:
                run.font.language_id = language_id


def fill(placeholder, value, plain: bool = False, language_id=None) -> None:
    """Write a string or a list of lines (two leading spaces = one level deeper)."""
    lines = value if isinstance(value, list) else str(value).split("\n")
    frame = placeholder.text_frame
    for number, line in enumerate(lines):
        paragraph = frame.paragraphs[0] if number == 0 else frame.add_paragraph()
        stripped = line.lstrip(" ")
        paragraph.level = min((len(line) - len(stripped)) // 2, 4)
        paragraph.text = stripped
        if plain:
            paragraph._p.get_or_add_pPr().set("marL", "0")
            paragraph._p.get_or_add_pPr().set("indent", "0")
            paragraph._p.get_or_add_pPr().append(paragraph._p.makeelement(qn("a:buNone"), {}))
    set_language(frame, language_id)


def add_slide_number(slide) -> None:
    """add_slide skips the slide-number placeholder; copy it from the layout."""
    for shape in slide.slide_layout.placeholders:
        if shape.placeholder_format.idx == 12:
            slide.shapes._spTree.append(copy.deepcopy(shape._element))


def build(outline: dict, template: str, target: str, lang: str | None = None) -> None:
    language_id = LANGUAGES[lang or outline.get("lang") or "cs"]
    prs = Presentation(template)
    by_name = {layout.name: layout for layout in prs.slide_layouts}
    sample_ids = list(prs.slides._sldIdLst)
    for sld_id in sample_ids:
        prs.part.drop_rel(sld_id.rId)
        prs.slides._sldIdLst.remove(sld_id)
    for number, spec in enumerate(outline["slides"], 1):
        kind = spec.get("layout", "content")
        if kind not in LAYOUTS:
            sys.exit(f"slide {number}: unknown layout {kind!r}; use one of {', '.join(LAYOUTS)}")
        layout_name, keys = LAYOUTS[kind]
        slide = prs.slides.add_slide(by_name[layout_name])
        placeholders = {shape.placeholder_format.idx: shape for shape in slide.placeholders}
        for key, idx in keys.items():
            if key in spec and idx in placeholders:
                fill(placeholders[idx], spec[key], plain=key == "text", language_id=language_id)
        for idx, shape in placeholders.items():  # drop untouched placeholders so no prompt text shows
            if not shape.text_frame.text.strip():
                shape._element.getparent().remove(shape._element)
        if kind != "title" and kind != "closing":
            add_slide_number(slide)
        if spec.get("notes"):
            slide.notes_slide.notes_text_frame.text = spec["notes"]
            set_language(slide.notes_slide.notes_text_frame, language_id)
    prs.save(target)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build an eSoul PPTX deck from a JSON outline.")
    parser.add_argument("outline", help="JSON outline")
    parser.add_argument("target", help="output PPTX")
    parser.add_argument("--template", default=str(DEFAULT_TEMPLATE))
    parser.add_argument("--lang", choices=sorted(LANGUAGES), help="proofing language (default: the key lang or cs)")
    args = parser.parse_args()
    with open(args.outline, encoding="utf-8") as handle:
        build(json.load(handle), args.template, args.target, args.lang)
