#!/usr/bin/env node
// Read-only conformance check of an eSoul project against the esoul-project-lifecycle standard.
//
// Usage: node scripts/conformance.mjs <project-root> [--tier full|light] [--github owner/repo] [--json]
//
// Checks required files, CONTEXT.md sections, leftover {{PLACEHOLDERS}}, broken relative links,
// ADR index consistency, slice IDs and, with --github, issues and repository merge settings.
//
// Node >= 20, no dependencies. Never writes to the project, GitHub or Freelo. Exit code 1 when
// any error is found, 2 on invalid usage, 0 otherwise.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const REQUIRED_FILES = Object.freeze({
    full: [
        'AGENTS.md',
        'CLAUDE.md',
        'CONTEXT.md',
        'GLOSSARY.md',
        'CONTRIBUTING.md',
        // GitHub reads CODEOWNERS from any of these locations.
        ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS'],
        '.coderabbit.yaml',
        '.github/ISSUE_TEMPLATE/task.yml',
        '.github/ISSUE_TEMPLATE/bug.yml',
        '.github/PULL_REQUEST_TEMPLATE.md',
        'Jenkinsfile',
        'docs/podklady/README.md',
        'docs/podklady/otevrene-otazky.md',
        'docs/adr/index.md',
        'docs/adr/0000-template.md',
        'docs/plan/README.md',
        'docs/plan/seznam-slices.md',
        'docs/project_guidelines/index.md',
    ],
    light: [
        ['AGENTS.md', 'CLAUDE.md'],
        'CONTEXT.md',
        '.coderabbit.yaml',
        'Jenkinsfile',
        'docs/sitemap-a-meta.md',
        'docs/rozhodnuti.md',
        'docs/plan.md',
        'docs/nasazeni.md',
        'docs/obsah-novy-web.md',
        'docs/design-log.md',
        '.github/PULL_REQUEST_TEMPLATE.md',
    ],
});

export const CONTEXT_SECTIONS = Object.freeze({
    full: ['Project profile', 'Freelo', 'Tasking convention', 'Commit convention'],
    light: ['Project profile', 'Freelo', 'Tasking convention'],
});

export const CATEGORY_LABELS = Object.freeze([
    'frontend', 'backend', 'data-migration', 'infrastructure', 'documentation', 'integration', 'bug',
]);

