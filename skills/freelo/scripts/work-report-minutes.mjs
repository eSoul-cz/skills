#!/usr/bin/env node
// Compute the active minutes of a session for a Freelo work report, excluding waiting.
// Method: references/work-reports.md, "How to compute the minutes", step 1.
//
// Usage: node work-report-minutes.mjs <transcript.jsonl> [--from <ISO time>] [--to <ISO time>] [--json]
//
// Gaps between consecutive records are summed from --from (default: first record) to --to
// (default: last record):
//   - a gap that ends in the result of a test, build, mutation, install or waiting-loop command
//     (`until`, `sleep`, `Monitor`, `[testq] waiting`) longer than one minute does not count;
//   - a gap that ends in the result of subagent work (Agent, Skill, Workflow) counts in full;
//   - any other gap counts for at most 5 minutes, a longer pause is waiting.
// The active total is rounded to 5 minutes. Without a transcript, build the timeline by hand
// as the reference describes.

import { readFileSync } from 'node:fs';

const WAIT_TOOLS = new Set(['Monitor']);
const FULL_TOOLS = new Set(['Agent', 'Task', 'Skill', 'Workflow']);
const WAIT_COMMAND =
    /\b(test|tests|pest|phpunit|vitest|jest|playwright|cypress|e2e|mutation|infection|stryker|build|lint|phpstan|install|testq|until|sleep)\b/i;
const WAIT_RESULT = /\[testq\] waiting/i;
const MINUTE = 60 * 1000;
const OTHER_CAP = 5 * MINUTE;

export function classify(record, toolUses) {
    const content = Array.isArray(record?.message?.content) ? record.message.content : [];
    let kind = 'other';
    for (const part of content) {
        if (part?.type !== 'tool_result') {
            continue;
        }
        const use = toolUses.get(part.tool_use_id);
        const text = typeof part.content === 'string' ? part.content : JSON.stringify(part.content ?? '');
        if (use && FULL_TOOLS.has(use.name)) {
            return 'full';
        }
        if (WAIT_RESULT.test(text) || (use && (WAIT_TOOLS.has(use.name) || WAIT_COMMAND.test(use.command)))) {
            kind = 'wait';
        }
    }
    return kind;
}

export function compute(records, from = null, to = null) {
    const toolUses = new Map();
    for (const record of records) {
        const content = Array.isArray(record?.message?.content) ? record.message.content : [];
        for (const part of content) {
            if (part?.type === 'tool_use') {
                toolUses.set(part.id, { name: part.name, command: String(part.input?.command ?? '') });
            }
        }
    }

    const timed = records
        .filter((record) => Number.isFinite(Date.parse(record?.timestamp)))
        .map((record) => ({ record, time: Date.parse(record.timestamp) }))
        .sort((a, b) => a.time - b.time)
        .filter(({ time }) => (from === null || time >= from) && (to === null || time <= to));

    let activeMs = 0;
    let elapsedMs = 0;
    for (let i = 1; i < timed.length; i++) {
        const gap = timed[i].time - timed[i - 1].time;
        const kind = classify(timed[i].record, toolUses);
        elapsedMs += gap;
        if (kind === 'full') {
            activeMs += gap;
        } else if (kind === 'wait') {
            // A wait longer than one minute does not count at all.
            activeMs += gap > MINUTE ? 0 : gap;
        } else {
            activeMs += Math.min(gap, OTHER_CAP);
        }
    }

    const toMinutes = (ms) => Math.round(ms / MINUTE);
    return {
        records: timed.length,
        elapsedMinutes: toMinutes(elapsedMs),
        activeMinutes: toMinutes(activeMs),
        reportMinutes: Math.round(activeMs / MINUTE / 5) * 5,
        waitingMinutes: toMinutes(elapsedMs - activeMs),
    };
}

function main() {
    const args = process.argv.slice(2);
    const option = (name) => {
        const index = args.indexOf(`--${name}`);
        return index >= 0 && args[index + 1] ? args[index + 1] : null;
    };
    const file = args.find((arg, i) => !arg.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--json'));
    if (args.includes('--help') || !file) {
        console.log('Usage: node work-report-minutes.mjs <transcript.jsonl> [--from <ISO time>] [--to <ISO time>] [--json]');
        process.exit(args.includes('--help') ? 0 : 1);
    }
    const parse = (value) => (value === null ? null : Date.parse(value));
    const from = parse(option('from'));
    const to = parse(option('to'));
    if (Number.isNaN(from) || Number.isNaN(to)) {
        console.error('--from and --to must be ISO times.');
        process.exit(1);
    }
    const records = [];
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        try {
            records.push(JSON.parse(line));
        } catch {
            // skip blank or partial lines
        }
    }
    const result = compute(records, from, to);
    if (args.includes('--json')) {
        console.log(JSON.stringify(result));
    } else {
        console.log(
            `Active: ${result.activeMinutes} min (report ${result.reportMinutes} min, rounded to 5). ` +
                `Waiting left out: ${result.waitingMinutes} min of ${result.elapsedMinutes} min elapsed. ` +
                `Records: ${result.records}.`,
        );
    }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
