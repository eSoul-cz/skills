import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { compute, toolEvents } from './work-report-minutes.mjs';

const script = fileURLToPath(new URL('./work-report-minutes.mjs', import.meta.url));

const at = (minutes) => new Date(Date.UTC(2026, 0, 1, 10, 0, 0) + minutes * 60000).toISOString();
const use = (id, name, command = '', minutes = 0) => ({
    timestamp: at(minutes),
    message: { content: [{ type: 'tool_use', id, name, input: { command } }] },
});
const result = (id, minutes, content = 'ok') => ({
    timestamp: at(minutes),
    message: { content: [{ type: 'tool_result', tool_use_id: id, content }] },
});

test('long test run is waiting, long pause capped at 5, subagent counts in full', () => {
    const records = [
        use('a', 'Edit', '', 0),
        result('a', 3), // 3 active
        use('b', 'Bash', 'pnpm test', 3),
        result('b', 33), // 30 min test run -> 0 active
        use('c', 'Bash', 'ls', 33),
        result('c', 63), // 30 min pause -> 5 active
        use('d', 'Agent', '', 63),
        result('d', 83), // 20 min subagent -> 20 active
    ];
    const out = compute(records);
    assert.equal(out.elapsedMinutes, 83);
    assert.equal(out.activeMinutes, 28);
    assert.equal(out.waitingMinutes, 55);
    assert.equal(out.reportMinutes, 30);
});

test('--from and --to limit the range', () => {
    const records = [use('a', 'Edit', '', 0), result('a', 2), use('b', 'Edit', '', 100), result('b', 102)];
    const out = compute(records, Date.parse(at(100)), Date.parse(at(102)));
    assert.equal(out.activeMinutes, 2);
});

test('a gap crossing --from is clipped to the range', () => {
    const records = [use('a', 'Edit', '', 0), result('a', 4), use('b', 'Edit', '', 4), result('b', 6)];
    const out = compute(records, Date.parse(at(2)), Date.parse(at(6)));
    assert.equal(out.activeMinutes, 4); // 2-4 clipped from the 0-4 gap, plus 4-6
});

test('a gap crossing --to is clipped to the range', () => {
    const records = [use('a', 'Edit', '', 0), result('a', 2), use('b', 'Edit', '', 2), result('b', 10)];
    const out = compute(records, Date.parse(at(0)), Date.parse(at(5)));
    assert.equal(out.activeMinutes, 5); // 0-2 plus 2-5 clipped from the 2-10 gap
});

test('a wait gap longer than a minute counts 0 even when clipped to a shorter span', () => {
    const records = [use('a', 'Edit', '', 0), result('a', 0), use('b', 'Bash', 'pnpm test', 0), result('b', 10)];
    const out = compute(records, Date.parse(at(0)), Date.parse(at(1)));
    assert.equal(out.activeMinutes, 0);
});

test('a result carrying [testq] waiting is waiting', () => {
    const records = [use('a', 'Bash', 'ls', 0), result('a', 10, '[testq] waiting for a slot')];
    assert.equal(compute(records).activeMinutes, 0);
});

test('a Monitor wait longer than a minute counts 0', () => {
    const records = [use('a', 'Monitor', '', 0), result('a', 10)];
    assert.equal(compute(records).activeMinutes, 0);
});

test('a Task subagent counts in full', () => {
    const records = [use('a', 'Task', '', 0), result('a', 20)];
    assert.equal(compute(records).activeMinutes, 20);
});

test('records without a timestamp are ignored', () => {
    const records = [use('a', 'Edit', '', 0), { message: { content: [] } }, result('a', 2)];
    const out = compute(records);
    assert.equal(out.records, 2);
    assert.equal(out.activeMinutes, 2);
});

test('the command line: --help exits 0, a missing file argument exits 1, --json prints the result', () => {
    assert.equal(spawnSync('node', [script, '--help']).status, 0);
    assert.equal(spawnSync('node', [script]).status, 1);

    const file = join(mkdtempSync(join(tmpdir(), 'wrm-')), 'transcript.jsonl');
    writeFileSync(file, [use('a', 'Edit', '', 0), result('a', 3)].map((r) => JSON.stringify(r)).join('\n'));
    const run = spawnSync('node', [script, file, '--json'], { encoding: 'utf8' });
    assert.equal(run.status, 0);
    assert.deepEqual(JSON.parse(run.stdout), {
        records: 2,
        elapsedMinutes: 3,
        activeMinutes: 3,
        reportMinutes: 5,
        waitingMinutes: 0,
    });
});

const fixture = (name) =>
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));

test('an omp transcript: tool names are seen, a test wait counts 0, a [task] wait counts in full', () => {
    // 1 + 1 (edit), 30 min `pnpm test` = 0, 1 + 1 + 20 (task, wait for the [task] job), 1 + 0 (wait for a [bash] job)
    assert.deepEqual(compute(fixture('omp-session.jsonl')), {
        records: 13,
        elapsedMinutes: 75,
        activeMinutes: 25,
        reportMinutes: 25,
        waitingMinutes: 50,
    });
});

test('a Codex transcript: the exec_command text is judged, wait_agent counts in full', () => {
    // 1 + 1 + 1 (read, patch, test call), 20 min `npm test` = 0, 1 + 1 + 20 (spawn, wait_agent), 1 + 5 (ls capped)
    assert.deepEqual(compute(fixture('codex-session.jsonl')), {
        records: 14,
        elapsedMinutes: 76,
        activeMinutes: 31,
        reportMinutes: 30,
        waitingMinutes: 45,
    });
});

test('toolEvents reads the three layouts and ignores records without tool traffic', () => {
    assert.deepEqual(toolEvents(use('a', 'Bash', 'ls')).uses, [{ id: 'a', name: 'Bash', command: 'ls' }]);
    const omp = fixture('omp-session.jsonl');
    assert.deepEqual(toolEvents(omp[3]).uses, [{ id: 'c1', name: 'edit', command: '' }]);
    assert.deepEqual(toolEvents(omp[4]).results, [{ id: 'c1', text: 'ok', name: 'edit' }]);
    const codex = fixture('codex-session.jsonl');
    assert.deepEqual(toolEvents(codex[2]).uses, [{ id: 'k1', name: 'exec_command', command: 'rg --files' }]);
    assert.equal(toolEvents(codex[0]).uses.length + toolEvents(codex[1]).results.length, 0);
});

test('the command line reads an omp transcript the same way as compute', () => {
    const run = spawnSync('node', [script, fileURLToPath(new URL('./fixtures/omp-session.jsonl', import.meta.url)), '--json'], {
        encoding: 'utf8',
    });
    assert.equal(run.status, 0);
    assert.equal(JSON.parse(run.stdout).activeMinutes, 25);
});
