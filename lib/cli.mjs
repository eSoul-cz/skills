// Commands of `esoul-skills`: install, project init, status, agents. The installed skills come
// from `npx skills` (the open skills CLI); this file only decides what to install and where.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
    PROJECT_INIT_LAYERS,
    expandLayerArgs,
    findStaleSetup,
    groupsForGuidelineLayers,
    layerGroups,
    layerSkills,
    loadManifest,
    managedGroups,
    planInstall,
    renamedSkills,
    resolveSelection,
    retiredSkills,
    satisfiedLayers,
    staleFix,
} from './layers.mjs';
import { boostChecks, boostSkills, projectGuidelineLayers } from './stack.mjs';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
export const MANIFEST_PATH = join(packageRoot, 'layers.json');

export const USAGE = `esoul-skills: install the eSoul agent skills in layers (on top of \`npx skills\`)

Usage:
  esoul-skills install [layer[:group]...] [--skill a,b] [options]
  esoul-skills project init [--stack lsr,vue | --no-stack] [options]
  esoul-skills status
  esoul-skills layers
  esoul-skills retired
  esoul-skills agents [claude|codex] [--dry-run]

install     Install layers (with the layers they require). With no layer and a terminal,
            asks which layers and skills to install. Project layers go into the current
            project (commit skills-lock.json); user layers are installed globally.
            A layer installs its own skills, its sources and its default groups; a group
            marked "on request" (for example upstream-picks:matt-extra) is installed by naming it.
project init  Install ${PROJECT_INIT_LAYERS.join(', ')} into the current project, plus the stack groups of
            upstream-core that match the project (from esoul-guidelines.json, else from composer.json
            and package.json like \`esoul-guidelines init\`): lsr, vue. A Laravel project is checked for
            Laravel Boost, which manages its own skills.
status      Show which skills of each layer are installed (project and user); Boost skills are reported as managed.
            Flags installed skills with a retired name and skills-lock.json entries whose skill is gone or whose
            path moved, and prints the commands that fix them.
layers      List the layers and their skills.
retired     List the retired skill names (what replaced them) and the \`git grep\` that finds them in project files.
agents      Optional worker agents and hooks: the Claude Code plugin or the Codex installer.

install options:
  --skill a,b     only these skills (they must belong to the selected layers)
  --optional      also install optional sources (for example the test queue)
  --no-requires   do not add the layers a layer requires
  --global        install every layer for the user      --project   install every layer in the project
  --agent <a>     pass --agent to npx skills (repeatable)   --copy   copy instead of symlinking
  --yes, -y       no prompts (adds required layers, passes --yes to npx skills)
  --dry-run       print the npx skills commands only
`;

function npxCommand() {
    return process.env.ESOUL_SKILLS_NPX || 'npx';
}

