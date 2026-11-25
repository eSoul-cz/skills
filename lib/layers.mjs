// Pure logic of the installer: reads layers.json, validates it, resolves `requires` and turns a
// selection into `npx skills add` invocations. No I/O besides loadManifest; everything else is
// testable without the network.
//
// A layer has own skills (`skills`, from the repository of the manifest), third-party `sources`
// and named `groups` of sources. Naming a layer installs its own skills, its sources and every
// group not marked `"default": false`; `layer:group` installs that group only. A group may carry
// `detect` (guideline layers that select it for `project init`), `detectFile` (a file of the project
// that selects it, installed when its sources are readable) and `managedBy` (skills another
// tool installs itself, for example Laravel Boost: nothing is installed for it).
import { readFileSync } from 'node:fs';

/** `core,dev upstream-core:lsr,vue` -> ['core', 'dev', 'upstream-core:lsr', 'upstream-core:vue']. */
export function expandLayerArgs(args) {
    return args.flatMap((arg) => {
        const [layer, groups] = String(arg).split(/:(.*)/s);
        if (groups !== undefined) {
            return groups.split(',').filter(Boolean).map((group) => `${layer}:${group}`);
        }
        return layer.split(',').filter(Boolean);
    });
}

export const SCOPES = ['project', 'user'];

export function loadManifest(file) {
    return JSON.parse(readFileSync(file, 'utf8'));
}

/** `upstream-picks:wordpress` -> { layer: 'upstream-picks', group: 'wordpress' }. */
export function parseLayerArg(arg) {
    const [layer, group = null, ...rest] = String(arg).split(':');
    if (!layer || rest.length > 0 || group === '') {
        throw new Error(`Invalid layer "${arg}"; use <layer> or <layer>:<group>.`);
    }
    return { layer, group };
}

/** Groups of a layer as [name, definition]; `defaultOnly` drops the ones that need to be named. */
export function layerGroups(manifest, layerId, { defaultOnly = false } = {}) {
    return Object.entries(manifest.layers[layerId].groups ?? {}).filter(([, group]) => !defaultOnly || group.default !== false);
}

/**
 * Third-party sources of a layer. `group` narrows to that group; without it the layer's own
 * sources and its default groups. `allGroups` includes the groups that must be named too.
 */
export function layerSources(manifest, layerId, { group = null, allGroups = false } = {}) {
    const layer = manifest.layers[layerId];
    const sources = group === null ? [...(layer.sources ?? [])] : [];
    for (const [name, definition] of layerGroups(manifest, layerId, { defaultOnly: !allGroups && group === null })) {
        if (group === null || group === name) {
            sources.push(...(definition.sources ?? []).map((source) => ({ ...source, group: name })));
        }
    }
    return sources;
}

/** Every skill name a layer installs, own skills first. Optional sources only on request. */
export function layerSkills(manifest, layerId, { group = null, optional = false, allGroups = false } = {}) {
    const layer = manifest.layers[layerId];
    const names = group === null ? [...(layer.skills ?? [])] : [];
    for (const source of layerSources(manifest, layerId, { group, allGroups })) {
        if (!source.optional || optional) {
            names.push(...source.skills);
        }
    }
    return names;
}

