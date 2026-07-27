#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import tomllib
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

from markdown_images import markdown_image_references, markdown_link_references


DEFAULT_TEMPLATE = Path("/opt/eisvogel.latex")
DEFAULT_HEADER = Path("/opt/documentation-tools/header.tex")
MERMAID_CONFIG = Path("/opt/documentation-tools/mermaid-config.json")
PUPPETEER_CONFIG = Path("/opt/documentation-tools/puppeteer-config.json")
GUIDE_ID_PATTERN = re.compile(r"[A-Za-z0-9_-]+")


def run(command: list[str], cwd: Path | None = None, capture: bool = False) -> str:
    completed = subprocess.run(
        command,
        cwd=cwd,
        check=True,
        text=True,
        capture_output=capture,
    )
    return completed.stdout if capture else ""


def inside(root: Path, path: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


def root_path(root: Path, value: str) -> Path:
    path = (root / value).resolve()
    if not inside(root, path):
        raise RuntimeError(f"Path escapes project root: {value}")
    return path


def load_config(root: Path, config_path: str) -> dict[str, Any]:
    path = root_path(root, config_path)
    try:
        config = tomllib.loads(path.read_text())
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise RuntimeError(f"Cannot load {config_path}: {error}") from error
    if not isinstance(config, dict):
        raise RuntimeError("Documentation configuration must contain a TOML table.")
    return config


def yaml_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFC", value).casefold().strip()
    value = "".join(
        character
        for character in value
        if character.isalnum() or character in {" ", "_", "-", "."}
    )
    return re.sub(r"[ -]+", "-", value).strip("-")


def guide_directory(work_root: Path, category: str, guide_id_value: object) -> tuple[str, Path]:
    guide_id = str(guide_id_value)
    if GUIDE_ID_PATTERN.fullmatch(guide_id) is None:
        raise RuntimeError(
            "Guide id must contain only ASCII letters, digits, underscores, and hyphens."
        )
    resolved_work_root = work_root.resolve()
    category_root = (work_root / category).resolve()
    if category_root == resolved_work_root or not inside(resolved_work_root, category_root):
        raise RuntimeError(f"Guide category directory escapes {resolved_work_root}: {category}")
    directory = (category_root / guide_id).resolve()
    if directory == category_root or not inside(category_root, directory):
        raise RuntimeError(f"Guide work directory escapes {category_root}: {guide_id}")
    return guide_id, directory


def internal_raw_filter(token: str) -> str:
    return f"""local internal_token = {json.dumps(token)}
local allowed_math_commands = {{
  alpha = true, approx = true, bar = true, beta = true, cdot = true,
  cos = true, delta = true, div = true, epsilon = true, exp = true,
  frac = true, gamma = true, ge = true, geq = true, hat = true,
  infty = true, lambda = true, langle = true, le = true, left = true,
  leftarrow = true, leq = true, ln = true, log = true, mathbf = true,
  mathit = true, mathrm = true, max = true, min = true, mp = true,
  mu = true, ne = true, neq = true, omega = true, operatorname = true,
  overline = true, phi = true, pi = true, pm = true, prod = true,
  rangle = true, right = true, rightarrow = true, sigma = true,
  sin = true, sqrt = true, sum = true, tan = true, text = true,
  theta = true, times = true, to = true, underline = true, vec = true,
}}

local function has_class(element, expected)
  for _, value in ipairs(element.classes) do
    if value == expected then
      return true
    end
  end
  return false
end

function Math(element)
  if element.text:find("^^", 1, true) then
    error("Unsafe TeX math control sequence")
  end
  for command in element.text:gmatch("\\\\([%a@]+)") do
    if not allowed_math_commands[command] then
      error("Unsafe TeX math command: \\\\" .. command)
    end
  end
  local without_commands = element.text:gsub("\\\\[%a@]+", "")
  if without_commands:find("\\\\", 1, true) then
    error("Unsafe TeX math control sequence")
  end
  return nil
end

function Div(element)
  if element.attributes["data-documentation-token"] ~= internal_token then
    return nil
  end
  if has_class(element, "documentation-page-break") then
    return pandoc.RawBlock("latex", "\\\\newpage")
  end
  if has_class(element, "documentation-landscape") then
    local blocks = {{pandoc.RawBlock("latex", "\\\\begin{{landscape}}")}}
    for _, block in ipairs(element.content) do
      blocks[#blocks + 1] = block
    end
    blocks[#blocks + 1] = pandoc.RawBlock("latex", "\\\\end{{landscape}}")
    return blocks
  end
  return nil
end
"""


def first_heading(markdown: str, source: Path) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", markdown, re.MULTILINE)
    if match is None:
        raise RuntimeError(f"Each PDF source page needs one H1: {source}")
    return match.group(1)


def rewrite_local_links(
    markdown: str,
    source: Path,
    root: Path,
    heading_by_path: dict[Path, str],
) -> str:
    replacements: list[tuple[int, int, str]] = []
    for reference in markdown_link_references(markdown):
        label = reference.label
        target = reference.target
        try:
            parsed_target = urlsplit(target)
        except ValueError:
            continue
        if parsed_target.scheme or parsed_target.netloc or not parsed_target.path:
            continue
        target_path = unquote(parsed_target.path)
        fragment = parsed_target.fragment
        resolved = (source.parent / target_path).resolve()
        if not inside(root, resolved):
            raise RuntimeError(f"Local link escapes project root in {source}: {target}")
        if target_path.lower().endswith(".md"):
            heading = heading_by_path.get(resolved)
            if heading is None:
                continue
            anchor = slugify(unquote(fragment)) if fragment else slugify(heading)
            replacement = f"[{label}](#{anchor})"
        elif resolved.is_file():
            query = f"?{parsed_target.query}" if parsed_target.query else ""
            suffix = f"#{fragment}" if fragment else ""
            replacement = f"[{label}]({resolved}{query}{suffix})"
        else:
            continue
        replacements.append((reference.offset, reference.end, replacement))

    for start, end, replacement in reversed(replacements):
        markdown = markdown[:start] + replacement + markdown[end:]
    return markdown


def normalize_local_images(markdown: str, source: Path, root: Path, work_dir: Path) -> str:
    replacements: list[tuple[int, int, str]] = []
    for reference in markdown_image_references(markdown):
        if reference.source_attribute == "srcset":
            raise RuntimeError("HTML srcset images are not permitted in PDF rendering.")
        if reference.source_attribute != "src":
            continue
        target = reference.target.strip()
        try:
            parsed_target = urlsplit(target)
        except ValueError as error:
            raise RuntimeError(
                f"Invalid image target is not permitted in PDF rendering: {target}"
            ) from error
        if parsed_target.scheme.lower() == "data":
            raise RuntimeError(
                f"Embedded image data is not permitted in PDF rendering: {target[:32]}"
            )
        if parsed_target.scheme or parsed_target.netloc:
            raise RuntimeError(
                f"Remote image targets are not permitted in PDF rendering: {target}"
            )
        target_path = unquote(parsed_target.path)
        resolved = (source.parent / target_path).resolve()
        if not inside(root, resolved) or not resolved.is_file():
            continue
        if resolved.suffix.lower() not in {".jpeg", ".jpg", ".png", ".webp", ".tif", ".tiff"}:
            continue
        digest = hashlib.sha256(str(resolved).encode()).hexdigest()[:16]
        output = work_dir / f"image-{digest}.png"
        run(["convert", str(resolved), "-depth", "8", "-strip", str(output)])
        alt = reference.alt.replace("[", "\\[").replace("]", "\\]")
        end = reference.end
        attributes = re.match(r"\{[^}\n]*\}", markdown[end:])
        attribute_text = "{ width=95% }"
        if attributes is not None:
            attribute_text = attributes.group(0)
            end += len(attribute_text)
        replacements.append(
            (reference.offset, end, f"![{alt}]({output}){attribute_text}")
        )

    for start, end, replacement in reversed(replacements):
        markdown = markdown[:start] + replacement + markdown[end:]
    return markdown


def render_mermaid(markdown: str, work_dir: Path) -> str:
    counter = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal counter
        counter += 1
        source = work_dir / f"diagram-{counter}.mmd"
        output = work_dir / f"diagram-{counter}.png"
        alt = re.sub(r"\s+", " ", match.group(1)).strip()
        source.write_text(match.group(2).strip() + "\n")
        run(
            [
                "mmdc",
                "--input",
                str(source),
                "--output",
                str(output),
                "--backgroundColor",
                "transparent",
                "--scale",
                "2",
                "--configFile",
                str(MERMAID_CONFIG),
                "--puppeteerConfigFile",
                str(PUPPETEER_CONFIG),
            ]
        )
        return f"![{alt}]({output}){{ width=95% }}"

    return re.sub(
        r"<!--\s*diagram-alt:\s*(.*?)\s*-->\s*```mermaid\s*\n(.*?)```",
        replace,
        markdown,
        flags=re.DOTALL,
    )


def guide_sources(root: Path, guide: dict[str, Any]) -> list[Path]:
    values = guide.get("sources", [])
    if not isinstance(values, list) or not values:
        raise RuntimeError(f"Guide {guide.get('id', '?')} has no sources.")
    return [root_path(root, str(value)) for value in values]


def logo_path(root: Path, config: dict[str, Any], work_dir: Path) -> Path | None:
    project = config.get("project", {})
    if not isinstance(project, dict):
        return None
    value = str(project.get("logo", "")).strip()
    if not value:
        return None
    source = root_path(root, value)
    if source.suffix.lower() != ".svg":
        return source
    output = work_dir / "cover-logo.png"
    run(["rsvg-convert", "--width", "900", "--output", str(output), str(source)])
    return output


def front_matter(
    root: Path,
    config: dict[str, Any],
    guide: dict[str, Any],
    work_dir: Path,
) -> str:
    project = config.get("project", {}) if isinstance(config.get("project", {}), dict) else {}
    pdf = config.get("pdf", {}) if isinstance(config.get("pdf", {}), dict) else {}
    title = str(guide.get("title", "Documentation"))
    metadata = [f"Commit {os.environ.get('DOC_COMMIT', 'unknown')}"]
    tag = os.environ.get("DOC_GIT_TAG", "").strip()
    if tag:
        metadata.append(f"Application version {tag}")
    docs_version = str(config.get("documentation_version", "")).strip()
    if docs_version:
        metadata.append(f"Documentation version {docs_version}")
    generated_at = os.environ.get("DOC_GENERATED_AT", "").strip()
    if not generated_at:
        generated_at = dt.datetime.now(dt.UTC).strftime("%Y-%m-%d %H:%M UTC")
    metadata.append(f"Generated {generated_at}")

    accent = re.sub(r"[^0-9A-Fa-f]", "", str(pdf.get("accent_color", "1B6B93"))) or "1B6B93"
    values = [
        "---",
        f"title: {yaml_string(title)}",
        f"subtitle: {yaml_string(' | '.join(metadata))}",
        f"lang: {yaml_string(str(config.get('primary_language', 'en')))}",
        "titlepage: true",
        "toc: true",
        "toc-own-page: true",
        "numbersections: true",
        f"papersize: {yaml_string(str(pdf.get('paper_size', 'a4')))}",
        f"mainfont: {yaml_string(str(pdf.get('main_font', 'Noto Sans')))}",
        f"sansfont: {yaml_string(str(pdf.get('main_font', 'Noto Sans')))}",
        f"monofont: {yaml_string(str(pdf.get('mono_font', 'Noto Sans Mono')))}",
        "colorlinks: true",
        "linkcolor: blue",
        "urlcolor: blue",
        f"titlepage-rule-color: {yaml_string(accent)}",
        f"header-left: {yaml_string(str(pdf.get('header_left', project.get('name', ''))))}",
        f"header-right: {yaml_string(title)}",
        f"footer-left: {yaml_string(str(pdf.get('footer_left', project.get('copyright', ''))))}",
        'geometry: "margin=24mm"',
    ]
    logo = logo_path(root, config, work_dir)
    if logo is not None:
        values.append(f"titlepage-logo: {yaml_string(str(logo))}")
    contact = str(project.get("contact", "")).strip()
    if contact:
        values.append(f"footer-center: {yaml_string(contact)}")
    values.extend(["---", ""])
    return "\n".join(values)


def build_guide(root: Path, config: dict[str, Any], guide: dict[str, Any]) -> Path:
    work_root = root_path(root, str(config.get("work_dir", "docs/.documentation-work")))
    guide_id, work_dir = guide_directory(work_root, "build", guide.get("id", "guide"))
    if work_dir.exists():
        shutil.rmtree(work_dir)
    staging_dir = work_dir / "staging"
    staging_dir.mkdir(parents=True)

    sources = guide_sources(root, guide)
    documents = {
        source.resolve(): source.read_text(encoding="utf-8")
        for source in sources
    }
    headings = {path: first_heading(markdown, path) for path, markdown in documents.items()}
    landscape = {
        root_path(root, str(value)).resolve()
        for value in guide.get("landscape_sources", [])
    }
    internal_token = secrets.token_hex(16)

    sections: list[str] = []
    for source in sources:
        markdown = normalize_local_images(
            documents[source.resolve()], source, root, staging_dir
        )
        markdown = rewrite_local_links(markdown, source, root, headings)
        if source.resolve() in landscape:
            markdown = "\n".join(
                [
                    "::: {.documentation-landscape "
                    f'data-documentation-token="{internal_token}"}}',
                    markdown,
                    ":::",
                ]
            )
        sections.append(markdown.strip())

    page_break = (
        "\n\n::: {.documentation-page-break "
        f'data-documentation-token="{internal_token}"}}\n:::\n\n'
    )
    combined = (
        front_matter(root, config, guide, staging_dir)
        + page_break.join(sections)
        + "\n"
    )
    combined = render_mermaid(combined, staging_dir)
    markdown_path = staging_dir / "combined.md"
    markdown_path.write_text(combined, encoding="utf-8")
    raw_filter = staging_dir / "internal-raw.lua"
    raw_filter.write_text(internal_raw_filter(internal_token), encoding="utf-8")

    output_dir = root_path(root, str(config.get("output_dir", "docs/pdf")))
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / str(guide.get("output", f"{guide_id}.pdf"))

    pdf = config.get("pdf", {}) if isinstance(config.get("pdf", {}), dict) else {}
    template_value = str(pdf.get("template", "")).strip()
    template = root_path(root, template_value) if template_value else DEFAULT_TEMPLATE
    header_value = str(pdf.get("header_include", "")).strip()
    header = root_path(root, header_value) if header_value else DEFAULT_HEADER

    run(
        [
            "pandoc",
            markdown_path.name,
            "--from=markdown+tex_math_dollars-raw_tex-raw_attribute",
            f"--lua-filter={raw_filter.name}",
            f"--template={template}",
            "--pdf-engine=xelatex",
            "--toc",
            "--number-sections",
            "--listings",
            f"--include-in-header={header}",
            f"--resource-path={staging_dir}",
            "--output",
            str(output),
        ],
        cwd=staging_dir,
    )
    return output


def inspect_pdf(root: Path, config: dict[str, Any], guide: dict[str, Any], pdf: Path) -> None:
    if not pdf.is_file():
        raise RuntimeError(f"Missing PDF for inspection: {pdf}")
    work_root = root_path(root, str(config.get("work_dir", "docs/.documentation-work")))
    guide_id, rendered_dir = guide_directory(
        work_root, "rendered", guide.get("id", pdf.stem)
    )
    _, review_dir = guide_directory(work_root, "review", guide_id)
    if rendered_dir.exists():
        shutil.rmtree(rendered_dir)
    rendered_dir.mkdir(parents=True)
    if review_dir.exists():
        shutil.rmtree(review_dir)
    review_dir.mkdir(parents=True)

    info = run(["pdfinfo", str(pdf)], capture=True)
    (review_dir / "pdfinfo.txt").write_text(info)
    page_match = re.search(r"^Pages:\s+(\d+)$", info, re.MULTILINE)
    if page_match is None or int(page_match.group(1)) < 1:
        raise RuntimeError(f"Could not verify a non-empty page count for {pdf}")

    run(["pdftotext", str(pdf), str(review_dir / "extracted.txt")])
    run(["pdftoppm", "-png", "-r", "144", str(pdf), str(rendered_dir / "page")])
    if not list(rendered_dir.glob("page-*.png")):
        raise RuntimeError(f"No rendered review pages were produced for {pdf}")


def image_dimensions(path: Path) -> tuple[int, int]:
    output = run(["identify", "-format", "%w %h", str(path)], capture=True).strip()
    width, height = output.split()
    return int(width), int(height)


def region_values(region: dict[str, Any], width: int, height: int) -> tuple[int, int, int, int]:
    try:
        x = int(region["x"])
        y = int(region["y"])
        region_width = int(region["width"])
        region_height = int(region["height"])
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError(f"Invalid redaction region: {region}") from error
    if x < 0 or y < 0 or region_width < 1 or region_height < 1:
        raise RuntimeError(f"Redaction coordinates must be positive: {region}")
    if x + region_width > width or y + region_height > height:
        raise RuntimeError(f"Redaction region exceeds image dimensions {width}x{height}: {region}")
    return x, y, region_width, region_height


def redact(root: Path, config: dict[str, Any], plan_value: str) -> None:
    plan_path = root_path(root, plan_value)
    try:
        plan = json.loads(plan_path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Cannot load redaction plan: {error}") from error
    if not isinstance(plan, dict):
        raise RuntimeError("Redaction plan must be a JSON object.")

    work_root = root_path(root, str(config.get("work_dir", "docs/.documentation-work")))
    raw_root = (work_root / "raw-screenshots").resolve()
    redacted_root = (work_root / "redacted-screenshots").resolve()
    source = root_path(root, str(plan.get("source", "")))
    output = root_path(root, str(plan.get("output", "")))
    if not inside(raw_root, source) or not source.is_file():
        raise RuntimeError("Redaction source must exist under the raw-screenshots work directory.")
    if not inside(redacted_root, output):
        raise RuntimeError("Redaction output must be under the redacted-screenshots work directory.")
    if output.exists():
        raise RuntimeError(f"Refusing to overwrite existing redacted image: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="documentation-redaction-") as temp_value:
        temp_dir = Path(temp_value)
        current = temp_dir / f"{output.stem}-0.png"
        crop = plan.get("crop")
        if crop is not None:
            if not isinstance(crop, dict):
                raise RuntimeError("Top-level crop must be an object.")
            width, height = image_dimensions(source)
            x, y, crop_width, crop_height = region_values(crop, width, height)
            run(
                [
                    "convert",
                    str(source),
                    "-crop",
                    f"{crop_width}x{crop_height}+{x}+{y}",
                    "+repage",
                    str(current),
                ]
            )
        else:
            shutil.copy2(source, current)

        regions = plan.get("regions", [])
        if not isinstance(regions, list):
            raise RuntimeError("Redaction regions must be an array.")
        for index, region in enumerate(regions, start=1):
            if not isinstance(region, dict):
                raise RuntimeError(f"Redaction region {index} must be an object.")
            width, height = image_dimensions(current)
            x, y, region_width, region_height = region_values(region, width, height)
            style = str(region.get("style", "solid"))
            next_path = temp_dir / f"{output.stem}-{index}.png"
            if style == "mosaic":
                block_size = int(region.get("block_size", 14))
                if block_size < 2:
                    raise RuntimeError("Mosaic block_size must be at least 2 pixels.")
                small_width = max(1, math.ceil(region_width / block_size))
                small_height = max(1, math.ceil(region_height / block_size))
                run(
                    [
                        "convert",
                        str(current),
                        "(",
                        "+clone",
                        "-crop",
                        f"{region_width}x{region_height}+{x}+{y}",
                        "+repage",
                        "-resize",
                        f"{small_width}x{small_height}!",
                        "-filter",
                        "point",
                        "-resize",
                        f"{region_width}x{region_height}!",
                        ")",
                        "-geometry",
                        f"+{x}+{y}",
                        "-composite",
                        str(next_path),
                    ]
                )
            elif style == "solid":
                color = str(region.get("color", "#111111"))
                run(
                    [
                        "convert",
                        str(current),
                        "-fill",
                        color,
                        "-draw",
                        f"rectangle {x},{y} {x + region_width - 1},{y + region_height - 1}",
                        str(next_path),
                    ]
                )
            else:
                raise RuntimeError(f"Unsupported redaction style: {style}")
            current = next_path

        final_image = temp_dir / f"{output.stem}-final.png"
        run(["convert", str(current), "-strip", str(final_image)])
        shutil.move(final_image, output)
    print(f"Created redacted copy: {output.relative_to(root)}")
    print("The original remains in quarantine. Human verification is required before promotion.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Render and inspect configured documentation PDFs.")
    parser.add_argument("--project-root", type=Path, default=Path("/workspace"))
    parser.add_argument("--config", default="docs/documentation.toml")
    parser.add_argument("--render-only", action="store_true")
    parser.add_argument("--redact")
    args = parser.parse_args()

    root = args.project_root.resolve()
    config = load_config(root, args.config)
    if args.redact:
        redact(root, config, args.redact)
        return 0

    guides = [guide for guide in config.get("guides", []) if isinstance(guide, dict)]
    output_dir = root_path(root, str(config.get("output_dir", "docs/pdf")))
    for guide in guides:
        if args.render_only:
            pdf = output_dir / str(guide.get("output", ""))
        else:
            pdf = build_guide(root, config, guide)
        inspect_pdf(root, config, guide, pdf)
        print(f"Verified {pdf.relative_to(root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