/** Runs `npx -y skills <args>`; the command is replaceable for tests. */
export function runSkills(args, { capture = false, cwd } = {}) {
    const result = spawnSync(npxCommand(), ['-y', 'skills', ...args], {
        cwd,
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    if (result.error) {
        throw new Error(`Could not run ${npxCommand()}: ${result.error.message}`);
    }
    return result;
}

export function parseArgs(argv) {
    const options = { skills: [], agents: [], stacks: [], positional: [], flags: new Set() };
    const valued = new Set(['--skill', '-s', '--agent', '-a', '--stack']);
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const [name, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
        if (valued.has(name)) {
            const value = inline ?? argv[(i += 1)];
            if (value === undefined) {
                throw new Error(`${name} needs a value`);
            }
            const list = value.split(',').filter(Boolean);
            (name === '--skill' || name === '-s' ? options.skills : name === '--stack' ? options.stacks : options.agents).push(...list);
        } else if (arg.startsWith('-')) {
            options.flags.add(arg === '-y' ? '--yes' : arg === '-g' ? '--global' : arg);
        } else {
            options.positional.push(arg);
        }
    }
    return options;
}

/** Installed skill names with their scope, from `npx skills ls --json` (project, then global). */
export function installedSkills(cwd = process.cwd()) {
    const found = [];
    for (const scope of ['project', 'user']) {
        const result = runSkills(['ls', '--json', ...(scope === 'user' ? ['-g'] : [])], { capture: true, cwd });
        if (result.status !== 0) {
            continue;
        }
        try {
            for (const entry of JSON.parse(result.stdout || '[]')) {
                found.push({ name: entry.name, scope, source: entry.source ?? null });
            }
        } catch {
            // A CLI that prints no JSON means "nothing installed" for this purpose.
        }
    }
    return found;
}

async function ask(rl, question) {
    return (await rl.question(question)).trim();
}

function groupNote(group) {
    return [group.default === false ? 'on request' : null, group.managedBy ? `managed by ${group.managedBy}` : null].filter(Boolean).join(', ');
}

async function chooseInteractively(manifest) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const entries = [];
        for (const [id, layer] of Object.entries(manifest.layers)) {
            entries.push({ arg: id, label: id, layer });
            for (const [name, group] of layerGroups(manifest, id)) {
                if (!group.managedBy) {
                    const note = groupNote(group);
                    entries.push({ arg: `${id}:${name}`, label: `${id}:${name}${note ? ` (${note})` : ''}`, layer });
                }
            }
        }
        console.log('Layers:');
        entries.forEach((entry, index) => {
            console.log(`  ${String(index + 1).padStart(2)}. ${entry.label.padEnd(36)} [${entry.layer.scope}] ${entry.layer.title}`);
        });
        const picked = (await ask(rl, 'Layers to install (numbers, comma separated): '))
            .split(/[,\s]+/)
            .filter(Boolean)
            .map((n) => entries[Number(n) - 1]?.arg);
        if (picked.length === 0 || picked.includes(undefined)) {
            throw new Error('No valid layer chosen.');
        }
        const resolved = resolveSelection(manifest, picked, { withRequires: false });
        const skills = resolved.layers.flatMap(({ layer, base, groups }) => [
            ...(base ? layerSkills(manifest, layer) : []),
            ...groups.flatMap((group) => layerSkills(manifest, layer, { group })),
        ]);
        console.log(`\nSkills: ${[...new Set(skills)].join(', ')}`);
        const only = await ask(rl, 'Install all of them? [Y/n, or list names to keep]: ');
        let filter = null;
        if (only && !/^y(es)?$/i.test(only)) {
            filter = /^n(o)?$/i.test(only) ? (await ask(rl, 'Skills to keep (comma separated): ')).split(/[,\s]+/).filter(Boolean) : only.split(/[,\s]+/).filter(Boolean);
        }
        return { layers: picked, skills: filter };
    } finally {
        rl.close();
    }
}

async function confirm(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        return /^(y|yes|)$/i.test(await ask(rl, `${question} [Y/n] `));
    } finally {
        rl.close();
    }
}

function printPlan(invocations) {
    for (const invocation of invocations) {
        console.log(`[${invocation.layer} · ${invocation.scope}] npx -y skills ${invocation.args.join(' ')}`);
    }
}

