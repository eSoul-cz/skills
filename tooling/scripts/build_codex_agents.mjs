#!/usr/bin/env node
// Generates codex/agents/<name>.toml from agents/<name>.md (Codex custom agents).
// Usage: node tooling/scripts/build_codex_agents.mjs [--check]
// --check writes nothing and exits 1 when a generated file differs, is missing or is extra.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const agentsDir = join(root, 'agents');
const outDir = join(root, 'codex', 'agents');
const MODELS = { haiku: 'gpt-6-luna', sonnet: 'gpt-6.1-terra', opus: 'gpt-6.1-sol' };

function convert(file) {
    const match = readFileSync(join(agentsDir, file), 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error(`${file}: no frontmatter`);
    }
    const fields = Object.fromEntries(
        match[1].split('\n').map((line) => line.match(/^([a-zA-Z]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]),
    );
    const name = file.replace(/\.md$/, '');
    if (fields.name !== name || !fields.description) {
        throw new Error(`${file}: name or description is wrong`);
    }
    const model = MODELS[fields.model];
    if (!model || !fields.effort) {
        throw new Error(`${file}: model "${fields.model}" or effort is not mapped`);
    }
    const body = match[2].trim();
    if (body.includes("'''")) {
        throw new Error(`${file}: body contains ''' and cannot be a TOML literal string`);
    }
    return `# Generated from agents/${file} by tooling/scripts/build_codex_agents.mjs — do not edit.
name = ${JSON.stringify(fields.name)}
description = ${JSON.stringify(fields.description)}
model = ${JSON.stringify(model)}
model_reasoning_effort = ${JSON.stringify(fields.effort)}
developer_instructions = '''
${body}
'''
`;
}

const check = process.argv.includes('--check');
const expected = new Map(
    readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort().map((f) => [f.replace(/\.md$/, '.toml'), convert(f)]),
);
const problems = [];
if (check) {
    const present = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.toml')) : [];
    for (const [file, text] of expected) {
        if (!existsSync(join(outDir, file))) {
            problems.push(`missing ${file}`);
        } else if (readFileSync(join(outDir, file), 'utf8') !== text) {
            problems.push(`outdated ${file}`);
        }
    }
    for (const file of present) {
        if (!expected.has(file)) {
            problems.push(`extra ${file}`);
        }
    }
    if (problems.length) {
        console.error(`codex/agents is out of date (${problems.join(', ')}). Run: node tooling/scripts/build_codex_agents.mjs`);
        process.exit(1);
    }
} else {
    mkdirSync(outDir, { recursive: true });
    for (const [file, text] of expected) {
        writeFileSync(join(outDir, file), text);
    }
    console.log(`Wrote ${expected.size} files to codex/agents`);
}
