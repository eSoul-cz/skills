import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('check_upstream.mjs', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));

function fixture() {
    const dir = mkdtempSync(join(tmpdir(), 'check-upstream-'));
    const upstream = join(dir, 'upstream');
    const files = { 'skills/a/SKILL.md': 'alpha\n', 'skills/b/SKILL.md': 'beta\n' };
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(upstream, path)), { recursive: true });
        writeFileSync(join(upstream, path), content);
    }
    writeFileSync(join(upstream, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    const manifest = join(dir, 'manifest.json');
    writeFileSync(manifest, JSON.stringify({
        version: '1.0.0',
        files: Object.entries(files).map(([path, content]) => ({
            vendored: `skills/x/references/${path.split('/')[1]}.md`,
            upstream: path,
            sha256: createHash('sha256').update(content).digest('hex'),
        })),
    }));
    return { dir, upstream, manifest };
}

function run(...args) {
    return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('reports nothing when the upstream files are unchanged', () => {
    const { dir, upstream, manifest } = fixture();
    try {
        const result = run(upstream, '--manifest', manifest);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /No adapted upstream file changed/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('lists changed and missing files and exits 1', () => {
    const { dir, upstream, manifest } = fixture();
    try {
        writeFileSync(join(upstream, 'skills/a/SKILL.md'), 'alpha, improved\n');
        rmSync(join(upstream, 'skills/b/SKILL.md'));
        const result = run(upstream, '--manifest', manifest);
        assert.equal(result.status, 1);
        assert.match(result.stdout, /changed\s+skills\/a\/SKILL\.md → port into skills\/x\/references\/a\.md/);
        assert.match(result.stdout, /missing\s+skills\/b\/SKILL\.md/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('--accept records new hashes and the upstream version', () => {
    const { dir, upstream, manifest } = fixture();
    try {
        writeFileSync(join(upstream, 'skills/a/SKILL.md'), 'alpha, improved\n');
        writeFileSync(join(upstream, 'package.json'), JSON.stringify({ version: '1.1.0' }));
        assert.equal(run(upstream, '--manifest', manifest, '--accept').status, 0);
        assert.equal(JSON.parse(readFileSync(manifest, 'utf8')).version, '1.1.0');
        assert.equal(run(upstream, '--manifest', manifest).status, 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('the repository manifest points at existing vendored files', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'tooling/upstream/mattpocock-skills.json'), 'utf8'));
    assert.ok(manifest.files.length > 0);
    for (const entry of manifest.files) {
        assert.ok(existsSync(join(root, entry.vendored)), `${entry.vendored} is missing`);
        assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    }
});
