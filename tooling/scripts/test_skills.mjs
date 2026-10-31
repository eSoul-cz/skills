import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Every skill's description is loaded into every agent session, so the descriptions are a
// standing cost. Keep each one short and the sum bounded.
const MAX_DESCRIPTION = 600;
const MAX_DESCRIPTIONS_TOTAL = 8000;

const root = fileURLToPath(new URL('../..', import.meta.url));
const skillsDir = join(root, 'skills');
const skills = readdirSync(skillsDir)
    .filter((name) => existsSync(join(skillsDir, name, 'SKILL.md')))
    .sort();

function frontmatter(name) {
    const text = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(match, `${name}: SKILL.md has no frontmatter`);
    const fields = {};
    let key = null;
    for (const line of match[1].split('\n')) {
        const field = line.match(/^([a-z][\w-]*):\s*(.*)$/);
        if (field) {
            key = field[1];
            fields[key] = field[2] === '>' || field[2] === '|' ? '' : field[2];
        } else if (key) {
            fields[key] += ` ${line.trim()}`;
        }
    }
    for (const field of Object.keys(fields)) {
        fields[field] = fields[field].trim();
    }
    return fields;
}

// Markdown files that belong to the skills themselves. Templates under assets/ are copied into
// projects, so their relative links point at project files and are not checked here.
function skillMarkdown(dir = skillsDir) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            if (entry !== 'assets' && entry !== 'node_modules') {
                files.push(...skillMarkdown(path));
            }
        } else if (entry.endsWith('.md')) {
            files.push(path);
        }
    }
    return files;
}

function withoutCode(text) {
    return text.replace(/^(```|````)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
}

test('every skill has a matching name and a bounded description', () => {
    let total = 0;
    for (const name of skills) {
        const fields = frontmatter(name);
        assert.equal(fields.name, name, `${name}: frontmatter name differs from its directory`);
        assert.ok(fields.description, `${name}: description is missing`);
        assert.ok(
            fields.description.length <= MAX_DESCRIPTION,
            `${name}: description has ${fields.description.length} characters, limit ${MAX_DESCRIPTION}`,
        );
        total += fields.description.length;
    }
    assert.ok(total <= MAX_DESCRIPTIONS_TOTAL, `descriptions total ${total} characters, limit ${MAX_DESCRIPTIONS_TOTAL}`);
});

test('relative links in skill documents resolve', () => {
    const broken = [];
    for (const file of skillMarkdown()) {
        const text = withoutCode(readFileSync(file, 'utf8'));
        for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
            if (/^[a-z]+:/i.test(target) || target.startsWith('#') || target.includes('{{') || target.startsWith('<')) {
                continue;
            }
            const path = target.split('#')[0];
            if (!existsSync(join(dirname(file), path))) {
                broken.push(`${relative(root, file)} → ${target}`);
            }
        }
    }
    assert.deepEqual(broken, []);
});

test('every skill is listed in the plugin manifest and documented in the README', () => {
    const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    for (const name of skills) {
        assert.match(manifest.description, new RegExp(`\\b${name}\\b`), `${name}: missing from plugin.json description`);
        assert.ok(readme.includes(`### \`${name}\``), `${name}: missing README section`);
    }
});

test('skills read convention sections with the one shared command', () => {
    const offenders = [];
    for (const file of skillMarkdown()) {
        const text = readFileSync(file, 'utf8');
        // The old forms read only CONTEXT.md, or stopped at an empty section because its
        // heading alone counted as output, or raced on a predictable `mktemp -u` index path.
        if (/awk '\/\^## /.test(text) || text.includes('grep . && break') || text.includes('mktemp -u')) {
            offenders.push(relative(root, file));
        }
    }
    assert.deepEqual(offenders, []);
});

test('skills do not route to retired project-local skills', () => {
    const retired = /\b(?:indcom-eshop-tasking|schok-plemenna-kniha-tasking|data-tasky-bez-primych-uprav|data-projektu-v-gitu-ne-ve-storage|vykazovani-casu-bez-cekani)\b/;
    const offenders = skillMarkdown().filter((file) => retired.test(readFileSync(file, 'utf8')));
    assert.deepEqual(offenders.map((file) => relative(root, file)), []);
});

// Plugin agents carry the model routing, so each must pin its model and effort; an agent
// without them silently inherits the caller's (usually most expensive) model.
test('every plugin agent pins its model and effort, and skills route only to existing agents', () => {
    const agentsDir = join(root, 'agents');
    const agents = readdirSync(agentsDir).filter((name) => name.endsWith('.md'));
    for (const file of agents) {
        const match = readFileSync(join(agentsDir, file), 'utf8').match(/^---\n([\s\S]*?)\n---\n/);
        assert.ok(match, `${file}: no frontmatter`);
        const fields = Object.fromEntries(
            match[1].split('\n').map((line) => line.match(/^([a-zA-Z]+):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]),
        );
        assert.equal(fields.name, file.replace(/\.md$/, ''), `${file}: name differs from its file name`);
        assert.ok(fields.description, `${file}: description is missing`);
        assert.match(fields.model ?? '', /^(haiku|sonnet|opus|fable)$/, `${file}: model must be a pinned alias`);
        assert.match(fields.effort ?? '', /^(low|medium|high|xhigh)$/, `${file}: effort must be set`);
    }
    const known = new Set(agents.map((file) => file.replace(/\.md$/, '')));
    const unknown = [];
    for (const file of skillMarkdown()) {
        for (const [, name] of readFileSync(file, 'utf8').matchAll(/esoul-skills:([a-z-]+)/g)) {
            if (!known.has(name)) {
                unknown.push(`${relative(root, file)} → esoul-skills:${name}`);
            }
        }
    }
    assert.deepEqual(unknown, []);
});
