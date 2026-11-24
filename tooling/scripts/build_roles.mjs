#!/usr/bin/env node
// Generates skills/helpers/esoul-model-routing/references/roles.md from agents/*.md: the role
// briefs an agent can hand to a generic subagent when the optional worker agents are not installed.
// Usage: node tooling/scripts/build_roles.mjs [--check] [--file <path>]
// --check writes nothing and exits 1 when the file differs or is missing.
// --file overrides the output path (used by the tests).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const agentsDir = join(root, 'agents');
const defaultOutput = join(root, 'skills', 'helpers', 'esoul-model-routing', 'references', 'roles.md');
// Reading order of the roles; agents not listed follow alphabetically.
const ORDER = ['scout', 'test-runner', 'implementer', 'reviewer', 'critical-reviewer', 'uat-runner', 'ops'];

function parse(file) {
    const match = readFileSync(join(agentsDir, file), 'utf8').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error(`${file}: no frontmatter`);
    }
    const fields = Object.fromEntries(
        match[1].split('\n').map((line) => line.match(/^([a-zA-Z]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]),
    );
    const name = file.replace(/\.md$/, '');
    if (fields.name !== name || !fields.description || !fields.model || !fields.effort) {
        throw new Error(`${file}: name, description, model or effort is missing or wrong`);
    }
    return { name, ...fields, body: match[2].trim() };
}

export function render() {
    const roles = readdirSync(agentsDir)
        .filter((file) => file.endsWith('.md') && !file.startsWith('.'))
        .map(parse)
        .sort((a, b) => {
            const rank = (role) => (ORDER.includes(role.name) ? ORDER.indexOf(role.name) : ORDER.length);
            return rank(a) - rank(b) || a.name.localeCompare(b.name);
        });
    const sections = roles.map((role) => {
        const facts = [
            `- Job: ${role.description}`,
            `- Recommended model: \`${role.model}\`, effort \`${role.effort}\`.`,
            ...(role.tools ? [`- Tools: ${role.tools}.`] : []),
            `- Optional plugin agent: \`esoul-skills:${role.name}\` (Claude Code plugin); Codex custom agent \`${role.name}\`.`,
        ];
        return `## ${role.name}\n\n${facts.join('\n')}\n\n### Brief\n\n${role.body}\n`;
    });
    return `<!-- Generated from agents/*.md by tooling/scripts/build_roles.mjs - do not edit; run \`node tooling/scripts/build_roles.mjs\` in the eSoul skills repository after changing agents/. -->
# Worker role briefs

One section per worker role. Without the optional worker agents, start a generic subagent (with the recommended model alias and effort, and only the listed tools when the harness lets you restrict them) and begin its prompt with the text under \`### Brief\`, followed by your task brief. When the harness offers no subagents, follow the brief yourself for that step.

${sections.join('\n')}`;
}

function main() {
    const args = process.argv.slice(2);
    const fileIndex = args.indexOf('--file');
    const output = fileIndex >= 0 ? args[fileIndex + 1] : defaultOutput;
    const expected = render();
    if (args.includes('--check')) {
        if (!existsSync(output) || readFileSync(output, 'utf8') !== expected) {
            console.error(`${output} is out of date. Run: node tooling/scripts/build_roles.mjs`);
            process.exit(1);
        }
        return;
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, expected);
    console.log(`Wrote ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
