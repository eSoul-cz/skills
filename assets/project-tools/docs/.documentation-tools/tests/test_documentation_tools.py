from __future__ import annotations

import importlib.util
import io
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


class ValidationReportTest(unittest.TestCase):
    def test_reports_success_and_errors(self) -> None:
        success = docs_tool.Validation()
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertEqual(0, success.report())
        self.assertIn("Validation passed", output.getvalue())

        failure = docs_tool.Validation()
        failure.error("broken")
        error = io.StringIO()
        with redirect_stderr(error):
            self.assertEqual(1, failure.report())
        self.assertIn("ERROR: broken", error.getvalue())


class MarkdownReferenceTest(unittest.TestCase):
    def test_discovers_supported_image_forms(self) -> None:
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

    def test_handles_parentheses_crlf_and_reference_destinations(self) -> None:
        markdown = (
            "```markdown\r\n![Ignored](image.png)\r\n```\r\n"
            "![Balanced](images/capture(1).png)\r\n"
            "![Reference][capture]\r\n"
            "[capture]:\r\n  images/reference.png \"Title\"\r\n"
        )

        references = docs_tool.markdown_image_references(markdown)

        self.assertEqual(
            ["images/capture(1).png", "images/reference.png"],
            [reference.target for reference in references],
        )

    def test_ignores_verbatim_comments_and_raw_html_attributes(self) -> None:
        markdown = (
            "`![Inline](inline.png)`\n"
            "~~~\n![Fence](fence.png)\n~~~\n"
            "<!-- ![Comment](comment.png) -->\n"
            '<img src="raw.png" alt="![Not an image](attribute.png)">\n'
            "![Published](published.png)\n"
        )

        references = docs_tool.markdown_image_references(markdown)

        self.assertEqual(
            ["raw.png", "published.png"],
            [reference.target for reference in references],
        )

    def test_exposes_remote_data_and_srcset_for_policy_validation(self) -> None:
        markdown = (
            "![Remote](https://example.com/image.png)\n"
            "![Embedded](data:image/png;base64,AAAA)\n"
            '<img srcset="one.png 1x, two.png 2x" alt="Responsive">\n'
        )

        references = docs_tool.markdown_image_references(markdown)

        self.assertEqual(
            ["https://example.com/image.png", "data:image/png;base64,AAAA", "one.png 1x, two.png 2x"],
            [reference.target for reference in references],
        )
        self.assertEqual("srcset", references[-1].source_attribute)

    def test_discovers_links_without_confusing_images_or_code(self) -> None:
        markdown = (
            "[Inline](guide(1).md)\n"
            "[Reference][guide]\n"
            "![Image](image.png)\n"
            "`[Code](ignored.md)`\n"
            "[guide]: other.md\n"
        )

        references = docs_tool.markdown_link_references(markdown)

        self.assertEqual(
            ["guide(1).md", "other.md"],
            [reference.target for reference in references],
        )


class ScreenshotManifestTest(unittest.TestCase):
    def test_rejects_duplicate_and_basename_only_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            manifest = root / "docs/user-guide/SCREENSHOTS.md"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(
                "| Published path | Approval |\n"
                "|---|---|\n"
                "| `example.png` | Approved |\n"
                "| `docs/user-guide/images/example.png` | Approved |\n"
                "| `docs/user-guide/images/example.png` | Approved |\n",
                encoding="utf-8",
            )
            result = docs_tool.Validation()

            rows = docs_tool.manifest_rows(root, manifest, result)

            self.assertEqual(["docs/user-guide/images/example.png"], list(rows))
            self.assertTrue(any("normalized and project-relative" in error for error in result.errors))
            self.assertTrue(any("duplicate screenshot manifest path" in error for error in result.errors))


