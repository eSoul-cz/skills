// Self-test of conformance.mjs: node --test scripts/conformance.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { fencedLines, makeGh, runConformance, sections } from './conformance.mjs';

const SCRIPT = fileURLToPath(new URL('./conformance.mjs', import.meta.url));
const temp = mkdtempSync(path.join(tmpdir(), 'esoul-conformance-'));
after(() => rmSync(temp, { recursive: true, force: true }));

let counter = 0;

function project(files, { git = true, untracked = {} } = {}) {
    counter += 1;
    const root = path.join(temp, `p${counter}`);
    for (const [rel, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        writeFileSync(path.join(root, rel), content);
    }
    if (git) {
        spawnSync('git', ['init', '-q', root]);
        spawnSync('git', ['-C', root, 'add', '-A']);
    }
    for (const [rel, content] of Object.entries(untracked)) {
        mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        writeFileSync(path.join(root, rel), content);
    }
    return root;
}

const context = (tier, stack = 'laravel', mode = 'github-freelo') => `# Demo — project context

## Project profile

- Stack: \`${stack}\`
- Archetype: \`—\`
- Process tier: \`${tier}\`
- Stack profile: \`esoul-project-lifecycle/references/stacks/${stack}.md\`
- Environments: staging https://staging.example.test, production https://example.test
- UAT dimensions: Role, Předpoklad

## Freelo

- Projekt: Demo
- Project ID: 1

## Tasking convention

Use the \`esoul-tasking\` skill for task authoring.

- Mode: \`${mode}\`

## Commit convention

\`\`\`text
:emoji: [optional-context] imperative message
\`\`\`
`;

const adr = (status, implementation = true) => `---
status: ${status}
date: 2026-10-21
deciders: eSoul
---

# Something is decided

## Context
${implementation ? '\n## Implementation status as of 2026-10-21\n\nNo issue.\n' : ''}`;

const adrIndex = (rows) => `# Architecture Decision Records

| ADR | Title | Status |
|---|---|---|
${rows.map(([file, status]) => `| [${file.slice(0, 4)}](${file}) | Title | \`${status}\` |`).join('\n')}
`;

const slices = `# Seznam slices