export async function install(layerArgs, options, manifest = loadManifest(MANIFEST_PATH)) {
    const flags = options.flags;
    let layers = expandLayerArgs(layerArgs);
    let skillFilter = options.skills.length > 0 ? options.skills : null;
    if (layers.length === 0) {
        if (!process.stdin.isTTY) {
            throw new Error('Name the layers to install (see `esoul-skills layers`), or run it in a terminal for the interactive choice.');
        }
        ({ layers, skills: skillFilter } = await chooseInteractively(manifest));
    }
    const withRequires = !flags.has('--no-requires');
    let satisfied = new Set();
    if (withRequires && !flags.has('--dry-run')) {
        satisfied = satisfiedLayers(manifest, installedSkills().map((entry) => entry.name));
    }
    const resolved = resolveSelection(manifest, layers, { satisfied, withRequires });
    if (resolved.added.length > 0) {
        const message = `Required layers not installed yet: ${resolved.added.join(', ')}.`;
        if (flags.has('--yes') || flags.has('--dry-run')) {
            console.log(`${message} Adding them.`);
        } else if (process.stdin.isTTY) {
            if (!(await confirm(`${message} Add them?`))) {
                throw new Error(`${message} Install them first or pass --no-requires.`);
            }
        } else {
            throw new Error(`${message} Pass --yes to add them, or --no-requires.`);
        }
    }
    const scope = flags.has('--global') ? 'user' : flags.has('--project') ? 'project' : 'auto';
    const passthrough = [...options.agents.flatMap((agent) => ['--agent', agent]), ...(flags.has('--copy') ? ['--copy'] : [])];
    const invocations = planInstall(manifest, resolved, {
        skillFilter,
        withOptional: flags.has('--optional'),
        scope,
        yes: flags.has('--yes'),
        passthrough,
    });
    if (invocations.length === 0) {
        throw new Error('Nothing to install for that selection (a group managed by another tool installs nothing).');
    }
    if (flags.has('--dry-run')) {
        printPlan(invocations);
        return 0;
    }
    for (const invocation of invocations) {
        console.log(`\n== ${invocation.layer}: ${invocation.skills.join(', ')} (${invocation.scope})`);
        const result = runSkills(invocation.args);
        if (result.status !== 0) {
            throw new Error(`npx skills ${invocation.args.slice(0, 2).join(' ')} failed (exit ${result.status}). Fix the cause and run the command again; finished sources are skipped quickly.`);
        }
    }
    const projectLayers = [...new Set(invocations.filter((entry) => entry.scope === 'project').map((entry) => entry.layer))];
    if (projectLayers.length > 0) {
        console.log(`\nProject layers installed (${projectLayers.join(', ')}). Commit skills-lock.json so teammates restore the same set with \`npx skills experimental_install\`.`);
    }
    return 0;
}

/** The stack groups `project init` adds: --stack names them, --no-stack none, otherwise the project decides. */
export function stackGroupArgs(manifest, options, root = process.cwd()) {
    const known = new Map();
    for (const [layerId, layer] of Object.entries(manifest.layers)) {
        if (layer.scope === 'project') {
            for (const [name] of layerGroups(manifest, layerId)) {
                known.set(name, `${layerId}:${name}`);
            }
        }
    }
    if (options.flags.has('--no-stack')) {
        return { args: [], source: 'disabled by --no-stack', layers: [] };
    }
    if (options.stacks.length > 0) {
        const unknown = options.stacks.filter((name) => !known.has(name));
        if (unknown.length > 0) {
            throw new Error(`Unknown stack ${unknown.join(', ')}. Stacks: ${[...known.keys()].join(', ')}.`);
        }
        return { args: options.stacks.map((name) => known.get(name)), source: '--stack', layers: [] };
    }
    const { layers, source } = projectGuidelineLayers(root);
    return { args: groupsForGuidelineLayers(manifest, layers), source, layers };
}

export async function projectInit(options, manifest = loadManifest(MANIFEST_PATH), root = process.cwd()) {
    const stack = stackGroupArgs(manifest, options, root);
    const managed = managedGroups(manifest).filter((entry) => stack.args.includes(`${entry.layer}:${entry.group}`));
    const detected = stack.layers.length > 0 ? ` (${stack.layers.join(', ')})` : '';
    console.log(`Stack groups from ${stack.source}${detected}: ${stack.args.length > 0 ? stack.args.join(', ') : 'none'}.`);
    for (const entry of managed) {
        console.log(`${entry.group}: the skills of this stack are managed by ${entry.managedBy} (part of the project layer, not installed here).`);
        for (const check of boostChecks(root)) {
            console.log(`  ${check.ok ? 'ok' : 'FIX'}  ${check.message}`);
        }
    }
    const stale = findStaleSetup(manifest, { lock: readLock(root) });
    if (stale.length > 0) {
        printStaleSetup(manifest, stale);
        console.log('project init installs the current skills (and rewrites a moved lock path) but never deletes a retired entry: run the remove commands above once.\n');
    }
    options.flags.add('--project');
    return install([...PROJECT_INIT_LAYERS, ...stack.args.filter((arg) => !managed.some((entry) => arg === `${entry.layer}:${entry.group}`))], options, manifest);
}

