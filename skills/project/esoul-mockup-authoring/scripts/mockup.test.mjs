import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Checks that need neither the application checkout nor PHP nor a browser. The isolation test of the
// preview itself stays opt-in: tooling/scripts/test_mockup_preview.mjs.
const scripts = dirname(fileURLToPath(import.meta.url));
const example = join(scripts, '..', 'example');
const cli = join(scripts, 'mockup.mjs');

const run = (...args) => spawnSync('node', [cli, ...args], { encoding: 'utf8' });

test('--help and a bare call print the usage and succeed', () => {
    for (const args of [['--help'], []]) {
        const result = run(...args);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /^Usage: node scripts\/mockup\.mjs validate\|preview/);
    }
});

test('bad arguments fail before any PHP is started', () => {
    for (const [args, message] of [
        [['publish'], /Usage:/],
        [['validate', '--port'], /Missing value for --port/],
        [['validate', '--port', 'abc'], /Port must be an integer/],
        [['validate', '--port', '70000'], /Port must be an integer/],
        [['validate', 'one', 'two'], /Unexpected argument: two/],
        [['validate', '--unknown'], /Unexpected argument: --unknown/],
    ]) {
        const result = run(...args);
        assert.equal(result.status, 1, `${args.join(' ')}: ${result.stdout}`);
        assert.match(result.stderr, message, args.join(' '));
    }
});

test('every frame of the example manifest has its entry, a marked root and a design width', () => {
    const manifest = JSON.parse(readFileSync(join(example, 'mockup.json'), 'utf8'));
    const entries = new Set();
    for (const screen of manifest.screens) {
        for (const frame of screen.frames) {
            const label = `${screen.id}/${frame.id}`;
            assert.ok(!entries.has(frame.entry), `${label}: entry ${frame.entry} is used twice`);
            entries.add(frame.entry);
            assert.ok(existsSync(join(example, frame.entry)), `${label}: ${frame.entry} is missing`);
            assert.ok(Number.isInteger(frame.width), `${label}: width must be an integer`);
            const html = readFileSync(join(example, frame.entry), 'utf8');
            assert.equal(html.match(/data-mockup-screen=/g)?.length, 1, `${label}: exactly one screen root`);
            assert.ok(html.includes(`data-mockup-screen="${screen.id}"`), `${label}: root screen attribute differs`);
            assert.ok(html.includes(`data-mockup-frame="${frame.id}"`), `${label}: root frame attribute differs`);
        }
    }
    assert.ok(manifest.screens.some((screen) => screen.id === manifest.start.screen), 'the start screen exists');
});