| ID | Titulek | Kat. | Závislosti | Rozsah | Obrazovky | Issue | Akceptace |
|---|---|---|---|---|---|---|---|
| F1-01 | Katalog: Zobrazit produkty | fe | — | S | B1 | [#1](https://github.com/o/r/issues/1) | Viz PR #99 |
| F1-02 | Košík: Přidat produkt | be | F1-01 | S | — | #7 | — |
| F1-03 | Účty: Přihlásit zákazníka | be | — | S | — | — | — |
`;

function fullFiles(overrides = {}) {
    return {
        'AGENTS.md': '# Agents\n',
        'CLAUDE.md': '@AGENTS.md\n',
        'CONTEXT.md': context('full'),
        'GLOSSARY.md': '# Glossary\n\n**Order (`Objednávka`)**: a placed cart.\n_Avoid_: purchase\n',
        'CONTRIBUTING.md': '# Contributing\n',
        '.github/CODEOWNERS': '* @eSoul-cz/devs\n',
        '.coderabbit.yaml': 'language: cs-CZ\n',
        '.github/ISSUE_TEMPLATE/task.yml': 'name: Task\n',
        '.github/ISSUE_TEMPLATE/bug.yml': 'name: Bug\n',
        '.github/PULL_REQUEST_TEMPLATE.md': '## Ověření\n',
        Jenkinsfile: 'pipeline {}\n',
        'docs/podklady/README.md': '# Podklady\n',
        'docs/podklady/otevrene-otazky.md': '# Otázky\n',
        'docs/adr/index.md': adrIndex([['0001-use-laravel.md', 'accepted']]),
        'docs/adr/0000-template.md': '---\nstatus: proposed\ndate: YYYY-MM-DD\n---\n# Decision statement\n',
        'docs/adr/0001-use-laravel.md': adr('accepted'),
        'docs/plan/README.md': '# Plán\n',
        'docs/plan/seznam-slices.md': slices,
        'docs/project_guidelines/index.md': '# Guidelines\n',
        ...overrides,
    };
}

function lightFiles(overrides = {}) {
    return {
        'CLAUDE.md': '# Site\n',
        'CONTEXT.md': context('light', 'astro', 'freelo-only').replace('`—`', '`A-static`'),
        '.coderabbit.yaml': 'language: cs-CZ\n',
        Jenkinsfile: 'pipeline {}\n',
        'docs/sitemap-a-meta.md': '# Sitemap\n',
        'docs/rozhodnuti.md': '# Rozhodnutí\n',
        'docs/plan.md': '# Plán\n',
        'docs/nasazeni.md': '# Nasazení\n',
        'docs/obsah-novy-web.md': '# Obsah\n',
        'docs/design-log.md': '# Design\n',
        '.github/PULL_REQUEST_TEMPLATE.md': '## Ověření\n',
        ...overrides,
    };
}

const codes = (result, severity) => result.findings.filter((f) => f.severity === severity).map((f) => f.code);
const find = (result, code) => result.findings.filter((f) => f.code === code);

test('a conforming full-tier project has no errors or warnings', () => {
    const result = runConformance(project(fullFiles()));
    assert.equal(result.profile.tier, 'full');
    assert.equal(result.profile.tierSource, 'CONTEXT.md');
    assert.deepEqual(codes(result, 'error'), []);
    assert.deepEqual(codes(result, 'warning'), []);
    const summary = find(result, 'slice-summary')[0].message;
    assert.match(summary, /3 slice row\(s\), 2 linked to an issue, 1 without/);
});

test('full tier reports missing files, placeholders, ADR and slice defects', () => {
    const files = fullFiles({
        'AGENTS.md': '# {{PROJECT_NAME}}\n\nRun `{{ price }}` in Vue.\n',
        '.agents/skills/demo/SKILL.md': '# {{IGNORED_IN_VENDORED_SKILL}}\n',
        'vendor/pkg/README.md': '{{IGNORED_IN_VENDOR}}\n',
        'docs/adr/index.md': adrIndex([
            ['0001-use-laravel.md', 'accepted'],
            ['0002-money.md', 'accepted'],
            ['0009-gone.md', 'proposed'],
        ]),
        'docs/adr/0002-money.md': adr('proposed'),
        'docs/adr/0002-duplicate.md': adr('accepted'),
        'docs/adr/0003-unlisted.md': adr('accepted', false),
        'docs/adr/0004-no-status.md': '# No frontmatter\n',
        'docs/adr/0000-template.md': '---\nstatus: proposed\n---\n# {{DECISION}}\n',
        'docs/plan/seznam-slices.md': `${slices}| F1-01 | Duplicate | be | — | S | — | — | — |

| ID | Změna | Důvod |
|---|---|---|
| F1-02 | Zrušeno | Change logs may repeat IDs |
`,
    });
    delete files['.github/CODEOWNERS'];
    delete files['GLOSSARY.md'];
    const root = project(files, { untracked: { 'notes.md': '{{UNTRACKED_IS_IGNORED}}\n' } });
    const result = runConformance(root);

    const missing = find(result, 'missing-file').map((f) => f.file);
    assert.deepEqual(missing, ['GLOSSARY.md', 'CODEOWNERS or .github/CODEOWNERS or docs/CODEOWNERS']);

    const placeholders = find(result, 'placeholder');
    assert.deepEqual(placeholders.map((f) => f.file).sort(), ['AGENTS.md', 'docs/adr/0000-template.md']);
    assert.match(placeholders.find((f) => f.file === 'AGENTS.md').message, /\{\{PROJECT_NAME\}\} \(line 1\)/);
    assert.equal(find(result, 'mustache').length, 1);

    assert.match(find(result, 'adr-duplicate')[0].message, /0002/);
    assert.equal(find(result, 'adr-status').length, 1);
    assert.equal(find(result, 'adr-status')[0].file, 'docs/adr/0004-no-status.md');
    assert.match(find(result, 'adr-index-mismatch')[0].message, /0002-money\.md: frontmatter says `proposed`, index says `accepted`/);
    assert.match(find(result, 'adr-index-missing')[0].message, /0002, 0003/);
    assert.match(find(result, 'adr-index-dangling')[0].message, /0009-gone\.md/);
    assert.match(find(result, 'adr-implementation')[0].message, /0003/);

    const duplicates = find(result, 'slice-duplicate');
    assert.equal(duplicates.length, 1);
    assert.match(duplicates[0].message, /^1 duplicate slice ID\(s\): F1-01/);
    assert.ok(result.counts.error > 0);
});

test('a project without a profile is checked as full with a warning, and --tier overrides it', () => {
    const files = lightFiles({ 'CONTEXT.md': '# Site context\n\n## Commit convention\n' });
    const root = project(files);

    const defaulted = runConformance(root);
    assert.equal(defaulted.profile.tier, 'full');
    assert.equal(defaulted.profile.tierSource, 'default');
    assert.ok(codes(defaulted, 'warning').includes('profile-missing'));
    assert.ok(codes(defaulted, 'warning').includes('tier-default'));
    assert.ok(find(defaulted, 'missing-file').some((f) => f.file === 'GLOSSARY.md'));

    const light = runConformance(root, { tier: 'light' });
    assert.equal(light.profile.tierSource, '--tier');
    assert.deepEqual(find(light, 'missing-file'), []);
    assert.ok(!codes(light, 'warning').includes('tier-default'));
});

test('a conforming light-tier project needs neither GLOSSARY nor ADRs nor slices', () => {
    const result = runConformance(project(lightFiles()));
    assert.equal(result.profile.tier, 'light');
    assert.equal(result.profile.archetype, 'A-static');
    assert.deepEqual(codes(result, 'error'), []);
    assert.deepEqual(codes(result, 'warning'), []);
});

test('light tier reports its own missing files and accepts AGENTS.md instead of CLAUDE.md', () => {
    const files = lightFiles({ 'AGENTS.md': '# Agents\n' });
    delete files['CLAUDE.md'];
    delete files['docs/nasazeni.md'];
    const result = runConformance(project(files));
    assert.deepEqual(find(result, 'missing-file').map((f) => f.file), ['docs/nasazeni.md']);
});

test('without git, files on disk are scanned and reported as info', () => {
    const result = runConformance(project(fullFiles({ 'AGENTS.md': '{{CLIENT_NAME}}\n' }), { git: false }));
    assert.ok(codes(result, 'info').includes('not-git'));
    assert.ok(find(result, 'placeholder').some((f) => f.file === 'AGENTS.md'));
});

// --- GitHub checks with a fake gh --------------------------------------------------------------

function fakeGh(responses) {
    const calls = [];
    const gh = (args) => {
        calls.push(args.join(' '));
        const key = Object.keys(responses).find((prefix) => args.join(' ').startsWith(prefix));
        if (!key) return { ok: false, error: 'HTTP 404: Not Found' };
        return { ok: true, data: responses[key] };
    };
    gh.calls = calls;
    return gh;
}

const issueBody = (extra = '') => `**Slice:** F1-01 · **Fáze:** F1\n\n## UAT\n\n1. [ ] a → b\n\nFreelo: https://app.freelo.io/task/123\n${extra}`;

test('--github reports title, label, UAT, Freelo, slice and ruleset findings', () => {
    const root = project(fullFiles());
    const gh = fakeGh({
        'api repos/o/r/rulesets/7': {
            bypass_actors: [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }],
            current_user_can_bypass: 'never',
        },
        'api repos/o/r/rulesets': [{ id: 7, name: 'Main', enforcement: 'active' }],
        'api repos/o/r/rules/branches/main': [
            { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Build' }] } },
            { type: 'pull_request', parameters: { required_approving_review_count: 0, allowed_merge_methods: ['merge'] } },
        ],
        'api repos/o/r': { default_branch: 'main', allow_squash_merge: false, allow_merge_commit: true },
        'api user': { login: 'someone' },
        'issue list -R o/r --state open': [
            { number: 1, title: '[FE] Katalog: Zobrazit produkty', labels: [{ name: 'frontend' }], body: issueBody() },
            { number: 2, title: 'F1-02 Košík: Přidat produkt', labels: [{ name: 'backend' }], body: issueBody() },
            { number: 3, title: 'Účty: Přihlásit', labels: [{ name: 'enhancement' }], body: '### UAT\n\n1. [ ] x → y\n' },
            { number: 4, title: 'Sklad: Odepsat zásobu', labels: [{ name: 'Backend' }], body: 'No sections. https://app.freelo.io/task/9' },
        ],
        'issue list -R o/r --state all': [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }],
    });

    const result = runConformance(root, { github: 'o/r', gh });

    assert.match(find(result, 'issue-title-prefix')[0].message, /^1 open issue.*#1\.$/);
    assert.match(find(result, 'issue-title-slice')[0].message, /#2\.$/);
    assert.match(find(result, 'issue-category-label')[0].message, /#3\.$/);
    assert.match(find(result, 'issue-uat')[0].message, /^1 open issue.*#4\.$/, '### UAT from the issue form counts');
    assert.match(find(result, 'issue-freelo-link')[0].message, /#3\.$/);
    assert.match(find(result, 'slice-issue-missing')[0].message, /F1-02 → #7/);
    assert.ok(!find(result, 'slice-issue-missing')[0].message.includes('#99'), 'PR references are not issues');
    assert.equal(find(result, 'merge-squash').length, 2);
    assert.equal(find(result, 'merge-methods').length, 1);
    assert.match(find(result, 'ruleset-jenkins')[0].message, /required: Build/);
    assert.match(find(result, 'ruleset-approvals')[0].message, /requires 0 approving/);
    assert.equal(find(result, 'ruleset-bypass')[0].severity, 'warning');
    assert.ok(gh.calls.every((call) => !/\b(edit|create|close|delete|merge|-X|--method)\b/.test(call)), 'only read commands');
});

test('--github flags the shared account bypass and skips Freelo checks in freelo-only mode', () => {
    const root = project(fullFiles({ 'CONTEXT.md': context('full', 'laravel', 'freelo-only') }));
    const gh = fakeGh({
        'api repos/o/r/rulesets/1': { bypass_actors: [], current_user_can_bypass: 'always' },
        'api repos/o/r/rulesets': [{ id: 1, name: 'Jenkins must pass', enforcement: 'active' }],
        'api repos/o/r/rules/branches/main': [
            { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'Jenkins' }] } },
            { type: 'pull_request', parameters: { required_approving_review_count: 1, allowed_merge_methods: ['squash'] } },
        ],
        'api repos/o/r': { default_branch: 'main', allow_squash_merge: true, allow_merge_commit: false, allow_rebase_merge: false },
        'api user': { login: 'esoul-cz-user' },
        'issue list -R o/r --state open': [{ number: 1, title: 'Katalog: Zobrazit', labels: [{ name: 'frontend' }], body: '## UAT\n' }],
        'issue list -R o/r --state all': [{ number: 1 }, { number: 7 }],
    });
    const result = runConformance(root, { github: 'o/r', gh });
    assert.deepEqual(codes(result, 'error'), ['ruleset-bypass']);
    assert.deepEqual(find(result, 'issue-freelo-link'), []);
});

test('a failing gh records a skipped finding instead of crashing', () => {
    const root = project(fullFiles());
    const result = runConformance(root, { github: 'o/r', gh: makeGh(path.join(temp, 'no-such-gh')) });
    const skipped = find(result, 'github-skipped');
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].severity, 'warning');
    assert.match(skipped[0].message, /not found/);
});

// --- CLI ----------------------------------------------------------------------------------------

test('CLI exits 1 on errors, 0 when clean, 2 on bad usage, and prints JSON with --json', () => {
    const clean = project(fullFiles());
    const broken = project(fullFiles({ 'AGENTS.md': '{{PROJECT_NAME}}\n' }));
    const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

    const ok = run(clean);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /Errors \(0\)/);

    const bad = run(broken, '--json');
    assert.equal(bad.status, 1);
    const json = JSON.parse(bad.stdout);
    assert.equal(json.counts.error, 1);
    assert.equal(json.findings.find((f) => f.severity === 'error').code, 'placeholder');

    assert.equal(run(clean, '--tier', 'medium').status, 2);
    assert.equal(run(path.join(temp, 'missing')).status, 2);
});

