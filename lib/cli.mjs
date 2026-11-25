// Commands of `esoul-skills`: install, project init, status, agents. The installed skills come
// from `npx skills` (the open skills CLI); this file only decides what to install and where.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
    PROJECT_INIT_LAYERS,
    TARGETS,
    expandLayerArgs,
    findStaleSetup,
    findUpstreamRemoved,
    groupsForGuidelineLayers,
    groupsForProjectFiles,
    layerChoices,
    layerGroups,
    layerSkills,
    loadManifest,
    managedGroups,
    planInstall,
    renamedSkills,
    resolveSelection,
    retiredSkills,
    satisfiedLayers,
    selectionGroups,
    staleFix,
    upstreamSpecs,
    withSkillRequires,
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

install     Install layers (with the layers they require). With no layer, no --skill and a terminal
            (and without --yes) an interactive selector asks, in this order: the target, the layers,
            and the skills of the chosen layers (deselect one to skip it); --dry-run prints the commands.
            The target is \`auto\` (each layer goes where layers.json says: project layers into the current
            project, user layers for you), \`project\` or \`user\` (everything there). Project skills are
            committed with skills-lock.json and .agents/skills/. A layer installs its own skills, its
            sources and its default groups; a group marked "on request" (for example
            upstream-picks:matt-extra) is installed by naming it. The skills are installed with one
            \`npx skills add\` per source repository and target.
project init  Install ${PROJECT_INIT_LAYERS.join(', ')} into the current project (with a terminal and without --yes, the selector
            opens with the auto target and these layers preselected, so a user layer ticked there goes to the user scope), plus the stack groups of
            upstream-core that match the project (from esoul-guidelines.json, else from composer.json
            and package.json like \`esoul-guidelines init\`): lsr, vue. A Laravel project is checked for
            Laravel Boost, which manages its own skills. A project with a Jenkinsfile also gets
            esoul-jenkins-libraries when you can read that private repository (otherwise one line says so).
            Then it cleans up and refreshes the project (project scope only, never your global skills): one
            \`npx skills remove -y\` takes out the retired skills and the skills their source no longer lists
            (a skill the project took from a source outside layers.json stays), and \`npx skills update -p -y\`
            refreshes the rest from the lock. The removal asks first in a terminal (default yes), runs with
            --yes, and without a terminal or --yes only reports it; --dry-run prints the commands.
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
  --target <t>    auto (default: each layer's own target), project or user (all layers)
  --global, -g    same as --target user                 --project, -p   same as --target project
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
    const options = { skills: [], agents: [], stacks: [], positional: [], flags: new Set(), target: null };
    const valued = new Set(['--skill', '-s', '--agent', '-a', '--stack', '--target']);
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const [name, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
        if (valued.has(name)) {
            const value = inline ?? argv[(i += 1)];
            if (value === undefined) {
                throw new Error(`${name} needs a value`);
            }
            if (name === '--target') {
                if (!TARGETS.includes(value)) {
                    throw new Error(`--target must be one of ${TARGETS.join(', ')}.`);
                }
                options.target = value;
                continue;
            }
            const list = value.split(',').filter(Boolean);
            (name === '--skill' || name === '-s' ? options.skills : name === '--stack' ? options.stacks : options.agents).push(...list);
        } else if (arg.startsWith('-')) {
            options.flags.add(arg === '-y' ? '--yes' : arg === '-g' ? '--global' : arg === '-p' ? '--project' : arg);
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

const CANCELLED = 'Cancelled; nothing installed.';

const TARGET_OPTIONS = {
    auto: { label: 'auto', hint: 'each layer where layers.json puts it: project layers into this project, user layers for you' },
    project: { label: 'project', hint: 'everything into this project (skills-lock.json and .agents/skills/)' },
    user: { label: 'user', hint: 'everything for you, globally' },
};

/**
 * The prompt layer of the selector (@clack/prompts, loaded only when a terminal asks, so scripts and tests never need
 * it). Every method takes plain data from layers.mjs and returns plain values; tests pass a stand-in with the same methods.
 */
async function clackPrompts() {
    const clack = await import('@clack/prompts');
    const answer = (value) => {
        if (clack.isCancel(value)) {
            throw new Error(CANCELLED);
        }
        return value;
    };
    const source = (skill) => (skill.ref ? `${skill.repo}@${skill.ref}` : skill.repo);
    return {
        intro: (text) => clack.intro(text),
        outro: (text) => clack.outro(text),
        log: (text) => clack.log.info(text),
        note: (text, title) => clack.note(text, title),
        async target({ initial }) {
            return answer(
                await clack.select({
                    message: 'Where should the skills go?',
                    initialValue: initial,
                    options: TARGETS.map((value) => ({ value, ...TARGET_OPTIONS[value] })),
                }),
            );
        },
        async layers({ choices, initial }) {
            return answer(
                await clack.multiselect({
                    message: 'Which layers? (space toggles, enter confirms)',
                    options: choices.map((choice) => ({
                        value: choice.value,
                        label: `${choice.value} (${choice.scope})`,
                        hint: `${choice.title}${choice.repos.length > 0 ? `: ${choice.repos.join(', ')}` : ''}`,
                    })),
                    initialValues: initial,
                    required: true,
                }),
            );
        },
        async skills({ groups }) {
            return answer(
                await clack.groupMultiselect({
                    message: 'Which skills? (deselect one to skip it)',
                    options: Object.fromEntries(groups.map((group) => [`${group.id} (${group.scope})`, group.skills.map((skill) => ({ value: skill.name, label: skill.name, hint: source(skill) }))])),
                    initialValues: groups.flatMap((group) => group.skills.filter((skill) => skill.selected).map((skill) => skill.name)),
                    required: true,
                }),
            );
        },
        async confirm({ message }) {
            return answer(await clack.confirm({ message, initialValue: true }));
        },
    };
}

async function confirm(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        return /^(y|yes|)$/i.test(await ask(rl, `${question} [Y/n] `));
    } finally {
        rl.close();
    }
}

function planLines(invocations) {
    return invocations.map((invocation) => `[${invocation.layers.join(', ')} · ${invocation.scope}] npx -y skills ${invocation.args.join(' ')}`);
}

function printPlan(invocations) {
    planLines(invocations).forEach((line) => console.log(line));
}

/** `--target` wins over the aliases `--global` and `--project`; without any the target is `auto`. */
function targetOf(options) {
    return options.target ?? (options.flags.has('--global') ? 'user' : options.flags.has('--project') ? 'project' : 'auto');
}

/** The selector replaces the named arguments: it needs a terminal (or a stand-in prompt layer) and no --yes, layer or --skill argument. */
function wantsSelector(layerArgs, options, ui) {
    if (options.flags.has('--yes') || expandLayerArgs(layerArgs).length > 0 || options.skills.length > 0) {
        return false;
    }
    return ui.prompts !== undefined || Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * The interactive selector: the target, then the layers (with the layers they require), then the skills of those
 * layers. Returns what `install` plans from: { resolved, target, skillFilter }.
 */
async function selectInteractively(manifest, prompts, { initialLayers, initialTarget, flags, satisfied }) {
    prompts.intro(`esoul-skills ${flags.has('--dry-run') ? '(dry run)' : ''}`.trim());
    const target = await prompts.target({ initial: initialTarget });
    const choices = layerChoices(manifest, target);
    const known = new Set(choices.map((choice) => choice.value));
    const picked = await prompts.layers({ choices, initial: initialLayers.filter((value) => known.has(value)) });
    const resolved = resolveSelection(manifest, picked, { satisfied: satisfied(), withRequires: !flags.has('--no-requires') });
    if (resolved.added.length > 0) {
        const message = `Required layers not installed yet: ${resolved.added.join(', ')}.`;
        if (flags.has('--dry-run')) {
            prompts.log(`${message} Adding them.`);
        } else if (!(await prompts.confirm({ message: `${message} Add them?` }))) {
            throw new Error(`${message} Install them first or pass --no-requires.`);
        }
    }
    const groups = selectionGroups(manifest, resolved, { withOptional: flags.has('--optional'), scope: target });
    const skillFilter = await prompts.skills({ groups });
    const needed = withSkillRequires(manifest, skillFilter).filter((name) => !skillFilter.includes(name));
    if (needed.length > 0) {
        prompts.log(`Also installed because a chosen skill needs them: ${needed.join(', ')}.`);
    }
    return { resolved, target, skillFilter };
}

/**
 * `ui.prompts` replaces the terminal prompts (tests), `ui.defaults` are the layers the selector preselects
 * (`project init` adds the stack groups of the project), `ui.after(prompts)` runs once the skills are installed (or
 * planned, with --dry-run), before the closing line (`project init` cleans up and refreshes there).
 */
export async function install(layerArgs, options, manifest = loadManifest(MANIFEST_PATH), ui = {}) {
    const flags = options.flags;
    const withRequires = !flags.has('--no-requires');
    const satisfied = () => (withRequires && !flags.has('--dry-run') ? satisfiedLayers(manifest, installedSkills().map((entry) => entry.name)) : new Set());
    let target = targetOf(options);
    let skillFilter = options.skills.length > 0 ? options.skills : null;
    let resolved;
    let prompts = null;
    if (wantsSelector(layerArgs, options, ui)) {
        prompts = ui.prompts ?? (await clackPrompts());
        ({ resolved, target, skillFilter } = await selectInteractively(manifest, prompts, {
            initialLayers: ui.defaults ?? PROJECT_INIT_LAYERS,
            initialTarget: target,
            flags,
            satisfied,
        }));
    } else {
        const layers = expandLayerArgs(layerArgs);
        if (layers.length === 0) {
            throw new Error('Name the layers to install (see `esoul-skills layers`), or run it in a terminal for the interactive choice.');
        }
        resolved = resolveSelection(manifest, layers, { satisfied: satisfied(), withRequires });
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
    }
    const passthrough = [...options.agents.flatMap((agent) => ['--agent', agent]), ...(flags.has('--copy') ? ['--copy'] : [])];
    const invocations = planInstall(manifest, resolved, {
        skillFilter,
        withOptional: flags.has('--optional'),
        scope: target,
        yes: flags.has('--yes'),
        passthrough,
    });
    if (invocations.length === 0) {
        throw new Error('Nothing to install for that selection (a group managed by another tool installs nothing).');
    }
    if (flags.has('--dry-run')) {
        printPlan(invocations);
        await ui.after?.(prompts);
        prompts?.outro('Dry run: nothing installed.');
        return 0;
    }
    if (prompts) {
        prompts.note(planLines(invocations).join('\n'), `${invocations.length} npx skills run${invocations.length === 1 ? '' : 's'}`);
        if (!(await prompts.confirm({ message: 'Install?' }))) {
            throw new Error(CANCELLED);
        }
    }
    for (const invocation of invocations) {
        console.log(`\n== ${invocation.layers.join(', ')}: ${invocation.skills.join(', ')} (${invocation.scope})`);
        const result = runSkills(invocation.args);
        if (result.status !== 0) {
            throw new Error(`npx skills ${invocation.args.slice(0, 2).join(' ')} failed (exit ${result.status}). Fix the cause and run the command again; finished sources are skipped quickly.`);
        }
    }
    const projectLayers = [...new Set(invocations.filter((entry) => entry.scope === 'project').flatMap((entry) => entry.layers))];
    if (projectLayers.length > 0) {
        console.log(`\nProject layers installed (${projectLayers.join(', ')}). Commit skills-lock.json and the installed skill folders (.agents/skills/) so the clone brings them; teammates restore or refresh the same set with \`npx skills experimental_install\`.`);
    }
    await ui.after?.(prompts);
    prompts?.outro('Done.');
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

