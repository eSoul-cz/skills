#!/usr/bin/env node
// Tests of the Codex generator (build_codex_agents.mjs), the Codex installer (codex/install.mjs) and the
// consistency of the optional worker agents with the skills.
// Usage: node --test tooling/scripts/test_codex_agents.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { GENERATED, MODELS, READ_ONLY_AGENTS, convert, expectedFiles, parseAgent, renderRules } from './build_codex_agents.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const installer = join(root, 'codex', 'install.mjs');
const agentFile = (overrides = '', body = 'Rules.') =>
    `---\nname: demo\ndescription: Does a thing.\nmodel: haiku\neffort: low\n${overrides}---\n\n${body}\n`;

test('every generated file is committed as generated', () => {
    for (const [file, text] of expectedFiles()) {
        assert.equal(readFileSync(join(root, file), 'utf8'), text, `${file} is out of date; run tooling/scripts/build_codex_agents.mjs`);
    }
});

test('convert maps the model alias and keeps the body as a literal string', () => {
    const toml = convert('demo.md', agentFile('', 'Use `rg`.\nNever Explore.'));
    assert.ok(toml.startsWith(GENERATED));
    assert.match(toml, new RegExp(`^model = "${MODELS.haiku}"$`, 'm'));
    assert.match(toml, /^model_reasoning_effort = "low"$/m);
    assert.match(toml, /Never the built-in explorer\./, 'Claude-specific wording is localised');
    assert.doesNotMatch(toml, /features\./, 'only the read-only agents switch features off');
});

test('convert rejects a bad agent file instead of writing a wrong one', () => {
    assert.throws(() => convert('demo.md', 'no frontmatter'), /no frontmatter/);
    assert.throws(() => convert('demo.md', agentFile().replace('name: demo', 'name: other')), /name or description is wrong/);
    assert.throws(() => convert('demo.md', agentFile().replace('model: haiku', 'model: gpt')), /not mapped/);
    assert.throws(() => convert('demo.md', agentFile().replace('model: haiku', 'model: fable')), /not mapped/);
    assert.throws(() => convert('demo.md', agentFile('', "It says '''.")), /TOML literal string/);
    assert.throws(() => convert('demo.md', agentFile().replace('description: Does a thing.', 'description: >\n  folded')), /folded or literal scalar/);
    assert.throws(() => parseAgent('demo.md', agentFile().replace('description: Does a thing.', 'description: |')), /folded or literal scalar/);
});

test('the read-only agents are exactly the agents whose rules say "Read only."', () => {
    const agentsDir = join(root, 'agents');
    const readOnly = readdirSync(agentsDir)
        .filter((file) => file.endsWith('.md'))
        .filter((file) => /^- Read only\./m.test(parseAgent(file, readFileSync(join(agentsDir, file), 'utf8')).body))
        .map((file) => file.replace(/\.md$/, ''))
        .sort();
    assert.deepEqual(readOnly, [...READ_ONLY_AGENTS].sort());
    for (const name of READ_ONLY_AGENTS) {
        assert.match(readFileSync(join(root, 'codex', 'agents', `${name}.toml`), 'utf8'), /^features\.apps = false$/m, `${name}.toml`);
    }
});

test('ops is limited to shell, read, search, the Skill tool and the Freelo MCP server', () => {
    const { fields } = parseAgent('ops.md', readFileSync(join(root, 'agents', 'ops.md'), 'utf8'));
    const tools = fields.tools.split(',').map((tool) => tool.trim());
    assert.deepEqual(tools.sort(), ['Bash', 'Glob', 'Grep', 'Read', 'Skill', 'mcp__freelo__*']);
});

test('both rule files come from one template and carry the guard-relevant lines', () => {
    const claude = renderRules('claude');
    const codex = renderRules('codex');
    assert.equal(readFileSync(join(root, 'hooks', 'session-rules.md'), 'utf8'), claude);
    assert.equal(readFileSync(join(root, 'codex', 'AGENTS.md'), 'utf8'), codex);
    for (const text of [claude, codex]) {
        assert.match(text, /explicit/);
        assert.match(text, /Size S: do it directly\./);
        assert.match(text, /two failed worker attempts/);
        assert.doesNotMatch(text, /auto-compact|autoCompact/i, 'a user setting is not an agent rule');
    }
    assert.match(claude, /Never start a fork/);
    assert.ok(codex.startsWith('<!-- esoul-skills:begin -->') && codex.trimEnd().endsWith('<!-- esoul-skills:end -->'));
    assert.match(codex, new RegExp(MODELS.haiku));
});

