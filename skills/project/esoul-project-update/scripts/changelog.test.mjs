import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    affectsProject,
    applyOrder,
    entriesAddedAfter,
    parseChangelog,
    recordedCommit,
    selectEntries,
    variantLayers,
} from './changelog.mjs';

// Shapes copied from eSoul-cz/app-templates CHANGELOG.md (texts shortened).
const CHANGELOG = `# Changelog

Entry format:

\`\`\`markdown
### YYYY-MM-DD: short title

Affects: <variants> / <layers>
\`\`\`

## Unreleased

### 2026-11-23: Astro projects run \`esoul-guidelines\` without PHP

Affects: \`astro-static\`, \`astro-ssr\` / layers \`astro/static\`, \`astro/ssr\` (\`README.md\`, \`Jenkinsfile\`); \`astro-cms\` / layer \`astro-cms/root\` (\`README.md\`).

The Astro layers have no Composer dependency.

Migration: add the \`Guidelines\` item to \`extraChecks\`.
Run \`check\` once first.

### 2026-11-23: Render guidelines 0.3.2

Affects: every variant / every layer that renders the guidelines; the builder.

The builder renders with \`esoul-cz/guidelines\` v0.3.2.

Migration: run \`esoul-guidelines sync\` once (after \`composer update esoul-cz/guidelines\`).

### 2026-11-23: LSR runs PHPStan at level 10

Affects: \`lsr-inertia\` / layer \`lsr/base\` (\`phpstan.neon\`, \`include/constants.php\`).

Level 10.

Migration: none.

### 2026-11-23: \`Money::proportion()\`

Affects: \`laravel-inertia\`, \`laravel-filament\` (and the backend of \`laravel-cms\`) / layer \`laravel/base\` (\`app/Domain/ValueObjects/Money.php\`).

Migration: none.

### 2026-11-23: The Laravel skeleton is re-synced

Affects: layer \`laravel/skeleton\` (no variant output changes).

Migration: none.

### 2026-11-23: The builder repository adopts the guidelines

Affects: the builder only (\`esoul-guidelines.json\`, \`composer.json\`).

Migration: none.

### 2026-11-23: Split of the CMS variants

Affects: variants \`laravel-cms\` (new), \`astro-static\` (new); variant \`astro-laravel-cms\` is removed /
layers \`astro/static\`, \`laravel/cms\`, \`variants/*.json\`.
Migration: copy the new files.

## 2026-11-18: Node 26 and the latest pnpm everywhere

Affects: all variants with a Node toolchain (\`laravel-inertia\`, \`astro-static\`).

- A bullet.

Migration: bump Node.
`;

const OLD = `# Changelog

## Unreleased

### 2026-11-23: LSR runs PHPStan at level 10

Affects: \`lsr-inertia\` / layer \`lsr/base\`.

Migration: none.

## 2026-11-18: Node 26 and the latest pnpm everywhere

Affects: all variants.

Migration: bump Node.
`;

const byTitle = (entries, part) => entries.find((entry) => entry.title.includes(part));

test('parses entries newest first, in both heading levels, skipping the format example', () => {
    const entries = parseChangelog(CHANGELOG);
    assert.equal(entries.length, 8);
    assert.equal(entries[0].date, '2026-11-23');
    assert.equal(entries[0].title, 'Astro projects run `esoul-guidelines` without PHP');
    assert.equal(entries[7].heading, '## 2026-11-18: Node 26 and the latest pnpm everywhere');
    assert.ok(entries.every((entry) => !entry.title.includes('short title')));
});

