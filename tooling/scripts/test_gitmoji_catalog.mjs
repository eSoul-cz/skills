#!/usr/bin/env node
// Checks the bundled Gitmoji catalog of the gitmoji-commit skill against its provenance
// notes, and that the shortcodes the skill names exist in it.
// Usage: node --test tooling/scripts/test_gitmoji_catalog.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = join(fileURLToPath(new URL('../..', import.meta.url)), 'skills', 'helpers', 'gitmoji-commit');
const read = (path) => readFileSync(join(skill, path));
const catalog = read('references/gitmojis.json');
const entries = JSON.parse(catalog.toString('utf8')).gitmojis;
const notes = read('references/catalog.md').toString('utf8');

test('catalog.md records the hash and entry count of gitmojis.json', () => {
    assert.equal(notes.match(/^- SHA-256: `([0-9a-f]{64})`$/m)?.[1], createHash('sha256').update(catalog).digest('hex'));
    assert.equal(Number(notes.match(/^- Entries: (\d+)$/m)?.[1]), entries.length);
});

test('every shortcode named in the skill exists in the catalog', () => {
    const codes = new Set(entries.map((entry) => entry.code));
    // `:emoji:` is the placeholder of the message format, not a shortcode.
    const placeholders = new Set([':emoji:']);
    const missing = [];
    for (const file of ['SKILL.md', 'references/convention-bootstrap.md']) {
        for (const [code] of read(file).toString('utf8').matchAll(/:[a-z0-9_+-]+:/g)) {
            if (!codes.has(code) && !placeholders.has(code)) {
                missing.push(`${file} → ${code}`);
            }
        }
    }
    assert.deepEqual(missing, []);
});

test('the jq projection the skill names yields one line per entry', () => {
    assert.match(read('SKILL.md').toString('utf8'), /\.gitmojis\[\] \| "\\\(\.code\)\\t\\\(\.description\)"/);
    assert.ok(entries.every((entry) => /^:[a-z0-9_+-]+:$/.test(entry.code) && typeof entry.description === 'string'));
});
