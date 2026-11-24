#!/usr/bin/env node
/**
 * eSoul Lighthouse gate: mobile Lighthouse on the key templates of a website against the eSoul budgets.
 * Node >= 22; Lighthouse and Chrome are resolved at runtime from ~/.cache/esoul-uat. Local only.
 *
 *   lighthouse-gate.mjs --check
 *   lighthouse-gate.mjs run --base https://site.cz [--urls file] [--staging] [--auth user:pass]
 *       [--header 'Name: value']... [--budget metric=value]... [--out dir] [--json]
 *
 * --urls has the format of assets/case-study/urls.txt and of ai-readiness.mjs (one URL or path per line,
 * `| slug`, `#` comments); list one URL per template. Without it only the base URL is measured.
 * --staging skips the SEO category: a preview is noindex, so SEO can only reach 100 on production.
 * Budgets (eSoul default): performance >= 90; accessibility, best practices and SEO 100; LCP < 2.5 s; CLS < 0.05.
 * --budget metric=value (repeatable) replaces a number where the project has its own (lcp in ms), e.g. --budget performance=85.
 * Exit code: 0 = every measured value is within budget, 1 = a budget is missed or a page failed, 2 = usage/tool error.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { INSTALL_LIGHTHOUSE, hasChrome, hasLighthouse, parseUrlsFile, runLighthouse } from './web.mjs';

export const BUDGETS = {
    performance: { min: 90 },
    accessibility: { min: 100 },
    bestPractices: { min: 100 },
    seo: { min: 100 },
    lcp: { max: 2500, unit: 'ms' },
    cls: { max: 0.05 },
};

/** The default budgets with `metric=value` overrides applied (the project's own numbers); throws on an unknown metric or value. */
export function withBudgets(specs = []) {
    const budgets = structuredClone(BUDGETS);
    for (const spec of specs) {
        const [metric, raw] = String(spec).split('=');
        const value = Number(raw);
        if (!budgets[metric] || raw === undefined || raw === '' || !Number.isFinite(value)) throw new Error(`Invalid --budget "${spec}" (metric=number; metrics: ${Object.keys(BUDGETS).join(', ')}).`);
        if (budgets[metric].min === undefined) budgets[metric].max = value;
        else budgets[metric].min = value;
    }
    return budgets;
}

/** Compares one Lighthouse entry with the budgets: [{ metric, value, budget, status: 'pass' | 'fail' | 'skipped' }]. */
export function evaluate(entry, { staging = false, budgets = BUDGETS } = {}) {
    const values = { ...entry.categories, ...Object.fromEntries(['lcp', 'cls'].map((k) => [k, entry.metrics?.[k]])) };
    return Object.entries(budgets).map(([metric, budget]) => {
        const value = values[metric] ?? null;
        const label = budget.min === undefined ? `< ${budget.max}${budget.unit ? ` ${budget.unit}` : ''}` : `>= ${budget.min}`;
        if (metric === 'seo' && staging) return { metric, value, budget: label, status: 'skipped' };
        if (value === null) return { metric, value, budget: label, status: 'fail' };
        const ok = budget.min === undefined ? value < budget.max : value >= budget.min;
        return { metric, value, budget: label, status: ok ? 'pass' : 'fail' };
    });
}

const round = (metric, value) => (value === null ? 'n/a' : metric === 'cls' ? value.toFixed(3) : String(Math.round(value)));

/** Plain-text report of results [{ url, error?, checks }]; also the Markdown report body. */
export function formatReport(results) {
    const lines = [];
    for (const r of results) {
        if (r.error) {
            lines.push(`FAIL ${r.url}: ${r.error}`);
            continue;
        }
        const failed = r.checks.filter((c) => c.status === 'fail');
        lines.push(`${failed.length ? 'FAIL' : 'OK  '} ${r.url}`);
        for (const c of r.checks) lines.push(`     ${c.status.padEnd(7)} ${c.metric.padEnd(14)} ${round(c.metric, c.value).padStart(6)}  (${c.budget})`);
    }
    const bad = results.filter((r) => r.error || r.checks.some((c) => c.status === 'fail')).length;
    lines.push('', `${results.length - bad}/${results.length} pages within budget.`);
    return lines.join('\n');
}

const die = (message, code = 2) => {
    console.error(`✗ ${message}`);
    process.exit(code);
};

function parseArgs(argv) {
    const o = { header: [], budget: [] };
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const key = argv[i].slice(2);
        const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
        if (key === 'header' || key === 'budget') o[key].push(value);
        else o[key] = value;
    }
    return o;
}

function requestHeaders(o) {
    const headers = {};
    for (const raw of o.header) {
        const idx = typeof raw === 'string' ? raw.indexOf(':') : -1;
        if (idx < 1) die(`Invalid header "${raw}" (expected 'Name: value').`);
        headers[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
    }
    if (typeof o.auth === 'string') headers.Authorization = `Basic ${Buffer.from(o.auth).toString('base64')}`;
    return Object.keys(headers).length ? headers : undefined;
}

async function check() {
    const lh = await hasLighthouse();
    console.log(lh ? '✓ lighthouse available' : `✗ lighthouse missing: ${INSTALL_LIGHTHOUSE}`);
    console.log(hasChrome() ? '✓ Google Chrome installed' : '✗ Google Chrome not found');
    process.exit(lh && hasChrome() ? 0 : 2);
}

async function run(o) {
    if (typeof o.base !== 'string') die('Missing --base.');
    let entries;
    try {
        entries = typeof o.urls === 'string' ? parseUrlsFile(readFileSync(o.urls, 'utf8'), o.base) : parseUrlsFile(o.base, o.base);
    } catch (error) {
        die(error.message);
    }
    if (entries.length === 0) die('The URL file is empty.');
    let budgets;
    try {
        budgets = withBudgets(o.budget);
    } catch (error) {
        die(error.message);
    }
    const out = typeof o.out === 'string' ? resolve(o.out) : null;
    const targets = entries.map((e) => ({ url: e.url, file: `lighthouse/${String(e.n).padStart(2, '0')}-${e.slug}.json` }));
    const measured = await runLighthouse(targets, out ?? join(process.env.TMPDIR ?? '/tmp', `esoul-lighthouse-${process.pid}`), { headers: requestHeaders(o) });
    if (!measured) die(`lighthouse is missing: ${INSTALL_LIGHTHOUSE}`);
    const results = measured.map((m) => (m.error ? { url: m.url, error: m.error } : { url: m.url, report: m.report, checks: evaluate(m, { staging: Boolean(o.staging), budgets }) }));
    if (out) {
        mkdirSync(out, { recursive: true });
        writeFileSync(join(out, 'lighthouse-gate.json'), `${JSON.stringify({ staging: Boolean(o.staging), budgets, results }, null, 2)}\n`);
    }
    console.log(o.json ? JSON.stringify(results, null, 2) : formatReport(results));
    process.exitCode = results.some((r) => r.error || r.checks.some((c) => c.status === 'fail')) ? 1 : 0;
}

async function main(argv) {
    const o = parseArgs(argv);
    if (o.check) return check();
    if (argv[0] === 'run') return run(o);
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 17).join('\n'));
    process.exitCode = argv.length ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => die(error.stack ?? String(error)));
}