test('reads the Affects line, also when it wraps onto the Migration line', () => {
    const entries = parseChangelog(CHANGELOG);

    assert.deepEqual(byTitle(entries, 'Astro projects').affects.variants, ['astro-static', 'astro-ssr', 'astro-cms']);
    assert.deepEqual(byTitle(entries, 'Astro projects').affects.layers, ['astro/static', 'astro/ssr', 'astro-cms/root']);

    const split = byTitle(entries, 'Split of the CMS').affects;
    assert.deepEqual(split.variants, ['laravel-cms', 'astro-static', 'astro-laravel-cms']);
    assert.deepEqual(split.layers, ['astro/static', 'laravel/cms', 'variants/*.json']);
    assert.equal(byTitle(entries, 'Split of the CMS').migration, 'copy the new files.');

    const everything = byTitle(entries, 'Render guidelines').affects;
    assert.equal(everything.all, true);
    assert.deepEqual(everything.variants, []);

    // Parenthetical names (files, "and the backend of ...") are not variants.
    assert.deepEqual(byTitle(entries, 'Money').affects.variants, ['laravel-inertia', 'laravel-filament']);
    assert.deepEqual(byTitle(entries, 'skeleton').affects.layers, ['laravel/skeleton']);
    assert.deepEqual(byTitle(entries, 'skeleton').affects.variants, []);
});

test('keeps a multi-line Migration and the full body', () => {
    const entry = byTitle(parseChangelog(CHANGELOG), 'Astro projects');
    assert.equal(entry.migration, 'add the `Guidelines` item to `extraChecks`.\nRun `check` once first.');
    assert.match(entry.body, /^Affects:/);
    assert.match(entry.body, /Migration:/);
    assert.equal(byTitle(parseChangelog(CHANGELOG), 'Node 26').migration, 'bump Node.');
});

test('selects by variant or layer, and explains every entry that is not selected', () => {
    const entries = parseChangelog(CHANGELOG);

    const laravel = selectEntries(entries, { variant: 'laravel-filament', layers: ['common', 'laravel/skeleton', 'laravel/base', 'laravel/filament'] });
    assert.deepEqual(
        laravel.selected.map((entry) => entry.title),
        [
            'Render guidelines 0.3.2',
            '`Money::proportion()`',
            'The Laravel skeleton is re-synced',
            'Node 26 and the latest pnpm everywhere',
        ],
    );
    assert.equal(laravel.selected.length + laravel.notApplicable.length, entries.length);
    const builder = laravel.notApplicable.find((item) => item.title.includes('builder repository'));
    assert.match(builder.reason, /laravel-filament/);
    assert.match(builder.reason, /the builder only/);

    // A layer match without a variant match: laravel-cms builds laravel/base.
    const cms = selectEntries(entries, { variant: 'laravel-cms', layers: ['common', 'laravel/base', 'laravel/cms'] });
    assert.ok(cms.selected.some((entry) => entry.title === '`Money::proportion()`'));
    assert.ok(cms.selected.some((entry) => entry.title.startsWith('Split of the CMS')));
    assert.ok(!cms.selected.some((entry) => entry.title.includes('LSR')));

    const astro = entries.filter((entry) => affectsProject(entry, { variant: 'astro-ssr', layers: ['common', 'astro/ssr'] }));
    assert.ok(astro.some((entry) => entry.title.startsWith('Astro projects')));
});

test('entries added after a base are found by title, whatever their date', () => {
    const added = entriesAddedAfter(OLD, CHANGELOG);
    assert.equal(added.length, 6);
    assert.ok(!added.some((entry) => entry.title.includes('PHPStan')));
    assert.ok(!added.some((entry) => entry.title.includes('Node 26')));

    const redated = OLD.replace('### 2026-11-23: LSR runs', '### 2026-11-22: LSR runs');
    assert.equal(entriesAddedAfter(redated, CHANGELOG).length, 6);
    assert.equal(entriesAddedAfter('', CHANGELOG).length, 8);
});

test('applyOrder puts the oldest entry first without mutating the input', () => {
    const entries = parseChangelog(CHANGELOG);
    const ordered = applyOrder(entries);
    assert.equal(ordered[0].title, 'Node 26 and the latest pnpm everywhere');
    assert.equal(entries[0].title.startsWith('Astro projects'), true);
});

