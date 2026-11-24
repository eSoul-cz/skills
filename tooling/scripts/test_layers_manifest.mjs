import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { layerSources, loadManifest, validateManifest } from '../../lib/layers.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const manifest = loadManifest(join(root, 'layers.json'));

function skillsOnDisk() {
    const found = {};
    const base = join(root, 'skills');
    for (const layer of readdirSync(base, { withFileTypes: true })) {
        if (!layer.isDirectory()) {
            continue;
        }
        found[layer.name] = readdirSync(join(base, layer.name), { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && existsSync(join(base, layer.name, entry.name, 'SKILL.md')))
            .map((entry) => entry.name);
    }
    return found;
}

test('layers.json is valid and every own skill is in exactly one layer', () => {
    assert.deepEqual(validateManifest(manifest, skillsOnDisk()), []);
    const layersOnDisk = Object.keys(skillsOnDisk()).sort();
    const ownLayers = Object.entries(manifest.layers).filter(([, layer]) => layer.skills?.length).map(([id]) => id).sort();
    assert.deepEqual(layersOnDisk, ownLayers, 'skills/ holds one folder per layer with own skills');
});

test('the seven layers exist and upstream-core pins mattpocock/skills', () => {
    assert.deepEqual(Object.keys(manifest.layers), ['core', 'dev', 'project', 'helpers', 'business', 'upstream-core', 'upstream-picks']);
    const mattpocock = manifest.layers['upstream-core'].sources.find((source) => source.repo === 'mattpocock/skills');
    assert.match(mattpocock.ref, /^v\d+\.\d+\.\d+$/);
});

function listSkills(source) {
    const local = source.repo === manifest.repo;
    const spec = local ? root : `${source.repo}${source.ref ? `@${source.ref}` : ''}`;
    return new Promise((resolve, reject) => {
        execFile('npx', ['-y', 'skills', 'add', spec, '--list'], { encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`npx skills add ${spec} --list failed: ${stderr || stdout || error.message}`));
                return;
            }
            const text = stdout.replace(/\x1b\[[0-9;]*m/g, '');
            resolve(new Set([...text.matchAll(/^│ {4}(\S+)\s*$/gm)].map((match) => match[1])));
        });
    });
}

// Needs the network and the `skills` package; the Jenkins job runs it. Set ESOUL_SKIP_NETWORK=1 offline.
test('every source of layers.json resolves and lists its skills', { skip: process.env.ESOUL_SKIP_NETWORK === '1', timeout: 600000 }, async () => {
    const sources = new Map();
    for (const id of Object.keys(manifest.layers)) {
        for (const source of layerSources(manifest, id)) {
            const key = `${source.repo}@${source.ref ?? ''}`;
            const entry = sources.get(key) ?? { source, skills: new Set(), layers: new Set() };
            source.skills.forEach((name) => entry.skills.add(name));
            entry.layers.add(id);
            sources.set(key, entry);
        }
    }
    // Own skills are listed from this checkout, not from GitHub, so a restructure can be checked before it is pushed.
    sources.set(`${manifest.repo}@`, {
        source: { repo: manifest.repo },
        skills: new Set(Object.values(manifest.layers).flatMap((layer) => layer.skills ?? [])),
        layers: new Set(['own']),
    });
    const entries = [...sources.values()];
    // Concurrent first runs of `npx -y skills` race on the shared npx cache (ENOTEMPTY); install it once before the parallel listing.
    const warm = spawnSync('npx', ['-y', 'skills', '--help'], { encoding: 'utf8', timeout: 240000 });
    assert.equal(warm.status, 0, `npx -y skills --help failed: ${warm.stderr}`);
    // A private source (marked "private": true) is checked when the machine can clone it and skipped with a note otherwise
    // (Jenkins has no clone credentials for the shell); ESOUL_REQUIRE_PRIVATE=1 makes it mandatory.
    const listed = await Promise.all(entries.map(({ source }) =>
        listSkills(source).catch((error) => {
            if (source.private && process.env.ESOUL_REQUIRE_PRIVATE !== '1') {
                console.log(`# skipped private source ${source.repo}: not reachable from this machine`);
                return null;
            }
            throw error;
        }),
    ));
    const missing = [];
    entries.forEach(({ source, skills, layers }, index) => {
        for (const name of skills) {
            if (listed[index] && !listed[index].has(name)) {
                missing.push(`${source.repo}${source.ref ? `@${source.ref}` : ''}: ${name} (${[...layers].join(', ')})`);
            }
        }
    });
    assert.deepEqual(missing, []);
});

