#!/usr/bin/env node
// Pure helpers for the project update skill: parse the app-templates CHANGELOG.md, pick the
// entries that concern one project, and compute the `commit` to record in .esoul/template.json.
// No network, no git: the agent feeds it file contents. Node 22, no dependencies.
import { readFileSync, writeFileSync } from 'node:fs';
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
 * Split entries into the ones the project declined (its `declined` list in .esoul/template.json),
 * the ones that concern it and the ones that do not, each of the latter with the reason to show
 * the user, so nothing is dropped silently. `order` lists every entry, oldest first, with its
 * kind: the agent needs the commit of each one to compute the deltas.
 *
 * @param {{title: string, reason: string}[]} declined
 * @returns {{selected: object[], notApplicable: {title: string, reason: string}[], declined: {title: string, reason: string}[], order: {title: string, kind: string}[]}}
 */
export function selectEntries(entries, project, declined = []) {
    const declinedReasons = new Map(declined.map((item) => [item.title, item.reason]));
    const selected = [];
    const notApplicable = [];
    const skippedOnPurpose = [];
    const order = [];
    for (const entry of entries) {
        if (declinedReasons.has(entry.title)) {
            skippedOnPurpose.push({ title: entry.title, reason: declinedReasons.get(entry.title) });
            order.push({ title: entry.title, kind: 'declined' });
        } else if (affectsProject(entry, project)) {
            selected.push(entry);
            order.push({ title: entry.title, kind: 'selected' });
        } else {
            notApplicable.push({
                title: entry.title,
                reason: entry.affects.raw === ''
                    ? 'no Affects line'
                    : `Affects names neither ${project.variant} nor its layers: ${entry.affects.raw}`,
            });
            order.push({ title: entry.title, kind: 'not-applicable' });
        }
    }
    return { selected, notApplicable, declined: skippedOnPurpose, order };
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
 * The `declined` list of a parsed .esoul/template.json: `[{title, reason}]`, empty when the key is
 * absent. A malformed list throws, so a hand edit that would silently re-offer entries is caught.
 */
export function parseDeclined(record) {
    const list = record?.declined ?? [];
    if (!Array.isArray(list)) {
        throw new Error('.esoul/template.json: "declined" must be a list of {"title", "reason"}.');
    }
    for (const item of list) {
        for (const key of ['title', 'reason']) {
            if (typeof item?.[key] !== 'string' || item[key].trim() === '') {
                throw new Error(`.esoul/template.json: every "declined" item needs a non-empty "${key}": ${JSON.stringify(item)}`);
            }
        }
    }
    return list.map(({ title, reason }) => ({ title, reason }));
}

/**
 * The "unlisted changes" entry: changes to the variant after the newest changelog entry. `delta`
 * is the output of `git diff --name-status -M <state of that entry> <state of head>` in the
 * template clone; empty means nothing is unlisted and the result is null.
 *
 * @returns {{title: string, commit: string, files: {status: string, path: string, from?: string}[]} | null}
 */
export function unlistedChanges({ head, delta }) {
    const files = delta
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '')
        .map((line) => {
            const [status, first, second] = line.split('\t');
            return second === undefined ? { status, path: first } : { status, from: first, path: second };
        });
    if (files.length === 0) {
        return null;
    }
    return { title: `Unlisted changes up to ${head.slice(0, 7)}`, commit: head, files };
}

/**
 * The new content of .esoul/template.json: the recorded `commit` replaced (kept when the run
 * recorded none) and the titles declined in this run added to `declined`. Other keys stay.
 */
export function updatedRecord(record, { commit, declined = [] }) {
    const known = parseDeclined(record);
    const added = declined.filter((item) => !known.some((existing) => existing.title === item.title));
    return {
        ...record,
        ...(commit === null || commit === undefined ? {} : { commit }),
        declined: [...known, ...parseDeclined({ declined: added })],
    };
}

/**
 * The `commit` to write into .esoul/template.json after a run.
 *
 * `entries` are in apply order (oldest first), each {title, commit, status}: `commit` is the
 * app-templates commit that added the entry, `status` one of applied, not-applicable, skipped,
 * conflict. The record advances over the leading run of entries that are done (applied or not
 * applicable) and stops at the first skipped or conflicting one, so the next run re-offers it and
 * everything after it. Declined entries and entries that do not concern the project are not part
 * of `entries`. All done: `head`. Nothing done: `base` (unchanged, possibly null).
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
        --variant NAME (--layers a,b,c | --variant-file variants/NAME.json) [--template .esoul/template.json]
      Entries added after --base (all when omitted) that concern the project, oldest first, plus
      the declined ones (the "declined" list of --template), the not applicable ones with their
      reason, and "order": every added entry, oldest first, with its kind. JSON on stdout.
  node changelog.mjs unlisted --commit SHA --delta NAME_STATUS.txt
      NAME_STATUS.txt: git diff --name-status -M <state of the newest entry> <state of head> in the
      template clone. Prints {"entry": null} or {"entry": {title, commit, files}}.
  node changelog.mjs record PLAN.json [--template .esoul/template.json]
      PLAN.json: {"base": sha|null, "head": sha, "entries": [{"title", "commit", "status"}],
      "declined": [{"title", "reason"}]} with entries oldest first and status applied |
      not-applicable | skipped | conflict; "declined" holds the titles declined in this run.
      Prints {"commit", "reason", "reoffered"}; with --template the file is rewritten with the
      new commit and the extended declined list.
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
            template: { type: 'string' },
            delta: { type: 'string' },
            commit: { type: 'string' },
        },
    });

    if (command === 'select') {
        if (!values.head || !values.variant || (!values.layers && !values['variant-file'])) {
            throw new Error(usage);
        }
        const head = readFileSync(values.head, 'utf8');
        const entries = values.base ? entriesAddedAfter(readFileSync(values.base, 'utf8'), head) : parseChangelog(head);
        const layers = values.layers ? values.layers.split(',').map((name) => name.trim()) : variantLayers(readFileSync(values['variant-file'], 'utf8'));
        const declined = values.template ? parseDeclined(JSON.parse(readFileSync(values.template, 'utf8'))) : [];
        return selectEntries(applyOrder(entries), { variant: values.variant, layers }, declined);
    }
    if (command === 'unlisted' && values.commit && values.delta) {
        return { entry: unlistedChanges({ head: values.commit, delta: readFileSync(values.delta, 'utf8') }) };
    }
    if (command === 'record' && positionals.length === 1) {
        const plan = JSON.parse(readFileSync(positionals[0], 'utf8'));
        const result = recordedCommit(plan);
        if (values.template) {
            const record = JSON.parse(readFileSync(values.template, 'utf8'));
            const updated = updatedRecord(record, { commit: result.commit, declined: plan.declined ?? [] });
            writeFileSync(values.template, `${JSON.stringify(updated, null, 4)}\n`);
        }
        return result;
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
