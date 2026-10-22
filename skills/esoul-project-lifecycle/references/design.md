# Design (P5, `design`)

eSoul designs in Pencil (`.pen`) driven by a written brief, reviews with the client through the
eSoul mockups module, and treats the approved design as part of the specification.

## Files

| What | Where |
|---|---|
| Design file | `docs/design_pencil/<project>.pen` via Git LFS |
| Brief written as a prompt for the design agent | `docs/design_pencil/PENCIL_BRIEF.md` or `prompt-pencil-*.md` |
| Derived summary (screen codes, node IDs, tokens) | `docs/design_pencil/README.md` — "the .pen file wins" |
| Exported design images | `docs/design_pencil/images/`, `exports/` via LFS |
| OG images exported for the site | `assets/og_images/<slug>.png` via LFS (see `sitemap-a-meta.md`) |
| Mockup bundle for client review | `docs/design_pencil/mockup/` (generated) |
| Client feedback per review round | `docs/podklady/pripominky-mockup-revize-N-YYYY-MM-DD.md` |
| Light tier approval log | `docs/design-log.md` |

## Rules

- Read and write `.pen` only through the Pencil MCP tools (or the project's `scripts/pen.sh`).
  Never `Read` or `grep` a `.pen` file.
- The brief is in Czech and pasteable in parts: A design system (tokens, typography, components),
  B screens one by one with screen codes (`B1`…), C supplements, D human checklist. Each screen
  has a „N. revize“ paragraph recording what changed and why.
- Do not invent fields. The data model, glossary and accepted ADRs are the only source for
  what a screen shows. Missing data → question in the register.
- Design every screen at desktop 1440 px and mobile 390 px.
- Notes on the canvas named „Poznámka — …“ are binding specification for implementation.
- Design tokens go into code once (Tailwind `@theme` or equivalent) and are lint-enforced.

## Review loop with the client

1. Publish the bundle with `esoul-mockup-authoring`.
2. Export the client's threads into `docs/podklady/pripominky-mockup-revize-N-<date>.md`.
3. Turn feedback into brief changes, `.pen` changes and, when decisions are involved,
   questions or ADR updates — in one `client-update` PR.
4. Record the revision in the brief and, for the light tier, the approval in `design-log.md`.

Gate B2 is the client's written approval of the screens a phase needs. Issues reference the
approved frames by screen code and node ID.
