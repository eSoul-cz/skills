from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from types import ModuleType
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def load_module(name: str, path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


docs_tool = load_module(
    "documentation_docs_tool",
    PROJECT_ROOT / "docs/.documentation-tools/docs.py",
)
renderer = load_module(
    "documentation_pdf_renderer",
    PROJECT_ROOT / "docs/.documentation-tools/pdf/renderer.py",
)


class ScreenshotManifestTest(unittest.TestCase):
    def test_manifest_rejects_duplicate_project_relative_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            manifest = root / "docs/user-guide/SCREENSHOTS.md"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(
                "| Published path | Approval |\n"
                "|---|---|\n"
                "| `docs/user-guide/images/example.png` | Approved |\n"
                "| `docs/user-guide/images/example.png` | Approved |\n"
            )
            result = docs_tool.Validation()

            rows = docs_tool.manifest_rows(root, manifest, result)

            self.assertEqual(["docs/user-guide/images/example.png"], list(rows))
            self.assertTrue(any("duplicate screenshot manifest path" in error for error in result.errors))

    def test_manifest_rejects_basename_only_approval_keys(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            manifest = root / "docs/user-guide/SCREENSHOTS.md"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(
                "| Published path | Approval |\n"
                "|---|---|\n"
                "| `example.png` | Approved |\n"
            )
            result = docs_tool.Validation()

            rows = docs_tool.manifest_rows(root, manifest, result)

            self.assertEqual({}, rows)
            self.assertTrue(any("normalized and project-relative" in error for error in result.errors))


class MarkdownImageReferenceTest(unittest.TestCase):
    def test_discovers_inline_reference_and_html_images(self) -> None:
        markdown = (
            "![Inline](<images/image with spaces.png>)\n"
            "![Reference][capture]\n"
            "![Collapsed][]\n"
            "![Shortcut]\n"
            '<img src="images/raw.png" alt="Raw image">\n'
            "[capture]: images/reference.png\n"
            "[collapsed]: <images/collapsed image.webp>\n"
            "[shortcut]: images/shortcut.tiff\n"
        )

        references = docs_tool.markdown_image_references(markdown)

        self.assertEqual(
            [
                "images/image with spaces.png",
                "images/reference.png",
                "images/collapsed image.webp",
                "images/shortcut.tiff",
                "images/raw.png",
            ],
            [reference.target for reference in references],
        )
        self.assertEqual(
            ["Inline", "Reference", "Collapsed", "Shortcut", "Raw image"],
            [reference.alt for reference in references],
        )

    def test_exposes_data_uri_for_explicit_rejection(self) -> None:
        references = docs_tool.markdown_image_references(
            "![Embedded](data:image/png;base64,AAAA)"
        )

        self.assertEqual("data:image/png;base64,AAAA", references[0].target)

    def test_preserves_inline_angle_bracket_destination_with_spaces(self) -> None:
        references = docs_tool.markdown_image_references(
            '![Capture](<images/image with spaces.png> "Title")'
        )

        self.assertEqual("images/image with spaces.png", references[0].target)

    def test_discovers_balanced_and_escaped_parentheses(self) -> None:
        references = docs_tool.markdown_image_references(
            "![Balanced](images/capture(1).png)\n"
            r"![Escaped](images/capture\(2\).png)" "\n"
        )

        self.assertEqual(
            ["images/capture(1).png", "images/capture(2).png"],
            [reference.target for reference in references],
        )

    def test_discovers_reference_destination_on_following_line(self) -> None:
        references = docs_tool.markdown_image_references(
            "![Capture][capture]\n[capture]:\n  images/capture.png\n"
        )

        self.assertEqual("images/capture.png", references[0].target)

    def test_discovers_images_after_crlf_fence_and_in_crlf_inline_form(self) -> None:
        references = docs_tool.markdown_image_references(
            "```markdown\r\n"
            "![Ignored][capture]\r\n"
            "```\r\n"
            "![Reference][capture]\r\n"
            "![Inline](\r\n  images/inline.png \r\n  \"Title\"\r\n)\r\n"
            "[capture]:\r\n  images/reference.png \"Title\"\r\n"
        )

        self.assertEqual(
            ["images/reference.png", "images/inline.png"],
            [reference.target for reference in references],
        )

    def test_discovers_reference_definitions_in_block_quotes_and_lists(self) -> None:
        references = docs_tool.markdown_image_references(
            "![Quote][quote]\n"
            "![List][list]\n"
            "> [quote]: images/quote.png\n"
            "- [list]: images/list.png\n"
        )

        self.assertEqual(
            ["images/quote.png", "images/list.png"],
            [reference.target for reference in references],
        )

    def test_uses_first_duplicate_reference_definition(self) -> None:
        references = docs_tool.markdown_image_references(
            "![Capture][capture]\n"
            "[capture]: images/first.png\n"
            "[capture]: images/second.png\n"
        )

        self.assertEqual("images/first.png", references[0].target)

    def test_ignores_invalid_duplicate_reference_definition(self) -> None:
        references = docs_tool.markdown_image_references(
            "![Capture][capture]\n"
            "[capture]: images/invalid.png trailing\n"
            "[capture]: images/valid.png\n"
        )

        self.assertEqual("images/valid.png", references[0].target)

    def test_ignores_images_in_verbatim_content_and_comments(self) -> None:
        markdown = (
            "`![Inline code](images/inline.png)`\n"
            "```markdown\n![Fence](images/fence.png)\n```\n"
            "~~~\n![Tilde](images/tilde.png)\n~~~\n"
            "- ```markdown\n  ![List fence](images/list-fence.png)\n  ```\n"
            "> ```markdown\n> ![Quote fence](images/quote-fence.png)\n> ```\n"
            "\n    ![Indented](images/indented.png)\n"
            "- item\n\n      ![List code](images/list-code.png)\n"
            "> item\n>\n>     ![Quote code](images/quote-code.png)\n"
            "<!-- ![Comment](images/comment.png) -->\n"
            r"\![Escaped](images/escaped.png)" "\n"
            "![Published](images/published.png)\n"
        )

        references = docs_tool.markdown_image_references(markdown)

        self.assertEqual(["images/published.png"], [reference.target for reference in references])

    def test_does_not_overlap_markdown_syntax_inside_raw_html_attributes(self) -> None:
        references = docs_tool.markdown_image_references(
            '<img src="images/raw.png" alt="![Not nested](images/nested.png)">'
        )

        self.assertEqual(1, len(references))
        self.assertEqual("images/raw.png", references[0].target)

    def test_parses_raw_html_tags_and_exact_src_attribute(self) -> None:
        references = docs_tool.markdown_image_references(
            '<img alt="x > y" data-src="images/approved.png" '
            'src="images/published.png">'
        )

        self.assertEqual(1, len(references))
        self.assertEqual("images/published.png", references[0].target)
        self.assertEqual("x > y", references[0].alt)

    def test_decodes_raw_html_src_exactly_once(self) -> None:
        references = docs_tool.markdown_image_references(
            r'<img src="images/a&amp;amp;b\(1\).png" alt="Raw">'
        )

        self.assertEqual(r"images/a&amp;b\(1\).png", references[0].target)

    def test_exposes_srcset_for_explicit_rejection(self) -> None:
        references = docs_tool.markdown_image_references(
            '<img srcset="images/small.png 1x, images/large.png 2x" alt="Responsive">'
        )

        self.assertEqual("srcset", references[0].source_attribute)

    def test_exposes_remote_image_for_explicit_rejection(self) -> None:
        references = docs_tool.markdown_image_references(
            "![Remote](https://example.com/capture.png)"
        )

        self.assertEqual("https://example.com/capture.png", references[0].target)


class MarkdownLinkReferenceTest(unittest.TestCase):
    def test_discovers_balanced_and_escaped_parentheses(self) -> None:
        references = docs_tool.markdown_link_references(
            "[Balanced](spec(v2).md)\n"
            r"[Escaped](spec\(v3\).md)" "\n"
        )

        self.assertEqual(
            ["spec(v2).md", "spec(v3).md"],
            [reference.target for reference in references],
        )

    def test_discovers_reference_collapsed_and_shortcut_links(self) -> None:
        references = docs_tool.markdown_link_references(
            "[Reference][spec]\n"
            "[Collapsed][]\n"
            "[Shortcut]\n"
            "[spec]: reference.md\n"
            "[collapsed]: collapsed.md\n"
            "[shortcut]: shortcut.md\n"
        )

        self.assertEqual(
            ["reference.md", "collapsed.md", "shortcut.md"],
            [reference.target for reference in references],
        )

    def test_ignores_images_and_links_in_verbatim_content(self) -> None:
        references = docs_tool.markdown_link_references(
            "![Image](capture.png)\n"
            "`[Inline](inline.md)`\n"
            "```markdown\n[Fence](fence.md)\n```\n"
            "[Published](published.md)\n"
        )

        self.assertEqual(
            ["published.md"],
            [reference.target for reference in references],
        )

    def test_ignores_markdown_syntax_inside_raw_html_attributes(self) -> None:
        references = docs_tool.markdown_link_references(
            '<span data-example="[Ignored](ignored.md)">Example</span>\n'
            "[Published](published.md)\n"
        )

        self.assertEqual(
            ["published.md"],
            [reference.target for reference in references],
        )


class ValidationReportTest(unittest.TestCase):
    def test_reports_success(self) -> None:
        output = io.StringIO()

        with redirect_stdout(output):
            status = docs_tool.Validation().report()

        self.assertEqual(0, status)
        self.assertEqual("Validation passed with 0 warning(s).\n", output.getvalue())

    def test_reports_errors(self) -> None:
        output = io.StringIO()
        errors = io.StringIO()
        result = docs_tool.Validation(errors=["broken"])

        with redirect_stdout(output), redirect_stderr(errors):
            status = result.report()

        self.assertEqual(1, status)
        self.assertEqual("", output.getvalue())
        self.assertIn("ERROR: broken", errors.getvalue())
        self.assertIn("Validation failed with 1 error(s)", errors.getvalue())


class ConfigurationSafetyTest(unittest.TestCase):
    def test_loads_utf8_toml_from_binary_stream(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            config = root / "docs/documentation.toml"
            config.parent.mkdir(parents=True)
            config.write_bytes('primary_language = "čeština"\n'.encode("utf-8"))

            self.assertEqual("čeština", docs_tool.load_config(root)["primary_language"])

    def test_docker_run_rejects_project_root_and_git_directories(self) -> None:
        invalid_paths = (
            ("output_dir", ".", "docs/work"),
            ("output_dir", ".git/output", "docs/work"),
            ("work_dir", "docs/pdf", "."),
            ("work_dir", "docs/pdf", ".git/work"),
        )

        for key, output_dir, work_dir in invalid_paths:
            with self.subTest(key=key, output_dir=output_dir, work_dir=work_dir):
                with tempfile.TemporaryDirectory() as temp_value:
                    root = Path(temp_value).resolve()
                    with (
                        patch.object(docs_tool, "docker_image") as docker_image,
                        self.assertRaisesRegex(
                            RuntimeError,
                            rf"Configuration key '{key}'.*outside \.git",
                        ),
                    ):
                        docs_tool.docker_run(
                            root,
                            {"output_dir": output_dir, "work_dir": work_dir},
                            [],
                        )

                    docker_image.assert_not_called()


class PublishedImageValidationTest(unittest.TestCase):
    def test_rejects_remote_images(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            dockerfile = root / "docs/tools/Dockerfile"
            source.parent.mkdir(parents=True)
            dockerfile.parent.mkdir(parents=True)
            source.write_text(
                "# Guide\n\n"
                "![Remote](https://example.com/capture.png)\n"
                "![Protocol relative](//127.0.0.1/private.png)\n"
                "![Malformed](//[invalid)\n"
            )
            dockerfile.write_text("FROM scratch\n")
            config = {
                "schema_version": 1,
                "output_dir": "docs/pdf",
                "work_dir": "docs/work",
                "primary_language": "en",
                "pdf": {"mode": "local", "dockerfile": "docs/tools/Dockerfile"},
                "guides": [
                    {
                        "id": "guide",
                        "title": "Guide",
                        "output": "guide.pdf",
                        "sources": ["docs/guide/page.md"],
                    }
                ],
            }

            result = docs_tool.validate_project(root, config)

            self.assertEqual(
                2,
                sum("remote images are not permitted" in error for error in result.errors),
            )
            self.assertTrue(any("invalid image target" in error for error in result.errors))

    def test_rejects_missing_and_project_escaping_non_raster_images(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            dockerfile = root / "docs/tools/Dockerfile"
            source.parent.mkdir(parents=True)
            dockerfile.parent.mkdir(parents=True)
            source.write_text(
                "# Guide\n\n"
                "![Missing](missing.svg)\n"
                "![Escape](../../../outside.svg)\n"
            )
            dockerfile.write_text("FROM scratch\n")
            config = {
                "schema_version": 1,
                "output_dir": "docs/pdf",
                "work_dir": "docs/work",
                "primary_language": "en",
                "pdf": {"mode": "local", "dockerfile": "docs/tools/Dockerfile"},
                "guides": [
                    {
                        "id": "guide",
                        "title": "Guide",
                        "output": "guide.pdf",
                        "sources": ["docs/guide/page.md"],
                    }
                ],
            }

            result = docs_tool.validate_project(root, config)

            self.assertTrue(any("does not exist: missing.svg" in error for error in result.errors))
            self.assertTrue(any("escapes the project" in error for error in result.errors))

    def test_rejects_html_srcset_images(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            dockerfile = root / "docs/tools/Dockerfile"
            source.parent.mkdir(parents=True)
            dockerfile.parent.mkdir(parents=True)
            source.write_text(
                '# Guide\n\n<img srcset="small.png 1x, large.png 2x" alt="Responsive">\n'
            )
            dockerfile.write_text("FROM scratch\n")
            config = {
                "schema_version": 1,
                "output_dir": "docs/pdf",
                "work_dir": "docs/work",
                "primary_language": "en",
                "pdf": {"mode": "local", "dockerfile": "docs/tools/Dockerfile"},
                "guides": [
                    {
                        "id": "guide",
                        "title": "Guide",
                        "output": "guide.pdf",
                        "sources": ["docs/guide/page.md"],
                    }
                ],
            }

            result = docs_tool.validate_project(root, config)

            self.assertTrue(any("srcset images are not supported" in error for error in result.errors))

    def test_balanced_parenthesis_image_is_not_truncated_by_link_validation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            source.parent.mkdir(parents=True)
            source.write_text("# Guide\n\n![Capture](capture(1).png)\n")
            (source.parent / "capture(1).png").write_bytes(b"raster")
            result = docs_tool.Validation()

            docs_tool.validate_markdown(root, source, {}, result)

            self.assertFalse(any("broken local link" in error for error in result.errors))

    def test_balanced_parenthesis_link_is_validated_as_one_destination(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            target = source.parent / "spec(v2).md"
            source.parent.mkdir(parents=True)
            source.write_text("# Guide\n\n[Specification](spec(v2).md)\n")
            target.write_text("# Specification\n")
            result = docs_tool.Validation()

            docs_tool.validate_markdown(root, source, {}, result)

            self.assertFalse(any("broken local link" in error for error in result.errors))

    def test_protocol_relative_link_is_external_and_encoded_anchor_is_normalized(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            target = source.parent / "spec file.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                "# Guide\n\n"
                "[External](//example.com/reference)\n"
                "[Section](spec%20file.md#release%20notes)\n"
            )
            target.write_text("# Release notes\n")
            result = docs_tool.Validation()

            docs_tool.validate_markdown(root, source, {}, result)

            self.assertEqual([], result.errors)

    def test_malformed_urls_are_reported_as_validation_errors(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                "# Guide\n\n"
                "[Malformed](//[invalid)\n"
            )
            result = docs_tool.Validation()

            docs_tool.validate_markdown(root, source, {}, result)

            self.assertTrue(any("invalid link target" in error for error in result.errors))


class RendererLinkRewriteTest(unittest.TestCase):
    def test_slugify_matches_pandoc_unicode_identifier(self) -> None:
        self.assertEqual(
            "přílišžluťoučký_kůň.verze-2",
            renderer.slugify(" Příliš/žluťoučký_kůň.verze 2 "),
        )

    def test_rewrites_balanced_parenthesis_markdown_link(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            target = source.parent / "spec file(v2).md"
            source.parent.mkdir(parents=True)
            target.write_text("# Specification\n")

            rewritten = renderer.rewrite_local_links(
                "[Specification](spec%20file(v2).md)",
                source,
                root,
                {target.resolve(): "Specification"},
            )

            self.assertEqual("[Specification](#specification)", rewritten)

    def test_rewrites_reference_style_markdown_link(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            target = source.parent / "spec.md"
            source.parent.mkdir(parents=True)
            target.write_text("# Specification\n")

            rewritten = renderer.rewrite_local_links(
                "[Specification][spec]\n\n[spec]: spec.md\n",
                source,
                root,
                {target.resolve(): "Specification"},
            )

            self.assertIn("[Specification](#specification)", rewritten)
            self.assertIn("[spec]: spec.md", rewritten)

    def test_preserves_protocol_relative_external_link(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            source.parent.mkdir(parents=True)
            markdown = "[External](//example.com/reference)"

            rewritten = renderer.rewrite_local_links(markdown, source, root, {})

            self.assertEqual(markdown, rewritten)

    def test_preserves_malformed_external_link_and_local_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            directory = source.parent / "reference"
            directory.mkdir(parents=True)
            markdown = "[Malformed](//[invalid)\n[Directory](reference)"

            rewritten = renderer.rewrite_local_links(markdown, source, root, {})

            self.assertEqual(markdown, rewritten)

    def test_preserves_query_and_fragment_on_non_markdown_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            target = source.parent / "api.html"
            source.parent.mkdir(parents=True)
            target.write_text("<h1 id=\"auth\">Authentication</h1>\n")

            rewritten = renderer.rewrite_local_links(
                "[API](api.html?mode=full#auth)",
                source,
                root,
                {},
            )

            self.assertEqual(f"[API]({target}?mode=full#auth)", rewritten)


class RendererSafetyTest(unittest.TestCase):
    def test_rejects_unsafe_guide_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            work_root = Path(temp_value).resolve()

            for guide_id in ("../escape", "/absolute", "nested/guide", ".", ""):
                with self.subTest(guide_id=guide_id):
                    with self.assertRaisesRegex(RuntimeError, "Guide id"):
                        renderer.guide_directory(work_root, "build", guide_id)

    def test_rejects_guide_directory_symlink_that_escapes_work_root(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            work_root = root / "work"
            build_root = work_root / "build"
            outside = root / "outside"
            build_root.mkdir(parents=True)
            outside.mkdir()
            (build_root / "guide").symlink_to(outside, target_is_directory=True)

            with self.assertRaisesRegex(RuntimeError, "escapes"):
                renderer.guide_directory(work_root, "build", "guide")

    def test_inspect_pdf_recreates_review_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            work = root / "docs/work"
            review = work / "review/guide"
            review.mkdir(parents=True)
            stale = review / "stale.txt"
            stale.write_text("stale", encoding="utf-8")
            (review / "stale-link").symlink_to(stale)
            pdf = root / "docs/pdf/guide.pdf"
            pdf.parent.mkdir(parents=True)
            pdf.write_bytes(b"pdf")

            def fake_run(
                command: list[str],
                cwd: Path | None = None,
                capture: bool = False,
            ) -> str:
                del cwd, capture
                if command[0] == "pdfinfo":
                    return "Pages: 1\n"
                if command[0] == "pdftotext":
                    Path(command[-1]).write_text("text", encoding="utf-8")
                if command[0] == "pdftoppm":
                    Path(command[-1] + "-1.png").write_bytes(b"page")
                return ""

            with patch.object(renderer, "run", fake_run):
                renderer.inspect_pdf(
                    root,
                    {"work_dir": work.relative_to(root).as_posix()},
                    {"id": "guide"},
                    pdf,
                )

            self.assertFalse((review / "stale.txt").exists())
            self.assertFalse((review / "stale-link").exists())
            self.assertEqual(
                "Pages: 1\n",
                (review / "pdfinfo.txt").read_text(encoding="utf-8"),
            )
            self.assertEqual(
                "text",
                (review / "extracted.txt").read_text(encoding="utf-8"),
            )

    def test_build_guide_uses_isolated_staging_and_internal_raw_filter(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            first = root / "docs/guide/first.md"
            second = root / "docs/guide/second.md"
            first.parent.mkdir(parents=True)
            first.write_text("# First\n\nContent.\n", encoding="utf-8")
            second.write_text("# Second\n\nContent.\n", encoding="utf-8")
            config = {
                "output_dir": "docs/pdf",
                "work_dir": "docs/work",
                "primary_language": "en",
            }
            guide = {
                "id": "guide",
                "title": "Guide",
                "output": "guide.pdf",
                "sources": [
                    first.relative_to(root).as_posix(),
                    second.relative_to(root).as_posix(),
                ],
                "landscape_sources": [second.relative_to(root).as_posix()],
            }
            invocations: list[tuple[list[str], Path | None]] = []

            def fake_run(
                command: list[str],
                cwd: Path | None = None,
                capture: bool = False,
            ) -> str:
                del capture
                invocations.append((command, cwd))
                return ""

            with patch.object(renderer, "run", fake_run):
                renderer.build_guide(root, config, guide)

            command, cwd = invocations[-1]
            staging = root / "docs/work/build/guide/staging"
            self.assertEqual(staging, cwd)
            self.assertEqual("combined.md", command[1])
            self.assertIn(
                "--from=markdown+tex_math_dollars-raw_tex-raw_attribute",
                command,
            )
            self.assertIn(f"--resource-path={staging}", command)
            self.assertFalse(any(str(root) + ":" in argument for argument in command))

            combined = (staging / "combined.md").read_text(encoding="utf-8")
            raw_filter = (staging / "internal-raw.lua").read_text(encoding="utf-8")
            self.assertNotIn("```{=latex}", combined)
            self.assertIn(".documentation-page-break", combined)
            self.assertIn(".documentation-landscape", combined)
            self.assertIn('pandoc.RawBlock("latex", "\\\\newpage")', raw_filter)
            self.assertIn('pandoc.RawBlock("latex", "\\\\begin{landscape}")', raw_filter)
            self.assertIn('pandoc.RawBlock("latex", "\\\\end{landscape}")', raw_filter)
            self.assertIn("function Math(element)", raw_filter)
            self.assertIn("Unsafe TeX math command", raw_filter)
            self.assertLess(
                raw_filter.index('element.text:find("^^", 1, true)'),
                raw_filter.index("for command in element.text:gmatch"),
            )
            self.assertEqual(
                {"combined.md", "internal-raw.lua"},
                {path.name for path in staging.iterdir()},
            )


class RendererImageNormalizationTest(unittest.TestCase):
    def test_normalizes_every_supported_local_image_form(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            images = source.parent / "images"
            work = root / "work"
            images.mkdir(parents=True)
            work.mkdir()
            for name in (
                "inline(1).jpg",
                "reference.png",
                "collapsed.webp",
                "shortcut.tiff",
                "raw.jpeg",
                "encoded image.png",
            ):
                (images / name).write_bytes(b"raster")
            markdown = (
                "![Inline](images/inline(1).jpg)\n"
                "![Reference][capture]\n"
                "![Collapsed][]\n"
                "![Shortcut]\n"
                '<img src="images/raw.jpeg" alt="Raw">\n'
                "![Encoded](images/encoded%20image.png)\n"
                "[capture]: images/reference.png\n"
                "[collapsed]: images/collapsed.webp\n"
                "[shortcut]: images/shortcut.tiff\n"
            )

            def fake_run(
                command: list[str],
                cwd: Path | None = None,
                capture: bool = False,
            ) -> str:
                del cwd, capture
                Path(command[-1]).write_bytes(b"normalized")
                return ""

            with patch.object(renderer, "run", fake_run):
                normalized = renderer.normalize_local_images(markdown, source, root, work)

            self.assertEqual(6, normalized.count("{ width=95% }"))
            self.assertEqual(6, normalized.count(str(work / "image-")))
            self.assertNotIn("<img", normalized)
            self.assertNotIn("![Reference][capture]", normalized)

    def test_preserves_explicit_image_attributes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            image = source.parent / "image.png"
            work = root / "work"
            source.parent.mkdir(parents=True)
            work.mkdir()
            image.write_bytes(b"raster")

            with patch.object(renderer, "run", return_value=""):
                normalized = renderer.normalize_local_images(
                    "![Capture](image.png){ width=40% }",
                    source,
                    root,
                    work,
                )

            self.assertEqual(1, normalized.count("{ width=40% }"))
            self.assertNotIn("width=95%", normalized)

    def test_rejects_remote_and_embedded_images_before_conversion(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            source = root / "docs/guide/page.md"
            work = root / "work"
            source.parent.mkdir(parents=True)
            work.mkdir()

            for markdown in (
                "![Remote](HTTP://127.0.0.1/private.png)",
                "![Protocol relative](//127.0.0.1/private.png)",
                "![Malformed](//[invalid)",
                "![Embedded](data:image/png;base64,AAAA)",
                '<img srcset="http://127.0.0.1/private.png 1x" alt="Remote">',
            ):
                with self.subTest(markdown=markdown):
                    with self.assertRaisesRegex(RuntimeError, "not permitted"):
                        renderer.normalize_local_images(markdown, source, root, work)


class RasterDimensionsTest(unittest.TestCase):
    def test_reads_webp_extended_dimensions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            path = Path(temp_value) / "example.webp"
            width = 321
            height = 123
            chunk = b"\x00\x00\x00\x00" + (width - 1).to_bytes(3, "little") + (
                height - 1
            ).to_bytes(3, "little")
            path.write_bytes(
                b"RIFF"
                + (4 + 8 + len(chunk)).to_bytes(4, "little")
                + b"WEBPVP8X"
                + len(chunk).to_bytes(4, "little")
                + chunk
            )

            self.assertEqual((width, height), docs_tool.raster_dimensions(path))

    def test_reads_little_endian_tiff_dimensions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            path = Path(temp_value) / "example.tiff"
            width = 640
            height = 480
            path.write_bytes(
                b"II\x2a\x00\x08\x00\x00\x00"
                + b"\x02\x00"
                + b"\x00\x01\x03\x00\x01\x00\x00\x00"
                + width.to_bytes(2, "little")
                + b"\x00\x00"
                + b"\x01\x01\x03\x00\x01\x00\x00\x00"
                + height.to_bytes(2, "little")
                + b"\x00\x00"
                + b"\x00\x00\x00\x00"
            )

            self.assertEqual((width, height), docs_tool.raster_dimensions(path))


class RemoteRendererTest(unittest.TestCase):
    image = "registry.example/documentation@sha256:" + "a" * 64

    def test_remote_renderer_requires_trusted_runtime_allowlist(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "trusted runtime configuration"):
                docs_tool.trusted_remote_renderer_image({"image": self.image})

    def test_remote_renderer_must_match_trusted_runtime_allowlist(self) -> None:
        with patch.dict(
            os.environ,
            {docs_tool.REMOTE_RENDERER_IMAGE_ENV: self.image.replace("a" * 64, "b" * 64)},
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, "not allowlisted"):
                docs_tool.trusted_remote_renderer_image({"image": self.image})

    def test_remote_renderer_accepts_exact_digest_pinned_allowlist_match(self) -> None:
        with patch.dict(
            os.environ,
            {docs_tool.REMOTE_RENDERER_IMAGE_ENV: self.image},
            clear=True,
        ):
            self.assertEqual(
                self.image,
                docs_tool.trusted_remote_renderer_image({"image": self.image}),
            )


class RedactionTemporaryFilesTest(unittest.TestCase):
    def test_redaction_defaults_regions_to_solid_style(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            work = root / "docs/.documentation-work"
            source = work / "raw-screenshots/source.png"
            output = work / "redacted-screenshots/output.png"
            plan = work / "plan.json"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"raw screenshot")
            plan.write_text(
                json.dumps(
                    {
                        "source": source.relative_to(root).as_posix(),
                        "output": output.relative_to(root).as_posix(),
                        "regions": [{"x": 1, "y": 2, "width": 10, "height": 12}],
                    }
                ),
                encoding="utf-8",
            )
            commands: list[list[str]] = []

            def fake_run(
                command: list[str],
                cwd: Path | None = None,
                capture: bool = False,
            ) -> str:
                del cwd
                commands.append(command)
                if command[0] == "identify":
                    return "100 100"
                if command[0] == "convert":
                    Path(command[-1]).write_bytes(b"redacted screenshot")
                return ""

            with patch.object(renderer, "run", fake_run):
                renderer.redact(
                    root,
                    {"work_dir": work.relative_to(root).as_posix()},
                    plan.relative_to(root).as_posix(),
                )

            self.assertTrue(any("-fill" in command for command in commands))
            self.assertFalse(any("-resize" in command for command in commands))

    def test_redaction_removes_all_intermediate_images(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            work = root / "docs/.documentation-work"
            source = work / "raw-screenshots/source.png"
            output = work / "redacted-screenshots/output.png"
            plan = work / "plan.json"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"raw screenshot")
            plan.write_text(
                json.dumps(
                    {
                        "source": source.relative_to(root).as_posix(),
                        "output": output.relative_to(root).as_posix(),
                        "regions": [],
                    }
                )
            )

            created_temp_dirs: list[Path] = []
            temporary_directory = renderer.tempfile.TemporaryDirectory

            def recording_temporary_directory(*args: object, **kwargs: object) -> object:
                directory = temporary_directory(*args, **kwargs)
                created_temp_dirs.append(Path(directory.name))
                return directory

            def fake_run(command: list[str], cwd: Path | None = None, capture: bool = False) -> str:
                del cwd, capture
                if command[0] == "convert":
                    Path(command[-1]).write_bytes(b"redacted screenshot")
                return ""

            with (
                patch.object(renderer.tempfile, "TemporaryDirectory", recording_temporary_directory),
                patch.object(renderer, "run", fake_run),
            ):
                renderer.redact(
                    root,
                    {"work_dir": work.relative_to(root).as_posix()},
                    plan.relative_to(root).as_posix(),
                )

            self.assertEqual(b"redacted screenshot", output.read_bytes())
            self.assertTrue(created_temp_dirs)
            self.assertTrue(all(not path.exists() for path in created_temp_dirs))

    def test_redaction_removes_intermediate_images_after_conversion_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            work = root / "docs/.documentation-work"
            source = work / "raw-screenshots/source.png"
            output = work / "redacted-screenshots/output.png"
            plan = work / "plan.json"
            source.parent.mkdir(parents=True)
            source.write_bytes(b"raw screenshot")
            plan.write_text(
                json.dumps(
                    {
                        "source": source.relative_to(root).as_posix(),
                        "output": output.relative_to(root).as_posix(),
                        "regions": [],
                    }
                )
            )

            created_temp_dirs: list[Path] = []
            temporary_directory = renderer.tempfile.TemporaryDirectory

            def recording_temporary_directory(*args: object, **kwargs: object) -> object:
                directory = temporary_directory(*args, **kwargs)
                created_temp_dirs.append(Path(directory.name))
                return directory

            with (
                patch.object(renderer.tempfile, "TemporaryDirectory", recording_temporary_directory),
                patch.object(renderer, "run", side_effect=RuntimeError("conversion failed")),
                self.assertRaisesRegex(RuntimeError, "conversion failed"),
            ):
                renderer.redact(
                    root,
                    {"work_dir": work.relative_to(root).as_posix()},
                    plan.relative_to(root).as_posix(),
                )

            self.assertFalse(output.exists())
            self.assertTrue(created_temp_dirs)
            self.assertTrue(all(not path.exists() for path in created_temp_dirs))


if __name__ == "__main__":
    unittest.main()
