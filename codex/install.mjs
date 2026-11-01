#!/usr/bin/env node
// Installs the eSoul Codex agents and rules into ${CODEX_HOME:-~/.codex}.
// Usage: node codex/install.mjs [--dry-run]
// Copies codex/agents/*.toml (overwrite) and inserts or replaces the marked block of
// codex/AGENTS.md in AGENTS.md. Text outside the markers and config.toml are never touched.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const dryRun = process.argv.includes('--dry-run');
const home = process.env.CODEX_HOME || join(homedir(), '.codex');
const BEGIN = '<!-- esoul-skills:begin -->';
const END = '<!-- esoul-skills:end -->';

const block = readFileSync(join(here, 'AGENTS.md'), 'utf8').trim();
const target = join(home, 'AGENTS.md');
const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
const count = (marker) => current.split(marker).length - 1;
const start = current.indexOf(BEGIN);
const end = current.indexOf(END);
// Validate before changing anything, so a failed install leaves no half-installed state.
if (count(BEGIN) > 1 || count(END) > 1 || (count(BEGIN) !== count(END)) || (start !== -1 && end < start)) {
    console.error(`${target} has unpaired or duplicated esoul-skills markers; fix it by hand and run again.`);
    process.exit(1);
}
const next = start !== -1
    ? current.slice(0, start) + block + current.slice(end + END.length)
    : current.trim() ? `${current.replace(/\s*$/, '')}\n\n${block}\n` : `${block}\n`;

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

if (next === current) {
    console.log(`${target} already up to date`);
} else {
    if (!dryRun) {
        mkdirSync(home, { recursive: true });
        // Write next to the target and rename, so an interrupted write never truncates it.
        const temp = `${target}.${process.pid}.tmp`;
        writeFileSync(temp, next);
        renameSync(temp, target);
    }
    console.log(`${dryRun ? 'would update' : 'updated'} ${target}`);
}
console.log(`\nMerge the settings by hand into ${join(home, 'config.toml')}: ${join(here, 'config.toml')}`);
