import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compute } from './work-report-minutes.mjs';

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
