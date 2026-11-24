import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agents, install, listRetired, parseArgs, projectInit, stackGroupArgs } from '../../lib/cli.mjs';
import { boostChecks, boostSkills, detectGuidelineLayers, projectGuidelineLayers } from '../../lib/stack.mjs';
import {
    PROJECT_INIT_LAYERS,
    batchInvocations,
    expandLayerArgs,
    findStaleSetup,
    groupsForGuidelineLayers,
    groupsForProjectFiles,
    layerChoices,
    layerSkills,
    managedGroups,
    parseLayerArg,
    planInstall,
    renamedSkills,
    resolveSelection,
    satisfiedLayers,
    selectionGroups,
    staleFix,
    validateManifest,
    withSkillRequires,
} from '../../lib/layers.mjs';

const manifest = {
    repo: 'org/skills',
    layers: {
        core: { title: 'Core', description: 'c', scope: 'project', requires: [], skills: ['a', 'b'] },
        dev: { title: 'Dev', description: 'd', scope: 'project', requires: ['core', 'up'], skills: ['c'] },
        extra: {
            title: 'Extra',
            description: 'e',
            scope: 'user',
            requires: ['core'],
            skills: ['d'],
            sources: [{ repo: 'org/queue', skills: ['q'], optional: true }],
        },
        up: {
            title: 'Up',
            description: 'u',
            scope: 'project',
            requires: [],
            sources: [{ repo: 'm/skills', ref: 'v1', skills: ['x', 'y'] }],
            groups: {
                stack: { default: false, detect: ['framework/lsr'], sources: [{ repo: 's/stack', skills: ['s1', 's2'] }] },
                boosted: { default: false, detect: ['framework/laravel'], managedBy: 'Boost', sources: [] },
                manual: { default: false, sources: [{ repo: 's/manual', skills: ['m1'] }] },
            },
        },
        picks: {
            title: 'Picks',
            description: 'p',
            scope: 'user',
            requires: [],
            groups: {
                one: { sources: [{ repo: 'p/one', skills: ['p1'] }] },
                two: { sources: [{ repo: 'p/two', skills: ['p2'] }] },
                extra: { default: false, sources: [{ repo: 'p/extra', skills: ['p3'] }] },
            },
        },
    },
};

test('layer arguments parse and expand', () => {
    assert.deepEqual(parseLayerArg('picks:one'), { layer: 'picks', group: 'one' });
    assert.deepEqual(parseLayerArg('core'), { layer: 'core', group: null });
    assert.throws(() => parseLayerArg('a:b:c'));
    assert.throws(() => parseLayerArg('a:'));
    assert.deepEqual(expandLayerArgs(['core,dev', 'picks:one,two']), ['core', 'dev', 'picks:one', 'picks:two']);
});

test('requires are resolved requirements first and reported as added', () => {
    const resolved = resolveSelection(manifest, ['dev']);
    assert.deepEqual(resolved.layers.map((l) => l.layer), ['core', 'up', 'dev']);
    assert.deepEqual(resolved.added, ['core', 'up']);
});

test('installed layers are not added again, and --no-requires skips them', () => {
    const resolved = resolveSelection(manifest, ['dev'], { satisfied: new Set(['core']) });
    assert.deepEqual(resolved.layers.map((l) => l.layer), ['up', 'dev']);
    assert.deepEqual(resolveSelection(manifest, ['dev'], { withRequires: false }).layers.map((l) => l.layer), ['dev']);
});

test('a selected requirement is listed before its dependant and not reported as added', () => {
    const resolved = resolveSelection(manifest, ['dev', 'core', 'up']);
    assert.deepEqual(resolved.layers.map((l) => l.layer), ['core', 'up', 'dev']);
    assert.deepEqual(resolved.added, []);
});

test('unknown layers and groups fail with the valid names', () => {
    assert.throws(() => resolveSelection(manifest, ['nope']), /Unknown layer "nope".*core/);
    assert.throws(() => resolveSelection(manifest, ['picks:three']), /no group "three".*one, two/);
    assert.throws(() => resolveSelection(manifest, ['core:x']), /no group "x"/);
});

test('a layer is its base plus default groups; a group on request needs naming', () => {
    assert.deepEqual(resolveSelection(manifest, ['picks:one']).layers, [{ layer: 'picks', base: false, groups: ['one'] }]);
    assert.deepEqual(resolveSelection(manifest, ['picks']).layers, [{ layer: 'picks', base: true, groups: [] }]);
    assert.deepEqual(resolveSelection(manifest, ['picks:one', 'picks']).layers, [{ layer: 'picks', base: true, groups: ['one'] }]);
    assert.deepEqual(layerSkills(manifest, 'picks', { group: 'two' }), ['p2']);
    assert.deepEqual(layerSkills(manifest, 'picks'), ['p1', 'p2']);
    assert.deepEqual(layerSkills(manifest, 'picks', { allGroups: true }), ['p1', 'p2', 'p3']);
    assert.deepEqual(layerSkills(manifest, 'up'), ['x', 'y']);
});

test('plan: one npx skills call per source, scope from the layer, ref pinned', () => {
    const plan = planInstall(manifest, resolveSelection(manifest, ['dev'], { satisfied: new Set(['core']) }));
    assert.deepEqual(plan.map((p) => p.args), [
        ['add', 'm/skills@v1', '--skill', 'x', 'y'],
        ['add', 'org/skills', '--skill', 'c'],
    ]);
    const user = planInstall(manifest, resolveSelection(manifest, ['extra'], { withRequires: false }));
    assert.deepEqual(user.map((p) => p.args), [['add', 'org/skills', '--skill', 'd', '--global']]);
});