test('fake gh binary works through makeGh', () => {
    const bin = path.join(temp, 'gh-fake.mjs');
    writeFileSync(bin, `#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ args: process.argv.slice(2) }));\n`);
    chmodSync(bin, 0o755);
    const result = makeGh(bin)(['api', 'repos/o/r']);
    assert.deepEqual(result, { ok: true, data: { args: ['api', 'repos/o/r'] } });
});

test('broken relative links are warnings; per-item templates, URLs and placeholders are ignored', () => {
    const root = project(lightFiles({
        'AGENTS.md': '[ok](docs/plan.md) [gone](docs/adr/index.md) [web](https://esoul.cz) [anchor](#x)\n',
        'docs/podklady/_poznamka.md': '[example](../adr/NNNN-english-slug.md)\n',
        'docs/rozhodnuti.md': '# Rozhodnutí\n\n```md\n[in code](missing.md)\n```\n',
    }));
    const warnings = find(runConformance(root), 'broken-link');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /^1 relative link/);
    assert.match(warnings[0].message, /AGENTS\.md → docs\/adr\/index\.md/);
});

test('CODEOWNERS placeholders are errors and HTML comments are not link-checked', () => {
    const root = project(fullFiles({
        CODEOWNERS: '* {{LEAD_OWNERS}}\n',
        'docs/data-model.md': '# Data model\n<!-- e.g. [ADR](adr/NNNN-x.md) -->\n',
    }));
    const result = runConformance(root);
    assert.ok(find(result, 'placeholder').some((f) => f.file === 'CODEOWNERS'));
    assert.equal(find(result, 'broken-link').length, 0);
});

test('code fences follow CommonMark: same character, at least the opener length, nothing after', () => {
    const doc = ['## A', '````md', '```bash', '## Not a section', '```', '````', '## B', '~~~', '[x](gone.md)', '~~~', 'end'];
    assert.deepEqual([...sections(doc.join('\n')).keys()], ['A', 'B']);
    assert.deepEqual(fencedLines(doc), [false, true, true, true, true, true, false, true, true, true, false]);
});

test('a malformed percent escape in a link does not abort the run', () => {
    const root = project(lightFiles({ 'AGENTS.md': '[sale](sleva-50%.md) [tilde]\n\n~~~\n[x](gone.md)\n~~~\n' }));
    const warnings = find(runConformance(root), 'broken-link');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /^1 relative link.*sleva-50%\.md/);
});

test('the CLI runs when invoked through a symlinked skill directory', () => {
    const linkDir = path.join(temp, 'linked-skill');
    symlinkSync(path.dirname(SCRIPT), linkDir);
    const root = project(lightFiles());
    const run = spawnSync(process.execPath, [path.join(linkDir, 'conformance.mjs'), root, '--json'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout).profile.tier, 'light');
});
