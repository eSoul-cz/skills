#!/usr/bin/env node
// Checks that the generated role briefs of esoul-model-routing match agents/*.md.
// Usage: node --test tooling/scripts/test_build_roles.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { render } from './build_roles.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = join(root, 'tooling/scripts/build_roles.mjs');
const rolesFile = join(root, 'skills/helpers/esoul-model-routing/references/roles.md');
const run = (...args) => spawnSync('node', [script, ...args], { encoding: 'utf8' });

test('the committed roles.md is in sync with agents/', () => {
    const result = run('--check');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(rolesFile, 'utf8'), render());
});

test('roles.md has a section with the brief, model and effort of every agent', () => {
    const text = readFileSync(rolesFile, 'utf8');
    assert.match(text, /^<!-- Generated from agents\/\*\.md/);
    for (const file of readdirSync(join(root, 'agents')).filter((name) => name.endsWith('.md'))) {
        const name = file.replace(/\.md$/, '');
        const source = readFileSync(join(root, 'agents', file), 'utf8');
        const model = source.match(/^model:\s*(\S+)/m)[1];
        const effort = source.match(/^effort:\s*(\S+)/m)[1];
        const body = source.split(/^---$/m)[2].trim();
        const section = text.split(/^## /m).find((part) => part.startsWith(`${name}\n`));
        assert.ok(section, `${name}: no section`);
        assert.ok(section.includes(`Recommended model: \`${model}\`, effort \`${effort}\``), `${name}: model or effort`);
        assert.ok(section.includes(body), `${name}: brief differs from agents/${file}`);
    }
});

test('--check fails for a stale or missing file and --file writes a fresh one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-roles-'));
    try {
        const file = join(dir, 'roles.md');
        assert.equal(run('--check', '--file', file).status, 1, 'missing file');
        assert.equal(run('--file', file).status, 0);
        assert.equal(run('--check', '--file', file).status, 0);
        writeFileSync(file, `${readFileSync(file, 'utf8')}\nhand edit\n`);
        const stale = run('--check', '--file', file);
        assert.equal(stale.status, 1);
        assert.match(stale.stderr, /out of date/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