/** Structural checks of layers.json. `ownSkillsOnDisk` (layer -> skill names under skills/<layer>/) proves every own skill is in exactly one layer. */
export function validateManifest(manifest, ownSkillsOnDisk = null) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object' || typeof manifest.layers !== 'object') {
        return ['layers.json needs a "layers" object'];
    }
    if (typeof manifest.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(manifest.repo)) {
        errors.push('"repo" must be owner/name');
    }
    const ids = Object.keys(manifest.layers);
    const owner = new Map();
    for (const id of ids) {
        const layer = manifest.layers[id];
        if (!SCOPES.includes(layer.scope)) {
            errors.push(`${id}: scope must be one of ${SCOPES.join(', ')}`);
        }
        if (!Array.isArray(layer.requires)) {
            errors.push(`${id}: requires must be an array`);
        }
        for (const required of layer.requires ?? []) {
            if (!manifest.layers[required]) {
                errors.push(`${id}: requires unknown layer "${required}"`);
            }
            if (required === id) {
                errors.push(`${id}: requires itself`);
            }
        }
        if (typeof layer.title !== 'string' || typeof layer.description !== 'string') {
            errors.push(`${id}: title and description are required`);
        }
        for (const skill of layer.skills ?? []) {
            if (owner.has(skill)) {
                errors.push(`skill ${skill} is in two layers: ${owner.get(skill)} and ${id}`);
            }
            owner.set(skill, id);
        }
        for (const [skill, needs] of Object.entries(layer.skillRequires ?? {})) {
            if (!(layer.skills ?? []).includes(skill)) {
                errors.push(`${id}: skillRequires names ${skill}, which is not an own skill of the layer`);
            }
            if (!Array.isArray(needs) || needs.some((need) => need === skill || typeof need !== 'string')) {
                errors.push(`${id}: skillRequires.${skill} must list other skill names`);
            }
        }
        for (const [name, group] of layerGroups(manifest, id)) {
            if (!group.managedBy && !(group.sources?.length)) {
                errors.push(`${id}:${name}: a group needs sources or managedBy`);
            }
            if (group.detect !== undefined && !(Array.isArray(group.detect) && group.detect.every((entry) => typeof entry === 'string'))) {
                errors.push(`${id}:${name}: detect must be an array of guideline layers`);
            }
            if (group.default !== undefined && typeof group.default !== 'boolean') {
                errors.push(`${id}:${name}: default must be a boolean`);
            }
            if (group.detect && layer.scope !== 'project') {
                errors.push(`${id}:${name}: only project layers can be detected for a project`);
            }
            if (group.detectFile !== undefined && (typeof group.detectFile !== 'string' || group.detectFile === '')) {
                errors.push(`${id}:${name}: detectFile must be a file name`);
            }
        }
        const sources = layerSources(manifest, id, { allGroups: true });
        for (const source of sources) {
            if (typeof source.repo !== 'string' || !source.repo) {
                errors.push(`${id}: a source has no repo`);
            }
            if (!Array.isArray(source.skills) || source.skills.length === 0) {
                errors.push(`${id}: source ${source.repo} lists no skills`);
            }
            if (source.ref !== undefined && typeof source.ref !== 'string') {
                errors.push(`${id}: source ${source.repo} has a non-string ref`);
            }
        }
        if (!(layer.skills?.length) && sources.length === 0 && layerGroups(manifest, id).length === 0) {
            errors.push(`${id}: a layer needs skills or sources`);
        }
    }
    // Cycles in requires.
    const state = new Map();
    const visit = (id, trail) => {
        if (state.get(id) === 'done' || !manifest.layers[id]) {
            return;
        }
        if (state.get(id) === 'open') {
            errors.push(`requires cycle: ${[...trail, id].join(' -> ')}`);
            return;
        }
        state.set(id, 'open');
        for (const required of manifest.layers[id].requires ?? []) {
            visit(required, [...trail, id]);
        }
        state.set(id, 'done');
    };
    ids.forEach((id) => visit(id, []));
    // A project layer must not require a user layer: its skills would be missing for teammates.
    for (const id of ids) {
        const layer = manifest.layers[id];
        for (const required of layer.requires ?? []) {
            if (layer.scope === 'project' && manifest.layers[required]?.scope === 'user') {
                errors.push(`${id}: a project layer cannot require the user layer ${required}`);
            }
        }
    }
    errors.push(...validateRetired(manifest, owner));
    if (ownSkillsOnDisk) {
        for (const [layerId, names] of Object.entries(ownSkillsOnDisk)) {
            for (const name of names) {
                const declared = owner.get(name);
                if (declared === undefined) {
                    errors.push(`skill ${name} (skills/${layerId}/) is in no layer`);
                } else if (declared !== layerId) {
                    errors.push(`skill ${name} is in skills/${layerId}/ but layer ${declared}`);
                }
            }
        }
        const onDisk = new Set(Object.values(ownSkillsOnDisk).flat());
        for (const [skill, layerId] of owner) {
            if (!onDisk.has(skill)) {
                errors.push(`layer ${layerId} lists ${skill}, which is not in skills/${layerId}/`);
            }
        }
    }
    return errors;
}

