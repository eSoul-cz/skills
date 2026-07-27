#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path


TOOL_VERSION = "0.1.4"
MANIFEST_PATH = Path("docs/.documentation-tools/managed-files.json")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def semantic_version(value: object) -> tuple[int, int, int] | None:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", str(value))
    if match is None:
        return None
    return tuple(int(part) for part in match.groups())


def source_files(asset_root: Path) -> dict[Path, Path]:
    return {
        path.relative_to(asset_root): path
        for path in sorted(asset_root.rglob("*"))
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"
    }


def load_manifest(project_root: Path) -> dict[str, object] | None:
    path = project_root / MANIFEST_PATH
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text())
    except (json.JSONDecodeError, OSError) as error:
        raise RuntimeError(f"Cannot read managed-tool manifest: {error}") from error
    if not isinstance(data, dict):
        raise RuntimeError("Managed-tool manifest must contain a JSON object.")
    return data


def drift(project_root: Path, manifest: dict[str, object]) -> list[str]:
    managed_files = manifest.get("managed_files")
    if not isinstance(managed_files, dict):
        return ["Manifest does not contain a valid managed_files object."]

    findings: list[str] = []
    for relative, expected in managed_files.items():
        target = project_root / str(relative)
        if not target.is_file():
            findings.append(f"Missing managed file: {relative}")
            continue
        actual = sha256(target)
        if actual != expected:
            findings.append(f"Locally modified managed file: {relative}")
    return findings


def manifest_payload(project_root: Path, relative_files: list[Path]) -> dict[str, object]:
    return {
        "schema_version": 1,
        "tool_version": TOOL_VERSION,
        "managed_files": {
            path.as_posix(): sha256(project_root / path)
            for path in sorted(relative_files)
        },
    }


def install(project_root: Path, upgrade: bool) -> None:
    skill_root = Path(__file__).resolve().parents[1]
    asset_root = skill_root / "assets/project-tools"
    files = source_files(asset_root)
    existing = load_manifest(project_root)

    if existing is not None:
        findings = drift(project_root, existing)
        if findings:
            raise RuntimeError(
                "Managed tooling has local drift; resolve it before installation:\n"
                + "\n".join(f"- {finding}" for finding in findings)
            )
        if not upgrade:
            installed = existing.get("tool_version", "unknown")
            raise RuntimeError(
                f"Managed tooling {installed} is already installed. "
                "Use --check or explicitly approve and run --upgrade."
            )
        installed_version = semantic_version(existing.get("tool_version"))
        bundled_version = semantic_version(TOOL_VERSION)
        if (
            installed_version is not None
            and bundled_version is not None
            and installed_version > bundled_version
        ):
            raise RuntimeError(
                f"Refusing to downgrade managed tooling from {existing.get('tool_version')} "
                f"to bundled version {TOOL_VERSION}."
            )

    conflicting = [
        relative.as_posix()
        for relative in files
        if (project_root / relative).exists() and existing is None
    ]
    if conflicting:
        raise RuntimeError(
            "Refusing to overwrite files not owned by a managed manifest:\n"
            + "\n".join(f"- {path}" for path in conflicting)
        )

    for relative, source in files.items():
        target = project_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    relative_files = [path for path in files if path != MANIFEST_PATH]
    manifest = manifest_payload(project_root, relative_files)
    manifest_path = project_root / MANIFEST_PATH
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")

    action = "Upgraded" if existing is not None else "Installed"
    print(f"{action} documentation tooling {TOOL_VERSION} in {project_root}")
    print("Project-owned configuration and documentation templates were not overwritten.")
    print("Ensure /docs/.documentation-work/ is ignored by Git.")
    print("Ignore /docs/pdf/ unless documentation.toml intentionally commits PDF outputs.")


def check(project_root: Path) -> int:
    manifest = load_manifest(project_root)
    if manifest is None:
        print("Documentation tooling is not installed.", file=sys.stderr)
        return 1
    findings = drift(project_root, manifest)
    installed = manifest.get("tool_version", "unknown")
    print(f"Installed documentation tooling: {installed}")
    print(f"Bundled documentation tooling: {TOOL_VERSION}")
    if findings:
        for finding in findings:
            print(f"DRIFT: {finding}", file=sys.stderr)
        return 1
    installed_version = semantic_version(installed)
    bundled_version = semantic_version(TOOL_VERSION)
    if installed_version is None or bundled_version is None:
        if str(installed) != TOOL_VERSION:
            print("VERSION DIFFERS: inspect versions before explicitly running --upgrade.")
    elif installed_version < bundled_version:
        print("UPDATE AVAILABLE: explicit --upgrade is required.")
    elif installed_version > bundled_version:
        print("Installed tooling is newer than the bundle; downgrade is disabled.")
    else:
        print("Managed files match their recorded checksums.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Install or verify the project-local eSoul documentation toolchain."
    )
    parser.add_argument("project_root", type=Path)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--check", action="store_true")
    action.add_argument("--upgrade", action="store_true")
    args = parser.parse_args()

    project_root = args.project_root.expanduser().resolve()
    if not project_root.is_dir():
        parser.error(f"Project root does not exist: {project_root}")

    try:
        if args.check:
            return check(project_root)
        install(project_root, args.upgrade)
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
