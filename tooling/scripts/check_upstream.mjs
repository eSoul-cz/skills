#!/usr/bin/env node
// Reports third-party sources of layers.json that are pinned to a release tag (`ref`) while a newer release exists.
// Usage: node tooling/scripts/check_upstream.mjs [--manifest <layers.json>]
// Exit 0: every pin is the latest release. Exit 1: at least one pin is behind (the report lists them).
// Exit 2: a source could not be checked (network, unknown repository, pin that is not a semantic version).
// The weekly scheduled Jenkins build runs it and marks the build unstable on exit 1 (Jenkinsfile).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** [major, minor, patch] of a release tag, or null for anything that is not a plain semantic version. */
export function parseVersion(tag) {
    const match = String(tag).match(SEMVER);
    return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
    for (let index = 0; index < 3; index += 1) {
        if (a[index] !== b[index]) {
            return a[index] - b[index];
        }
    }
    return 0;
}

/** The highest plain semantic-version tag of a list, or null. */
export function latestRelease(tags) {
    return tags.filter((tag) => parseVersion(tag)).sort((a, b) => compareVersions(parseVersion(b), parseVersion(a)))[0] ?? null;
}

/** Every pinned third-party source of the manifest once: [{ repo, ref, where }]. */
export function pinnedSources(manifest) {
    const found = new Map();
    for (const [layerId, layer] of Object.entries(manifest.layers)) {
        const groups = Object.entries(layer.groups ?? {}).map(([name, group]) => [`${layerId}:${name}`, group.sources ?? []]);
        for (const [where, sources] of [[layerId, layer.sources ?? []], ...groups]) {
            for (const source of sources.filter((entry) => entry.ref)) {
                const key = `${source.repo}@${source.ref}`;
                found.set(key, { repo: source.repo, ref: source.ref, where: [...(found.get(key)?.where ?? []), where] });
            }
        }
    }
    return [...found.values()];
}

/**
 * Compares every pin with the newest release tag. `listTags(repo)` returns the tag names of a repository.
 * Result: { current: [...], behind: [{ repo, ref, latest, where }], unchecked: [{ repo, ref, reason }] }.
 */
export function checkPins(manifest, listTags) {
    const result = { current: [], behind: [], unchecked: [] };
    for (const pin of pinnedSources(manifest)) {
        const pinned = parseVersion(pin.ref);
        if (!pinned) {
            result.unchecked.push({ ...pin, reason: `the pin ${pin.ref} is not a semantic version` });
            continue;
        }
        let latest;
        try {
            latest = latestRelease(listTags(pin.repo));
        } catch (error) {
            result.unchecked.push({ ...pin, reason: error.message });
            continue;
        }
        if (!latest) {
            result.unchecked.push({ ...pin, reason: 'the repository has no release tag' });
        } else if (compareVersions(parseVersion(latest), pinned) > 0) {
            result.behind.push({ ...pin, latest });
        } else {
            result.current.push({ ...pin, latest });
        }
    }
    return result;
}

export function gitTags(repo) {
    const url = /^(git@|https?:|ssh:)/.test(repo) ? repo : `https://github.com/${repo}.git`;
    const run = spawnSync('git', ['ls-remote', '--tags', '--refs', url], { encoding: 'utf8', timeout: 60000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    if (run.status !== 0) {
        throw new Error(`git ls-remote ${url} failed: ${(run.stderr || run.error?.message || '').trim()}`);
    }
    return run.stdout.split('\n').map((line) => line.split('refs/tags/')[1]).filter(Boolean);
}

export function formatReport(result) {
    const lines = [];
    for (const entry of result.behind) {
        lines.push(`NEWER RELEASE ${entry.repo}: pinned ${entry.ref}, latest ${entry.latest} (${entry.where.join(', ')}). Read the upstream changes, then bump "ref" in layers.json.`);
    }
    for (const entry of result.unchecked) {
        lines.push(`UNCHECKED ${entry.repo}@${entry.ref}: ${entry.reason}`);
    }
    for (const entry of result.current) {
        lines.push(`ok ${entry.repo}: ${entry.ref} is the latest release`);
    }
    return lines.join('\n');
}

function main() {
    const args = process.argv.slice(2);
    const manifestIndex = args.indexOf('--manifest');
    const file = manifestIndex >= 0 ? args[manifestIndex + 1] : fileURLToPath(new URL('../../layers.json', import.meta.url));
    const result = checkPins(JSON.parse(readFileSync(file, 'utf8')), gitTags);
    console.log(formatReport(result));
    process.exit(result.unchecked.length ? 2 : result.behind.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
