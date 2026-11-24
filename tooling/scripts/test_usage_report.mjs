#!/usr/bin/env node
// Tests tooling/scripts/usage-report.mjs against synthetic transcripts.
// Usage: node --test tooling/scripts/test_usage_report.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./usage-report.mjs', import.meta.url));
let dir;

before(() => {
    dir = mkdtempSync(join(tmpdir(), 'usage-report-'));
});
after(() => rmSync(dir, { recursive: true, force: true }));

let counter = 0;
const request = (model, usage, id = `m${++counter}`) =>
    JSON.stringify({ type: 'assistant', requestId: `r-${id}`, message: { id, model, usage } });

function fixture(name, files) {
    const root = join(dir, name, 'projects');
    for (const [path, content] of Object.entries(files)) {
        const file = join(root, path);
        mkdirSync(join(file, '..'), { recursive: true });
        writeFileSync(file, content);
    }
    return root;
}

function report(root, ...extra) {
    const result = spawnSync('node', [script, '--root', root, ...extra], { encoding: 'utf8' });
    return { status: result.status, out: result.stdout, err: result.stderr };
}

test('cost weights are 1 input, 1.25 cache write, 0.1 cache read, 5 output, times the model price', () => {
    // Costs: haiku input 0.1, sonnet cache write 2.5, opus cache read 0.4, fable output 50 (total 53).
    const root = fixture('weights', {
        'p/session.jsonl': [
            request('claude-haiku-x', { input_tokens: 1e6 }),
            request('claude-sonnet-x', { cache_creation_input_tokens: 1e6 }),
            request('claude-opus-x', { cache_read_input_tokens: 1e6 }),
            request('claude-fable-x', { output_tokens: 1e6 }),
        ].join('\n'),
    });
    const { status, out } = report(root);
    assert.equal(status, 0);
    const share = (row) => out.match(new RegExp(`^main ${row}\\s+\\d+\\s+\\S+\\s+\\S+\\s+([\\d.]+)%`, 'm'))?.[1];
    assert.equal(share('haiku'), '0.2');
    assert.equal(share('sonnet'), '4.7');
    assert.equal(share('opus'), '0.8');
    assert.equal(share('fable'), '94.3');
    assert.match(out, /1 main sessions/);
});

test('a request repeated in the transcript counts once', () => {
    const line = request('claude-sonnet-x', { input_tokens: 10 }, 'same');
    const root = fixture('dedupe', { 'p/session.jsonl': [line, line, request('claude-sonnet-x', { input_tokens: 10 })].join('\n') });
    assert.match(report(root).out, /^main sonnet\s+2 /m);
});

test('main-session requests fall into the context buckets at 50K, 150K, 300K and 500K', () => {
    const sizes = [49_999, 50_000, 149_999, 150_000, 299_999, 300_000, 499_999, 500_000, 600_000];
    const root = fixture('buckets', {
        'p/session.jsonl': sizes.map((input_tokens) => request('claude-sonnet-x', { input_tokens })).join('\n'),
    });
    const { out } = report(root);
    const count = (label) => Number(out.match(new RegExp(`^  ${label}\\s+(\\d+) requests`, 'm'))?.[1]);
    assert.deepEqual(
        ['0-50K', '50-150K', '150-300K', '300-500K', '500-K'].map(count),
        [1, 2, 2, 2, 2],
    );
});

test('a subagent that ran on another model than its agent definition names is flagged', () => {
    const agents = join(dir, 'agents-flag');
    mkdirSync(agents, { recursive: true });
    writeFileSync(join(agents, 'scout.md'), '---\nname: scout\nmodel: haiku\n---\nbody\n');
    writeFileSync(join(agents, 'reviewer.md'), '---\nname: reviewer\nmodel: sonnet\n---\nbody\n');
    const subagent = (model, type) => ({
        [`p/session/subagents/${type.replace(':', '-')}-${model}.jsonl`]: request(model, { input_tokens: 5 }),
        [`p/session/subagents/${type.replace(':', '-')}-${model}.meta.json`]: JSON.stringify({ agentType: type }),
    });
    const root = fixture('flag', {
        'p/session.jsonl': request('claude-opus-x', { input_tokens: 5 }),
        ...subagent('claude-sonnet-x', 'esoul-skills:scout'),
        ...subagent('claude-sonnet-x', 'esoul-skills:reviewer'),
    });
    const { out } = report(root, '--agents', agents);
    assert.match(out, /esoul-skills:scout\s+\{"sonnet":1\}\s+<- configured haiku, check routing/);
    assert.match(out, /esoul-skills:reviewer\s+\{"sonnet":1\}\s*$/m);
    assert.match(out, /^subagent sonnet\s+2 /m);
});

test('a missing agents directory skips the routing check with a message', () => {
    const root = fixture('noagents', {
        'p/session.jsonl': request('claude-opus-x', { input_tokens: 5 }),
        'p/session/subagents/a.jsonl': request('claude-haiku-x', { input_tokens: 5 }),
        'p/session/subagents/a.meta.json': JSON.stringify({ agentType: 'esoul-skills:scout' }),
    });
    const { status, out } = report(root, '--agents', join(dir, 'does-not-exist'));
    assert.equal(status, 0);
    assert.match(out, /routing check skipped: agents directory not found/);
    assert.doesNotMatch(out, /check routing/);
});

test('requests on unknown model families are counted, not silently dropped', () => {
    const root = fixture('unknown', {
        'p/session.jsonl': [request('claude-opus-x', { input_tokens: 5 }), request('mystery-9', { input_tokens: 5 }), request('mystery-9', { input_tokens: 5 })].join('\n'),
    });
    const { out } = report(root);
    assert.match(out, /2 requests on unknown model families/);
    assert.doesNotMatch(out, /mystery/);
});

test('--days must be a positive number; transcripts older than the window are ignored', () => {
    const root = fixture('days', { 'p/session.jsonl': request('claude-opus-x', { input_tokens: 5 }) });
    for (const bad of ['abc', '0', '-3']) {
        const result = report(root, '--days', bad);
        assert.equal(result.status, 2, bad);
        assert.match(result.err, /--days must be a positive number/);
    }
    const old = new Date(Date.now() - 30 * 86400 * 1000);
    utimesSync(join(root, 'p/session.jsonl'), old, old);
    assert.match(report(root, '--days', '7').out, /0 main sessions/);
    assert.match(report(root, '--days', '60').out, /1 main sessions/);
});

test('a missing transcript directory is an error', () => {
    const result = report(join(dir, 'nowhere'));
    assert.equal(result.status, 2);
    assert.match(result.err, /Transcript directory not found/);
});