test('plan: optional sources only with --optional or when named by --skill', () => {
    const resolved = resolveSelection(manifest, ['extra'], { withRequires: false });
    assert.equal(planInstall(manifest, resolved).length, 1);
    assert.equal(planInstall(manifest, resolved, { withOptional: true }).length, 2);
    const named = planInstall(manifest, resolved, { skillFilter: ['q'] });
    assert.deepEqual(named.map((p) => p.args), [['add', 'org/queue', '--skill', 'q', '--global']]);
});

test('plan: --skill filters and rejects skills outside the selection', () => {
    const resolved = resolveSelection(manifest, ['core']);
    assert.deepEqual(planInstall(manifest, resolved, { skillFilter: ['b'] }).map((p) => p.skills), [['b']]);
    assert.throws(() => planInstall(manifest, resolved, { skillFilter: ['zzz'] }), /zzz is not in the selected layers/);
});

test('plan: --skill also installs the skills it requires (skillRequires), and the manifest check rejects a bad entry', () => {
    const requiring = structuredClone(manifest);
    requiring.layers.core.skillRequires = { b: ['a'] };
    const resolved = resolveSelection(requiring, ['core']);
    assert.deepEqual(planInstall(requiring, resolved, { skillFilter: ['b'] }).map((p) => p.skills), [['a', 'b']]);
    assert.deepEqual(withSkillRequires(requiring, ['b']).sort(), ['a', 'b']);
    assert.deepEqual(validateManifest(requiring), []);
    requiring.layers.core.skillRequires = { zzz: ['a'], a: ['a'] };
    assert.equal(validateManifest(requiring).length, 2);
});

test('plan: scope override, --yes and passthrough flags', () => {
    const resolved = resolveSelection(manifest, ['core']);
    const [call] = planInstall(manifest, resolved, { scope: 'user', yes: true, passthrough: ['--agent', 'codex'] });
    assert.deepEqual(call.args, ['add', 'org/skills', '--skill', 'a', 'b', '--global', '--yes', '--agent', 'codex']);
    assert.equal(call.scope, 'user');
});

test('plan: a group only installs the sources of that group', () => {
    const plan = planInstall(manifest, resolveSelection(manifest, ['picks:two']));
    assert.deepEqual(plan.map((p) => p.args), [['add', 'p/two', '--skill', 'p2', '--global']]);
});

test('plan: the layer skips groups on request, naming them adds them, a managed group installs nothing', () => {
    const whole = planInstall(manifest, resolveSelection(manifest, ['picks']));
    assert.deepEqual(whole.map((p) => p.repo), ['p/one', 'p/two']);
    const withExtra = planInstall(manifest, resolveSelection(manifest, ['picks', 'picks:extra']));
    assert.deepEqual(withExtra.map((p) => p.repo), ['p/one', 'p/two', 'p/extra']);
    const stack = planInstall(manifest, resolveSelection(manifest, ['up', 'up:stack', 'up:boosted'], { withRequires: false }));
    assert.deepEqual(stack.map((p) => p.args), [
        ['add', 'm/skills@v1', '--skill', 'x', 'y'],
        ['add', 's/stack', '--skill', 's1', 's2'],
    ]);
    assert.deepEqual(planInstall(manifest, resolveSelection(manifest, ['up:boosted'], { withRequires: false })), []);
    assert.throws(() => planInstall(manifest, resolveSelection(manifest, ['picks']), { skillFilter: ['p3'] }), /p3 is not in the selected layers/);
});

test('stack groups follow the guideline layers of the project', () => {
    assert.deepEqual(groupsForGuidelineLayers(manifest, ['framework/lsr', 'package/lsr-cqrs']), ['up:stack']);
    assert.deepEqual(groupsForGuidelineLayers(manifest, ['framework/laravel', 'framework/lsr']), ['up:stack', 'up:boosted']);
    assert.deepEqual(groupsForGuidelineLayers(manifest, ['framework/astro']), []);
    assert.deepEqual(managedGroups(manifest), [{ layer: 'up', group: 'boosted', managedBy: 'Boost', detect: ['framework/laravel'] }]);
});

function project(files) {
    const root = mkdtempSync(join(tmpdir(), 'esoul-skills-'));
    for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(root, name), typeof content === 'string' ? content : JSON.stringify(content));
    }
    return root;
}

test('stack detection mirrors esoul-guidelines init', () => {
    const root = project({
        'composer.json': { require: { 'lsr/core': '^1', 'lsr/cqrs': '^1' }, 'require-dev': { 'infection/infection': '*' } },
        'package.json': { dependencies: { '@inertiajs/vue3': '^2' } },
    });
    assert.deepEqual(detectGuidelineLayers(root), ['framework/lsr', 'package/inertia-vue', 'package/lsr-cqrs', 'package/mutation-testing']);
    const laravel = project({
        'composer.json': { require: { 'laravel/framework': '^13', 'inertiajs/inertia-laravel': '^2' }, 'require-dev': { 'lunarphp/lunar': '*' } },
    });
    assert.deepEqual(detectGuidelineLayers(laravel), ['framework/laravel', 'package/filament', 'package/laravel-inertia', 'package/lunar']);
    assert.deepEqual(detectGuidelineLayers(project({})), []);
    assert.deepEqual(detectGuidelineLayers(project({ 'composer.json': 'not json' })), []);
});