export function status(manifest = loadManifest(MANIFEST_PATH), root = process.cwd()) {
    const installed = installedSkills(root);
    const scopesOf = (name) => installed.filter((entry) => entry.name === name).map((entry) => entry.scope);
    const describe = (names) => {
        const present = names.filter((name) => scopesOf(name).length > 0);
        return { present, mark: present.length === names.length ? 'installed' : present.length === 0 ? 'missing' : 'partial' };
    };
    for (const [id, layer] of Object.entries(manifest.layers)) {
        const names = layerSkills(manifest, id, { optional: true });
        const { present, mark } = describe(names);
        console.log(`${id.padEnd(15)} ${mark.padEnd(9)} ${present.length}/${names.length}  [${layer.scope}] ${layer.title}`);
        for (const name of names) {
            const scopes = scopesOf(name);
            if (scopes.length === 0) {
                console.log(`    - ${name}`);
            } else if (mark !== 'installed') {
                console.log(`    + ${name} (${scopes.join(', ')})`);
            }
        }
        for (const [name, group] of layerGroups(manifest, id).filter(([, definition]) => definition.default === false || definition.managedBy)) {
            if (group.managedBy) {
                const managed = boostSkills(root);
                console.log(`    ${id}:${name}  managed by ${group.managedBy}${managed ? `: ${managed.join(', ') || 'no skills listed in boost.json'}` : ' (no boost.json in this directory)'}`);
                continue;
            }
            const groupNames = layerSkills(manifest, id, { group: name });
            const state = describe(groupNames);
            console.log(`    ${id}:${name}  ${state.mark} ${state.present.length}/${groupNames.length} (${groupNote(group)})`);
        }
    }
    console.log('\nUpdate what is installed: `npx skills update -p` (project) and `npx skills update -g` (user).');
    printStaleSetup(manifest, findStaleSetup(manifest, { installed, lock: readLock(root) }));
    return 0;
}