/**
 * Selected layers plus the layers they require, requirements first. A required layer in
 * `satisfied` (already installed) is not added. `added` lists the layers pulled in by `requires`.
 * Each entry is `{ layer, base, groups }`: `base` = the layer itself (own skills, sources,
 * default groups), `groups` = explicitly named groups.
 */
export function resolveSelection(manifest, args, { satisfied = new Set(), withRequires = true } = {}) {
    const selected = args.map(parseLayerArg);
    for (const { layer, group } of selected) {
        const definition = manifest.layers[layer];
        if (!definition) {
            throw new Error(`Unknown layer "${layer}". Layers: ${Object.keys(manifest.layers).join(', ')}.`);
        }
        if (group !== null && !definition.groups?.[group]) {
            const names = layerGroups(manifest, layer).map(([name]) => name);
            throw new Error(`Layer ${layer} has no group "${group}".${names.length > 0 ? ` Groups: ${names.join(', ')}.` : ''}`);
        }
    }
    const seen = new Map();
    const order = [];
    const add = (layer, group) => {
        let entry = seen.get(layer);
        if (!entry) {
            entry = { layer, base: false, groups: new Set() };
            seen.set(layer, entry);
            order.push(entry);
        }
        if (group === null) {
            entry.base = true;
        } else {
            entry.groups.add(group);
        }
    };
    const selectedIds = new Set(selected.map(({ layer }) => layer));
    const added = [];
    const pull = (layerId) => {
        for (const required of manifest.layers[layerId].requires ?? []) {
            if (satisfied.has(required) || seen.has(required)) {
                continue;
            }
            pull(required);
            add(required, null);
            if (!selectedIds.has(required)) {
                added.push(required);
            }
        }
    };
    for (const { layer, group } of selected) {
        if (withRequires) {
            pull(layer);
        }
        add(layer, group);
    }
    // A layer selected earlier than another selected layer that requires it must still come first.
    const rank = new Map();
    const place = (id) => {
        if (rank.has(id)) {
            return;
        }
        rank.set(id, -1);
        for (const required of manifest.layers[id].requires ?? []) {
            if (seen.has(required)) {
                place(required);
            }
        }
        rank.set(id, rank.size);
    };
    order.forEach((entry) => place(entry.layer));
    order.sort((a, b) => rank.get(a.layer) - rank.get(b.layer));
    return {
        layers: order.map(({ layer, base, groups }) => ({ layer, base, groups: [...groups] })),
        added: [...new Set(added)],
    };
}

/** Layers whose every non-optional skill (own and default groups) is in `installedNames`. */
export function satisfiedLayers(manifest, installedNames) {
    const installed = new Set(installedNames);
    const done = new Set();
    for (const id of Object.keys(manifest.layers)) {
        const names = layerSkills(manifest, id);
        if (names.length > 0 && names.every((name) => installed.has(name))) {
            done.add(id);
        }
    }
    return done;
}

/** The `retired` map of layers.json as a list: names that once came from `repo` and what to use now (a skill of this repository, or the same name from `source`). */
export function retiredSkills(manifest) {
    return Object.entries(manifest.retired ?? {}).map(([name, entry]) => ({ name, use: entry.use, source: entry.source ?? null }));
}

/** Retired names that are gone for good, so project files naming them must be rewritten (the same name from another source, such as `freelo`, is not a rename). */
export function renamedSkills(manifest) {
    return retiredSkills(manifest).filter((entry) => !entry.use.includes(entry.name));
}

/** Own skills of the manifest repository as a Map of name to layer. */
export function ownSkillLayers(manifest) {
    return new Map(Object.entries(manifest.layers).flatMap(([id, layer]) => (layer.skills ?? []).map((name) => [name, id])));
}

