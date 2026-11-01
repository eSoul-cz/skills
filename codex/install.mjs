#!/usr/bin/env node
// Installs the eSoul Codex agents and rules into ${CODEX_HOME:-~/.codex}.
// Usage: node codex/install.mjs [--dry-run]
// Copies codex/agents/*.toml (overwrite) and inserts or replaces the marked block of
// codex/AGENTS.md in AGENTS.md. Text outside the markers and config.toml are never touched.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const dryRun = process.argv.includes('--dry-run');
const home = process.env.CODEX_HOME || join(homedir(), '.codex');
const BEGIN = '<!-- esoul-skills:begin -->';
const END = '<!-- esoul-skills:end -->';

const agentsOut = join(home, 'agents');
if (!dryRun) {
    mkdirSync(agentsOut, { recursive: true });
}
const agents = readdirSync(join(here, 'agents')).filter((f) => f.endsWith('.toml')).sort();
for (const file of agents) {
    if (!dryRun) {
        copyFileSync(join(here, 'agents', file), join(agentsOut, file));
    }
    console.log(`${dryRun ? 'would copy' : 'copied'} ${file} -> ${agentsOut}`);
}

const block = readFileSync(join(here, 'AGENTS.md'), 'utf8').trim();
const target = join(home, 'AGENTS.md');
const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
const start = current.indexOf(BEGIN);
const end = current.indexOf(END);
let next;
if (start !== -1 && end > start) {
    next = current.slice(0, start) + block + current.slice(end + END.length);
} else if (start !== -1 || end !== -1) {
    console.error(`${target} has an unpaired esoul-skills marker; fix it by hand and run again.`);
    process.exit(1);
} else {
    next = current.trim() ? `${current.replace(/\s*$/, '')}\n\n${block}\n` : `${block}\n`;
}
if (next === current) {
    console.log(`${target} already up to date`);
} else {
    if (!dryRun) {
        mkdirSync(home, { recursive: true });
        writeFileSync(target, next);
    }
    console.log(`${dryRun ? 'would update' : 'updated'} ${target}`);
}
console.log(`\nMerge the settings by hand into ${join(home, 'config.toml')}: ${join(here, 'config.toml')}`);
