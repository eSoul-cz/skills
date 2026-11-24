import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
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
    const listed = await Promise.all(entries.map(({ source }) => listSkills(source)));
    const missing = [];
    entries.forEach(({ source, skills, layers }, index) => {
        for (const name of skills) {
            if (!listed[index].has(name)) {
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