test('esoul-guidelines.json wins over detection', () => {
    const root = project({
        'esoul-guidelines.json': { layers: ['general', 'framework/lsr'] },
        'composer.json': { require: { 'laravel/framework': '^13' } },
    });
    assert.deepEqual(projectGuidelineLayers(root), { layers: ['general', 'framework/lsr'], source: 'esoul-guidelines.json' });
    assert.equal(projectGuidelineLayers(project({ 'composer.json': { require: {} } })).source, 'composer.json and package.json');
});

test('stack options: --stack names groups, --no-stack none, unknown fails', () => {
    const root = project({ 'esoul-guidelines.json': { layers: ['framework/lsr'] } });
    assert.deepEqual(stackGroupArgs(manifest, parseArgs([]), root).args, ['up:stack']);
    assert.deepEqual(stackGroupArgs(manifest, parseArgs(['--stack', 'manual,stack']), root).args, ['up:manual', 'up:stack']);
    assert.deepEqual(stackGroupArgs(manifest, parseArgs(['--no-stack']), root).args, []);
    assert.throws(() => stackGroupArgs(manifest, parseArgs(['--stack', 'nope']), root), /Unknown stack nope. Stacks: stack, boosted, manual/);
});

test('Laravel Boost checks and skills', () => {
    const good = project({
        'composer.json': { require: { 'laravel/framework': '^13' }, 'require-dev': { 'laravel/boost': '^2' }, scripts: { 'post-update-cmd': ['@php artisan boost:update --ansi'] } },
        'boost.json': { skills: ['laravel-best-practices'] },
    });
    assert.deepEqual(boostChecks(good).map((check) => check.ok), [true, true]);
    assert.deepEqual(boostSkills(good), ['laravel-best-practices']);
    const bad = project({ 'composer.json': { require: { 'laravel/framework': '^13' } } });
    assert.deepEqual(boostChecks(bad).map((check) => check.ok), [false, false]);
    assert.equal(boostSkills(bad), null);
});

test('project init prints the Boost checks for a Laravel project and installs the matching groups', async () => {
    const root = project({ 'esoul-guidelines.json': { layers: ['framework/laravel', 'framework/lsr'] }, 'composer.json': { require: {} } });
    const lines = [];
    const originalLog = console.log;
    console.log = (line) => lines.push(String(line));
    try {
        const renamed = JSON.parse(JSON.stringify(manifest));
        renamed.layers['upstream-core'] = renamed.layers.up;
        delete renamed.layers.up;
        renamed.layers.dev.requires = ['core', 'upstream-core'];
        await projectInit(parseArgs(['--dry-run', '--yes']), renamed, root);
    } finally {
        console.log = originalLog;
    }
    const text = lines.join('\n');
    assert.match(text, /upstream-core:stack, upstream-core:boosted/);
    assert.match(text, /managed by Boost/);
    assert.match(text, /FIX {2}laravel\/boost is not installed/);
    assert.match(text, /npx -y skills add s\/stack/);
    assert.doesNotMatch(text, /boosted --skill/);
});

function withJenkinsGroup() {
    const copy = structuredClone(manifest);
    copy.layers['upstream-core'] = copy.layers.up;
    delete copy.layers.up;
    copy.layers.dev.requires = ['core', 'upstream-core'];
    copy.layers.picks.groups.ci = { default: false, detectFile: 'Jenkinsfile', sources: [{ repo: 'git@example.com:org/ci.git', skills: ['p4'], private: true }] };
    return copy;
}

async function runProjectInit(root, readable) {
    const lines = [];
    const originalLog = console.log;
    console.log = (line) => lines.push(String(line));
    try {
        await projectInit(parseArgs(['--dry-run', '--yes', '--no-stack']), withJenkinsGroup(), root, readable);
    } finally {
        console.log = originalLog;
    }
    return lines.join('\n');
}

test('groupsForProjectFiles selects the groups whose detectFile exists', () => {
    const jenkins = withJenkinsGroup();
    assert.deepEqual(groupsForProjectFiles(jenkins, (file) => file === 'Jenkinsfile').map((entry) => entry.arg), ['picks:ci']);
    assert.deepEqual(groupsForProjectFiles(jenkins, () => false), []);
    jenkins.layers.picks.groups.ci.detectFile = '';
    assert.match(validateManifest(jenkins).join('\n'), /detectFile must be a file name/);
});

test('project init installs the Jenkins skill for a project with a Jenkinsfile when the repository is readable', async () => {
    const text = await runProjectInit(project({ Jenkinsfile: '// pipeline' }), () => true);
    assert.match(text, /\[picks · project\] npx -y skills add git@example.com:org\/ci.git --skill p4/);
});

test('project init skips it with one line when the private repository is not readable, and without a Jenkinsfile', async () => {
    const unreadable = await runProjectInit(project({ Jenkinsfile: '// pipeline' }), () => false);
    assert.match(unreadable, /Skipped picks:ci: git@example.com:org\/ci.git is private/);
    assert.doesNotMatch(unreadable, /--skill p4/);
    const without = await runProjectInit(project({}), () => true);
    assert.doesNotMatch(without, /--skill p4|Skipped/);
});

test('satisfied layers need every non-optional skill installed', () => {
    assert.deepEqual([...satisfiedLayers(manifest, ['a', 'b', 'x', 'y'])].sort(), ['core', 'up']);
    assert.deepEqual([...satisfiedLayers(manifest, ['a'])], []);
});

