# Local font smoke fixture

`DocumentationFixture-Regular.ttf` is a test-only rename of the static Syne
font in `pdf/fonts/esoul/Syne-SemiBold.ttf`. Its unique family name proves that
the renderer discovers a project-owned font through `pdf.font_dirs` instead of
falling back to a font preinstalled in the image.

The glyph data comes from Syne at the pinned Google Fonts commit documented by
`pdf/fonts/esoul/README.md`. The bundled `OFL.txt` applies to this renamed test
derivative.