class ProjectValidationTest(unittest.TestCase):
    def base_project(self, root: Path, markdown: str) -> dict[str, object]:
        source = root / "docs/guide/page.md"
        source.parent.mkdir(parents=True)
        source.write_text(markdown, encoding="utf-8")
        dockerfile = root / "docs/.documentation-tools/pdf/Dockerfile"
        dockerfile.parent.mkdir(parents=True)
        dockerfile.write_text("FROM scratch\n", encoding="utf-8")
        return {
            "schema_version": 1,
            "output_dir": "docs/pdf",
            "work_dir": "docs/.documentation-work",
            "primary_language": "en",
            "pdf": {
                "mode": "local",
                "dockerfile": "docs/.documentation-tools/pdf/Dockerfile",
            },
            "guides": [
                {
                    "id": "guide",
                    "title": "Guide",
                    "output": "guide.pdf",
                    "sources": ["docs/guide/page.md"],
                }
            ],
        }

    def test_rejects_remote_embedded_missing_and_escaping_images(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            config = self.base_project(
                root,
                "# Guide\n\n"
                "![Remote](https://example.com/image.png)\n"
                "![Embedded](data:image/png;base64,AAAA)\n"
                "![Missing](missing.svg)\n"
                "![Escape](../../../outside.svg)\n",
            )

            result = docs_tool.validate_project(root, config)

            self.assertTrue(any("remote images" in error for error in result.errors))
            self.assertTrue(any("embedded data URI" in error for error in result.errors))
            self.assertTrue(any("does not exist" in error for error in result.errors))
            self.assertTrue(any("escapes the project" in error for error in result.errors))

    def test_requires_mermaid_text_alternative(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            config = self.base_project(
                root,
                "# Guide\n\n```mermaid\nflowchart LR\n  A --> B\n```\n",
            )

            result = docs_tool.validate_project(root, config)

            self.assertTrue(any("diagram-alt" in error for error in result.errors))

    def test_rejects_raw_latex_and_detects_private_keys(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            config = self.base_project(
                root,
                "# Guide\n\n\\begin{danger}\n"
                "-----BEGIN PRIVATE KEY-----\n",
            )

            result = docs_tool.validate_project(root, config)

            self.assertTrue(any("raw LaTeX" in error for error in result.errors))
            self.assertTrue(any("private key material" in error for error in result.errors))


class ConfigurationSafetyTest(unittest.TestCase):
    def test_docker_run_rejects_project_root_and_git_directories(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value).resolve()
            (root / ".git").mkdir()
            for key, value in (("output_dir", "."), ("work_dir", ".git/work")):
                config = {
                    "output_dir": "docs/pdf",
                    "work_dir": "docs/work",
                    "pdf": {},
                }
                config[key] = value
                with self.subTest(key=key), self.assertRaisesRegex(
                    RuntimeError, "dedicated directory outside .git"
                ):
                    docs_tool.docker_run(root, config, [])


class MermaidRendererPackagingTest(unittest.TestCase):
    def test_uses_native_merman_without_browser_runtime(self) -> None:
        pdf_tools = PROJECT_ROOT / "docs/.documentation-tools/pdf"
        dockerfile = (pdf_tools / "Dockerfile").read_text(encoding="utf-8")
        source_filter = (pdf_tools / "filters/source.lua").read_text(encoding="utf-8")

        self.assertIn("FROM rust:1.95-bookworm AS merman_builder", dockerfile)
        self.assertIn("--version 0.7.0", dockerfile)
        self.assertIn(
            "COPY --from=merman_builder /out/bin/merman-cli "
            "/usr/local/bin/merman-cli",
            dockerfile,
        )
        for forbidden in ("chromium", "node:", "nodejs", "npm install", "puppeteer"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, dockerfile.lower())

        self.assertIn('pandoc.pipe("merman-cli"', source_filter)
        self.assertIn('"diagram-" .. digest .. ".pdf"', source_filter)
        self.assertIn('"--outputFormat", "pdf"', source_filter)
        self.assertIn('"--pdfFit"', source_filter)
        self.assertNotIn('pandoc.pipe("mmdc"', source_filter)
        self.assertNotIn("puppeteer", source_filter.lower())
        self.assertFalse((pdf_tools / "puppeteer-config.json").exists())


class RasterDimensionsTest(unittest.TestCase):
    def test_reads_webp_and_little_endian_tiff_dimensions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_value:
            root = Path(temp_value)
            webp = root / "example.webp"
            width = 321
            height = 123
            chunk = b"\x00\x00\x00\x00" + (width - 1).to_bytes(3, "little") + (
                height - 1
            ).to_bytes(3, "little")
            webp.write_bytes(
                b"RIFF"
                + (4 + 8 + len(chunk)).to_bytes(4, "little")
                + b"WEBPVP8X"
                + len(chunk).to_bytes(4, "little")
                + chunk
            )
            self.assertEqual((width, height), docs_tool.raster_dimensions(webp))

            tiff = root / "example.tiff"
            tiff.write_bytes(
                b"II\x2a\x00\x08\x00\x00\x00"
                + b"\x02\x00"
                + b"\x00\x01\x03\x00\x01\x00\x00\x00"
                + (640).to_bytes(2, "little")
                + b"\x00\x00"
                + b"\x01\x01\x03\x00\x01\x00\x00\x00"
                + (480).to_bytes(2, "little")
                + b"\x00\x00"
                + b"\x00\x00\x00\x00"
            )
            self.assertEqual((640, 480), docs_tool.raster_dimensions(tiff))


class RemoteRendererTest(unittest.TestCase):
    image = "registry.example/documentation@sha256:" + "a" * 64

    def test_requires_exact_trusted_digest(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "trusted runtime configuration"):
                docs_tool.trusted_remote_renderer_image({"image": self.image})

        with patch.dict(
            os.environ,
            {docs_tool.REMOTE_RENDERER_IMAGE_ENV: self.image},
            clear=True,
        ):
            self.assertEqual(
                self.image,
                docs_tool.trusted_remote_renderer_image({"image": self.image}),
            )


if __name__ == "__main__":
    unittest.main()
