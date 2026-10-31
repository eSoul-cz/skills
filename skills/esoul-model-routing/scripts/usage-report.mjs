#!/usr/bin/env node
// Summarise Claude Code token usage from local transcripts, to see where the weekly limit goes
// and whether subagents really run on the model their definition names.
//
// Usage: node usage-report.mjs [--days 7] [--root ~/.claude/projects]
//
// Cost is weighted by API list prices (input 1, cache write 1.25, cache read 0.1, output 5,
// times the model's input price). Plan limits do not publish their weights, so read the
// numbers as relative shares, not as a bill.

import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
function option(name, fallback) {
    const index = args.indexOf(`--${name}`);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
if (args.includes('--help')) {
    console.log('Usage: node usage-report.mjs [--days 7] [--root ~/.claude/projects]');
    process.exit(0);
}

const days = Number(option('days', '7'));
const root = option('root', join(homedir(), '.claude', 'projects')).replace(/^~/, homedir());
const cutoff = Date.now() - days * 86400 * 1000;
const inputPrice = { fable: 10, opus: 4, sonnet: 2, haiku: 0.1 };
const buckets = [50e3, 150e3, 300e3, 500e3, Infinity];

// Models the eSoul plugin agents are configured for, read from this plugin's agents/ directory.
const configured = {};
const agentsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'agents');
if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir).filter((name) => name.endsWith('.md'))) {
        const model = readFileSync(join(agentsDir, file), 'utf8').match(/^model:\s*(\S+)/m);
        if (model) {
            configured[`esoul-skills:${basename(file, '.md')}`] = model[1];
        }
    }
}

function family(model) {
    return Object.keys(inputPrice).find((name) => (model ?? '').includes(name));
}

function transcripts(dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...transcripts(path));
        } else if (entry.name.endsWith('.jsonl') && statSync(path).mtimeMs >= cutoff) {
            files.push(path);
        }
    }
    return files;
}

const totals = new Map();
const mainBuckets = buckets.map(() => ({ requests: 0, cost: 0 }));
const subagentRuns = new Map();
const seen = new Set();
let mainSessions = 0;

for (const file of transcripts(root)) {
    const isSubagent = file.includes('/subagents/');
    let firstModel = null;
    let requests = 0;
    const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    for await (const line of lines) {
        if (!line.includes('"usage"') || !line.includes('"assistant"')) {
            continue;
        }
        let entry;
        try {
            entry = JSON.parse(line);
        } catch {
            continue;
        }
        const message = entry.message ?? {};
        const usage = message.usage;
        const model = family(message.model);
        if (entry.type !== 'assistant' || !usage || !model) {
            continue;
        }
        const key = `${message.id}:${entry.requestId}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        firstModel ??= model;
        requests += 1;
        const input = usage.input_tokens ?? 0;
        const write = usage.cache_creation_input_tokens ?? 0;
        const read = usage.cache_read_input_tokens ?? 0;
        const output = usage.output_tokens ?? 0;
        const cost = (inputPrice[model] * (input + 1.25 * write + 0.1 * read + 5 * output)) / 1e6;
        const row = `${isSubagent ? 'subagent' : 'main'} ${model}`;
        const total = totals.get(row) ?? { requests: 0, read: 0, output: 0, cost: 0 };
        total.requests += 1;
        total.read += read;
        total.output += output;
        total.cost += cost;
        totals.set(row, total);
        if (!isSubagent) {
            const bucket = mainBuckets[buckets.findIndex((limit) => input + write + read < limit)];
            bucket.requests += 1;
            bucket.cost += cost;
        }
    }
    if (isSubagent && firstModel) {
        let type = '?';
        const meta = file.replace(/\.jsonl$/, '.meta.json');
        if (existsSync(meta)) {
            try {
                type = JSON.parse(readFileSync(meta, 'utf8')).agentType ?? '?';
            } catch {}
        }
        const runs = subagentRuns.get(type) ?? {};
        runs[firstModel] = (runs[firstModel] ?? 0) + 1;
        subagentRuns.set(type, runs);
    } else if (!isSubagent && requests) {
        mainSessions += 1;
    }
}

const grand = [...totals.values()].reduce((sum, row) => sum + row.cost, 0) || 1;
const percent = (value) => `${((100 * value) / grand).toFixed(1)}%`.padStart(6);

console.log(`Last ${days} days, ${mainSessions} main sessions, ${root}`);
console.log('\nWhere            requests  cache read M  output M   share');
for (const [row, total] of [...totals].sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(
        `${row.padEnd(16)} ${String(total.requests).padStart(8)}  ${(total.read / 1e6).toFixed(1).padStart(12)}  ${(total.output / 1e6).toFixed(2).padStart(8)}  ${percent(total.cost)}`,
    );
}

const mainRequests = mainBuckets.reduce((sum, bucket) => sum + bucket.requests, 0);
if (mainRequests) {
    console.log('\nMain-session context per request (target: most cost below 200K)');
    let lower = 0;
    buckets.forEach((limit, index) => {
        const label = `${lower / 1e3}-${limit === Infinity ? '' : `${limit / 1e3}`}K`;
        console.log(`  ${label.padEnd(10)} ${String(mainBuckets[index].requests).padStart(7)} requests  ${percent(mainBuckets[index].cost)}`);
        lower = limit;
    });
}

if (subagentRuns.size) {
    console.log('\nSubagent runs by type -> model of the first reply');
    for (const [type, runs] of [...subagentRuns].sort()) {
        const expected = configured[type];
        const wrong = expected ? Object.entries(runs).filter(([model]) => model !== expected) : [];
        const flag = wrong.length ? `  <- configured ${expected}, check routing` : '';
        console.log(`  ${type.padEnd(34)} ${JSON.stringify(runs)}${flag}`);
    }
}