test('manifest validation catches the structural errors', () => {
    assert.deepEqual(validateManifest(manifest), []);
    const clone = () => JSON.parse(JSON.stringify(manifest));
    let broken = clone();
    broken.layers.dev.requires = ['ghost'];
    assert.match(validateManifest(broken).join('\n'), /unknown layer "ghost"/);
    broken = clone();
    broken.layers.extra.skills.push('a');
    assert.match(validateManifest(broken).join('\n'), /skill a is in two layers/);
    broken = clone();
    broken.layers.core.requires = ['dev'];
    assert.match(validateManifest(broken).join('\n'), /requires cycle/);
    broken = clone();
    broken.layers.core.scope = 'nowhere';
    assert.match(validateManifest(broken).join('\n'), /scope must be one of/);
    broken = clone();
    broken.layers.core.requires = ['extra'];
    assert.match(validateManifest(broken).join('\n'), /project layer cannot require the user layer extra/);
    broken = clone();
    broken.layers.up.groups.manual.sources = [];
    assert.match(validateManifest(broken).join('\n'), /up:manual: a group needs sources or managedBy/);
    broken = clone();
    broken.layers.extra.groups = { g: { detect: ['x'], sources: [{ repo: 'a/b', skills: ['z'] }] } };
    assert.match(validateManifest(broken).join('\n'), /only project layers can be detected/);
    broken = clone();
    broken.layers.up.sources[0].skills = [];
    assert.match(validateManifest(broken).join('\n'), /lists no skills/);
});

test('every own skill must be on disk in exactly its layer', () => {
    const onDisk = { core: ['a', 'b'], dev: ['c'], extra: ['d'] };
    assert.deepEqual(validateManifest(manifest, onDisk), []);
    assert.match(validateManifest(manifest, { ...onDisk, dev: ['c', 'stray'] }).join('\n'), /skill stray .* is in no layer/);
    assert.match(validateManifest(manifest, { ...onDisk, core: ['a'], dev: ['c', 'b'] }).join('\n'), /skill b is in skills\/dev\/ but layer core/);
    assert.match(validateManifest(manifest, { core: ['a', 'b'], dev: [], extra: ['d'] }).join('\n'), /lists c, which is not in skills\/dev\//);
});

test('project init installs the layers every developer gets', () => {
    assert.deepEqual(PROJECT_INIT_LAYERS, ['core', 'dev', 'upstream-core']);
});

test('argument parsing handles lists, repeats and short flags', () => {
    const options = parseArgs(['dev', '--skill', 'a,b', '-s', 'c', '--agent=codex', '-y', '-g', '--dry-run']);
    assert.deepEqual(options.positional, ['dev']);
    assert.deepEqual(options.skills, ['a', 'b', 'c']);
    assert.deepEqual(options.agents, ['codex']);
    assert.ok(options.flags.has('--yes') && options.flags.has('--global') && options.flags.has('--dry-run'));
    assert.throws(() => parseArgs(['--skill']), /needs a value/);
});

test('agents command rejects an unknown target', () => {
    const originalLog = console.log;
    console.log = () => {};
    try {
        assert.equal(agents('vim', { flags: new Set() }), 2);
        assert.equal(agents(undefined, { flags: new Set() }), 0);
    } finally {
        console.log = originalLog;
    }
});

const retiredManifest = {
    ...manifest,
    retired: {
        old: { use: ['a', 'b'] },
        merged: { use: ['d'] },
        q: { use: ['q'], source: 'org/queue' },
    },
};

test('the retired map is validated against the own skills and the listed sources', () => {
    assert.deepEqual(validateManifest(retiredManifest), []);
    const clone = () => JSON.parse(JSON.stringify(retiredManifest));
    let broken = clone();
    broken.retired.a = { use: ['b'] };
    assert.match(validateManifest(broken).join('\n'), /retired: a is a current skill of org\/skills/);
    broken = clone();
    broken.retired.old.use = ['ghost'];
    assert.match(validateManifest(broken).join('\n'), /retired: old points at ghost, which is not an own skill/);
    broken = clone();
    broken.retired.q.use = ['nope'];
    assert.match(validateManifest(broken).join('\n'), /retired: q points at nope, which org\/queue does not list/);
    broken = clone();
    broken.retired.old = { use: [] };
    assert.match(validateManifest(broken).join('\n'), /retired: old needs "use"/);
});

test('renamed skills leave out a name that only changed its source', () => {
    assert.deepEqual(renamedSkills(retiredManifest).map((entry) => entry.name), ['old', 'merged']);
});

test('stale setup: retired installs, removed and moved lock entries; third-party entries are not judged', () => {
    const stale = findStaleSetup(retiredManifest, {
        installed: [
            { name: 'a', scope: 'project', source: 'org/skills' },
            { name: 'old', scope: 'project', source: null },
            { name: 'q', scope: 'user', source: 'org/skills' },
            { name: 'q', scope: 'project', source: 'org/queue' },
            { name: 'x', scope: 'project', source: 'm/skills' },
        ],
        lock: {
            skills: {
                a: { source: 'org/skills', skillPath: 'skills/core/a/SKILL.md' },
                b: { source: 'org/skills', skillPath: 'skills/b/SKILL.md' },
                merged: { source: 'org/skills', skillPath: 'skills/merged/SKILL.md' },
                x: { source: 'm/skills', skillPath: 'skills/gone/SKILL.md' },
                c: { source: 'org/skills' },
            },
        },
    });
    assert.deepEqual(stale.map(({ kind, scope, name, reason }) => `${kind}:${scope}:${name}:${reason}`), [
        'installed:project:old:removed',
        'installed:user:q:removed',
        'lock:project:b:moved',
        'lock:project:merged:removed',
    ]);
    assert.deepEqual(stale.find((entry) => entry.name === 'merged').use, ['d']);
    assert.deepEqual(stale.find((entry) => entry.name === 'q').source, 'org/queue');
    assert.deepEqual(findStaleSetup(retiredManifest, { installed: [{ name: 'a', scope: 'project', source: 'org/skills' }], lock: null }), []);
});

test('stale fix removes per scope, then runs project init and the user install of the replacements', () => {
    const stale = findStaleSetup(retiredManifest, {
        installed: [
            { name: 'old', scope: 'project' },
            { name: 'q', scope: 'user', source: 'org/skills' },
        ],
        lock: { skills: { merged: { source: 'org/skills' }, b: { source: 'org/skills', skillPath: 'skills/b/SKILL.md' } } },
    });
    assert.deepEqual(staleFix(retiredManifest, stale), {
        remove: [
            { scope: 'project', names: ['old', 'merged'] },
            { scope: 'user', names: ['q'] },
        ],
        then: ['esoul-skills project init', 'esoul-skills install extra --optional'],
    });
    assert.deepEqual(staleFix(retiredManifest, []), { remove: [], then: [] });
});

const binary = fileURLToPath(new URL('../../bin/esoul-skills.mjs', import.meta.url));

/** A project directory and an `npx` stand-in that logs every call and answers `ls --json` from the given lists. */
function fakeNpx(projectSkills, userSkills, files = {}) {
    const root = project(files);
    const log = join(root, 'npx.log');
    const script = join(root, 'npx');
    writeFileSync(
        script,
        `#!/bin/sh\necho "$@" >> "${log}"\ncase "$*" in\n  *"ls --json -g"*) echo '${JSON.stringify(userSkills)}';;\n  *"ls --json"*) echo '${JSON.stringify(projectSkills)}';;\n  *) echo '[]';;\nesac\n`,
    );
    chmodSync(script, 0o755);
    const run = (...args) => spawnSync(process.execPath, [binary, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ESOUL_SKILLS_NPX: script } });
    return { root, log, run };
}

