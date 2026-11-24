import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { assertSameOrigin, readSecrets } from './sweep.mjs';

const secretsFile = (content, mode) => {
    const file = join(mkdtempSync(join(tmpdir(), 'esoul-sweep-')), 'demo.uat.env');
    writeFileSync(file, content);
    chmodSync(file, mode);
    return file;
};

test('readSecrets parses KEY=VALUE lines, strips quotes and ignores comments', () => {
    const file = secretsFile('# comment\nUAT_BASE_URL=https://uat.example.cz\nUAT_ROLE_A_EMAIL="admin@example.cz"\nUAT_ROLE_A_PASSWORD=\n', 0o600);
    assert.deepEqual(readSecrets(file), { UAT_BASE_URL: 'https://uat.example.cz', UAT_ROLE_A_EMAIL: 'admin@example.cz', UAT_ROLE_A_PASSWORD: '' });
});

test('readSecrets refuses a file that other users can read', () => {
    assert.throws(() => readSecrets(secretsFile('UAT_BASE_URL=https://uat.example.cz\n', 0o644)), /chmod 600/);
});

test('readSecrets refuses a missing file and points at the access reference', () => {
    assert.throws(() => readSecrets(join(tmpdir(), 'esoul-sweep-missing.env')), /references\/access\.md/);
});

test('assertSameOrigin accepts the same origin and refuses another environment', () => {
    const run = { id: '2026-11-24-uat', base_url: 'https://uat.example.cz/app' };
    assert.doesNotThrow(() => assertSameOrigin(run, 'https://uat.example.cz'));
    assert.throws(() => assertSameOrigin(run, 'https://www.example.cz'), /does not match the run 2026-11-24-uat/);
});
