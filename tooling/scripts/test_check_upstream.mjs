#!/usr/bin/env node
// Tests of the upstream drift check (check_upstream.mjs) with a fake tag lister; the network is never used.
// Usage: node --test tooling/scripts/test_check_upstream.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkPins, compareVersions, formatReport, latestRelease, parseVersion, pinnedSources } from './check_upstream.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const manifest = {
    layers: {
        core: { skills: ['a'] },
        up: {
            sources: [{ repo: 'owner/pinned', ref: 'v1.3.2', skills: ['x'] }, { repo: 'owner/floating', skills: ['y'] }],
            groups: {
                extra: { sources: [{ repo: 'owner/pinned', ref: 'v1.3.2', skills: ['z'] }, { repo: 'owner/odd', ref: 'main', skills: ['w'] }] },
            },
        },
    },
};

test('versions parse and compare as numbers, not as text', () => {
    assert.deepEqual(parseVersion('v1.10.0'), [1, 10, 0]);
    assert.equal(parseVersion('1.2'), null);
    assert.equal(parseVersion('v1.2.3-rc1'), null);
    assert.ok(compareVersions(parseVersion('v1.10.0'), parseVersion('v1.9.9')) > 0);
    assert.equal(latestRelease(['v1.9.0', 'v1.10.0', 'nightly', 'v1.3.2', 'v2.0.0-beta']), 'v1.10.0');
    assert.equal(latestRelease(['nightly']), null);
});

test('every pinned source is checked once, wherever it is listed; unpinned sources are ignored', () => {
    const pins = pinnedSources(manifest);
    assert.deepEqual(pins.map((pin) => `${pin.repo}@${pin.ref}`), ['owner/pinned@v1.3.2', 'owner/odd@main']);
    assert.deepEqual(pins[0].where, ['up', 'up:extra']);
});

test('a pin behind the latest release is reported with the newer tag', () => {
    const result = checkPins(manifest, () => ['v1.3.2', 'v1.4.0', 'v1.3.9']);
    assert.deepEqual(result.behind.map((entry) => [entry.repo, entry.ref, entry.latest]), [['owner/pinned', 'v1.3.2', 'v1.4.0']]);
    assert.match(formatReport(result), /NEWER RELEASE owner\/pinned: pinned v1\.3\.2, latest v1\.4\.0/);
});

test('a pin at the latest release is current; a pin that is not a version, or a failing lister, is unchecked', () => {
    const current = checkPins(manifest, () => ['v1.3.2']);
    assert.deepEqual(current.behind, []);
    assert.deepEqual(current.current.map((entry) => entry.repo), ['owner/pinned']);
    assert.match(current.unchecked[0].reason, /not a semantic version/);
    const failing = checkPins(manifest, () => {
        throw new Error('offline');
    });
    assert.match(failing.unchecked.find((entry) => entry.repo === 'owner/pinned').reason, /offline/);
    assert.match(checkPins(manifest, () => []).unchecked[0].reason, /no release tag/);
});

test('the real layers.json has at least one pin and every pin is a semantic version', () => {
    const real = JSON.parse(readFileSync(join(root, 'layers.json'), 'utf8'));
    const pins = pinnedSources(real);
    assert.ok(pins.length >= 1);
    for (const pin of pins) {
        assert.ok(parseVersion(pin.ref), `${pin.repo}@${pin.ref} is not a release tag`);
    }
});

test('the CLI exits 0 for a manifest without pins and reads the file it is given', () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-upstream-'));
    try {
        const file = join(dir, 'layers.json');
        writeFileSync(file, JSON.stringify({ layers: { core: { skills: ['a'] } } }));
        const run = spawnSync('node', [join(root, 'tooling/scripts/check_upstream.mjs'), '--manifest', file], { encoding: 'utf8' });
        assert.equal(run.status, 0, run.stderr);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