function readLock(root) {
    const file = join(root, 'skills-lock.json');
    if (!existsSync(file)) {
        return null;
    }
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function staleLine(entry) {
    const where = entry.kind === 'lock' ? 'skills-lock.json' : 'installed';
    const what = entry.reason === 'moved' ? `path ${entry.path} moved` : entry.kind === 'lock' ? 'skill is no longer in eSoul-cz/skills' : 'retired skill';
    const use = entry.reason === 'moved' ? 'rewrite the lock' : entry.use.length === 0 ? 'no replacement' : `use ${entry.use.join(', ')}${entry.source ? ` from ${entry.source}` : ''}`;
    return `  ${entry.scope.padEnd(8)} ${entry.name}  (${where}: ${what}; ${use})`;
}

/** Prints the retired names and lock entries found by `findStaleSetup`, and the commands that fix them. */
function printStaleSetup(manifest, stale) {
    if (stale.length === 0) {
        console.log('\nNo retired skill names or stale lock entries (`esoul-skills retired` lists the retired names).');
        return;
    }
    console.log('\nRetired or moved skills (the layout changed in plugin 0.26.0):');
    stale.forEach((entry) => console.log(staleLine(entry)));
    const { remove, then } = staleFix(manifest, stale);
    console.log('Fix:');
    for (const { scope, names } of remove) {
        console.log(`  npx -y skills remove ${scope === 'user' ? '-g ' : ''}${names.join(' ')} -y`);
    }
    then.forEach((command) => console.log(`  ${command}`));
    console.log('  esoul-skills retired     the retired names to replace in the project\'s own files');
}

/** The retired-name map of layers.json, and the `git grep` that finds the renamed ones in a project's files. */
export function listRetired(manifest = loadManifest(MANIFEST_PATH)) {
    console.log(`Retired skill names (layers.json "retired"; names from ${manifest.repo}):`);
    for (const entry of retiredSkills(manifest)) {
        const rename = entry.use.includes(entry.name);
        console.log(`  ${entry.name.padEnd(42)} ${rename ? 'same name, now from' : 'use'} ${rename ? entry.source : entry.use.join(', ')}`);
    }
    const names = renamedSkills(manifest).map((entry) => entry.name);
    console.log(`\nFind them in a project's own files (skills-lock.json and the installed copies are rewritten by project init):\n  git grep -nwE '${names.join('|')}' -- . ':!skills-lock.json' ':!.agents' ':!.claude'`);
    return 0;
}

export function listLayers(manifest = loadManifest(MANIFEST_PATH)) {
    for (const [id, layer] of Object.entries(manifest.layers)) {
        const requires = layer.requires.length > 0 ? ` (requires ${layer.requires.join(', ')})` : '';
        console.log(`${id} [${layer.scope}]${requires}: ${layer.title}`);
        console.log(`    ${layerSkills(manifest, id, { optional: true }).join(', ')}`);
        for (const [name, group] of layerGroups(manifest, id)) {
            const note = groupNote(group);
            const detect = group.detect ? `; project init when ${group.detect.join(' or ')}` : '';
            console.log(`    ${id}:${name}${note || detect ? ` (${note}${note && detect ? '' : ''}${detect})` : ''}: ${layerSkills(manifest, id, { group: name }).join(', ') || '-'}`);
        }
    }
    return 0;
}

const MARKETPLACE = 'eSoul-cz/skills';

export function agents(target, options) {
    const dryRun = options.flags.has('--dry-run');
    if (target === 'codex') {
        const installer = join(packageRoot, 'codex', 'install.mjs');
        if (!existsSync(installer)) {
            throw new Error(`${installer} is missing.`);
        }
        const result = spawnSync(process.execPath, [installer, ...(dryRun ? ['--dry-run'] : [])], { stdio: 'inherit' });
        return result.status ?? 1;
    }
    if (target === 'claude') {
        const steps = [
            ['claude', 'plugin', 'marketplace', 'add', MARKETPLACE],
            ['claude', 'plugin', 'install', 'esoul-skills@esoul'],
        ];
        const hasClaude = spawnSync('claude', ['--version'], { stdio: 'ignore' }).status === 0;
        if (dryRun || !hasClaude) {
            console.log(hasClaude ? 'Would run:' : 'The claude CLI was not found. In Claude Code run:');
            steps.forEach((step) => console.log(`  ${step.join(' ')}`));
            return dryRun || hasClaude ? 0 : 1;
        }
        for (const [command, ...args] of steps) {
            const result = spawnSync(command, args, { stdio: 'inherit' });
            if (result.status !== 0) {
                return result.status ?? 1;
            }
        }
        return 0;
    }
    console.log(`The worker agents and hooks are optional; no skill needs them.
  esoul-skills agents claude   Claude Code plugin (agents, hooks and the skills as a plugin)
  esoul-skills agents codex    Codex agents and rules into \${CODEX_HOME:-~/.codex}`);
    return target ? 2 : 0;
}

export async function main(argv) {
    const [command, ...rest] = argv;
    if (!command || command === '-h' || command === '--help' || command === 'help' || rest.includes('--help') || rest.includes('-h')) {
        console.log(USAGE);
        return 0;
    }
    const options = parseArgs(rest);
    switch (command) {
        case 'install':
            return install(options.positional, options);
        case 'project': {
            if (options.positional[0] !== 'init') {
                throw new Error('Usage: esoul-skills project init');
            }
            return projectInit(options);
        }
        case 'status':
            return status();
        case 'layers':
            return listLayers();
        case 'retired':
            return listRetired();
        case 'agents':
            return agents(options.positional[0], options);
        default:
            throw new Error(`Unknown command "${command}".\n\n${USAGE}`);
    }
}
