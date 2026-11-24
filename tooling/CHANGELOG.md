# Changelog

Release notes of the documentation tool (`docs/documentation`, the renderer image and the installer). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Jenkins publishes the section of a tag's version as the release notes; how to release is in [MAINTAINERS.md](MAINTAINERS.md). The configuration schema is stated where it changes.

## Unreleased

### Added

- `language` on a `[[guides]]` block overrides `primary_language` for that guide (the PDF `lang` metadata and the Czech cover labels follow it); a Czech user guide and an English developer guide can share one configuration. A guide `language` must be a language tag such as `cs` or `en-GB`. Configuration schema remains 1.
- `validate` checks math: a formula with a command outside the allow list, a `^^` escape or another control sequence is an error naming the source file, instead of a late `build` failure. The list is the one of the render filter (`render.lua`); a test keeps both identical.
- Tests for the screenshot redaction output (solid and mosaic regions, refusal to overwrite, quarantine directories), for the `commit_pdf_outputs` wiring in `validate` and for the Git ignore check.

### Changed

- `commit_pdf_outputs` defaults to `false`; `true` only prints a `NOTICE` (it still skips the "PDF output directory is not ignored" check; nothing else changes). The starter configuration keeps it `false`.
- The installer's closing reminder says to keep the PDF output directory ignored by Git because generated PDFs are not committed, instead of allowing committed PDFs.
- Installer flag help and the upgrade-plan error say "release-resolved" and "release" instead of the removed "catalog".

## 0.6.7 - 2026-10-20

### Changed

- Code is typeset with fvextra instead of listings, so Czech letters, arrows and box drawing in inline code and code blocks render in order; DejaVu fallbacks cover missing symbols and inline code wraps after underscores. Code blocks no longer show line numbers. The upgrade replaces the managed `header.tex`. Configuration schema remains 1.
