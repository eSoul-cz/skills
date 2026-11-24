# Presentation layouts

The template `assets/templates/esoul-presentation.pptx` is a dark deck (background `#1B1B1D`,
gold `#E1BB36` titles, Syne headings, Poppins body, eSoul logo, gold footer strip with
`esoul.cz | info@esoul.cz` and the slide number). Size 10 x 5.625 in (16:9). Its 11 sample slides
carry no text, only the layout; `scripts/build_pptx.py` deletes them and builds slides from the
layouts below.

| Outline `layout` | Template layout (index) | Placeholders (outline key) | Use for |
| --- | --- | --- | --- |
| `title` | TITLE (0) | title, subtitle | Opening slide; large logo on top, no footer |
| `closing` | TITLE (0) | title, subtitle | Last slide, thanks and contact |
| `section` | SECTION_HEADER (1) | title | Chapter divider, one short centred title |
| `content` | TITLE_AND_BODY (2) | title, bullets | The default slide: title and up to about 6 bullets |
| `two-column` | TITLE_AND_TWO_COLUMNS (3) | title, left, right | Comparison, before/after, options |
| `title-only` | TITLE_ONLY (4) | title | Title with a free area (add a picture or table in PowerPoint) |
| `text` | ONE_COLUMN_TEXT (5) | title, bullets | Longer text; title is narrower (7.5 in) |
| `main-point` | MAIN_POINT (6) | title | One statement or key message |
| `split` | SECTION_TITLE_AND_DESCRIPTION (7) | title, subtitle, bullets | Dark left half with title, gold right half with description |
| `caption` | CAPTION_ONLY (8) | text | A single caption line |
| `big-number` | BIG_NUMBER (9) | title (the number), text | One figure, such as a price or effort, with a label |
| `blank` | BLANK (10) | none | Free canvas with logo and footer |

Notes:

- Placeholders left empty are removed so no prompt text shows.
- Titles are one line (about 45 characters at the default size); the template autofit shrinks
  text only inside PowerPoint, so keep text short instead of relying on it.
- Syne and Poppins are embedded in the template. Keynote and some viewers ignore embedded
  fonts and substitute Arial for headings; PowerPoint shows the real fonts.
- A bullet indented by two spaces becomes a sub-bullet (up to 4 levels).
- Optional `"notes": "..."` on any slide sets speaker notes.