/** Whether the developer can read a source repository (a private one needs their credentials). */
export function canReadSource(repo) {
    const result = spawnSync('git', ['ls-remote', '--exit-code', repo, 'HEAD'], {
        stdio: 'ignore',
        timeout: 20000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return result.status === 0;
}

/** Groups selected by a file of the project (a Jenkinsfile): installed when readable, skipped with one line otherwise. */
function fileGroupArgs(manifest, root, readable) {
    const args = [];
    for (const { arg, sources } of groupsForProjectFiles(manifest, (file) => existsSync(join(root, file)))) {
        const unreadable = sources.find((source) => source.private && !readable(source.repo));
        if (unreadable) {
            console.log(`Skipped ${arg}: ${unreadable.repo} is private and your credentials cannot read it. Install it later with \`esoul-skills install ${arg} --project\`.`);
        } else {
            args.push(arg);
        }
    }
    return args;
}

/**
 * The skills a source repository lists, as `npx skills add <spec> --list` prints them (one `│    name` line each);
 * null when it cannot be read or prints nothing recognisable, so a failure never looks like "every skill was dropped".
 */
export function listSourceSkills(spec, cwd = process.cwd()) {
    const result = runSkills(['add', spec, '--list'], { capture: true, cwd });
    if (result.status !== 0) {
        return null;
    }
    const names = [...String(result.stdout).replace(/\x1b\[[0-9;]*m/g, '').matchAll(/^│ {4}(\S+)\s*$/gm)].map((match) => match[1]);
    return names.length > 0 ? new Set(names) : null;
}

function dropReason(manifest, entry) {
    if (entry.reason === 'upstream') {
        return `${entry.source} no longer lists it`;
    }
    return entry.use.length > 0 ? `retired in ${manifest.repo}; use ${entry.use.join(', ')}` : `no longer in ${manifest.repo}`;
}

/**
 * What `project init` does once the skills are installed, project scope only: remove the retired skills and the ones
 * their source dropped (one `npx skills remove` call; a lock entry of a source outside layers.json stays), then refresh
 * the rest from the lock (`npx skills update -p`). The removal needs --yes or a confirmation in a terminal; without
 * either it only reports, so a script never deletes silently.
 */
async function cleanAndRefresh(manifest, options, root, ui, prompts) {
    const flags = options.flags;
    const lock = readLock(root);
    const listSource = ui.listSource ?? listSourceSkills;
    const listings = new Map(upstreamSpecs(manifest, lock).map((spec) => [spec, listSource(spec, root)]));
    const upstream = findUpstreamRemoved(manifest, lock, listings);
    upstream.unverified.forEach((repo) => console.log(`Could not list ${repo}: the skills it may have dropped were not checked.`));
    const drop = [...findStaleSetup(manifest, { lock }).filter((entry) => entry.kind === 'lock' && entry.reason === 'removed'), ...upstream.removed];
    if (drop.length === 0) {
        console.log('\nNo retired skills and none dropped by their source in this project.');
    } else {
        console.log('\nRetired or dropped skills in this project (project scope; global skills are never touched here):');
        drop.forEach((entry) => console.log(`  ${entry.name}  (${dropReason(manifest, entry)})`));
        const args = ['remove', ...drop.map((entry) => entry.name), '-y'];
        const command = `npx -y skills ${args.join(' ')}`;
        const terminal = prompts !== null || Boolean(process.stdin.isTTY && process.stdout.isTTY);
        if (flags.has('--dry-run')) {
            console.log(`[cleanup · project] ${command}`);
        } else if (!flags.has('--yes') && !terminal) {
            console.log(`Not removed (no terminal): pass --yes to remove them, or run\n  ${command}`);
        } else if (!flags.has('--yes') && !(await (prompts ? prompts.confirm({ message: `Remove these ${drop.length} skills?` }) : confirm(`Remove these ${drop.length} skills?`)))) {
            console.log(`Not removed. Remove them later with\n  ${command}`);
        } else {
            console.log(`\n== removing ${drop.length} skill${drop.length === 1 ? '' : 's'} (project)`);
            const result = runSkills(args, { cwd: root });
            if (result.status !== 0) {
                throw new Error(`npx skills remove failed (exit ${result.status}). Run it again:\n  ${command}`);
            }
        }
    }
    const refresh = ['update', '-p', '-y'];
    if (flags.has('--dry-run')) {
        console.log(`[refresh · project] npx -y skills ${refresh.join(' ')}`);
        return;
    }
    console.log('\n== refreshing the installed project skills from their sources');
    const result = runSkills(refresh, { cwd: root });
    if (result.status !== 0) {
        throw new Error(`npx skills ${refresh.join(' ')} failed (exit ${result.status}). Run it again.`);
    }
}

export async function projectInit(options, manifest = loadManifest(MANIFEST_PATH), root = process.cwd(), readable = canReadSource, ui = {}) {
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
    // The selector preselects `auto` (project layers stay in the project, a ticked user layer goes to the user scope);
    // without it, everything goes to the project as before.
    if (!wantsSelector([], options, ui)) {
        options.flags.add('--project');
    }
    const fileGroups = fileGroupArgs(manifest, root, readable);
    const layers = [...PROJECT_INIT_LAYERS, ...stack.args.filter((arg) => !managed.some((entry) => arg === `${entry.layer}:${entry.group}`)), ...fileGroups];
    // With the selector the detected layers and groups are what it preselects; otherwise they are the named layers.
    return install(wantsSelector([], options, ui) ? [] : layers, options, manifest, {
        ...ui,
        defaults: layers,
        after: (prompts) => cleanAndRefresh(manifest, options, root, ui, prompts),
    });
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
