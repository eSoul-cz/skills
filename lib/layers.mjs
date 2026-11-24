// Pure logic of the installer: reads layers.json, validates it, resolves `requires` and turns a
// selection into `npx skills add` invocations. No I/O besides loadManifest; everything else is
// testable without the network.
//
// A layer has own skills (`skills`, from the repository of the manifest), third-party `sources`
// and named `groups` of sources. Naming a layer installs its own skills, its sources and every
// group not marked `"default": false`; `layer:group` installs that group only. A group may carry
// `detect` (guideline layers that select it for `project init`) and `managedBy` (skills another
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

/**
 * `npx skills add` invocations for a resolved selection.
 * `skillFilter`: only these skills (each must belong to a selected layer or group).
 * `scope`: 'auto' (layer scope), 'user' or 'project' forces one for all layers.
 */
export function planInstall(manifest, resolved, { skillFilter = null, withOptional = false, scope = 'auto', yes = false, passthrough = [] } = {}) {
    const filter = skillFilter ? new Set(withSkillRequires(manifest, skillFilter)) : null;
    const available = new Set();
    const invocations = [];
    for (const { layer, base, groups } of resolved.layers) {
        const definition = manifest.layers[layer];
        const effectiveScope = scope === 'auto' ? definition.scope : scope;
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
        for (const source of sources) {
            source.skills.forEach((name) => available.add(name));
            const named = filter ? source.skills.filter((name) => filter.has(name)) : [];
            if (source.optional && !withOptional && named.length === 0) {
                continue;
            }
            const skills = filter ? named : source.skills;
            if (skills.length === 0) {
                continue;
            }
            const args = ['add', sourceSpec(source.repo, source.ref), '--skill', ...skills];
            if (effectiveScope === 'user') {
                args.push('--global');
            }
            if (yes) {
                args.push('--yes');
            }
            args.push(...passthrough);
            invocations.push({ layer, scope: effectiveScope, repo: source.repo, ref: source.ref ?? null, skills, args });
        }
    }
    if (filter) {
        const unknown = [...filter].filter((name) => !available.has(name));
        if (unknown.length > 0) {
            throw new Error(`Skill ${unknown.join(', ')} is not in the selected layers (${resolved.layers.map(({ layer }) => layer).join(', ')}).`);
        }
    }
    return invocations;
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

/** The groups managed by another tool: [{ layer, group, managedBy, detect }]. */
export function managedGroups(manifest) {
    return Object.keys(manifest.layers).flatMap((layer) =>
        layerGroups(manifest, layer)
            .filter(([, group]) => group.managedBy)
            .map(([name, group]) => ({ layer, group: name, managedBy: group.managedBy, detect: group.detect ?? [] })),
    );
}
