#!/usr/bin/env node
// Generates the Codex side of the optional worker agents:
//   codex/agents/<name>.toml  from agents/<name>.md (Codex custom agents)
//   codex/AGENTS.md           the usage rules Codex gets (marked block of ~/.codex/AGENTS.md)
//   hooks/session-rules.md    the same rules for the Claude Code SessionStart hook
// Both rule files come from one template (RULES) with a per-runtime phrase table, so they cannot drift apart.
// Usage: node tooling/scripts/build_codex_agents.mjs [--check]
// --check writes nothing and exits 1 when a generated file differs, is missing or is extra.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
export const MODELS = { haiku: 'gpt-6-luna', sonnet: 'gpt-6.1-terra', opus: 'gpt-6.1-sol' };
export const GENERATED = '# Generated from agents/';

// Codex custom agent files cannot set the sandbox (it is inherited from the parent session; see
// https://developers.openai.com/codex/subagents), so the read-only agents get the nearest thing a file can switch off:
// the connectors ("apps"), which are the "contact external services" half of their read-only rule. The read-only rule
// itself stays in their instructions. The names are the agents whose body starts with "Read only."
export const READ_ONLY_AGENTS = ['critical-reviewer', 'reviewer', 'scout'];
const READ_ONLY_FEATURES = ['features.apps = false'];

// Claude-specific wording replaced in descriptions and bodies (whole words only).
const REPLACEMENTS = [[/\bExplore\b/g, 'the built-in explorer']];
const localize = (text) => REPLACEMENTS.reduce((out, [pattern, to]) => out.replace(pattern, to), text);

export function parseAgent(file, text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error(`${file}: no frontmatter`);
    }
    const fields = Object.fromEntries(
        match[1].split('\n').map((line) => line.match(/^([a-zA-Z]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]),
    );
    // The reader below takes single-line values only; a folded or literal scalar would silently become ">" or "|".
    for (const [key, value] of Object.entries(fields)) {
        if (/^[>|][+-]?$/.test(value)) {
            throw new Error(`${file}: ${key} is a folded or literal scalar; write it on one line`);
        }
    }
    return { fields, body: match[2].trim() };
}

export function convert(file, text) {
    const { fields, body: rawBody } = parseAgent(file, text);
    const name = file.replace(/\.md$/, '');
    if (fields.name !== name || !fields.description) {
        throw new Error(`${file}: name or description is wrong`);
    }
    const model = MODELS[fields.model];
    if (!model || !fields.effort) {
        throw new Error(`${file}: model "${fields.model}" or effort is not mapped`);
    }
    const body = localize(rawBody);
    if (body.includes("'''")) {
        throw new Error(`${file}: body contains ''' and cannot be a TOML literal string`);
    }
    const readOnly = READ_ONLY_AGENTS.includes(name);
    return `${GENERATED}${file} by tooling/scripts/build_codex_agents.mjs — do not edit.
name = ${JSON.stringify(fields.name)}
description = ${JSON.stringify(localize(fields.description))}
model = ${JSON.stringify(model)}
model_reasoning_effort = ${JSON.stringify(fields.effort)}
${readOnly ? `${READ_ONLY_FEATURES.join('\n')}\n` : ''}developer_instructions = '''
${body}
'''
`;
}

// The usage rules: the lines that decide how subagents are started. Which agent takes which job is in the agent
// descriptions and in `esoul-model-routing`; only what the PreToolUse guard enforces (or Codex cannot enforce) is injected.
const TITLE_RULE = 'Session title: a cheap model names the session from the first exchange, so when the session works on a GitHub issue or a Freelo task, start the first reply with the line `#<issue number> <issue title>` (Freelo-only work: `Freelo <task id> <task title>`), shortened to about 60 characters. Look the title up first if the prompt gives only a number or a link.';
const RUNTIMES = {
    claude: {
        heading: '# eSoul usage rules (esoul-skills plugin)',
        optional: 'These rules are an optional convenience of the `esoul-skills` plugin',
        model: '`model` (`haiku` for search and runs, `sonnet` for implementation and review); an `esoul-skills:*` agent pins its own',
        search: 'Search with `esoul-skills:scout`, never Explore, which runs on the session model',
        fork: 'Never start a fork',
    },
    codex: {
        heading: '# eSoul usage rules (esoul-skills)',
        optional: 'These rules are an optional convenience installed by `node codex/install.mjs`',
        model: `model (\`${MODELS.haiku}\` for search and runs, \`${MODELS.sonnet}\` for implementation and review); an installed custom agent pins its own`,
        search: 'Search with the `scout` agent, not the built-in explorer',
        fork: 'Never spawn an agent that copies the whole conversation',
    },
};

export function renderRules(runtime) {
    const r = RUNTIMES[runtime];
    const text = `${r.heading}

${r.optional}; the skills work without it (skill \`esoul-model-routing\` describes the same delegation by job).

- Give every subagent an explicit ${r.model}. ${r.fork}. ${r.search}.
- Size S: do it directly.
- After two failed worker attempts, take over yourself.
- ${TITLE_RULE}

Details: skill \`esoul-model-routing\` (optional helpers layer).
`;
    return runtime === 'codex' ? `<!-- esoul-skills:begin -->\n${text}<!-- esoul-skills:end -->\n` : text;
}

// Every file this script owns, relative to the repository root, with its expected content.
export function expectedFiles(dir = root) {
    const agentsDir = join(dir, 'agents');
    const files = new Map();
    for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).sort()) {
        files.set(`codex/agents/${file.replace(/\.md$/, '.toml')}`, convert(file, readFileSync(join(agentsDir, file), 'utf8')));
    }
    files.set('codex/AGENTS.md', renderRules('codex'));
    files.set('hooks/session-rules.md', renderRules('claude'));
    return files;
}

function main() {
    const check = process.argv.includes('--check');
    const expected = expectedFiles();
    const outDir = join(root, 'codex', 'agents');
    const problems = [];
    if (check) {
        for (const [file, text] of expected) {
            if (!existsSync(join(root, file))) {
                problems.push(`missing ${file}`);
            } else if (readFileSync(join(root, file), 'utf8') !== text) {
                problems.push(`outdated ${file}`);
            }
        }
        const present = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.toml') && !f.startsWith('.')) : [];
        for (const file of present) {
            if (!expected.has(`codex/agents/${file}`)) {
                problems.push(`extra codex/agents/${file}`);
            }
        }
        if (problems.length) {
            console.error(`Generated Codex and hook files are out of date (${problems.join(', ')}). Run: node tooling/scripts/build_codex_agents.mjs`);
            process.exit(1);
        }
        return;
    }
    mkdirSync(outDir, { recursive: true });
    for (const [file, text] of expected) {
        writeFileSync(join(root, file), text);
    }
    // Remove stale generated files whose source agent is gone; hand-written files stay.
    for (const file of readdirSync(outDir).filter((f) => f.endsWith('.toml') && !f.startsWith('.') && !expected.has(`codex/agents/${f}`))) {
        if (readFileSync(join(outDir, file), 'utf8').startsWith(GENERATED)) {
            unlinkSync(join(outDir, file));
            console.log(`Removed stale ${file}`);
        }
    }
    console.log(`Wrote ${expected.size} files (codex/agents, codex/AGENTS.md, hooks/session-rules.md)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