test('the verification receipt command of test-runner equals the one esoul-workflow documents', () => {
    const command = /^\s*`?(d=\$\(mktemp -d\);[^\n`]+)`?\s*$/m;
    const runner = readFileSync(join(root, 'agents', 'test-runner.md'), 'utf8').match(command)?.[1];
    const workflow = readFileSync(join(root, 'skills', 'core', 'esoul-workflow', 'SKILL.md'), 'utf8').match(command)?.[1];
    assert.ok(runner, 'receipt command not found in agents/test-runner.md');
    assert.equal(runner, workflow);
});

// The installer runs against a temporary CODEX_HOME; nothing outside it is touched.
function install(home, ...args) {
    return spawnSync('node', [installer, ...args], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: home } });
}
const tempHome = () => mkdtempSync(join(tmpdir(), 'codex-home-'));
const block = readFileSync(join(root, 'codex', 'AGENTS.md'), 'utf8').trim();
const BEGIN = '<!-- esoul-skills:begin -->';
const END = '<!-- esoul-skills:end -->';

test('install copies the agents and writes the marked rules block into an empty home', () => {
    const home = tempHome();
    try {
        const result = install(home);
        assert.equal(result.status, 0, result.stderr);
        const agents = readdirSync(join(root, 'codex', 'agents')).filter((file) => file.endsWith('.toml'));
        assert.deepEqual(readdirSync(join(home, 'agents')).sort(), agents.sort());
        assert.equal(readFileSync(join(home, 'AGENTS.md'), 'utf8'), `${block}\n`);
        assert.match(install(home).stdout, /already up to date/);
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});

test('install replaces the block in place and keeps the text around it', () => {
    const home = tempHome();
    try {
        writeFileSync(join(home, 'AGENTS.md'), `# Mine\n\n${BEGIN}\nold rules\n${END}\n\n## After\n`);
        assert.equal(install(home).status, 0);
        assert.equal(readFileSync(join(home, 'AGENTS.md'), 'utf8'), `# Mine\n\n${block}\n\n## After\n`);
        writeFileSync(join(home, 'AGENTS.md'), '# Mine\n');
        assert.equal(install(home).status, 0);
        assert.equal(readFileSync(join(home, 'AGENTS.md'), 'utf8'), `# Mine\n\n${block}\n`);
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});

test('install refuses unpaired markers and changes nothing', () => {
    const home = tempHome();
    try {
        writeFileSync(join(home, 'AGENTS.md'), `text\n${BEGIN}\nhalf a block\n`);
        const result = install(home);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /unpaired or duplicated/);
        assert.equal(existsSync(join(home, 'agents')), false, 'no agent is copied before the markers are valid');
        assert.equal(readFileSync(join(home, 'AGENTS.md'), 'utf8'), `text\n${BEGIN}\nhalf a block\n`);
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});

test('install --dry-run writes nothing', () => {
    const home = tempHome();
    try {
        const result = install(home, '--dry-run');
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /would copy scout\.toml/);
        assert.deepEqual(readdirSync(home), []);
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});

test('install removes a generated agent whose source is gone and keeps hand-written ones', () => {
    const home = tempHome();
    try {
        mkdirSync(join(home, 'agents'));
        writeFileSync(join(home, 'agents', 'retired.toml'), `${GENERATED}retired.md by tooling/scripts/build_codex_agents.mjs\nname = "retired"\n`);
        writeFileSync(join(home, 'agents', 'mine.toml'), 'name = "mine"\n');
        assert.equal(install(home).status, 0);
        assert.equal(existsSync(join(home, 'agents', 'retired.toml')), false);
        assert.equal(existsSync(join(home, 'agents', 'mine.toml')), true);
    } finally {
        rmSync(home, { recursive: true, force: true });
    }
});
