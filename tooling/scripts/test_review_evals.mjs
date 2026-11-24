import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const casesUrl = new URL('../review-evals/cases/', import.meta.url);
const files = readdirSync(fileURLToPath(casesUrl)).filter((name) => name.endsWith('.json')).sort();
const cases = files.map((name) => ({ name, data: JSON.parse(readFileSync(new URL(name, casesUrl), 'utf8')) }));

const REQUIRED = ['id', 'kind', 'repository', 'intent', 'expected'];
const FORBIDDEN = ['base', 'head', 'fix', 'confirmedBy'];

test('the eval set has cases of both kinds', () => {
    assert.ok(cases.length > 0, 'no cases');
    const bugs = cases.filter(({ data }) => data.kind === 'bug').length;
    const clean = cases.filter(({ data }) => data.kind === 'clean').length;
    assert.ok(bugs > 0 && clean > 0, `need bug and clean cases, got ${bugs} bug and ${clean} clean`);
});

test('ids are unique and match the file names', () => {
    const ids = new Set();
    for (const { name, data } of cases) {
        assert.equal(data.id, basename(name, '.json'), `${name}: id differs from the file name`);
        assert.ok(!ids.has(data.id), `${name}: duplicate id`);
        ids.add(data.id);
    }
});

for (const { name, data } of cases) {
    test(`${name} follows the case schema`, () => {
        for (const field of REQUIRED) assert.ok(field in data, `missing ${field}`);
        for (const field of FORBIDDEN) assert.ok(!(field in data), `${field} must stay in the private mapping`);
        assert.deepEqual(Object.keys(data).filter((key) => !REQUIRED.includes(key)), [], 'unknown fields');

        assert.ok(['bug', 'clean'].includes(data.kind), 'kind is bug or clean');
        assert.match(data.id, new RegExp(`^${data.kind}-\\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$`), 'id is <kind>-NN-<slug>');
        assert.match(data.repository, /^private\/[a-z0-9-]+$/, 'repository is a private/<stack> label');
        assert.equal(typeof data.intent, 'string');
        assert.ok(data.intent.trim().length > 0, 'intent is empty');
        assert.ok(Array.isArray(data.expected), 'expected is an array');

        if (data.kind === 'clean') assert.equal(data.expected.length, 0, 'a clean case expects nothing');
        else assert.ok(data.expected.length > 0, 'a bug case expects at least one defect');

        for (const item of data.expected) {
            assert.deepEqual(Object.keys(item).sort(), ['blocking', 'defect', 'line', 'path'], 'expected item fields');
            assert.equal(typeof item.path, 'string');
            assert.ok(item.path.length > 0 && !item.path.startsWith('/'), 'path is repository-relative');
            assert.ok(Number.isInteger(item.line) && item.line > 0, 'line is a positive integer');
            assert.equal(typeof item.defect, 'string');
            assert.ok(item.defect.trim().length > 0, 'defect is empty');
            assert.equal(typeof item.blocking, 'boolean');
        }
    });
}
