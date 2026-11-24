#!/usr/bin/env node
// Tests of the release-notes reader the tag build uses (release_notes.mjs).
// Usage: node --test tooling/scripts/test_release_notes.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAX_LENGTH, releaseNotes, sectionLines } from './release_notes.mjs';

const script = fileURLToPath(new URL('./release_notes.mjs', import.meta.url));
const changelog = `# Changelog

## Unreleased

### Added
- Not released yet.

## [0.6.8] - 2026-12-01

### Changed
- Typesets code with fvextra instead of listings, so Czech letters render
  in order.
- The upgrade replaces the managed \`header.tex\` \u2013 configuration schema stays 1

### Removed
- Code blocks no longer show line numbers.

## 0.6.7
- Older notes.
`;

test('the section of a version is found with or without brackets and date, and stops at the next version', () => {
    assert.equal(sectionLines(changelog, '0.6.7').join('').trim(), '- Older notes.');
    assert.ok(sectionLines(changelog, '0.6.8').some((line) => line.includes('fvextra')));
    assert.ok(!sectionLines(changelog, '0.6.8').some((line) => line.includes('Older')));
    assert.equal(sectionLines(changelog, '0.6.80'), null, 'a version is matched whole');
    assert.equal(sectionLines(changelog, '0.6'), null);
});

test('the notes are one ASCII line: headings dropped, wrapped items joined, every item ended with a full stop', () => {
    assert.equal(
        releaseNotes(changelog, '0.6.8'),
        'Typesets code with fvextra instead of listings, so Czech letters render in order. The upgrade replaces the managed `header.tex` - configuration schema stays 1. Code blocks no longer show line numbers.',
    );
});

test('a missing, empty, over-long or non-ASCII section is an error', () => {
    assert.throws(() => releaseNotes(changelog, '9.9.9'), /no "## 9\.9\.9" section/);
    assert.throws(() => releaseNotes('## 1.0.0\n\n### Added\n\n## 0.9.0\n- x\n', '1.0.0'), /empty/);
    assert.throws(() => releaseNotes(`## 1.0.0\n- ${'a'.repeat(MAX_LENGTH)}\n`, '1.0.0'), /allows 1024/);
    assert.throws(() => releaseNotes('## 1.0.0\n- Nové písmo\n', '1.0.0'), /outside printable ASCII/);
});

test('the CLI prints the notes, and fails for a missing section or file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'release-notes-'));
    try {
        const file = join(dir, 'CHANGELOG.md');
        writeFileSync(file, changelog);
        const ok = spawnSync('node', [script, '0.6.7', '--file', file], { encoding: 'utf8' });
        assert.equal(ok.status, 0, ok.stderr);
        assert.equal(ok.stdout, 'Older notes.\n');
        assert.equal(spawnSync('node', [script, '1.2.3', '--file', file], { encoding: 'utf8' }).status, 1);
        const missing = spawnSync('node', [script, '0.6.7', '--file', join(dir, 'nope.md')], { encoding: 'utf8' });
        assert.equal(missing.status, 1);
        assert.match(missing.stderr, /does not exist/);
        assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
