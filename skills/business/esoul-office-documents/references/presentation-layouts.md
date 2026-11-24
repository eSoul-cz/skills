# Presentation layouts

Read when you write a PPTX outline. The template `assets/templates/esoul-presentation.pptx` is the
source of truth for look and feel; `scripts/build_pptx.py` deletes its sample slides and builds
slides from the layouts below (the `LAYOUTS` table in the script maps each outline `layout` to a
template layout).

| Outline `layout` | Placeholders (outline key) | Use for |
| --- | --- | --- |
| `title` | title, subtitle | Opening slide; large logo on top, no footer |
| `closing` | title, subtitle | Last slide, thanks and contact |
| `section` | title | Chapter divider, one short centred title |
| `content` | title, bullets | The default slide: title and up to about 6 short bullets |
| `two-column` | title, left, right | Comparison, before/after, options |
| `title-only` | title | Title with a free area (add a picture or table in PowerPoint) |
| `text` | title, bullets | Longer text; the title is narrower |
| `main-point` | title | One statement or key message |
| `split` | title, subtitle, bullets | Two halves: title on one, description on the other |
| `caption` | text | A single caption line |
| `big-number` | title (the number), text | One figure, such as a price or effort, with a label |
| `blank` | none | Free canvas with logo and footer |

Notes:

- Placeholders left empty are removed so no prompt text shows.
- Titles are one line (about 45 characters at the default size); the template autofit shrinks
  text only inside PowerPoint, so keep text short instead of relying on it.
- Syne and Poppins are embedded in the template. Keynote and some viewers ignore embedded
  fonts and substitute Arial for headings; PowerPoint shows the real fonts.
- A bullet indented by two spaces becomes a sub-bullet (up to 4 levels).
- Optional `"notes": "..."` on any slide sets speaker notes.
