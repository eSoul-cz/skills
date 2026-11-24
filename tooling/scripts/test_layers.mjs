import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agents, listRetired, parseArgs, projectInit, stackGroupArgs } from '../../lib/cli.mjs';
import { boostChecks, boostSkills, detectGuidelineLayers, projectGuidelineLayers } from '../../lib/stack.mjs';
import {
    PROJECT_INIT_LAYERS,
    expandLayerArgs,
    findStaleSetup,
    groupsForGuidelineLayers,
    groupsForProjectFiles,
    layerSkills,
    managedGroups,
    parseLayerArg,
    planInstall,
    renamedSkills,
    resolveSelection,
    satisfiedLayers,
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
