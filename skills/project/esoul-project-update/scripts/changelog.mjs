#!/usr/bin/env node
// Pure helpers for the project update skill: parse the app-templates CHANGELOG.md, pick the
// entries that concern one project, and compute the `commit` to record in .esoul/template.json.
// No network, no git: the agent feeds it file contents. Node 22, no dependencies.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HEADING = /^#{2,3}\s+(\d{4}-\d{2}-\d{2}):\s+(.+?)\s*$/;
const FENCE = /^\s*(```|~~~)/;
const STOPS = new Set(['skipped', 'conflict']);
const STATUSES = new Set(['applied', 'not-applicable', 'skipped', 'conflict']);

/**
 * Parse a CHANGELOG.md into entries in file order (newest first).
 *
 * Entry: {date, title, heading, affects: {raw, all, variants, layers}, migration, body}
 * - `body` is the whole text under the heading, `migration` the text after `Migration:`.
 * - `affects.variants` and `affects.layers` are the backticked names outside parentheses (the
 *   parentheses hold files); `all` is true for "every/all variants".
 *
 * @param {string} text
 */
export function parseChangelog(text) {
    const entries = [];
    let current = null;
    let fenced = false;

    for (const line of text.split(/\r?\n/)) {
        if (FENCE.test(line)) {
            fenced = !fenced;
        }
        const heading = fenced ? null : line.match(HEADING);
        if (heading) {
            current = { date: heading[1], title: heading[2], heading: line.trim(), lines: [] };
            entries.push(current);
        } else if (!fenced && /^#{1,3}\s/.test(line)) {
            current = null;
        } else if (current) {
            current.lines.push(line);
        }
    }

    return entries.map(({ lines, ...entry }) => ({
        ...entry,
        affects: parseAffects(lines),
        migration: parseMigration(lines),
        body: lines.join('\n').trim(),
    }));
}

function parseAffects(lines) {
    const start = lines.findIndex((line) => /^Affects:/.test(line));
    if (start === -1) {
        return { raw: '', all: false, variants: [], layers: [] };
    }
    const parts = [lines[start].replace(/^Affects:\s*/, '')];
    for (const line of lines.slice(start + 1)) {
        if (line.trim() === '' || /^Migration:/.test(line)) {
            break;
        }
        parts.push(line.trim());
    }
    const raw = parts.join(' ').trim();

    let plain = raw;
    for (let previous = ''; previous !== plain; ) {
        previous = plain;
        plain = plain.replace(/\([^()]*\)/g, ' ');
    }

    const result = { raw, all: false, variants: [], layers: [] };
    for (const group of plain.split(';')) {
        const [left, ...rest] = group.split(/\s\/\s/);
        const names = (part) => [...part.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
        if (rest.length > 0) {
            result.variants.push(...names(left));
            result.layers.push(...names(rest.join(' / ')));
        } else if (/^\s*layers?\b/i.test(left)) {
            result.layers.push(...names(left));
        } else {
            result.variants.push(...names(left));
        }
        result.all ||= /\b(?:every|all)\s+variants?\b/i.test(left);
    }
    result.variants = [...new Set(result.variants)];
    result.layers = [...new Set(result.layers)];
    return result;
}

function parseMigration(lines) {
    const start = lines.findIndex((line) => /^Migration:/.test(line));
    if (start === -1) {
        return null;
    }
    return [lines[start].replace(/^Migration:\s*/, ''), ...lines.slice(start + 1)].join('\n').trim();
}

/**
 * Whether an entry concerns a project: its `Affects:` names the variant or one of its layers,
 * or says "every variant". A superset on purpose: the agent confirms against the entry text.
 *
 * @param {ReturnType<typeof parseChangelog>[number]} entry
 * @param {{variant: string, layers: string[]}} project
 */
export function affectsProject(entry, { variant, layers }) {
    const { all, variants, layers: named } = entry.affects;
    return all || variants.includes(variant) || named.some((layer) => layers.includes(layer));
}

/**
 * Split entries into the ones that concern the project and the ones that do not, each of the
 * latter with the reason to show the user, so nothing is dropped silently.
 *
 * @returns {{selected: object[], notApplicable: {title: string, reason: string}[]}}
 */
export function selectEntries(entries, project) {
    const selected = [];
    const notApplicable = [];
    for (const entry of entries) {
        if (affectsProject(entry, project)) {
            selected.push(entry);
        } else {
            notApplicable.push({
                title: entry.title,
                reason: entry.affects.raw === ''
                    ? 'no Affects line'
                    : `Affects names neither ${project.variant} nor its layers: ${entry.affects.raw}`,
            });
        }
    }
    return { selected, notApplicable };
}

/**
 * Entries present in the head changelog but not in the base one, in file order. Identity is the
 * title: the date of an entry is corrected when its PR merges.
 */
export function entriesAddedAfter(baseText, headText) {
    const known = new Set(parseChangelog(baseText).map((entry) => entry.title));
    return parseChangelog(headText).filter((entry) => !known.has(entry.title));
}

/** Apply order: the oldest entry first (a changelog lists the newest first). */
export function applyOrder(entries) {
    return [...entries].reverse();
}

/** Layer names of a `variants/<variant>.json` of app-templates, in build order. */
export function variantLayers(variantJson) {
    const data = typeof variantJson === 'string' ? JSON.parse(variantJson) : variantJson;
    return data.layers.map((entry) => (typeof entry === 'string' ? entry : entry.layer));
}

/**
 * The `commit` to write into .esoul/template.json after a run.
 *
 * `entries` are in apply order (oldest first), each {title, commit, status}: `commit` is the
 * app-templates commit that added the entry, `status` one of applied, not-applicable, skipped,
 * conflict. The record advances over the leading run of entries that are done (applied or not
 * applicable) and stops at the first skipped or conflicting one, so the next run re-offers it and
 * everything after it. All done: `head`. Nothing done: `base` (unchanged, possibly null).
 *
 * @returns {{commit: string | null, reason: string, reoffered: string[]}}
 */
export function recordedCommit({ base = null, head, entries }) {
    for (const entry of entries) {
        if (!STATUSES.has(entry.status)) {
            throw new Error(`Entry "${entry.title}" has status "${entry.status}", expected ${[...STATUSES].join(', ')}.`);
        }
    }
    const stop = entries.findIndex((entry) => STOPS.has(entry.status));
    if (stop === -1) {
        if (!head) {
            throw new Error('Every entry is done, so the head commit of app-templates main is required.');
        }
        return { commit: head, reason: 'every entry is applied or not applicable: HEAD of app-templates main', reoffered: [] };
    }
    const reoffered = entries.slice(stop).map((entry) => entry.title);
    if (stop === 0) {
        return { commit: base, reason: `"${entries[0].title}" is ${entries[0].status}: the recorded commit stays`, reoffered };
    }
    const last = entries[stop - 1];
    if (!last.commit) {
        throw new Error(`Entry "${last.title}" has no commit; find it with git log -S on CHANGELOG.md.`);
    }
    return {
        commit: last.commit,
        reason: `last fully applied entry before "${entries[stop].title}" (${entries[stop].status}): "${last.title}"`,
        reoffered,
    };
}

const usage = `Usage:
  node changelog.mjs select --head CHANGELOG.md [--base OLD_CHANGELOG.md]
        --variant NAME (--layers a,b,c | --variant-file variants/NAME.json)
      Entries added after --base (all when omitted) that concern the project, oldest first,
      plus the not applicable ones with their reason. JSON on stdout.
  node changelog.mjs record PLAN.json
      PLAN.json: {"base": sha|null, "head": sha, "entries": [{"title", "commit", "status"}]}
      with entries oldest first and status applied | not-applicable | skipped | conflict.
      Prints {"commit", "reason", "reoffered"}.
`;

function main(argv) {
    const [command, ...rest] = argv;
    const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
            head: { type: 'string' },
            base: { type: 'string' },
            variant: { type: 'string' },
            layers: { type: 'string' },
            'variant-file': { type: 'string' },
        },
    });

    if (command === 'select') {
        if (!values.head || !values.variant || (!values.layers && !values['variant-file'])) {
            throw new Error(usage);
        }
        const head = readFileSync(values.head, 'utf8');
        const entries = values.base ? entriesAddedAfter(readFileSync(values.base, 'utf8'), head) : parseChangelog(head);
        const layers = values.layers ? values.layers.split(',').map((name) => name.trim()) : variantLayers(readFileSync(values['variant-file'], 'utf8'));
        const { selected, notApplicable } = selectEntries(applyOrder(entries), { variant: values.variant, layers });
        return { selected, notApplicable };
    }
    if (command === 'record' && positionals.length === 1) {
        return recordedCommit(JSON.parse(readFileSync(positionals[0], 'utf8')));
    }
    throw new Error(usage);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exit(2);
    }
}