test('variantLayers reads the layer names of a variant file', () => {
    const json = '{"name": "laravel-filament", "layers": [{"layer": "common"}, {"layer": "laravel/base"}, {"layer": "laravel/cms", "into": "backend"}]}';
    assert.deepEqual(variantLayers(json), ['common', 'laravel/base', 'laravel/cms']);
});

const plan = (statuses) =>
    statuses.map((status, index) => ({ title: `entry ${index + 1}`, commit: `c${index + 1}`, status }));

test('records HEAD when every entry is applied or not applicable', () => {
    const result = recordedCommit({ base: 'b0', head: 'h9', entries: plan(['applied', 'not-applicable', 'applied']) });
    assert.equal(result.commit, 'h9');
    assert.deepEqual(result.reoffered, []);
    assert.equal(recordedCommit({ base: 'b0', head: 'h9', entries: [] }).commit, 'h9');
});

test('records the last fully applied entry before the first skipped or conflicting one', () => {
    const skipped = recordedCommit({ base: 'b0', head: 'h9', entries: plan(['applied', 'applied', 'skipped', 'applied']) });
    assert.equal(skipped.commit, 'c2');
    assert.deepEqual(skipped.reoffered, ['entry 3', 'entry 4']);

    // Never a later entry, even when it was applied.
    const conflict = recordedCommit({ base: 'b0', head: 'h9', entries: plan(['applied', 'conflict', 'applied', 'applied']) });
    assert.equal(conflict.commit, 'c1');
    assert.match(conflict.reason, /entry 2/);

    // Entries that do not concern the project before the stop count as passed.
    const passed = recordedCommit({ base: 'b0', head: 'h9', entries: plan(['not-applicable', 'applied', 'skipped']) });
    assert.equal(passed.commit, 'c2');
});

test('keeps the recorded commit when the first entry is not applied', () => {
    assert.equal(recordedCommit({ base: 'b0', head: 'h9', entries: plan(['conflict', 'applied']) }).commit, 'b0');
    assert.equal(recordedCommit({ base: null, head: 'h9', entries: plan(['skipped']) }).commit, null);
});

test('rejects unknown statuses and a missing commit', () => {
    assert.throws(() => recordedCommit({ head: 'h', entries: plan(['done']) }), /status "done"/);
    assert.throws(() => recordedCommit({ head: 'h', entries: [{ title: 'x', status: 'applied' }, { title: 'y', commit: 'c', status: 'skipped' }] }), /no commit/);
    assert.throws(() => recordedCommit({ head: '', entries: plan(['applied']) }), /head commit/);
});

test('the CLI selects and records', () => {
    const script = fileURLToPath(new URL('./changelog.mjs', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
    writeFileSync(join(dir, 'head.md'), CHANGELOG);
    writeFileSync(join(dir, 'base.md'), OLD);
    writeFileSync(join(dir, 'variant.json'), '{"name": "lsr-inertia", "layers": [{"layer": "common"}, {"layer": "lsr/base"}]}');

    const selected = spawnSync(
        process.execPath,
        [script, 'select', '--head', join(dir, 'head.md'), '--base', join(dir, 'base.md'), '--variant', 'lsr-inertia', '--variant-file', join(dir, 'variant.json')],
        { encoding: 'utf8' },
    );
    assert.equal(selected.status, 0, selected.stderr);
    const output = JSON.parse(selected.stdout);
    assert.deepEqual(output.selected.map((entry) => entry.title), ['Render guidelines 0.3.2']);
    assert.equal(output.notApplicable.length, 5);

    writeFileSync(join(dir, 'plan.json'), JSON.stringify({ base: 'b0', head: 'h9', entries: plan(['applied', 'skipped']) }));
    const recorded = spawnSync(process.execPath, [script, 'record', join(dir, 'plan.json')], { encoding: 'utf8' });
    assert.equal(recorded.status, 0, recorded.stderr);
    assert.equal(JSON.parse(recorded.stdout).commit, 'c1');

    const bad = spawnSync(process.execPath, [script, 'select'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /Usage/);
});
