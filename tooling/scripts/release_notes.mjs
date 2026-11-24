#!/usr/bin/env node
// Prints the release notes of one version of the documentation tooling as the single line the release metadata
// (UPGRADE_NOTES in release.env) allows: printable ASCII, at most 1024 characters.
// Usage: node tooling/scripts/release_notes.mjs <version> [--file tooling/CHANGELOG.md]
// The notes are the body of the `## <version>` section of tooling/CHANGELOG.md (Keep a Changelog: `## 0.6.8`, `## [0.6.8]`,
// optionally followed by ` - date`). A missing file, a missing or empty section, a longer or non-ASCII text exits 1,
// which fails the tag build in the Jenkinsfile: a release without notes is not published.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MAX_LENGTH = 1024;
const TYPOGRAPHIC = [[/[\u2013\u2014]/g, '-'], [/[\u2018\u2019]/g, "'"], [/[\u201C\u201D]/g, '"'], [/\u2192/g, '->'], [/\u2026/g, '...'], [/\u00A0/g, ' ']];

/** The lines of the `## <version>` section, or null when there is none. */
export function sectionLines(changelog, version) {
    const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const heading = new RegExp(`^##\\s+\\[?${escaped}\\]?(?:\\s+-\\s+.*|\\s*)$`);
    const lines = changelog.split(/\r?\n/);
    const start = lines.findIndex((line) => heading.test(line));
    if (start === -1) {
        return null;
    }
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^##\s/.test(line));
    return end === -1 ? rest : rest.slice(0, end);
}

/** The section as one line: headings dropped, list markers removed, every item ended with a full stop. */
export function releaseNotes(changelog, version) {
    const lines = sectionLines(changelog, version);
    if (lines === null) {
        throw new Error(`tooling/CHANGELOG.md has no "## ${version}" section; move the entries of "## Unreleased" under it before tagging.`);
    }
    const items = [];
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || /^#{3,}\s/.test(line)) {
            continue;
        }
        const text = line.replace(/^[-*+]\s+/, '');
        if (/^[-*+]\s/.test(line) || items.length === 0) {
            items.push(text);
        } else {
            items[items.length - 1] += ` ${text}`;
        }
    }
    const notes = items
        .map((item) => TYPOGRAPHIC.reduce((out, [pattern, to]) => out.replace(pattern, to), item).replace(/\s+/g, ' ').trim())
        .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`))
        .join(' ');
    if (!notes) {
        throw new Error(`The "## ${version}" section of tooling/CHANGELOG.md is empty.`);
    }
    if (!/^[\x20-\x7E]+$/.test(notes)) {
        throw new Error(`The notes of ${version} hold characters outside printable ASCII (${[...notes].filter((c) => !/[\x20-\x7E]/.test(c)).slice(0, 5).join(' ')}); the release metadata allows ASCII only.`);
    }
    if (notes.length > MAX_LENGTH) {
        throw new Error(`The notes of ${version} have ${notes.length} characters; the release metadata allows ${MAX_LENGTH}. Shorten the section.`);
    }
    return notes;
}

function main() {
    const args = process.argv.slice(2);
    const fileIndex = args.indexOf('--file');
    const file = fileIndex >= 0 ? args[fileIndex + 1] : fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));
    const version = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--file');
    if (!version) {
        console.error('Usage: node tooling/scripts/release_notes.mjs <version> [--file tooling/CHANGELOG.md]');
        process.exit(2);
    }
    try {
        process.stdout.write(`${releaseNotes(readFileSync(file, 'utf8'), version)}\n`);
    } catch (error) {
        console.error(error.code === 'ENOENT' ? `${file} does not exist.` : error.message);
        process.exit(1);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
