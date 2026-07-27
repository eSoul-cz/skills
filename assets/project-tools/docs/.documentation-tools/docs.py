#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

PDF_TOOLS = Path(__file__).resolve().parent / "pdf"
if str(PDF_TOOLS) not in sys.path:
    sys.path.insert(0, str(PDF_TOOLS))

from markdown_images import (
    MarkdownImageReference,
    markdown_image_references,
    markdown_link_references,
)


MINIMUM_PYTHON = (3, 11)
MANIFEST = Path("docs/.documentation-tools/managed-files.json")
CONFIG = Path("docs/documentation.toml")
RASTER_SUFFIXES = {".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}
REMOTE_RENDERER_IMAGE_ENV = "DOCUMENTATION_REMOTE_RENDERER_IMAGE"


@dataclass
class Validation:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def report(self) -> int:
        for message in self.warnings:
            print(f"WARNING: {message}")
        for message in self.errors:
            print(f"ERROR: {message}", file=sys.stderr)
        if self.errors:
            print(
                f"Validation failed with {len(self.errors)} error(s) "
                f"and {len(self.warnings)} warning(s).",
                file=sys.stderr,
            )
            return 1
        print(f"Validation passed with {len(self.warnings)} warning(s).")
        return 0


def inside(root: Path, path: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError:
        return False
    return True


def project_path(root: Path, value: str) -> Path:
    path = (root / value).resolve()
    if not inside(root, path):
        raise ValueError(f"Path escapes the project root: {value}")
    return path


def load_config(root: Path) -> dict[str, Any]:
    path = root / CONFIG
    try:
        with path.open("rb") as stream:
            data = tomllib.load(stream)
    except FileNotFoundError as error:
        raise RuntimeError(f"Missing configuration: {CONFIG}") from error
    except tomllib.TOMLDecodeError as error:
        raise RuntimeError(f"Invalid {CONFIG}: {error}") from error
    if not isinstance(data, dict):
        raise RuntimeError(f"{CONFIG} must contain a TOML table.")
    return data


def config_string(config: dict[str, Any], key: str, default: str = "") -> str:
    value = config.get(key, default)
    if not isinstance(value, str):
        raise RuntimeError(f"Configuration key '{key}' must be a string.")
    return value


def guide_list(config: dict[str, Any]) -> list[dict[str, Any]]:
    guides = config.get("guides", [])
    if not isinstance(guides, list):
        raise RuntimeError("Configuration key 'guides' must be an array of tables.")
    return [guide for guide in guides if isinstance(guide, dict)]


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def markdown_slug(value: str) -> str:
    value = re.sub(r"[`*_~]", "", value).lower().strip()
    value = re.sub(r"[^\w -]", "", value)
    return re.sub(r"[ -]+", "-", value).strip("-")


def markdown_anchors(text: str) -> set[str]:
    return {
        markdown_slug(match.group(1))
        for match in re.finditer(r"^#{1,6}\s+(.+?)\s*$", text, re.MULTILINE)
    }

def raster_dimensions(path: Path) -> tuple[int, int] | None:
    """Read supported raster dimensions without adding a host-side image dependency."""
    data = path.read_bytes()
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    if data.startswith(b"\xff\xd8"):
        offset = 2
        while offset + 9 < len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            marker = data[offset + 1]
            offset += 2
            if marker in {0xD8, 0xD9}:
                continue
            if offset + 2 > len(data):
                break
            length = int.from_bytes(data[offset : offset + 2], "big")
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                if offset + 7 <= len(data):
                    return (
                        int.from_bytes(data[offset + 5 : offset + 7], "big"),
                        int.from_bytes(data[offset + 3 : offset + 5], "big"),
                    )
                break
            if length < 2:
                break
            offset += length
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        offset = 12
        while offset + 8 <= len(data):
            chunk_type = data[offset : offset + 4]
            chunk_length = int.from_bytes(data[offset + 4 : offset + 8], "little")
            chunk = data[offset + 8 : offset + 8 + chunk_length]
            if chunk_type == b"VP8X" and len(chunk) >= 10:
                return (
                    1 + int.from_bytes(chunk[4:7], "little"),
                    1 + int.from_bytes(chunk[7:10], "little"),
                )
            if chunk_type == b"VP8 " and len(chunk) >= 10 and chunk[3:6] == b"\x9d\x01\x2a":
                return (
                    int.from_bytes(chunk[6:8], "little") & 0x3FFF,
                    int.from_bytes(chunk[8:10], "little") & 0x3FFF,
                )
            if chunk_type == b"VP8L" and len(chunk) >= 5 and chunk[0] == 0x2F:
                bits = int.from_bytes(chunk[1:5], "little")
                return (1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF))
            offset += 8 + chunk_length + (chunk_length % 2)
    if data[:2] in {b"II", b"MM"} and len(data) >= 8:
        byte_order = "little" if data[:2] == b"II" else "big"
        if int.from_bytes(data[2:4], byte_order) != 42:
            return None
        directory_offset = int.from_bytes(data[4:8], byte_order)
        if directory_offset + 2 > len(data):
            return None
        entry_count = int.from_bytes(data[directory_offset : directory_offset + 2], byte_order)
        dimensions: dict[int, int] = {}
        for index in range(entry_count):
            entry_offset = directory_offset + 2 + (index * 12)
            if entry_offset + 12 > len(data):
                return None
            tag = int.from_bytes(data[entry_offset : entry_offset + 2], byte_order)
            value_type = int.from_bytes(data[entry_offset + 2 : entry_offset + 4], byte_order)
            value_count = int.from_bytes(data[entry_offset + 4 : entry_offset + 8], byte_order)
            if tag not in {256, 257} or value_count < 1:
                continue
            if value_type == 3 and value_count == 1:
                value = int.from_bytes(data[entry_offset + 8 : entry_offset + 10], byte_order)
            elif value_type == 4 and value_count == 1:
                value = int.from_bytes(data[entry_offset + 8 : entry_offset + 12], byte_order)
            else:
                continue
            dimensions[tag] = value
        if 256 in dimensions and 257 in dimensions:
            return (dimensions[256], dimensions[257])
    return None


def manifest_rows(root: Path, path: Path, result: Validation) -> dict[str, dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    header: list[str] | None = None
    rows: dict[str, dict[str, str]] = {}
    for line in lines:
        if not line.strip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if header is None:
            header = [cell.lower() for cell in cells]
            continue
        if all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        if len(cells) != len(header):
            continue
        row = dict(zip(header, cells, strict=True))
        published_path = row.get("published path", row.get("filename", "")).strip("` ")
        if not published_path:
            continue
        try:
            resolved = project_path(root, published_path)
        except ValueError as error:
            result.error(f"{path.relative_to(root)}: {error}")
            continue
        relative = resolved.relative_to(root).as_posix()
        if (
            Path(published_path).is_absolute()
            or len(Path(published_path).parts) < 2
            or published_path != relative
        ):
            result.error(
                f"{path.relative_to(root)}: screenshot path must be normalized and project-relative: "
                f"{published_path}"
            )
            continue
        if relative in rows:
            result.error(
                f"{path.relative_to(root)}: duplicate screenshot manifest path: {relative}"
            )
            continue
        rows[relative] = row
    return rows


def trusted_remote_renderer_image(pdf: dict[str, Any]) -> str:
    configured = str(pdf.get("image", "")).strip()
    if "@sha256:" not in configured:
        raise RuntimeError("Remote pdf.image must be pinned by an immutable sha256 digest.")
    trusted = os.environ.get(REMOTE_RENDERER_IMAGE_ENV, "").strip()
    if not trusted:
        raise RuntimeError(
            f"Remote PDF mode requires {REMOTE_RENDERER_IMAGE_ENV} to be set by trusted runtime "
            "configuration outside the repository."
        )
    if configured != trusted:
        raise RuntimeError(
            f"Configured remote renderer is not allowlisted by {REMOTE_RENDERER_IMAGE_ENV}."
        )
    return trusted


def validate_markdown(root: Path, source: Path, config: dict[str, Any], result: Validation) -> None:
    relative = source.relative_to(root).as_posix()
    text = source.read_text(encoding="utf-8")
    headings = list(re.finditer(r"^(#{1,6})\s+\S.*$", text, re.MULTILINE))
    h1_count = sum(1 for match in headings if len(match.group(1)) == 1)
    if h1_count != 1:
        result.error(f"{relative}: expected exactly one H1, found {h1_count}.")

    previous_level = 0
    for match in headings:
        level = len(match.group(1))
        if previous_level and level > previous_level + 1:
            result.warn(
                f"{relative}:{line_number(text, match.start())}: heading level jumps "
                f"from H{previous_level} to H{level}."
            )
        previous_level = level

    for image in markdown_image_references(text):
        if not image.alt.strip():
            result.error(
                f"{relative}:{line_number(text, image.offset)}: image alt text is empty."
            )

    links = markdown_link_references(text)
    for link in links:
        label = link.label.strip().lower()
        if label in {"click here", "here", "link", "more"}:
            result.warn(
                f"{relative}:{line_number(text, link.offset)}: link text '{label}' is not descriptive."
            )

    for link in links:
        target = link.target
        try:
            parsed_target = urlsplit(target)
        except ValueError:
            result.error(
                f"{relative}:{line_number(text, link.offset)}: invalid link target: {target}"
            )
            continue
        if parsed_target.scheme or parsed_target.netloc:
            continue
        local_target = unquote(parsed_target.path)
        fragment = parsed_target.fragment
        resolved = source.resolve() if not local_target else (source.parent / local_target).resolve()
        if not inside(root, resolved):
            result.error(
                f"{relative}:{line_number(text, link.offset)}: local link escapes the project: {target}"
            )
        elif not resolved.exists():
            result.error(
                f"{relative}:{line_number(text, link.offset)}: broken local link: {target}"
            )
        elif fragment and resolved.is_file() and resolved.suffix.lower() == ".md":
            normalized_fragment = markdown_slug(unquote(fragment))
            if normalized_fragment not in markdown_anchors(
                resolved.read_text(encoding="utf-8")
            ):
                result.error(
                    f"{relative}:{line_number(text, link.offset)}: broken Markdown anchor: {target}"
                )

    prose = re.sub(r"^```.*?^```\s*$", "", text, flags=re.MULTILINE | re.DOTALL)
    if "```{=latex}" in text or re.search(r"^\\(?:begin|end)\{", prose, re.MULTILINE):
        result.error(f"{relative}: authored Markdown contains renderer-specific raw LaTeX.")

    for mermaid in re.finditer(r"```mermaid\s*\n(.*?)```", text, re.DOTALL):
        prefix = text[max(0, mermaid.start() - 500) : mermaid.start()]
        if not re.search(r"<!--\s*diagram-alt:\s*\S.*?-->\s*$", prefix, re.DOTALL):
            result.error(
                f"{relative}:{line_number(text, mermaid.start())}: Mermaid diagram needs an immediately preceding "
                "'<!-- diagram-alt: ... -->' text alternative."
            )
    if "```mermaid" in text and not re.search(r"```mermaid\s*\n.*?```", text, re.DOTALL):
        result.error(f"{relative}: unterminated Mermaid fence.")

    private_key = re.search(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", text)
    if private_key:
        result.error(
            f"{relative}:{line_number(text, private_key.start())}: private key material detected."
        )

    credential_pattern = re.compile(
        r"(?i)(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*['\"]?([A-Za-z0-9_./+\-=]{12,})"
    )
    for match in credential_pattern.finditer(text):
        result.warn(
            f"{relative}:{line_number(text, match.start())}: credential-shaped value requires review."
        )

    privacy = config.get("privacy", {})
    allowed_domains = set()
    if isinstance(privacy, dict):
        allowed_domains = {
            str(domain).lower() for domain in privacy.get("allowed_email_domains", [])
        }
    for match in re.finditer(r"\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b", text, re.IGNORECASE):
        domain = match.group(1).lower()
        if domain not in allowed_domains:
            result.warn(
                f"{relative}:{line_number(text, match.start())}: email address outside the privacy allowlist."
            )


def git_ignored(root: Path, relative: str) -> bool:
    if not (root / ".git").exists() or shutil.which("git") is None:
        return False
    completed = subprocess.run(
        ["git", "check-ignore", "--no-index", "-q", relative],
        cwd=root,
        check=False,
    )
    return completed.returncode == 0


def validate_project(root: Path, config: dict[str, Any]) -> Validation:
    result = Validation()
    if config.get("schema_version") != 1:
        result.error("schema_version must be 1.")

    for required in ("output_dir", "work_dir", "primary_language"):
        if not isinstance(config.get(required), str) or not str(config.get(required)).strip():
            result.error(f"Configuration key '{required}' must be a non-empty string.")

    try:
        output_dir = project_path(root, config_string(config, "output_dir", "docs/pdf"))
        work_dir = project_path(root, config_string(config, "work_dir", "docs/.documentation-work"))
    except (ValueError, RuntimeError) as error:
        result.error(str(error))
        return result

    if (root / ".git").exists():
        relative_work = work_dir.relative_to(root).as_posix() + "/.ignore-probe"
        if not git_ignored(root, relative_work):
            result.error(f"Work directory is not ignored by Git: {work_dir.relative_to(root)}")

        if not bool(config.get("commit_pdf_outputs", False)):
            relative_output = output_dir.relative_to(root).as_posix() + "/.ignore-probe.pdf"
            if not git_ignored(root, relative_output):
                result.error(f"PDF output directory is not ignored by Git: {output_dir.relative_to(root)}")
        if not git_value(root, ["rev-parse", "--verify", "HEAD"]):
            if str(config.get("documentation_version", "")).strip():
                result.warn("Git revision is unavailable; PDFs will rely on documentation_version for traceability.")
            else:
                result.warn(
                    "Git revision and documentation_version are unavailable; generated PDFs will be marked "
                    "'Commit unknown' and are not publish-ready without an explicit review disposition."
                )
    else:
        result.warn("Git metadata is unavailable; ignore rules and revision metadata cannot be verified.")

    pdf = config.get("pdf", {})
    if not isinstance(pdf, dict):
        result.error("Configuration key 'pdf' must be a table.")
    else:
        mode = pdf.get("mode", "local")
        if mode not in {"local", "remote"}:
            result.error("pdf.mode must be 'local' or 'remote'.")
        if mode == "remote":
            try:
                trusted_remote_renderer_image(pdf)
            except RuntimeError as error:
                result.error(str(error))
        if mode == "local":
            try:
                dockerfile = project_path(root, str(pdf.get("dockerfile", "")))
                if not dockerfile.is_file():
                    result.error(f"Missing configured Dockerfile: {dockerfile.relative_to(root)}")
            except ValueError as error:
                result.error(str(error))

    guides = guide_list(config)
    if not guides:
        result.error("At least one [[guides]] table is required.")
        return result

    seen_ids: set[str] = set()
    seen_outputs: set[str] = set()
    seen_sources: set[Path] = set()
    published_rasters: dict[str, tuple[Path, Path]] = {}

    for index, guide in enumerate(guides, start=1):
        guide_id = str(guide.get("id", "")).strip()
        title = str(guide.get("title", "")).strip()
        output = str(guide.get("output", "")).strip()
        sources = guide.get("sources", [])
        if not guide_id or not re.fullmatch(r"[a-z0-9-]+", guide_id):
            result.error(f"Guide {index}: id must use lowercase letters, digits, and hyphens.")
        elif guide_id in seen_ids:
            result.error(f"Duplicate guide id: {guide_id}")
        seen_ids.add(guide_id)
        if not title:
            result.error(f"Guide {guide_id or index}: title is required.")
        if not output.lower().endswith(".pdf") or "/" in output or "\\" in output:
            result.error(f"Guide {guide_id or index}: output must be a PDF filename, not a path.")
        elif output in seen_outputs:
            result.error(f"Duplicate guide output: {output}")
        seen_outputs.add(output)
        if not isinstance(sources, list) or not sources:
            result.error(f"Guide {guide_id or index}: sources must be a non-empty array.")
            continue
        for value in sources:
            if not isinstance(value, str):
                result.error(f"Guide {guide_id or index}: source paths must be strings.")
                continue
            try:
                source = project_path(root, value)
            except ValueError as error:
                result.error(str(error))
                continue
            if source in seen_sources:
                result.warn(f"Source appears in multiple guides: {value}")
            seen_sources.add(source)
            if not source.is_file():
                result.error(f"Missing source: {value}")
                continue
            validate_markdown(root, source, config, result)
            text = source.read_text(encoding="utf-8")
            for image in markdown_image_references(text):
                if image.source_attribute == "srcset":
                    result.error(
                        f"{source.relative_to(root)}:{line_number(text, image.offset)}: HTML srcset "
                        "images are not supported; use one approved project-local src image instead."
                    )
                    continue
                target = image.target.strip()
                try:
                    parsed_target = urlsplit(target)
                except ValueError:
                    result.error(
                        f"{source.relative_to(root)}:{line_number(text, image.offset)}: "
                        f"invalid image target: {target}"
                    )
                    continue
                if parsed_target.scheme.lower() == "data":
                    result.error(
                        f"{source.relative_to(root)}:{line_number(text, image.offset)}: embedded data URI "
                        "images are not permitted; publish an approved project-local raster instead."
                    )
                    continue
                if parsed_target.scheme or parsed_target.netloc:
                    result.error(
                        f"{source.relative_to(root)}:{line_number(text, image.offset)}: remote images "
                        "are not permitted; publish an approved project-local raster instead."
                    )
                    continue
                if not target:
                    continue
                local_target = unquote(parsed_target.path)
                image_path = (source.parent / local_target).resolve()
                if not inside(root, image_path):
                    result.error(
                        f"{source.relative_to(root)}:{line_number(text, image.offset)}: published image "
                        f"escapes the project: {target}"
                    )
                    continue
                if not image_path.is_file():
                    result.error(
                        f"{source.relative_to(root)}:{line_number(text, image.offset)}: published image "
                        f"does not exist: {target}"
                    )
                    continue
                if image_path.suffix.lower() not in RASTER_SUFFIXES:
                    continue
                relative_image = image_path.relative_to(root).as_posix()
                published_rasters.setdefault(relative_image, (source, image_path))

    if published_rasters:
        manifests = list((root / "docs").glob("**/SCREENSHOTS.md"))
        rows: dict[str, dict[str, str]] = {}
        row_manifests: dict[str, Path] = {}
        for manifest in manifests:
            for published_path, row in manifest_rows(root, manifest, result).items():
                if published_path in rows:
                    result.error(
                        f"Duplicate screenshot manifest path {published_path}: "
                        f"{row_manifests[published_path].relative_to(root)} and "
                        f"{manifest.relative_to(root)}"
                    )
                    continue
                rows[published_path] = row
                row_manifests[published_path] = manifest
        if not manifests:
            result.error("Published images exist but no SCREENSHOTS.md manifest was found.")
        else:
            for published_path, (source, image_path) in published_rasters.items():
                row = rows.get(published_path)
                if row is None:
                    result.error(
                        f"{source.relative_to(root)}: published raster image is absent from screenshot "
                        f"manifests: {published_path}"
                    )
                    continue
                dimensions = row.get("image dimensions", "")
                actual = raster_dimensions(image_path) if image_path.is_file() else None
                match = re.fullmatch(r"\s*(\d+)\s*[x×]\s*(\d+)\s*", dimensions)
                if image_path.is_file() and actual is None:
                    result.error(
                        f"{source.relative_to(root)}: cannot read dimensions for published raster: "
                        f"{published_path}"
                    )
                elif actual is not None and match is None:
                    result.error(
                        f"{source.relative_to(root)}: screenshot manifest must record Image dimensions "
                        f"for {published_path} as {actual[0]}×{actual[1]}."
                    )
                elif actual is not None and actual != (int(match.group(1)), int(match.group(2))):
                    result.error(
                        f"{source.relative_to(root)}: screenshot dimensions drifted for {published_path}; "
                        f"manifest says {match.group(1)}×{match.group(2)}, file is {actual[0]}×{actual[1]}."
                    )
                approval = row.get("approval", "").strip().lower()
                if approval not in {"approved", "not required"}:
                    result.error(
                        f"{source.relative_to(root)}: screenshot {published_path} lacks publication approval."
                    )

    return result


def run(command: list[str], cwd: Path) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def git_value(root: Path, args: list[str]) -> str:
    if shutil.which("git") is None or not (root / ".git").exists():
        return ""
    completed = subprocess.run(
        ["git", *args], cwd=root, check=False, text=True, capture_output=True
    )
    return completed.stdout.strip() if completed.returncode == 0 else ""


def tool_version(root: Path) -> str:
    try:
        manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return "unknown"
    return str(manifest.get("tool_version", "unknown"))


def docker_settings(config: dict[str, Any]) -> tuple[dict[str, Any], str]:
    pdf = config.get("pdf", {})
    if not isinstance(pdf, dict):
        raise RuntimeError("Configuration key 'pdf' must be a table.")
    platform = str(pdf.get("platform", "")).strip()
    return pdf, platform


def docker_image(root: Path, config: dict[str, Any]) -> str:
    pdf, platform = docker_settings(config)
    mode = str(pdf.get("mode", "local"))
    if mode == "remote":
        image = trusted_remote_renderer_image(pdf)
        pull = ["docker", "pull"]
        if platform:
            pull.extend(["--platform", platform])
        run([*pull, image], root)
        return image

    dockerfile = project_path(root, str(pdf.get("dockerfile", "")))
    context = dockerfile.parent
    version = re.sub(r"[^A-Za-z0-9_.-]", "-", tool_version(root))
    image = f"esoul-documentation-tools:{version}"
    uid = str(os.getuid()) if hasattr(os, "getuid") else "1000"
    gid = str(os.getgid()) if hasattr(os, "getgid") else "1000"
    build = ["docker", "build"]
    if platform:
        build.extend(["--platform", platform])
    run(
        [
            *build,
            "--build-arg",
            f"DOC_UID={uid}",
            "--build-arg",
            f"DOC_GID={gid}",
            "--file",
            str(dockerfile),
            "--tag",
            image,
            str(context),
        ],
        root,
    )
    return image


def docker_run(root: Path, config: dict[str, Any], renderer_args: list[str]) -> None:
    output_dir = project_path(root, config_string(config, "output_dir", "docs/pdf"))
    work_dir = project_path(root, config_string(config, "work_dir", "docs/.documentation-work"))
    project_root = root.resolve()
    git_dir = (project_root / ".git").resolve()
    for key, directory in (("output_dir", output_dir), ("work_dir", work_dir)):
        if directory == project_root or inside(git_dir, directory):
            raise RuntimeError(
                f"Configuration key '{key}' must use a dedicated directory outside .git."
            )
    image = docker_image(root, config)
    output_dir.mkdir(parents=True, exist_ok=True)
    work_dir.mkdir(parents=True, exist_ok=True)
    command = [
        "docker",
        "run",
        "--rm",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "512",
        "--shm-size",
        "256m",
        "--network",
        "none",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,size=1g",
        "--env",
        "HOME=/tmp",
        "--env",
        "XDG_CACHE_HOME=/tmp/.cache",
    ]
    _, platform = docker_settings(config)
    if platform:
        command.extend(["--platform", platform])
    if hasattr(os, "getuid") and hasattr(os, "getgid"):
        command.extend(["--user", f"{os.getuid()}:{os.getgid()}"])
    command.extend(
        [
            "--env",
            f"DOC_COMMIT={git_value(root, ['rev-parse', '--short=12', 'HEAD']) or 'unknown'}",
            "--env",
            f"DOC_GIT_TAG={git_value(root, ['describe', '--tags', '--abbrev=0'])}",
            "--env",
            f"DOC_GENERATED_AT={dt.datetime.now(dt.UTC).strftime('%Y-%m-%d %H:%M UTC')}",
            "--volume",
            f"{root}:/workspace:ro",
            "--volume",
            f"{output_dir}:/workspace/{output_dir.relative_to(root).as_posix()}:rw",
            "--volume",
            f"{work_dir}:/workspace/{work_dir.relative_to(root).as_posix()}:rw",
            image,
            "--project-root",
            "/workspace",
            "--config",
            CONFIG.as_posix(),
            *renderer_args,
        ]
    )
    run(command, root)


def command_validate(root: Path) -> int:
    try:
        config = load_config(root)
        return validate_project(root, config).report()
    except (RuntimeError, OSError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


def command_build(root: Path) -> int:
    try:
        config = load_config(root)
        result = validate_project(root, config)
        if result.report() != 0:
            return 1
        docker_run(root, config, [])
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


def command_render(root: Path) -> int:
    try:
        config = load_config(root)
        docker_run(root, config, ["--render-only"])
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


def command_redact(root: Path, plan: str) -> int:
    try:
        config = load_config(root)
        plan_path = project_path(root, plan)
        if not plan_path.is_file():
            raise RuntimeError(f"Redaction plan does not exist: {plan}")
        docker_run(root, config, ["--redact", plan_path.relative_to(root).as_posix()])
    except (RuntimeError, OSError, subprocess.CalledProcessError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    if sys.version_info < MINIMUM_PYTHON:
        raise SystemExit("Python 3.11 or newer is required.")

    parser = argparse.ArgumentParser(description="Project-local application documentation tools.")
    parser.add_argument("--project-root", type=Path, required=True)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("validate")
    subparsers.add_parser("build")
    subparsers.add_parser("render")
    redact = subparsers.add_parser("redact")
    redact.add_argument("plan")
    subparsers.add_parser("version")
    args = parser.parse_args()

    root = args.project_root.expanduser().resolve()
    if args.command == "validate":
        return command_validate(root)
    if args.command == "build":
        return command_build(root)
    if args.command == "render":
        return command_render(root)
    if args.command == "redact":
        return command_redact(root, args.plan)
    print(tool_version(root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