function validateRetired(manifest, owner) {
    const retired = manifest.retired ?? {};
    if (typeof retired !== 'object' || Array.isArray(retired)) {
        return ['"retired" must be an object of skill names'];
    }
    const errors = [];
    const sourceSkills = new Map();
    for (const id of Object.keys(manifest.layers)) {
        for (const source of layerSources(manifest, id, { allGroups: true })) {
            sourceSkills.set(source.repo, new Set([...(sourceSkills.get(source.repo) ?? []), ...(source.skills ?? [])]));
        }
    }
    for (const [name, entry] of Object.entries(retired)) {
        if (owner.has(name)) {
            errors.push(`retired: ${name} is a current skill of ${manifest.repo}`);
        }
        if (!Array.isArray(entry?.use) || entry.use.length === 0 || entry.use.some((use) => typeof use !== 'string')) {
            errors.push(`retired: ${name} needs "use", a list of skill names`);
            continue;
        }
        if (entry.source !== undefined && typeof entry.source !== 'string') {
            errors.push(`retired: ${name} has a non-string source`);
            continue;
        }
        for (const use of entry.use) {
            const listed = entry.source === undefined ? owner.has(use) : sourceSkills.get(entry.source)?.has(use);
            if (!listed) {
                errors.push(`retired: ${name} points at ${use}, which ${entry.source === undefined ? `is not an own skill of ${manifest.repo}` : `${entry.source} does not list in layers.json`}`);
            }
        }
    }
    return errors;
}

/** First layer that installs `name` (own skill, or a skill of `source`); null when none does. */
export function layerOfSkill(manifest, name, source = null) {
    for (const id of Object.keys(manifest.layers)) {
        const own = source === null && (manifest.layers[id].skills ?? []).includes(name);
        const sourced = layerSources(manifest, id, { allGroups: true }).some((entry) => (source === null || entry.repo === source) && entry.skills.includes(name));
        if (own || sourced) {
            return id;
        }
    }
    return null;
}

const normalizeRepo = (repo) => (typeof repo === 'string' ? repo.toLowerCase().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '') : null);
const sameRepo = (a, b) => normalizeRepo(a) !== null && normalizeRepo(a) === normalizeRepo(b);

/**
 * What in a project or user setup no longer matches the layout of this repository: installed skills with a retired
 * name or from this repository under a name it no longer has (`installed`: [{ name, scope, source }]), and
 * `skills-lock.json` entries from this repository whose skill is gone or whose path moved (`lock`: the parsed file).
 * Third-party entries are not checked: their paths cannot be verified offline.
 */
export function findStaleSetup(manifest, { installed = [], lock = null } = {}) {
    const retired = new Map(retiredSkills(manifest).map((entry) => [entry.name, entry]));
    const current = new Set(Object.keys(manifest.layers).flatMap((id) => layerSkills(manifest, id, { optional: true, allGroups: true })));
    const own = ownSkillLayers(manifest);
    const stale = [];
    const gone = (name) => ({ use: retired.get(name)?.use ?? [], source: retired.get(name)?.source ?? null });
    for (const { name, scope, source = null } of installed) {
        const fromHere = sameRepo(source, manifest.repo);
        if (fromHere ? !own.has(name) : retired.has(name) && !current.has(name)) {
            stale.push({ kind: 'installed', scope, name, reason: 'removed', ...gone(name) });
        }
    }
    for (const [name, record] of Object.entries(lock?.skills ?? {})) {
        if (!sameRepo(record?.source, manifest.repo)) {
            continue;
        }
        const layer = own.get(name);
        if (layer === undefined) {
            stale.push({ kind: 'lock', scope: 'project', name, reason: 'removed', ...gone(name) });
        } else if (typeof record.skillPath === 'string' && record.skillPath !== `skills/${layer}/${name}/SKILL.md`) {
            stale.push({ kind: 'lock', scope: 'project', name, reason: 'moved', use: [name], source: null, path: record.skillPath });
        }
    }
    return stale;
}

