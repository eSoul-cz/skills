#!/usr/bin/env node
// Compares the upstream files that eSoul skills adapt with a newer upstream checkout.
// Usage: node tooling/scripts/check_upstream.mjs <upstream-checkout> [--manifest <path>] [--accept]
// Exit 0 when nothing changed, 1 when an upstream file changed or disappeared, 2 on usage errors.
// --accept records the current upstream hashes and version after the changes were ported.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

function parseArgs(argv) {
    const options = { manifest: join(root, 'tooling/upstream/mattpocock-skills.json'), accept: false, upstream: null };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--manifest') {
            options.manifest = argv[(i += 1)];
        } else if (argv[i] === '--accept') {
            options.accept = true;
        } else if (!options.upstream) {
            options.upstream = argv[i];
        } else {
            throw new Error(`Unexpected argument: ${argv[i]}`);
        }
    }
    if (!options.upstream || !options.manifest) {
        throw new Error('Usage: check_upstream.mjs <upstream-checkout> [--manifest <path>] [--accept]');
    }
    return options;
}

function sha256(path) {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function upstreamVersion(dir) {
    const pkg = join(dir, 'package.json');
    return existsSync(pkg) ? JSON.parse(readFileSync(pkg, 'utf8')).version ?? null : null;
}

let options;
try {
    options = parseArgs(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exit(2);
}

const manifest = JSON.parse(readFileSync(options.manifest, 'utf8'));
const version = upstreamVersion(options.upstream);
const changed = [];

for (const entry of manifest.files) {
    const path = join(options.upstream, entry.upstream);
    const status = !existsSync(path) ? 'missing' : sha256(path) === entry.sha256 ? 'unchanged' : 'changed';
    if (status !== 'unchanged') {
        changed.push({ ...entry, status });
    }
    if (options.accept && status === 'changed') {
        entry.sha256 = sha256(path);
    }
}

console.log(`Pinned ${manifest.version}; upstream checkout ${version ?? 'unknown version'}.`);
if (changed.length === 0) {
    console.log('No adapted upstream file changed.');
} else {
    for (const entry of changed) {
        console.log(`${entry.status.padEnd(8)} ${entry.upstream} → port into ${entry.vendored}`);
    }
}

if (options.accept) {
    if (changed.some((entry) => entry.status === 'missing')) {
        console.error('Not accepting: an upstream file is missing. Update the manifest by hand first.');
        process.exit(1);
    }
    if (version) {
        manifest.version = version;
    }
    writeFileSync(options.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Recorded upstream ${manifest.version} in ${options.manifest}.`);
    process.exit(0);
}

process.exit(changed.length === 0 ? 0 : 1);
