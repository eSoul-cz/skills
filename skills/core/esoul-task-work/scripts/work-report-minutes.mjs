#!/usr/bin/env node
// Compute the active minutes of a Claude Code, omp or Codex session transcript for a Freelo
// work report, excluding waiting. Method: references/freelo.md, "Work reports".
//
// Usage: node work-report-minutes.mjs <transcript.jsonl> [--from <ISO time>] [--to <ISO time>] [--json]
//
// The format is recognised per record, so no flag is needed:
//   - Claude Code (~/.claude/projects/<project>/<session>.jsonl): `message.content[]` blocks
//     `tool_use` / `tool_result`;
//   - omp (~/.omp/agent/sessions/<project>/<session>.jsonl): assistant `toolCall` blocks and
//     separate `toolResult` messages;
//   - Codex (~/.codex/sessions/<y>/<m>/<d>/rollout-*.jsonl): `response_item` records with
//     `function_call` / `custom_tool_call` and their `*_output`.
//
// Gaps between consecutive records are summed from --from (default: first record) to --to
// (default: last record); a gap crossing either bound is clipped to it and classified by its
// closing record, and a wait is judged on the unclipped gap:
//   - a gap that ends in the result of a test, build, mutation, install or waiting-loop command
//     (`until`, `sleep`, `Monitor`, omp/Codex `wait`, `[testq] waiting`) longer than one minute
//     does not count;
//   - a gap that ends in the result of subagent work (Agent, Task, Skill, Workflow, Codex
//     `wait_agent`, an omp `wait` that returns `[task]` jobs) counts in full;
//   - any other gap counts for at most 5 minutes, a longer pause is waiting.
// The active total is rounded to 5 minutes. Without a transcript, build the timeline by hand
// as the reference describes.

import { readFileSync } from 'node:fs';

const WAIT_TOOLS = new Set(['monitor', 'wait']);
const FULL_TOOLS = new Set(['agent', 'task', 'skill', 'workflow', 'wait_agent']);
const WAIT_COMMAND =
    /\b(test|tests|pest|phpunit|vitest|jest|playwright|cypress|e2e|mutation|infection|stryker|build|lint|phpstan|install|testq|until|sleep)\b/i;
const WAIT_RESULT = /\[testq\] waiting/i;
const SUBAGENT_JOB = /\[task\]/;
const MINUTE = 60 * 1000;
const OTHER_CAP = 5 * MINUTE;

const asObject = (value) => {
    if (typeof value !== 'string') {
        return value ?? {};
    }
    try {
        return JSON.parse(value) ?? {};
    } catch {
        return {};
    }
};

const textOf = (value) => (typeof value === 'string' ? value : JSON.stringify(value ?? ''));

// The tool calls and tool results of one record, whatever the agent that wrote it.
export function toolEvents(record) {
    const uses = [];
    const results = [];

    // Claude Code and omp: message.content[]
    const message = record?.message;
    const content = Array.isArray(message?.content) ? message.content : [];
    for (const part of content) {
        if (part?.type === 'tool_use') {
            uses.push({ id: part.id, name: part.name, command: String(part.input?.command ?? '') });
        } else if (part?.type === 'toolCall') {
            uses.push({ id: part.id, name: part.name, command: String(asObject(part.arguments).command ?? '') });
        } else if (part?.type === 'tool_result') {
            results.push({ id: part.tool_use_id, text: textOf(part.content) });
        }
    }
    if (message?.role === 'toolResult') {
        // omp: one record per result; the text blocks are its output.
        const text = content.map((part) => part?.text ?? '').join('\n');
        results.push({ id: message.toolCallId, text, name: message.toolName });
    }

    // Codex: response_item payloads
    const payload = record?.type === 'response_item' ? record.payload : null;
    if (payload?.type === 'function_call') {
        uses.push({ id: payload.call_id, name: payload.name, command: String(asObject(payload.arguments).cmd ?? '') });
    } else if (payload?.type === 'custom_tool_call') {
        uses.push({ id: payload.call_id, name: payload.name, command: String(payload.input ?? '') });
    } else if (payload?.type === 'function_call_output' || payload?.type === 'custom_tool_call_output') {
        results.push({ id: payload.call_id, text: textOf(payload.output) });
    }

    return { uses, results };
}

export function classify(record, toolUses) {
    let kind = 'other';
    for (const result of toolEvents(record).results) {
        const use = toolUses.get(result.id);
        const name = String(use?.name ?? result.name ?? '').toLowerCase();
        if (FULL_TOOLS.has(name) || (name === 'wait' && SUBAGENT_JOB.test(result.text))) {
            return 'full';
        }
        if (WAIT_RESULT.test(result.text) || WAIT_TOOLS.has(name) || (use && WAIT_COMMAND.test(use.command))) {
            kind = 'wait';
        }
    }
    return kind;
}

export function compute(records, from = null, to = null) {
    const toolUses = new Map();
    for (const record of records) {
        for (const use of toolEvents(record).uses) {
            toolUses.set(use.id, use);
        }
    }

    const timed = records
        .filter((record) => Number.isFinite(Date.parse(record?.timestamp)))
        .map((record) => ({ record, time: Date.parse(record.timestamp) }))
        .sort((a, b) => a.time - b.time);
    const inRange = timed.filter(({ time }) => (from === null || time >= from) && (to === null || time <= to));

    let activeMs = 0;
    let elapsedMs = 0;
    for (let i = 1; i < timed.length; i++) {
        // Clip the interval to [from, to]; it is classified by its closing entry. A wait is judged
        // on the unclipped gap, so an interval crossing a boundary keeps its full-length rule.
        const fullGap = timed[i].time - timed[i - 1].time;
        const start = from === null ? timed[i - 1].time : Math.max(timed[i - 1].time, from);
        const end = to === null ? timed[i].time : Math.min(timed[i].time, to);
        const gap = end - start;
        if (gap <= 0) {
            continue;
        }
        const kind = classify(timed[i].record, toolUses);
        elapsedMs += gap;
        if (kind === 'full') {
            activeMs += gap;
        } else if (kind === 'wait') {
            // A wait longer than one minute does not count at all.
            activeMs += fullGap > MINUTE ? 0 : gap;
        } else {
            activeMs += Math.min(gap, OTHER_CAP);
        }
    }

    const toMinutes = (ms) => Math.round(ms / MINUTE);
    return {
        records: inRange.length,
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