/** Where a lock entry says its skill came from (`source`, and `sourceUrl` for a full URL). */
const lockSources = (record) => [record?.source, record?.sourceUrl].filter((value) => typeof value === 'string');

/**
 * The lock entries that come from a third-party source of layers.json (any layer or group; not this repository, whose
 * skills the manifest knows itself). A skill the project added from elsewhere is not among them. `skill` is the name
 * the source lists (`skillName` when the project installed it under another name); `specs` are the `repo[@ref]` the
 * manifest installs that repository with; `wanted` is true when the manifest still names the skill for it.
 */
function upstreamLockEntries(manifest, lock) {
    const sources = [];
    for (const id of Object.keys(manifest.layers)) {
        sources.push(...layerSources(manifest, id, { allGroups: true }).filter((source) => !sameRepo(source.repo, manifest.repo)));
    }
    const entries = [];
    for (const [name, record] of Object.entries(lock?.skills ?? {})) {
        const from = sources.filter((source) => lockSources(record).some((value) => sameRepo(value, source.repo)));
        if (from.length === 0) {
            continue;
        }
        const skill = typeof record.skillName === 'string' ? record.skillName : name;
        entries.push({
            name,
            skill,
            repo: from[0].repo,
            specs: [...new Set(from.map((source) => sourceSpec(source.repo, source.ref)))],
            wanted: from.some((source) => source.skills.includes(skill)),
        });
    }
    return entries;
}

/** The `repo[@ref]` sources to list (with `npx skills add <spec> --list`) to find the skills their repositories dropped. */
export function upstreamSpecs(manifest, lock) {
    return [...new Set(upstreamLockEntries(manifest, lock).filter((entry) => !entry.wanted).flatMap((entry) => entry.specs))];
}

/**
 * Lock entries of a third-party source of layers.json whose skill the source no longer lists (dropped or renamed
 * upstream). `listings` maps a spec to the Set of names it lists, or null when it could not be read: such a source is
 * never judged (`unverified`), and neither is a skill the manifest still names.
 */
export function findUpstreamRemoved(manifest, lock, listings) {
    const removed = [];
    const unverified = new Set();
    for (const entry of upstreamLockEntries(manifest, lock).filter((item) => !item.wanted)) {
        const lists = entry.specs.map((spec) => listings.get(spec) ?? null);
        if (lists.some((list) => list === null)) {
            unverified.add(entry.repo);
        } else if (!lists.some((list) => list.has(entry.skill))) {
            removed.push({ kind: 'lock', scope: 'project', name: entry.name, reason: 'upstream', use: [], source: entry.repo });
        }
    }
    return { removed, unverified: [...unverified] };
}

/** The commands that clear a stale setup: `remove` per scope, then the helper calls that reinstall the replacements. */
export function staleFix(manifest, stale) {
    const names = (scope) => [...new Set(stale.filter((entry) => entry.scope === scope && entry.reason === 'removed').map((entry) => entry.name))];
    const remove = ['project', 'user'].map((scope) => ({ scope, names: names(scope) })).filter((entry) => entry.names.length > 0);
    const then = [];
    if (stale.some((entry) => entry.scope === 'project')) {
        then.push('esoul-skills project init');
    }
    const userLayers = new Set();
    let optional = false;
    for (const entry of stale.filter((item) => item.scope === 'user')) {
        for (const use of entry.use) {
            const layer = layerOfSkill(manifest, use, entry.source);
            if (layer && manifest.layers[layer].scope === 'user') {
                userLayers.add(layer);
                optional ||= layerSources(manifest, layer, { allGroups: true }).some((source) => source.optional && source.skills.includes(use));
            }
        }
    }
    if (userLayers.size > 0) {
        then.push(`esoul-skills install ${[...userLayers].join(' ')}${optional ? ' --optional' : ''}`);
    }
    return { remove, then };
}

function sourceSpec(repo, ref) {
    return ref ? `${repo}@${ref}` : repo;
}

/**
 * `skillRequires` of a layer (`{ "skill": ["other-skill"] }`): naming a skill with `--skill` also installs the
 * skills it needs, transitively. Installing a whole layer already includes them.
 */
