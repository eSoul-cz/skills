# Changelog

Release notes of the documentation tool (`docs/documentation`, the renderer image and the installer). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Jenkins publishes the section of a tag's version as the release notes; how to release is in [MAINTAINERS.md](MAINTAINERS.md). The configuration schema is stated where it changes.

## Unreleased

## 0.6.8 - 2026-11-24

### Added

- `language` on a `[[guides]]` block overrides `primary_language` for that guide (PDF `lang` metadata, Czech cover labels); it must be a language tag such as `cs` or `en-GB`. Configuration schema remains 1.
- `validate` reports math with a command outside the render filter allow list, a `^^` escape or another control sequence as an error naming the source file, instead of a late `build` failure.

### Changed

- `commit_pdf_outputs` defaults to `false`; `true` only prints a `NOTICE` and still skips the "PDF output directory is not ignored" check.
- The installer's closing reminder says to keep the PDF output directory ignored by Git; flag help and the upgrade-plan error say "release-resolved" and "release" instead of "catalog".

## 0.6.7 - 2026-10-20

### Changed

- Code is typeset with fvextra instead of listings, so Czech letters, arrows and box drawing in inline code and code blocks render in order; DejaVu fallbacks cover missing symbols and inline code wraps after underscores. Code blocks no longer show line numbers. The upgrade replaces the managed `header.tex`. Configuration schema remains 1.