test('--help and -h of every command print the usage and run nothing', () => {
    const { log, run } = fakeNpx([], []);
    for (const args of [['install'], ['project'], ['project', 'init'], ['status'], ['layers'], ['retired'], ['agents'], ['agents', 'claude'], ['agents', 'codex']]) {
        for (const flag of ['--help', '-h']) {
            const result = run(...args, flag);
            assert.equal(result.status, 0, `${args.join(' ')} ${flag}: ${result.stderr}`);
            assert.match(result.stdout, /Usage:\n {2}esoul-skills install/, `${args.join(' ')} ${flag} prints the usage`);
        }
    }
    assert.equal(existsSync(log), false, 'help never calls npx skills');
    assert.match(run('project', 'init', '--help').stdout, /project init {2}Install core, dev, upstream-core/);
});

test('status flags retired installs and stale lock entries and prints the fix', () => {
    const lock = {
        version: 1,
        skills: {
            'esoul-freelo-task-authoring': { source: 'eSoul-cz/skills', sourceType: 'github', skillPath: 'skills/esoul-freelo-task-authoring/SKILL.md' },
            'gitmoji-commit': { source: 'eSoul-cz/skills', sourceType: 'github', skillPath: 'skills/gitmoji-commit/SKILL.md' },
            'esoul-review': { source: 'eSoul-cz/skills', sourceType: 'github', skillPath: 'skills/dev/esoul-review/SKILL.md' },
            'code-review': { source: 'mattpocock/skills', sourceType: 'github', skillPath: 'skills/engineering/code-review/SKILL.md' },
        },
    };
    const { run } = fakeNpx(
        [{ name: 'esoul-review', source: 'eSoul-cz/skills' }, { name: 'final-pr-review', source: 'eSoul-cz/skills' }],
        [{ name: 'test-queue', source: 'eSoul-cz/skills' }, { name: 'freelo', source: 'freeloio/freelo-cli' }],
        { 'skills-lock.json': lock },
    );
    const result = run('status');
    assert.equal(result.status, 0, result.stderr);
    const text = result.stdout;
    assert.match(text, /project\s+final-pr-review {2}\(installed: retired skill; use esoul-review\)/);
    assert.match(text, /project\s+esoul-freelo-task-authoring {2}\(skills-lock.json: skill is no longer in eSoul-cz\/skills; use esoul-task-create\)/);
    assert.match(text, /project\s+gitmoji-commit {2}\(skills-lock.json: path skills\/gitmoji-commit\/SKILL.md moved; rewrite the lock\)/);
    assert.match(text, /user\s+test-queue {2}\(installed: retired skill; use test-queue from eSoul-cz\/test-queue\)/);
    assert.doesNotMatch(text, /freelo {2}\(installed/, 'the official freelo skill is not retired');
    assert.doesNotMatch(text, /esoul-review {2}\(/);
    assert.match(text, /npx -y skills remove final-pr-review esoul-freelo-task-authoring -y/);
    assert.match(text, /npx -y skills remove -g test-queue -y/);
    assert.match(text, /\n {2}esoul-skills project init\n {2}esoul-skills install helpers --optional\n/);
    const clean = fakeNpx([{ name: 'esoul-review', source: 'eSoul-cz/skills' }], []);
    assert.match(clean.run('status').stdout, /No retired skill names or stale lock entries/);
});

test('retired lists every retired name and a git grep over the renamed ones', () => {
    const lines = [];
    const originalLog = console.log;
    console.log = (line) => lines.push(String(line));
    try {
        assert.equal(listRetired(), 0);
    } finally {
        console.log = originalLog;
    }
    const text = lines.join('\n');
    for (const name of ['final-pr-review', 'pre-pr-review', 'esoul-tasking', 'esoul-freelo-task-authoring', 'esoul-maintain-application-documentation', 'esoul-project-data', 'esoul-data-task-guard', 'test-queue', 'freelo']) {
        assert.match(text, new RegExp(`^  ${name} `, 'm'));
    }
    assert.match(text, /esoul-tasking {2}.*use esoul-task-create, esoul-task-work/);
    assert.match(text, /^ {2}test-queue .*same name, now from eSoul-cz\/test-queue/m);
    assert.match(text, /git grep -nwE 'final-pr-review\|pre-pr-review\|esoul-tasking\|[^']*' -- \./);
    assert.doesNotMatch(text, /git grep[^\n]*\|freelo\|/);
});

/** Runs `install` in-process and returns what it printed; `--dry-run` keeps it away from npx. */
async function dryInstall(layers, args, definition = manifest, ui = {}) {
    const lines = [];
    const originalLog = console.log;
    console.log = (line = '') => lines.push(String(line));
    try {
        await install(layers, parseArgs([...args, '--dry-run']), definition, ui);
    } finally {
        console.log = originalLog;
    }
    return lines.filter((line) => line !== '');
}

// Pinned before the interactive selector and the batching were added: a named selection (no terminal,
// --yes or explicit arguments) prints exactly these commands when no two layers share a source and scope.
test('pinned: named layers without a shared source print the same commands as before', async () => {
    assert.deepEqual(await dryInstall(['up'], []), ['[up · project] npx -y skills add m/skills@v1 --skill x y']);
    assert.deepEqual(await dryInstall(['extra', 'picks'], ['--optional', '--yes', '--agent', 'claude', '--copy']), [
        'Required layers not installed yet: core. Adding them.',
        '[core · project] npx -y skills add org/skills --skill a b --yes --agent claude --copy',
        '[extra · user] npx -y skills add org/skills --skill d --global --yes --agent claude --copy',
        '[extra · user] npx -y skills add org/queue --skill q --global --yes --agent claude --copy',
        '[picks · user] npx -y skills add p/one --skill p1 --global --yes --agent claude --copy',
        '[picks · user] npx -y skills add p/two --skill p2 --global --yes --agent claude --copy',
    ]);
    assert.deepEqual(await dryInstall(['dev'], ['--skill', 'c,x']), [
        'Required layers not installed yet: core, up. Adding them.',
        '[up · project] npx -y skills add m/skills@v1 --skill x',
        '[dev · project] npx -y skills add org/skills --skill c',
    ]);
});

test('batching: one command per source repository, ref and scope, with every chosen skill', () => {
    const calls = batchInvocations(
        [
            { layer: 'core', scope: 'project', repo: 'org/skills', skills: ['a', 'b'] },
            { layer: 'up', scope: 'project', repo: 'm/skills', ref: 'v1', skills: ['x'] },
            { layer: 'dev', scope: 'project', repo: 'org/skills', skills: ['b', 'c'] },
            { layer: 'extra', scope: 'user', repo: 'org/skills', skills: ['d'] },
            { layer: 'up', scope: 'project', repo: 'm/skills', ref: 'v2', skills: ['y'] },
            { layer: 'matt', scope: 'project', repo: 'm/skills', ref: 'v1', skills: ['z'] },
        ],
        { yes: true, passthrough: ['--agent', 'claude'] },
    );
    assert.deepEqual(calls.map((call) => call.args), [
        ['add', 'org/skills', '--skill', 'a', 'b', 'c', '--yes', '--agent', 'claude'],
        ['add', 'm/skills@v1', '--skill', 'x', 'z', '--yes', '--agent', 'claude'],
        ['add', 'org/skills', '--skill', 'd', '--global', '--yes', '--agent', 'claude'],
        ['add', 'm/skills@v2', '--skill', 'y', '--yes', '--agent', 'claude'],
    ]);
    assert.deepEqual(calls.map((call) => call.layers), [['core', 'dev'], ['up', 'matt'], ['extra'], ['up']]);
    assert.deepEqual(calls.map((call) => call.scope), ['project', 'project', 'user', 'project']);
});

test('plan: layers of one repository and scope share a command; auto keeps project and user apart, a forced target merges', () => {
    const together = planInstall(manifest, resolveSelection(manifest, ['core', 'dev'], { satisfied: new Set(['up']) }));
    assert.deepEqual(together.map((call) => call.args), [['add', 'org/skills', '--skill', 'a', 'b', 'c']]);
    assert.deepEqual(together[0].layers, ['core', 'dev']);
    const resolved = resolveSelection(manifest, ['core', 'extra']);
    assert.deepEqual(planInstall(manifest, resolved).map((call) => call.args), [
        ['add', 'org/skills', '--skill', 'a', 'b'],
        ['add', 'org/skills', '--skill', 'd', '--global'],
    ]);
    assert.deepEqual(planInstall(manifest, resolved, { scope: 'project' }).map((call) => call.args), [['add', 'org/skills', '--skill', 'a', 'b', 'd']]);
    assert.deepEqual(planInstall(manifest, resolved, { scope: 'user' }).map((call) => call.args), [['add', 'org/skills', '--skill', 'a', 'b', 'd', '--global']]);
});

test('--target is the same as --global and --project, and wins over them', async () => {
    const user = ['[extra · user] npx -y skills add org/skills --skill d --global'];
    assert.deepEqual(await dryInstall(['extra'], ['--no-requires', '--target', 'user']), user);
    assert.deepEqual(await dryInstall(['extra'], ['--no-requires', '--global']), user);
    assert.deepEqual(await dryInstall(['extra'], ['--no-requires', '-g']), user);
    assert.deepEqual(await dryInstall(['extra'], ['--no-requires', '-p']), ['[extra · project] npx -y skills add org/skills --skill d']);
    assert.deepEqual(await dryInstall(['extra'], ['--no-requires', '--target=project']), ['[extra · project] npx -y skills add org/skills --skill d']);
    assert.deepEqual(await dryInstall(['extra'], ['--no-requires', '--global', '--target', 'auto']), user);
    assert.throws(() => parseArgs(['--target', 'everywhere']), /--target must be one of auto, project, user/);
});

test('the layer step names where each layer goes for a target, groups on request are entries of their own', () => {
    const auto = layerChoices(manifest);
    assert.deepEqual(auto.map((choice) => [choice.value, choice.scope]), [
        ['core', 'project'],
        ['dev', 'project'],
        ['extra', 'user'],
        ['up', 'project'],
        ['up:stack', 'project'],
        ['up:manual', 'project'],
        ['picks', 'user'],
        ['picks:extra', 'user'],
    ]);
    assert.ok(layerChoices(manifest, 'user').every((choice) => choice.scope === 'user'));
    assert.deepEqual(layerChoices(manifest, 'project').find((choice) => choice.value === 'up:stack').repos, ['s/stack']);
});

test('the skill step lists the skills of the selection by layer; optional sources are not preselected', () => {
    const resolved = resolveSelection(manifest, ['extra', 'picks', 'up:stack'], { withRequires: false });
    const groups = selectionGroups(manifest, resolved);
    assert.deepEqual(groups.map((group) => [group.id, group.scope, group.skills.map((skill) => `${skill.name}${skill.selected ? '' : '?'}`)]), [
        ['extra', 'user', ['d', 'q?']],
        ['picks:one', 'user', ['p1']],
        ['picks:two', 'user', ['p2']],
        ['up:stack', 'project', ['s1', 's2']],
    ]);
    assert.deepEqual(groups[0].skills.map((skill) => skill.repo), ['org/skills', 'org/queue']);
    assert.equal(selectionGroups(manifest, resolved, { withOptional: true })[0].skills[1].selected, true);
    assert.deepEqual(selectionGroups(manifest, resolved, { scope: 'project' }).map((group) => group.scope), ['project', 'project', 'project', 'project']);
});

/** A prompt layer stand-in: answers from `answers`, records every call. */
function stubPrompts(answers) {
    const calls = [];
    const record = (name, value) => (data) => {
        calls.push([name, data]);
        return typeof value === 'function' ? value(data) : value;
    };
    return {
        calls,
        intro: record('intro'),
        outro: record('outro'),
        log: record('log'),
        note: record('note'),
        target: record('target', answers.target),
        layers: record('layers', answers.layers),
        skills: record('skills', answers.skills),
        confirm: record('confirm', answers.confirm ?? true),
    };
}

const forbiddenPrompts = stubPrompts({
    target: () => assert.fail('the selector must not run'),
    layers: () => assert.fail('the selector must not run'),
    skills: () => assert.fail('the selector must not run'),
});

test('selector: target first, then layers, then skills; the result is batched per source and scope', async () => {
    const prompts = stubPrompts({ target: 'auto', layers: ['core', 'dev', 'extra'], skills: (data) => data.groups.flatMap((group) => group.skills.filter((skill) => skill.selected).map((skill) => skill.name)).filter((name) => name !== 'b') });
    const lines = await dryInstall([], ['--no-requires'], manifest, { prompts });
    assert.deepEqual(prompts.calls.filter(([name]) => ['target', 'layers', 'skills'].includes(name)).map(([name]) => name), ['target', 'layers', 'skills']);
    assert.deepEqual(lines, ['[core, dev · project] npx -y skills add org/skills --skill a c', '[extra · user] npx -y skills add org/skills --skill d --global']);
    assert.equal(prompts.calls.at(-1)[0], 'outro');
});

test('selector: the layers the command preselects, the target the command names, the choices show the resolved target', async () => {
    const plain = stubPrompts({ target: 'auto', layers: ['core'], skills: ['a'] });
    await dryInstall([], ['--no-requires'], manifest, { prompts: plain });
    assert.equal(plain.calls.find(([name]) => name === 'target')[1].initial, 'auto');
    assert.deepEqual(plain.calls.find(([name]) => name === 'layers')[1].initial, PROJECT_INIT_LAYERS.filter((id) => id in manifest.layers));
    for (const [flag, initial] of [['--project', 'project'], ['-p', 'project'], ['--global', 'user'], ['--target=user', 'user']]) {
        const prompts = stubPrompts({ target: initial, layers: ['extra'], skills: ['d'] });
        await dryInstall([], ['--no-requires', flag], manifest, { prompts });
        assert.equal(prompts.calls.find(([name]) => name === 'target')[1].initial, initial, flag);
    }
    const chosen = stubPrompts({ target: 'user', layers: ['core'], skills: ['a', 'b'] });
    const lines = await dryInstall([], ['--no-requires'], manifest, { prompts: chosen });
    assert.deepEqual(chosen.calls.find(([name]) => name === 'layers')[1].choices.map((choice) => choice.scope), Array(8).fill('user'));
    assert.deepEqual(lines, ['[core · user] npx -y skills add org/skills --skill a b --global']);
});

test('selector: required layers are added (listed in the skill step), a deselected skill is skipped, a needed one comes back', async () => {
    const requiring = structuredClone(manifest);
    requiring.layers.dev.skillRequires = { c: ['a'] };
    const prompts = stubPrompts({ target: 'project', layers: ['dev'], skills: ['c', 'x'] });
    const lines = await dryInstall([], [], requiring, { prompts });
    const groups = prompts.calls.find(([name]) => name === 'skills')[1].groups;
    assert.deepEqual(groups.map((group) => group.id), ['core', 'up', 'dev']);
    assert.ok(prompts.calls.some(([name, text]) => name === 'log' && text === 'Required layers not installed yet: core, up. Adding them.'));
    assert.deepEqual(lines, ['[core, dev · project] npx -y skills add org/skills --skill a c', '[up · project] npx -y skills add m/skills@v1 --skill x']);
    assert.match(prompts.calls.find(([name, text]) => name === 'log' && /needs/.test(text))[1], /Also installed .*: a\./);
});

test('selector: project init preselects the detected layers and groups under the project target', async () => {
    const definition = withJenkinsGroup();
    const prompts = stubPrompts({ target: 'project', layers: ['core', 'upstream-core', 'upstream-core:stack'], skills: ['a', 'x', 's1'] });
    const lines = [];
    const originalLog = console.log;
    console.log = (line = '') => lines.push(String(line));
    try {
        await projectInit(parseArgs(['--dry-run', '--stack', 'stack']), definition, project({ Jenkinsfile: '//' }), () => true, { prompts });
    } finally {
        console.log = originalLog;
    }
    assert.equal(prompts.calls.find(([name]) => name === 'target')[1].initial, 'project');
    assert.deepEqual(prompts.calls.find(([name]) => name === 'layers')[1].initial, ['core', 'dev', 'upstream-core', 'upstream-core:stack', 'picks:ci']);
    assert.ok(lines.includes('[core · project] npx -y skills add org/skills --skill a'));
    assert.ok(lines.includes('[upstream-core · project] npx -y skills add m/skills@v1 --skill x'));
});

test('no prompt without a terminal, with --yes, or with layer or --skill arguments: the selector stays out of it', async () => {
    for (const [layers, args] of [[['up'], []], [['up'], ['--yes']], [['core', 'dev'], ['--skill', 'a,c', '--yes']]]) {
        assert.deepEqual(await dryInstall(layers, args, manifest, { prompts: forbiddenPrompts }), await dryInstall(layers, args));
    }
    await assert.rejects(() => dryInstall([], ['--yes'], manifest, { prompts: forbiddenPrompts }), /Name the layers to install/);
    await assert.rejects(() => dryInstall([], ['--skill', 'x'], manifest, { prompts: forbiddenPrompts }), /Name the layers to install/);
    // No terminal: the binary has no TTY on stdin or stdout here.
    const { root, run } = fakeNpx([], []);
    const result = run('install', '--dry-run');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Name the layers to install/);
    assert.doesNotMatch(result.stdout, /Where should the skills go/);
    assert.ok(!existsSync(join(root, 'npx.log')), 'nothing ran');
});

test('selector: confirming runs one npx skills per source and scope, declining stops, a failure keeps the resume message', async () => {
    const { root, log, run } = fakeNpx([], []);
    void run;
    const previous = process.env.ESOUL_SKILLS_NPX;
    process.env.ESOUL_SKILLS_NPX = join(root, 'npx');
    const lines = [];
    const originalLog = console.log;
    console.log = (line = '') => lines.push(String(line));
    try {
        const accept = stubPrompts({ target: 'auto', layers: ['core', 'dev', 'extra'], skills: ['a', 'b', 'c', 'd'] });
        await install([], parseArgs(['--no-requires']), manifest, { prompts: accept });
        const calls = readFileSync(log, 'utf8').trim().split('\n');
        assert.deepEqual(calls, ['-y skills add org/skills --skill a b c', '-y skills add org/skills --skill d --global']);
        assert.match(lines.join('\n'), /Project layers installed \(core, dev\)\. Commit skills-lock\.json and the installed skill folders \(\.agents\/skills\/\)/);
        assert.equal(accept.calls.find(([name]) => name === 'note')[1].split('\n').length, 2);
        const decline = stubPrompts({ target: 'auto', layers: ['core'], skills: ['a'], confirm: false });
        await assert.rejects(() => install([], parseArgs(['--no-requires']), manifest, { prompts: decline }), /Cancelled; nothing installed/);
        assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 2, 'declined: nothing more ran');
        writeFileSync(join(root, 'npx'), '#!/bin/sh\nexit 3\n');
        await assert.rejects(() => install([], parseArgs(['--no-requires']), manifest, { prompts: stubPrompts({ target: 'project', layers: ['core'], skills: ['a'] }) }), /npx skills add org\/skills failed \(exit 3\)\. Fix the cause and run the command again; finished sources are skipped quickly\./);
    } finally {
        console.log = originalLog;
        if (previous === undefined) {
            delete process.env.ESOUL_SKILLS_NPX;
        } else {
            process.env.ESOUL_SKILLS_NPX = previous;
        }
    }
});