export function withSkillRequires(manifest, names) {
    const needs = new Map();
    for (const layer of Object.values(manifest.layers)) {
        for (const [skill, required] of Object.entries(layer.skillRequires ?? {})) {
            needs.set(skill, required);
        }
    }
    const all = new Set(names);
    const queue = [...all];
    while (queue.length > 0) {
        for (const need of needs.get(queue.shift()) ?? []) {
            if (!all.has(need)) {
                all.add(need);
                queue.push(need);
            }
        }
    }
    return [...all];
}

export const TARGETS = ['auto', 'project', 'user'];

/** Where a layer goes for a target: `auto` is the layer's own scope, `project` and `user` force one for every layer. */
export function layerTarget(manifest, layerId, target = 'auto') {
    return target === 'auto' ? manifest.layers[layerId].scope : target;
}

/**
 * The sources a resolved selection installs, in order: [{ layer, scope, source }]. `source` is
 * { repo, ref?, skills, optional?, group? }; own skills of the manifest repository come first in a layer.
 */
function selectionSources(manifest, resolved, target) {
    const found = [];
    for (const { layer, base, groups } of resolved.layers) {
        const definition = manifest.layers[layer];
        const sources = [];
        if (base) {
            if (definition.skills?.length) {
                sources.push({ repo: manifest.repo, skills: definition.skills });
            }
            sources.push(...layerSources(manifest, layer));
        }
        const included = new Set(sources.map((source) => source.group).filter(Boolean));
        for (const group of groups) {
            if (!included.has(group)) {
                sources.push(...layerSources(manifest, layer, { group }));
            }
        }
        found.push(...sources.map((source) => ({ layer, scope: layerTarget(manifest, layer, target), source })));
    }
    return found;
}

/**
 * One `npx skills add` per (repository, ref, scope): entries ({ layer, scope, repo, ref, skills }) that share them
 * are merged, skills in first-seen order, and every skill is passed to the one command.
 */
export function batchInvocations(entries, { yes = false, passthrough = [] } = {}) {
    const batches = new Map();
    for (const { layer, scope, repo, ref = null, skills } of entries) {
        const key = JSON.stringify([repo, ref, scope]);
        if (!batches.has(key)) {
            batches.set(key, { layers: [], scope, repo, ref, skills: [] });
        }
        const batch = batches.get(key);
        if (!batch.layers.includes(layer)) {
            batch.layers.push(layer);
        }
        batch.skills.push(...skills.filter((name) => !batch.skills.includes(name)));
    }
    return [...batches.values()].map((batch) => {
        const args = ['add', sourceSpec(batch.repo, batch.ref), '--skill', ...batch.skills];
        if (batch.scope === 'user') {
            args.push('--global');
        }
        if (yes) {
            args.push('--yes');
        }
        args.push(...passthrough);
        return { ...batch, args };
    });
}

/**
 * `npx skills add` invocations for a resolved selection, batched by source and scope.
 * `skillFilter`: only these skills (each must belong to a selected layer or group).
 * `scope`: the target, 'auto' (each layer's own scope), 'user' or 'project' (all layers).
 */
export function planInstall(manifest, resolved, { skillFilter = null, withOptional = false, scope = 'auto', yes = false, passthrough = [] } = {}) {
    const filter = skillFilter ? new Set(withSkillRequires(manifest, skillFilter)) : null;
    const available = new Set();
    const entries = [];
    for (const { layer, scope: effectiveScope, source } of selectionSources(manifest, resolved, scope)) {
        source.skills.forEach((name) => available.add(name));
        const named = filter ? source.skills.filter((name) => filter.has(name)) : [];
        if (source.optional && !withOptional && named.length === 0) {
            continue;
        }
        const skills = filter ? named : source.skills;
        if (skills.length > 0) {
            entries.push({ layer, scope: effectiveScope, repo: source.repo, ref: source.ref ?? null, skills });
        }
    }
    if (filter) {
        const unknown = [...filter].filter((name) => !available.has(name));
        if (unknown.length > 0) {
            throw new Error(`Skill ${unknown.join(', ')} is not in the selected layers (${resolved.layers.map(({ layer }) => layer).join(', ')}).`);
        }
    }
    return batchInvocations(entries, { yes, passthrough });
}