const TIERS = ['full', 'light'];
const STACKS = /^(laravel|medusa-nuxt|astro|other:[\w.-]+)$/;
const ARCHETYPES = ['A-static', 'B-admin', 'C-headless'];
const TASKING_MODES = ['github-freelo', 'freelo-only'];
const ADR_STATUS = /^(proposed|accepted|deprecated|superseded by adr-\d{4})$/i;
const ADR_STATUS_LOOSE = /^(proposed|accepted|deprecated|rejected|superseded by adr-\d{4})\b/i;
// Slice IDs are `<phase code>-<nn>`: F1-17, M1-05, NT-02, PR-01.
const SLICE_ID = /^[A-Z][A-Z0-9]*-\d+$/;
const OTHER_ID = /^[A-Z][A-Z0-9]*\d*-\d+$/;
const PLACEHOLDER = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const ANY_MUSTACHE = /\{\{/g;
const SKIP_SEGMENTS = new Set(['node_modules', 'vendor']);
const SCANNED_EXT = /\.(md|markdown|ya?ml)$/i;
// Extensionless project files that templates also fill.
const SCANNED_NAMES = /(^|\/)(CODEOWNERS|Jenkinsfile)$/;
const SHARED_ACCOUNT = 'esoul-cz-user';

// ---------------------------------------------------------------------------------------------
// Small helpers

class Findings {
    constructor() {
        this.items = [];
    }

    add(severity, code, message, file = null) {
        this.items.push({ severity, code, message, file });
    }

    error(code, message, file) {
        this.add('error', code, message, file);
    }

    warn(code, message, file) {
        this.add('warning', code, message, file);
    }

    info(code, message, file) {
        this.add('info', code, message, file);
    }
}

function readText(root, rel) {
    const full = path.join(root, rel);
    try {
        if (!statSync(full).isFile()) return null;
        return readFileSync(full, 'utf8').replace(/^﻿/, '');
    } catch {
        return null;
    }
}

function exists(root, rel) {
    return existsSync(path.join(root, rel));
}

export function listSome(values, limit = 15) {
    const shown = values.slice(0, limit).join(', ');
    return values.length > limit ? `${shown} (+${values.length - limit} more)` : shown;
}

function stripMarkdown(cell) {
    return cell
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[`*_]/g, '')
        .trim();
}

/** Splits a Markdown document into `## ` sections, ignoring headings inside code fences. */
export function sections(markdown) {
    const result = new Map();
    let current = null;
    let fence = null;
    for (const line of markdown.split(/\r?\n/)) {
        const fenceMatch = line.match(/^\s*(```|~~~)/);
        if (fenceMatch) {
            if (fence === null) fence = fenceMatch[1];
            else if (fence === fenceMatch[1]) fence = null;
        }
        const heading = fence === null ? line.match(/^##\s+(.+?)\s*#*\s*$/) : null;
        if (heading && !line.startsWith('###')) {
            current = heading[1].trim();
            if (!result.has(current)) result.set(current, []);
            continue;
        }
        if (/^#\s/.test(line) && fence === null) {
            current = null;
            continue;
        }
        if (current !== null) result.get(current).push(line);
    }
    return result;
}

function findSection(sectionMap, name) {
    for (const [title, lines] of sectionMap) {
        if (title.toLowerCase() === name.toLowerCase()) return lines;
    }
    return null;
}

/** Reads `- Key: value` lines; the value is the first backticked span, else the text before a comment. */
export function parseKeyValues(lines) {
    const values = {};
    for (const line of lines) {
        const match = line.match(/^\s*[-*]\s+([^:]+):\s*(.*)$/);
        if (!match) continue;
        const raw = match[2];
        const ticked = raw.match(/`([^`]*)`/);
        const value = ticked ? ticked[1] : raw.replace(/<!--.*$/, '').replace(/\s+#\s.*$/, '');
        values[match[1].trim().toLowerCase()] = value.trim();
    }
    return values;
}

/** Parses Markdown tables into { header, rows } where every row keeps its raw line. */
export function parseTables(markdown) {
    const tables = [];
    const lines = markdown.split(/\r?\n/);
    const split = (line) => {
        const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/);
        return cells.map((cell) => cell.trim());
    };
    for (let i = 0; i < lines.length; i += 1) {
        const next = lines[i + 1];
        if (!lines[i].trim().startsWith('|') || !next || !/^\s*\|?\s*:?-{3,}/.test(next)) continue;
        const table = { header: split(lines[i]).map(stripMarkdown), rows: [], line: i + 1 };
        i += 2;
        while (i < lines.length && lines[i].trim().startsWith('|')) {
            table.rows.push({ cells: split(lines[i]), raw: lines[i], line: i + 1 });
            i += 1;
        }
        i -= 1;
        tables.push(table);
    }
    return tables;
}

// ---------------------------------------------------------------------------------------------
// Profile

export function readProfile(root, findings, tierFlag) {
    const context = readText(root, 'CONTEXT.md');
    const profile = { tier: null, tierSource: null, stack: null, archetype: null, taskingMode: null };
    let profileLines = null;
    let sectionMap = new Map();

    if (context !== null) {
        sectionMap = sections(context);
        profileLines = findSection(sectionMap, 'Project profile');
        const tasking = findSection(sectionMap, 'Tasking convention');
        if (tasking) profile.taskingMode = parseKeyValues(tasking).mode ?? null;
    }

    if (profileLines) {
        const values = parseKeyValues(profileLines);
        profile.stack = values.stack ?? null;
        profile.archetype = values.archetype ?? null;
        const recorded = values['process tier'] ?? null;
        if (recorded && TIERS.includes(recorded)) {
            profile.tier = recorded;
            profile.tierSource = 'CONTEXT.md';
        } else if (recorded && !recorded.includes('{{')) {
            findings.error('profile-tier', `Process tier \`${recorded}\` is not one of: ${TIERS.join(', ')}.`, 'CONTEXT.md');
        }
        if (profile.stack && !profile.stack.includes('{{') && !STACKS.test(profile.stack)) {
            findings.warn('profile-stack', `Stack \`${profile.stack}\` is not laravel, medusa-nuxt, astro or other:<name>.`, 'CONTEXT.md');
        }
        if (profile.stack === 'astro' && !ARCHETYPES.includes(profile.archetype ?? '')) {
            findings.warn('profile-archetype', `Astro project without an archetype (${ARCHETYPES.join(' | ')}).`, 'CONTEXT.md');
        }
        if (!values['uat dimensions'] && (profile.tier ?? 'full') === 'full') {
            findings.warn('profile-uat', 'Project profile does not list UAT dimensions.', 'CONTEXT.md');
        }
    } else {
        findings.warn(
            'profile-missing',
            context === null
                ? 'CONTEXT.md is missing, so the project profile is unknown.'
                : 'CONTEXT.md has no `## Project profile` section.',
            'CONTEXT.md',
        );
    }

    if (tierFlag) {
        if (profile.tier && profile.tier !== tierFlag) {
            findings.info('tier-override', `--tier ${tierFlag} overrides the recorded tier \`${profile.tier}\`.`, 'CONTEXT.md');
        }
        profile.tier = tierFlag;
        profile.tierSource = '--tier';
    } else if (!profile.tier) {
        profile.tier = 'full';
        profile.tierSource = 'default';
        findings.warn('tier-default', 'No process tier recorded; checked as `full`.', 'CONTEXT.md');
    }

    if (profile.taskingMode && !profile.taskingMode.includes('{{') && !TASKING_MODES.includes(profile.taskingMode)) {
        findings.warn('tasking-mode', `Tasking mode \`${profile.taskingMode}\` is not ${TASKING_MODES.join(' or ')}.`, 'CONTEXT.md');
    }

    return { profile, context, sectionMap };
}

// ---------------------------------------------------------------------------------------------
// Files and CONTEXT sections

export function checkRequiredFiles(root, tier, findings) {
    for (const entry of REQUIRED_FILES[tier]) {
        const options = Array.isArray(entry) ? entry : [entry];
        if (!options.some((rel) => exists(root, rel))) {
            findings.error('missing-file', `Required ${tier}-tier file is missing.`, options.join(' or '));
        }
    }
}

export function checkContext(context, sectionMap, tier, findings) {
    if (context === null) return;
    for (const name of CONTEXT_SECTIONS[tier]) {
        if (name === 'Project profile') continue; // reported by readProfile
        if (!findSection(sectionMap, name)) {
            const report = tier === 'full' ? findings.error.bind(findings) : findings.warn.bind(findings);
            report('context-section', `CONTEXT.md has no \`## ${name}\` section.`, 'CONTEXT.md');
        }
    }
    if (/_Avoid_\s*:/.test(context)) {
        findings.warn('glossary-in-context', 'CONTEXT.md contains glossary entries (`_Avoid_:`); domain language belongs in GLOSSARY.md (company rule: CONTEXT.md vs GLOSSARY.md).', 'CONTEXT.md');
    }
}

// ---------------------------------------------------------------------------------------------
// Placeholders

function isSkipped(rel) {
    const parts = rel.split('/');
    if (parts[0] === '.agents') return true;
    return parts.some((part) => SKIP_SEGMENTS.has(part));
}

function walk(root, rel = '', out = []) {
    let entries;
    try {
        entries = readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        const child = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.name === '.git' || isSkipped(child)) continue;
        if (entry.isDirectory()) walk(root, child, out);
        else if (entry.isFile()) out.push(child);
    }
    return out;
}

export function trackedFiles(root, findings) {
    const result = spawnSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (result.status === 0) return result.stdout.split('\0').filter(Boolean);
    findings.info('not-git', 'Not a git work tree; scanned all files on disk instead of `git ls-files`.');
    return walk(root);
}

export function checkPlaceholders(root, files, findings) {
    const otherMustache = [];
    for (const rel of files) {
        if (!(SCANNED_EXT.test(rel) || SCANNED_NAMES.test(rel)) || isSkipped(rel)) continue;
        const full = path.join(root, rel);
        let text;
        try {
            const stat = statSync(full);
            if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
            text = readFileSync(full, 'utf8');
        } catch {
            continue;
        }
        if (!text.includes('{{')) continue;
        const names = new Map();
        const lines = text.split(/\r?\n/);
        lines.forEach((line, index) => {
            for (const match of line.matchAll(PLACEHOLDER)) {
                if (!names.has(match[1])) names.set(match[1], index + 1);
            }
        });
        if (names.size > 0) {
            const detail = [...names].map(([name, line]) => `{{${name}}} (line ${line})`);
            findings.error('placeholder', `Unfilled template placeholders: ${listSome(detail, 8)}.`, rel);
        }
        const total = (text.match(ANY_MUSTACHE) ?? []).length;
        const placeholders = (text.match(PLACEHOLDER) ?? []).length;
        if (total > placeholders) otherMustache.push(rel);
    }
    if (otherMustache.length > 0) {
        findings.info('mustache', `Other \`{{\` syntax (code samples, Actions expressions) in ${otherMustache.length} file(s), not treated as placeholders: ${listSome(otherMustache, 6)}.`);
    }
}

// ---------------------------------------------------------------------------------------------
// Relative links

// Per-item templates (`_poznamka.md`, `0000-template.md`) link to example targets by design.
const LINK_TEMPLATE_FILE = /(^|\/)(_[^/]*|0000-template)\.md$/;
const MARKDOWN_LINK = /\]\(([^)\s]+)\)/g;

export function checkLinks(root, files, findings) {
    const broken = [];
    for (const rel of files) {
        if (!/\.md$/i.test(rel) || isSkipped(rel) || LINK_TEMPLATE_FILE.test(rel)) continue;
        if (rel.includes('/') && !rel.startsWith('docs/')) continue;
        const text = (readText(root, rel) ?? '').replace(/```[\s\S]*?```/g, '').replace(/<!--[\s\S]*?-->/g, '');
        for (const match of text.matchAll(MARKDOWN_LINK)) {
            const target = match[1].split('#')[0];
            if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes('{{')) continue;
            const resolved = path.normalize(path.join(path.dirname(rel), decodeURI(target)));
            if (!existsSync(path.join(root, resolved))) broken.push(`${rel} → ${target}`);
        }
    }
    if (broken.length > 0) {
        findings.warn('broken-link', `${broken.length} relative link(s) point to missing files (adapt copied templates to this tier and stack): ${listSome(broken, 10)}.`);
    }
}

// ---------------------------------------------------------------------------------------------
// ADRs

export function parseFrontmatter(text) {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/);
    if (!match) return null;
    const data = {};
    for (const line of match[1].split(/\r?\n/)) {
        const kv = line.match(/^([\w-]+):\s*(.*)$/);
        if (kv) data[kv[1].toLowerCase()] = kv[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return data;
}

const normalizeStatus = (status) => stripMarkdown(status).replace(/\s+/g, ' ').toLowerCase();

export function checkAdrs(root, findings) {
    const dir = path.join(root, 'docs/adr');
    if (!existsSync(dir)) return;
    const files = readdirSync(dir).filter((name) => /^\d{4}-.+\.md$/.test(name)).sort();
    const byNumber = new Map();
    const adrs = new Map();

    for (const name of files) {
        const number = name.slice(0, 4);
        if (!byNumber.has(number)) byNumber.set(number, []);
        byNumber.get(number).push(name);
        if (number === '0000') continue;
        const rel = `docs/adr/${name}`;
        const text = readText(root, rel) ?? '';
        const frontmatter = parseFrontmatter(text);
        const status = frontmatter?.status ? normalizeStatus(frontmatter.status) : null;
        if (!status) {
            findings.error('adr-status', 'ADR has no `status` in its YAML frontmatter.', rel);
        } else if (!ADR_STATUS.test(status)) {
            findings.warn('adr-status', `ADR status \`${status}\` is not proposed, accepted, superseded by ADR-NNNN or deprecated.`, rel);
        }
        const superseded = status?.match(/superseded by adr-(\d{4})/);
        if (superseded && !files.some((file) => file.startsWith(`${superseded[1]}-`))) {
            findings.warn('adr-superseded', `Superseding ADR-${superseded[1]} does not exist.`, rel);
        }
        adrs.set(name, { number, rel, status, text });
    }

    for (const [number, names] of byNumber) {
        if (names.length > 1) {
            findings.error('adr-duplicate', `ADR number ${number} is used by ${names.length} files: ${names.join(', ')}.`, 'docs/adr/');
        }
    }

    const missingImplementation = [...adrs.entries()]
        .filter(([, adr]) => adr.status === 'accepted' && !/^##\s+Implementation status/im.test(adr.text))
        .map(([, adr]) => adr.number);
    if (missingImplementation.length > 0) {
        findings.warn('adr-implementation', `${missingImplementation.length} accepted ADR(s) lack \`## Implementation status\` (company rule: ADRs): ${listSome(missingImplementation)}.`, 'docs/adr/');
    }

    const index = readText(root, 'docs/adr/index.md');
    if (index === null) return;
    const listed = new Map();
    for (const table of parseTables(index)) {
        for (const row of table.rows) {
            const link = row.raw.match(/\]\(\.?\/?([^)\s#]*?(\d{4})-[^)\s#/]*\.md)(#[^)]*)?\)/);
            if (!link) continue;
            const name = path.posix.basename(link[1]);
            const statusCell = row.cells.slice(1).map(normalizeStatus).filter((cell) => ADR_STATUS_LOOSE.test(cell)).pop() ?? null;
            if (listed.has(name)) {
                findings.warn('adr-index-duplicate', `${name} is listed more than once in the index table.`, 'docs/adr/index.md');
            }
            listed.set(name, { status: statusCell, line: row.line });
        }
    }

    const unlisted = [];
    for (const [name, adr] of adrs) {
        const entry = listed.get(name);
        if (!entry) {
            unlisted.push(adr.number);
            continue;
        }
        if (!entry.status) {
            findings.error('adr-index-status', `Index row for ${name} (line ${entry.line}) has no status.`, 'docs/adr/index.md');
        } else if (adr.status && entry.status.replace(/\s+/g, ' ') !== adr.status) {
            findings.error('adr-index-mismatch', `${name}: frontmatter says \`${adr.status}\`, index says \`${entry.status}\`.`, 'docs/adr/index.md');
        }
    }
    if (unlisted.length > 0) {
        findings.error('adr-index-missing', `${unlisted.length} ADR(s) are not in the index table: ${listSome(unlisted)}.`, 'docs/adr/index.md');
    }
    for (const [name, entry] of listed) {
        if (!name.startsWith('0000-') && !adrs.has(name)) {
            findings.error('adr-index-dangling', `Index row (line ${entry.line}) links ${name}, which does not exist.`, 'docs/adr/index.md');
        }
    }

    findings.info('adr-summary', `${adrs.size} ADR(s), ${listed.size} index row(s).`, 'docs/adr/');
}

// ---------------------------------------------------------------------------------------------
// Slices

function issueNumbers(text) {
    const numbers = new Set();
    for (const match of text.matchAll(/\/issues\/(\d+)/g)) numbers.add(Number(match[1]));
    for (const match of text.matchAll(/(?<![\w&/])#(\d+)\b/g)) {
        const before = text.slice(Math.max(0, match.index - 4), match.index);
        if (!/PR\s?$/i.test(before)) numbers.add(Number(match[1]));
    }
    return [...numbers];
}

export function findSliceFile(root) {
    if (exists(root, 'docs/plan/seznam-slices.md')) return 'docs/plan/seznam-slices.md';
    const dir = path.join(root, 'docs/plan');
    if (!existsSync(dir)) return null;
    const candidate = readdirSync(dir).filter((name) => /slices?\.md$/i.test(name)).sort()[0];
    return candidate ? `docs/plan/${candidate}` : null;
}

export function checkSlices(root, findings) {
    const rel = findSliceFile(root);
    if (!rel) return { rel: null, slices: [] };
    if (rel !== 'docs/plan/seznam-slices.md') {
        findings.info('slices-location', `Slice table read from ${rel} instead of docs/plan/seznam-slices.md.`, rel);
    }
    const text = readText(root, rel) ?? '';
    const slices = [];
    const otherIds = new Set();
    for (const table of parseTables(text)) {
        // Only slice tables (ID + title columns); change logs such as `ID | Změna | Důvod` repeat IDs.
        if (!table.header.some((cell) => /^(titulek|title|název|nazev)$/i.test(cell))) continue;
        const issueColumn = table.header.findIndex((cell) => /^(issue|issues|github issue|zadání|gh)$/i.test(cell));
        for (const row of table.rows) {
            const id = stripMarkdown(row.cells[0] ?? '');
            if (!SLICE_ID.test(id)) {
                if (OTHER_ID.test(id)) otherIds.add(id);
                continue;
            }
            const source = issueColumn >= 0 ? row.cells[issueColumn] ?? '' : row.raw;
            slices.push({ id, line: row.line, issues: issueNumbers(source) });
        }
    }

    const seen = new Map();
    const duplicates = [];
    for (const slice of slices) {
        if (seen.has(slice.id)) duplicates.push(`${slice.id} (lines ${seen.get(slice.id)}, ${slice.line})`);
        else seen.set(slice.id, slice.line);
    }
    if (duplicates.length > 0) {
        findings.error('slice-duplicate', `${duplicates.length} duplicate slice ID(s): ${listSome(duplicates, 10)}.`, rel);
    }

    const issueOwners = new Map();
    for (const slice of slices) {
        for (const number of slice.issues) {
            if (!issueOwners.has(number)) issueOwners.set(number, []);
            issueOwners.get(number).push(slice.id);
        }
    }
    const shared = [...issueOwners].filter(([, ids]) => new Set(ids).size > 1);
    if (shared.length > 0) {
        findings.warn('slice-shared-issue', `Issues referenced by more than one slice: ${listSome(shared.map(([n, ids]) => `#${n} (${[...new Set(ids)].join(', ')})`), 8)}.`, rel);
    }

    const withIssue = slices.filter((slice) => slice.issues.length > 0).length;
    findings.info('slice-summary', `${slices.length} slice row(s), ${withIssue} linked to an issue, ${slices.length - withIssue} without.`, rel);
    if (otherIds.size > 0) {
        findings.info('slice-other-ids', `${otherIds.size} row ID(s) do not follow \`F<phase>-<nn>\`: ${listSome([...otherIds], 8)}.`, rel);
    }
    return { rel, slices };
}

// ---------------------------------------------------------------------------------------------
// GitHub (read-only, via gh)

export function makeGh(bin = process.env.CONFORMANCE_GH_BIN || 'gh') {
    return (args) => {
        const result = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
        if (result.error) return { ok: false, error: result.error.code === 'ENOENT' ? `${bin} not found` : result.error.message };
        if (result.status !== 0) return { ok: false, error: (result.stderr || result.stdout || `exit ${result.status}`).trim().split('\n').pop() };
        try {
            return { ok: true, data: result.stdout.trim() ? JSON.parse(result.stdout) : null };
        } catch (error) {
            return { ok: false, error: `invalid JSON from ${bin}: ${error.message}` };
        }
    };
}

const issueRefs = (numbers) => listSome(numbers.map((n) => `#${n}`));

export function checkGithub(repo, { tier, taskingMode, slices, sliceFile }, findings, gh = makeGh()) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
        findings.error('github-repo', `--github expects owner/repo, got \`${repo}\`.`);
        return;
    }
    const skipped = (what, error) => findings.warn('github-skipped', `Skipped ${what}: ${error}.`);

    const repoInfo = gh(['api', `repos/${repo}`]);
    if (!repoInfo.ok) {
        skipped(`all GitHub checks for ${repo}`, repoInfo.error);
        return;
    }

    // Issues
    const open = gh(['issue', 'list', '-R', repo, '--state', 'open', '--limit', '5000', '--json', 'number,title,labels,body']);
    if (!open.ok) {
        skipped('open issue checks', open.error);
    } else {
        const issues = open.data ?? [];
        const prefixed = issues.filter((i) => /^\s*\[(FE|BE|DATA)\]/i.test(i.title)).map((i) => i.number);
        // Slice IDs such as F1-17, M1-05 or NT-02 at the start of a title or in brackets.
        const sliceTitled = issues.filter((i) => /(^|[[(])[A-Z][A-Z0-9]*-\d+\b/.test(i.title.trim())).map((i) => i.number);
        const unlabeled = issues
            .filter((i) => !(i.labels ?? []).some((label) => CATEGORY_LABELS.includes(String(label.name).toLowerCase())))
            .map((i) => i.number);
        if (prefixed.length > 0) findings.error('issue-title-prefix', `${prefixed.length} open issue(s) carry a [FE]/[BE]/[DATA] title prefix (company rule: titles): ${issueRefs(prefixed)}.`, repo);
        if (sliceTitled.length > 0) findings.error('issue-title-slice', `${sliceTitled.length} open issue(s) carry a slice ID in the title (company rule: titles): ${issueRefs(sliceTitled)}.`, repo);
        if (unlabeled.length > 0) findings.warn('issue-category-label', `${unlabeled.length} open issue(s) have no category label (${CATEGORY_LABELS.join(', ')}): ${issueRefs(unlabeled)}.`, repo);
        if (tier === 'full') {
            // esoul-tasking writes `## UAT`; the GitHub issue form renders the field as `### UAT`.
            const noUat = issues.filter((i) => !/^#{2,3}\s+UAT\b/m.test(i.body ?? '')).map((i) => i.number);
            if (noUat.length > 0) findings.warn('issue-uat', `${noUat.length} open issue(s) have no \`## UAT\` section (company rule: UAT): ${issueRefs(noUat)}.`, repo);
        }
        if (taskingMode !== 'freelo-only') {
            const noFreelo = issues.filter((i) => !/app\.freelo\.io\/task\//i.test(i.body ?? '')).map((i) => i.number);
            if (noFreelo.length > 0) findings.warn('issue-freelo-link', `${noFreelo.length} open issue(s) have no Freelo task link: ${issueRefs(noFreelo)}.`, repo);
        }
        findings.info('issue-summary', `${issues.length} open issue(s) checked.`, repo);
    }

    // Slice rows -> issues
    const referenced = [...new Set(slices.flatMap((slice) => slice.issues))];
    if (referenced.length > 0) {
        const all = gh(['issue', 'list', '-R', repo, '--state', 'all', '--limit', '10000', '--json', 'number']);
        if (!all.ok) {
            skipped('slice-to-issue checks', all.error);
        } else {
            const known = new Set((all.data ?? []).map((i) => i.number));
            const dangling = slices.flatMap((slice) => slice.issues.filter((n) => !known.has(n)).map((n) => `${slice.id} → #${n}`));
            if (dangling.length > 0) findings.error('slice-issue-missing', `${dangling.length} slice reference(s) point to a non-existent issue: ${listSome(dangling, 10)}.`, sliceFile);
        }
    }

    // Merge settings and rules on the default branch
    const settings = repoInfo.data ?? {};
    const branch = settings.default_branch || 'main';
    if (settings.allow_squash_merge === false) {
        findings.error('merge-squash', 'Squash merge is not allowed in the repository settings (company rule: merging).', repo);
    } else if (settings.allow_squash_merge === undefined) {
        findings.info('merge-settings', 'Merge settings are not visible to this token.', repo);
    }
    if (settings.allow_merge_commit === true || settings.allow_rebase_merge === true) {
        const others = [settings.allow_merge_commit && 'merge commits', settings.allow_rebase_merge && 'rebase'].filter(Boolean);
        findings.warn('merge-methods', `Repository also allows ${others.join(' and ')}; the company merging rule expects squash only.`, repo);
    }

    let requiredChecks = new Set();
    let approvals = 0;
    let rulesSeen = false;
    const rules = gh(['api', `repos/${repo}/rules/branches/${branch}`]);
    if (!rules.ok) {
        skipped(`rules of branch ${branch}`, rules.error);
    } else {
        for (const rule of rules.data ?? []) {
            rulesSeen = true;
            if (rule.type === 'required_status_checks') {
                for (const check of rule.parameters?.required_status_checks ?? []) requiredChecks.add(check.context);
            }
            if (rule.type === 'pull_request') {
                approvals = Math.max(approvals, rule.parameters?.required_approving_review_count ?? 0);
                const methods = rule.parameters?.allowed_merge_methods;
                if (Array.isArray(methods) && !methods.includes('squash')) {
                    findings.error('merge-squash', `A ruleset on ${branch} does not allow squash merge (allowed: ${methods.join(', ')}).`, repo);
                }
            }
        }
    }

    const protection = gh(['api', `repos/${repo}/branches/${branch}/protection`]);
    if (protection.ok && protection.data) {
        rulesSeen = true;
        for (const context of protection.data.required_status_checks?.contexts ?? []) requiredChecks.add(context);
        for (const check of protection.data.required_status_checks?.checks ?? []) requiredChecks.add(check.context);
        approvals = Math.max(approvals, protection.data.required_pull_request_reviews?.required_approving_review_count ?? 0);
    }

    if (rules.ok || protection.ok) {
        if (!requiredChecks.has('Jenkins')) {
            findings.error('ruleset-jenkins', `Branch ${branch} does not require the \`Jenkins\` status check (company rule: merging)${requiredChecks.size ? `; required: ${[...requiredChecks].join(', ')}` : ''}.`, repo);
        }
        if (approvals < 1) {
            findings.error('ruleset-approvals', `Branch ${branch} requires ${approvals} approving review(s); the company merging rule requires at least 1.`, repo);
        }
        if (!rulesSeen) findings.info('ruleset-none', `No ruleset or branch protection applies to ${branch}.`, repo);
    }

    const rulesets = gh(['api', `repos/${repo}/rulesets?includes_parents=true`]);
    if (!rulesets.ok) {
        skipped('ruleset bypass checks', rulesets.error);
        return;
    }
    const user = gh(['api', 'user']);
    const login = user.ok ? user.data?.login : null;
    for (const summary of rulesets.data ?? []) {
        if (summary.enforcement && summary.enforcement !== 'active') continue;
        const detail = gh(['api', `repos/${repo}/rulesets/${summary.id}`]);
        if (!detail.ok) {
            skipped(`ruleset "${summary.name}"`, detail.error);
            continue;
        }
        const actors = detail.data?.bypass_actors;
        const canBypass = detail.data?.current_user_can_bypass;
        if (login === SHARED_ACCOUNT && canBypass && canBypass !== 'never') {
            findings.error('ruleset-bypass', `Shared account ${SHARED_ACCOUNT} can bypass ruleset "${summary.name}" (company rule: merging).`, repo);
        } else if (Array.isArray(actors) && actors.length > 0) {
            const who = actors.map((a) => `${a.actor_type}${a.actor_id ? `#${a.actor_id}` : ''} (${a.bypass_mode})`);
            findings.warn('ruleset-bypass', `Ruleset "${summary.name}" has bypass actors: ${who.join(', ')}${canBypass && canBypass !== 'never' ? `; ${login ?? 'the current user'} can bypass` : ''}. Make sure ${SHARED_ACCOUNT} cannot (company rule: merging).`, repo);
        } else if (actors === undefined) {
            findings.info('ruleset-bypass', `Bypass actors of ruleset "${summary.name}" are not visible to this token.`, repo);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Orchestration and output

export function runConformance(root, { tier: tierFlag = null, github = null, gh } = {}) {
    const findings = new Findings();
    const absolute = path.resolve(root);
    const { profile, context, sectionMap } = readProfile(absolute, findings, tierFlag);
    const tier = profile.tier;

    checkRequiredFiles(absolute, tier, findings);
    checkContext(context, sectionMap, tier, findings);
    const files = trackedFiles(absolute, findings);
    checkPlaceholders(absolute, files, findings);
    checkLinks(absolute, files, findings);
    checkAdrs(absolute, findings);
    const { rel: sliceFile, slices } = tier === 'full' ? checkSlices(absolute, findings) : { rel: null, slices: [] };

    if (github) {
        checkGithub(github, { tier, taskingMode: profile.taskingMode, slices, sliceFile }, findings, gh ?? makeGh());
    }

    const counts = { error: 0, warning: 0, info: 0 };
    for (const item of findings.items) counts[item.severity] += 1;
    return { root: absolute, profile, github, counts, findings: findings.items };
}

export function formatReport(result) {
    const { profile } = result;
    const out = [];
    out.push(`eSoul conformance: ${result.root}`);
    out.push(`Profile: tier ${profile.tier} (${profile.tierSource}), stack ${profile.stack ?? 'unknown'}, archetype ${profile.archetype ?? '—'}, tasking ${profile.taskingMode ?? 'unknown'}`);
    out.push(`GitHub: ${result.github ?? 'not checked (use --github owner/repo)'}`);
    const groups = [['error', 'Errors'], ['warning', 'Warnings'], ['info', 'Info']];
    for (const [severity, title] of groups) {
        const items = result.findings.filter((item) => item.severity === severity);
        out.push('', `${title} (${items.length})`);
        for (const item of items) out.push(`  - [${item.code}] ${item.message}${item.file ? `  → ${item.file}` : ''}`);
    }
    out.push('', `Summary: ${result.counts.error} error(s), ${result.counts.warning} warning(s), ${result.counts.info} info.`);
    return out.join('\n');
}

export function parseArgs(argv) {
    const options = { root: null, tier: null, github: null, json: false };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const value = () => {
            const next = argv[i + 1];
            if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
            i += 1;
            return next;
        };
        if (arg === '--json') options.json = true;
        else if (arg === '--tier') options.tier = value();
        else if (arg.startsWith('--tier=')) options.tier = arg.slice(7);
        else if (arg === '--github') options.github = value();
        else if (arg.startsWith('--github=')) options.github = arg.slice(9);
        else if (arg === '-h' || arg === '--help') options.help = true;
        else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
        else if (options.root === null) options.root = arg;
        else throw new Error(`unexpected argument ${arg}`);
    }
    if (options.tier && !TIERS.includes(options.tier)) throw new Error(`--tier must be ${TIERS.join(' or ')}`);
    return options;
}

const USAGE = 'Usage: node scripts/conformance.mjs <project-root> [--tier full|light] [--github owner/repo] [--json]';

export function main(argv = process.argv.slice(2)) {
    let options;
    try {
        options = parseArgs(argv);
    } catch (error) {
        console.error(`${error.message}\n${USAGE}`);
        return 2;
    }
    if (options.help) {
        console.log(USAGE);
        return 0;
    }
    if (!options.root || !existsSync(options.root) || !statSync(options.root).isDirectory()) {
        console.error(`Project root not found: ${options.root ?? '(none)'}\n${USAGE}`);
        return 2;
    }
    const result = runConformance(options.root, options);
    console.log(options.json ? JSON.stringify(result, null, 2) : formatReport(result));
    return result.counts.error > 0 ? 1 : 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (import.meta.url === invokedPath) {
    process.exitCode = main();
}