test('the helper package ships what its bin needs', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.name, '@esoul-cz/skills');
    assert.equal(pkg.publishConfig.access, 'public');
    assert.deepEqual(pkg.dependencies ?? {}, {}, 'the helper has no runtime dependencies');
    for (const file of [pkg.bin['esoul-skills'], ...pkg.files, 'lib/cli.mjs', 'lib/layers.mjs', 'lib/stack.mjs']) {
        assert.ok(existsSync(join(root, file)), `${file} is missing`);
    }
});

// The picks manifest was pruned to the picks whose advice does not conflict with the project guidelines (review
// decisions AP-D1/AP-D4). A dropped pick returns only with a new decision, so the test pins both lists.
test('upstream-picks lists only the reviewed picks and none of the dropped ones', () => {
    const groups = manifest.layers['upstream-picks'].groups;
    const skillsOf = (group) => groups[group].sources.flatMap((source) => source.skills);
    assert.deepEqual(Object.keys(groups), ['wordpress', 'web', 'frontend', 'data', 'jenkins', 'matt-extra']);
    assert.deepEqual(skillsOf('wordpress'), ['wordpress']);
    assert.deepEqual(skillsOf('web'), ['accessibility-compliance-accessibility-audit', 'seo-schema', 'seo-technical']);
    assert.deepEqual(skillsOf('frontend'), ['frontend-design', 'frontend-lighthouse']);
    assert.deepEqual(skillsOf('data'), ['sql-optimization-patterns']);
    assert.deepEqual(skillsOf('jenkins'), ['esoul-jenkins-libraries']);
    const dropped = [
        'laravel-expert', 'laravel-security-audit', 'php-pro', 'docker-expert', 'mysql', 'jenkins', 'e2e-testing', 'e2e-testing-patterns',
        'seo-audit', 'web-performance-optimization', 'data-storytelling', 'frontend-architecture', 'gdpr-compliance',
        'wordpress-plugin-development', 'wordpress-theme-development', 'wordpress-woocommerce-development',
    ];
    const listed = new Set(Object.values(manifest.layers).flatMap((layer) => Object.keys(layer.groups ?? {}).flatMap((group) => layerSkillsOf(layer, group))));
    assert.deepEqual(dropped.filter((name) => listed.has(name)), []);
});

function layerSkillsOf(layer, group) {
    return layer.groups[group].sources?.flatMap((source) => source.skills) ?? [];
}

// The one place that knows the retired skill names: `esoul-skills status` and `retired`, and the "update a project's
// eSoul setup" procedure of esoul-project-update read it. A name is added when a skill is renamed or removed.
test('layers.json carries the retired-name map, and no retired name is a skill on disk', () => {
    const replacements = Object.fromEntries(Object.entries(manifest.retired).map(([name, entry]) => [name, entry.use.join(',') + (entry.source ? `@${entry.source}` : '')]));
    assert.deepEqual(replacements, {
        'final-pr-review': 'esoul-review',
        'pre-pr-review': 'esoul-review',
        'esoul-tasking': 'esoul-task-create,esoul-task-work',
        'esoul-freelo-task-authoring': 'esoul-task-create',
        'esoul-maintain-application-documentation': 'esoul-docs',
        'esoul-project-data': 'esoul-data',
        'esoul-data-task-guard': 'esoul-data',
        'test-queue': 'test-queue@eSoul-cz/test-queue',
        freelo: 'freelo@freeloio/freelo-cli',
    });
    const onDisk = new Set(Object.values(skillsOnDisk()).flat());
    assert.deepEqual(Object.keys(manifest.retired).filter((name) => onDisk.has(name)), []);
});