/**
 * The layer step of the interactive selector: every layer, plus the groups that must be named (a group on request
 * is its own entry; managed groups install nothing and are left out). `scope` is where it goes for `target`.
 * [{ value: 'core' | 'upstream-core:lsr', layer, group, scope, title, repos }]
 */
export function layerChoices(manifest, target = 'auto') {
    const choices = [];
    for (const [layer, definition] of Object.entries(manifest.layers)) {
        const scope = layerTarget(manifest, layer, target);
        choices.push({ value: layer, layer, group: null, scope, title: definition.title, repos: [] });
        for (const [name, group] of layerGroups(manifest, layer)) {
            if (group.default === false && !group.managedBy) {
                choices.push({ value: `${layer}:${name}`, layer, group: name, scope, title: `${definition.title}, on request`, repos: (group.sources ?? []).map((source) => source.repo) });
            }
        }
    }
    return choices;
}

/**
 * The skill step of the interactive selector: the skills a resolved selection would install, grouped by layer
 * (a default group of a layer, such as `upstream-picks:web`, is a group of its own). Optional sources are listed
 * but not `selected` unless `withOptional`. A name listed twice appears once.
 * [{ id, layer, group, scope, skills: [{ name, repo, ref, selected }] }]
 */
export function selectionGroups(manifest, resolved, { withOptional = false, scope = 'auto' } = {}) {
    const groups = new Map();
    const seen = new Set();
    for (const { layer, scope: effectiveScope, source } of selectionSources(manifest, resolved, scope)) {
        const id = source.group ? `${layer}:${source.group}` : layer;
        if (!groups.has(id)) {
            groups.set(id, { id, layer, group: source.group ?? null, scope: effectiveScope, skills: [] });
        }
        for (const name of source.skills.filter((skill) => !seen.has(skill))) {
            seen.add(name);
            groups.get(id).skills.push({ name, repo: source.repo, ref: source.ref ?? null, selected: !source.optional || withOptional });
        }
    }
    return [...groups.values()].filter((group) => group.skills.length > 0);
}

/** The layers of `project init`: what every developer gets in a project (plus the stack groups detected). */
export const PROJECT_INIT_LAYERS = ['core', 'dev', 'upstream-core'];

/** `layer:group` arguments of the groups whose `detect` lists one of the project's guideline layers. */
export function groupsForGuidelineLayers(manifest, guidelineLayers) {
    const present = new Set(guidelineLayers);
    const args = [];
    for (const [layerId, layer] of Object.entries(manifest.layers)) {
        if (layer.scope !== 'project') {
            continue;
        }
        for (const [name, group] of layerGroups(manifest, layerId)) {
            if ((group.detect ?? []).some((entry) => present.has(entry))) {
                args.push(`${layerId}:${name}`);
            }
        }
    }
    return args;
}

/**
 * The groups whose `detectFile` exists in the project (the Jenkinsfile of `esoul-jenkins-libraries`):
 * [{ arg, group, sources }]. `project init` installs them into the project when the sources are readable.
 */
export function groupsForProjectFiles(manifest, fileExists) {
    return Object.keys(manifest.layers).flatMap((layerId) =>
        layerGroups(manifest, layerId)
            .filter(([, group]) => group.detectFile && fileExists(group.detectFile))
            .map(([name, group]) => ({ arg: `${layerId}:${name}`, group: name, sources: group.sources ?? [] })),
    );
}

/** The groups managed by another tool: [{ layer, group, managedBy, detect }]. */
export function managedGroups(manifest) {
    return Object.keys(manifest.layers).flatMap((layer) =>
        layerGroups(manifest, layer)
            .filter(([, group]) => group.managedBy)
            .map(([name, group]) => ({ layer, group: name, managedBy: group.managedBy, detect: group.detect ?? [] })),
    );
}
