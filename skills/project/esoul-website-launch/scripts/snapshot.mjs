#!/usr/bin/env node
/**
 * eSoul case-study snapshots of a client's ORIGINAL site (pred = before) and the launched one (po = after).
 * Node >= 22; Playwright and Lighthouse are resolved at runtime from ~/.cache/esoul-uat.
 * Needs the sibling skill esoul-quality-gates (scripts/web.mjs): URL helpers, Playwright and Lighthouse loading.
 *
 *   snapshot.mjs --check
 *   snapshot.mjs discover --base https://old.example.cz [--max 200] [--json]
 *   snapshot.mjs capture  --base https://old.example.cz --urls assets/case-study/urls.txt \
 *                         --out assets/case-study/pred [--date YYYY-MM-DD] [--label pred|po] \
 *                         [--devices desktop,mobile] [--lighthouse [N]] [--wayback <timestamp>]
 *
 * discover: lists candidate URLs from robots.txt, sitemaps and the home page, grouped by path
 *   pattern, so one URL per template can be picked. No browser needed.
 * capture: urls file has one URL or path per line, optional `| slug`, `#` comments; the line
 *   order gives the NN- prefix. Writes <out>/<date>/ with manifest.json, desktop/ and mobile/
 *   screenshots (full page and first viewport) and, with --lighthouse, mobile Lighthouse for the
 *   first N URLs (default 3) under lighthouse/. --wayback shoots web.archive.org snapshots.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

let web;
try {
    web = await import('../../esoul-quality-gates/scripts/web.mjs');
} catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    console.error('✗ snapshot.mjs needs the sibling skill esoul-quality-gates (scripts/web.mjs). Install it from the same layer.');
    process.exit(2);
}
const { DESKTOP_UA, INSTALL_LIGHTHOUSE, INSTALL_PLAYWRIGHT, extractLinks, groupByPattern, hasChrome, hasLighthouse, isAssetUrl, isJunkUrl, loadPlaywright, normalizeUrl, parseRobotsSitemaps, parseSitemapXml, parseUrlsFile, runLighthouse, sameSite } = web;

export const TOOL_NAME = 'esoul-website-launch/snapshot.mjs';
export const TOOL_VERSION = '1.0.0';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
export const DEVICES = {
    desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: DESKTOP_UA },
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE_UA },
};

// ---------------------------------------------------------------------------------------------
// Pure helpers (tested without network or browser)

/** `if_` mode serves the archived page without the Wayback toolbar. */
export const waybackUrl = (timestamp, url) => `https://web.archive.org/web/${timestamp}if_/${url}`;

export function buildManifest({ label, date, base, source = 'live', waybackTimestamp, capturedAt = new Date().toISOString(), devices, pages, lighthouse = null, notes = [] }) {
    const manifest = { label, date, base, source };
    if (source === 'wayback') manifest.waybackTimestamp = waybackTimestamp;
    Object.assign(manifest, { capturedAt, tool: TOOL_NAME, toolVersion: TOOL_VERSION, devices, pages, lighthouse, notes });
    return manifest;
}

export function summarize(manifest) {
    const failed = manifest.pages.filter((p) => p.error).length;
    let shots = 0;
    for (const p of manifest.pages) for (const d of Object.values(p.shots ?? {})) shots += Object.keys(d).length;
    return { ok: manifest.pages.length - failed, failed, shots, lighthouse: manifest.lighthouse?.filter((l) => !l.error).length ?? 0 };
}

export function formatSummary(manifest, bytes, dir) {
    const s = summarize(manifest);
    const lh = manifest.lighthouse ? `, Lighthouse ${s.lighthouse}/${manifest.lighthouse.length}` : '';
    return `${manifest.label} ${manifest.date}: ${s.ok} pages ok, ${s.failed} failed, ${s.shots} screenshots${lh}, ${(bytes / 1048576).toFixed(1)} MB → ${dir}`;
}

export function dirSize(dir) {
    let total = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        total += entry.isDirectory() ? dirSize(p) : statSync(p).size;
    }
    return total;
}

export function writeJsonAtomic(file, data) {
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
    renameSync(tmp, file);
}

const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** Validates the `capture` options; throws an Error with a usage message. */
export function parseCaptureOptions(o) {
    for (const key of ['base', 'urls', 'out']) if (typeof o[key] !== 'string') throw new Error(`Missing --${key}.`);
    const label = o.label ?? 'pred';
    if (!['pred', 'po'].includes(label)) throw new Error('--label must be pred or po.');
    const date = o.date ?? new Date().toLocaleDateString('sv-SE');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date must be YYYY-MM-DD.');
    const deviceIds = list(o.devices).length ? list(o.devices) : ['desktop', 'mobile'];
    for (const id of deviceIds) if (!DEVICES[id]) throw new Error(`Unknown device ${id} (${Object.keys(DEVICES).join(', ')}).`);
    const wayback = typeof o.wayback === 'string' ? o.wayback : null;
    if (o.wayback !== undefined && !/^\d{4,14}$/.test(wayback ?? '')) throw new Error('--wayback needs a timestamp (YYYYMMDD or YYYYMMDDhhmmss).');
    let lhCount = 0;
    if (o.lighthouse !== undefined) {
        lhCount = o.lighthouse === true ? 3 : Number.parseInt(o.lighthouse, 10);
        if (!(lhCount > 0)) throw new Error('--lighthouse expects a positive number.');
    }
    return { base: o.base, urls: o.urls, out: o.out, label, date, deviceIds, wayback, lhCount };
}

// ---------------------------------------------------------------------------------------------
// Discovery (network, no browser)

async function fetchText(url, timeout = 20000) {
    try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), headers: { 'user-agent': 'esoul-snapshot/1.0', accept: 'text/html,application/xml,text/plain,*/*' } });
        return { ok: res.ok, status: res.status, finalUrl: res.url, text: res.ok ? await res.text() : '' };
    } catch (error) {
        return { ok: false, status: 0, finalUrl: url, text: '', error: String(error.message ?? error) };
    }
}

/** Candidate URLs of a site from robots.txt, sitemaps and the home page: { base, sources, total, shown, nav, groups }. */
export async function discoverSite({ base, max = 200 }) {
    const home = await fetchText(base);
    const origin = new URL(home.finalUrl).origin;
    const robots = await fetchText(`${origin}/robots.txt`);
    let queue = robots.ok ? parseRobotsSitemaps(robots.text) : [];
    if (queue.length === 0) queue = [`${origin}/sitemap.xml`];
    const sources = [];
    const found = [];
    const visited = new Set();
    while (queue.length > 0 && visited.size < 50) {
        const sitemap = queue.shift();
        if (visited.has(sitemap) || /\.gz($|\?)/i.test(sitemap)) continue;
        visited.add(sitemap);
        const res = await fetchText(sitemap);
        if (!res.ok) continue;
        const { type, locs } = parseSitemapXml(res.text);
        sources.push(`${sitemap} (${type}, ${locs.length})`);
        if (type === 'index') queue.push(...locs);
        else found.push(...locs);
    }
    const nav = home.ok ? extractLinks(home.text, home.finalUrl, { navOnly: true }) : [];
    let candidates = found;
    if (candidates.length === 0 && home.ok) {
        candidates = extractLinks(home.text, home.finalUrl);
        sources.push(`${home.finalUrl} (links from home)`);
    }
    const seen = new Set();
    const urls = [];
    for (const raw of candidates) {
        const url = normalizeUrl(raw, origin);
        if (!url || seen.has(url) || !sameSite(url, origin) || isAssetUrl(url) || isJunkUrl(url)) continue;
        seen.add(url);
        urls.push(url);
    }
    return { base: origin, sources, total: urls.length, shown: Math.min(urls.length, max), nav, groups: groupByPattern(urls.slice(0, max)) };
}

export function formatDiscovery(result, max) {
    const lines = [`Base: ${result.base}`, `Sources: ${result.sources.join('; ') || 'none (the home page could not be loaded)'}`];
    lines.push(`Candidates: ${result.total}${result.total > max ? ` (first ${max} shown)` : ''}`, '');
    if (result.nav.length) lines.push(`Main navigation (${result.nav.length}):`, ...result.nav.map((u) => `  ${u}`), '');
    lines.push('Templates by path:');
    for (const g of result.groups) lines.push(`  ${g.pattern}  (${g.count})  e.g. ${g.examples.join(', ')}`);
    return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Capture (browser)

// Playwright CSS locators pierce open shadow roots, so Usercentrics and the Seznam CMP match too.
const COOKIE_SELECTORS = [
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', // Cookiebot
    '#CybotCookiebotDialogBodyButtonAccept',
    '#onetrust-accept-btn-handler', // OneTrust
    '#didomi-notice-agree-button', // Didomi
    '.cmplz-accept', // Complianz
    '.cky-btn-accept', // CookieYes
    '#cn-accept-cookie', // Cookie Notice
    '#c-p-bn', // orestbida cookieconsent v2
    'button[data-role="all"]', // orestbida cookieconsent v3
    '[data-cc="accept-all"]',
    '[data-testid="uc-accept-all-button"]', // Usercentrics
    '[data-testid="cw-button-agree-with-ads"]', // Seznam CMP
    '.fc-cta-consent', // Google Funding Choices
    '.qc-cmp2-summary-buttons button[mode="primary"]', // Quantcast
];
const COOKIE_LABELS = [
    'přijmout vše', 'přijmout všechny', 'přijmout všechny cookies', 'přijmout všechny soubory cookie', 'povolit vše',
    'povolit všechny', 'souhlasím', 'souhlasím se vším', 'souhlasím a pokračovat', 'přijmout', 'rozumím', 'ok, rozumím',
    'accept all', 'accept all cookies', 'allow all', 'allow all cookies', 'accept', 'i agree', 'agree', 'got it',
];

/** Clicks a known consent button or a button with an accept label (also inside iframes); returns what was clicked or null. */
async function dismissCookies(page) {
    for (let attempt = 0; attempt < 2; attempt++) {
        for (const selector of COOKIE_SELECTORS) {
            const el = page.locator(selector).first();
            if (await el.isVisible().catch(() => false)) {
                await el.click({ timeout: 2000 }).catch(() => {});
                await page.waitForTimeout(600);
                return selector;
            }
        }
        let label = null;
        for (const frame of page.frames()) {
            label = await clickAcceptLabel(frame);
            if (label) break;
        }
        if (label) {
            await page.waitForTimeout(600);
            return label;
        }
        await page.waitForTimeout(800); // banners often appear late
    }
    return null;
}

/** Clicks the first visible button whose whole text is an accept label, in one frame. */
function clickAcceptLabel(frame) {
    return frame
            .evaluate((labels) => {
                const norm = (s) => s.replace(/\s+/g, ' ').replace(/[.!]+$/, '').trim().toLowerCase();
                const visible = (el) => {
                    const r = el.getBoundingClientRect();
                    const s = getComputedStyle(el);
                    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
                };
                for (const el of document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')) {
                    const text = norm(el.value || el.textContent || '');
                    if (labels.includes(text) && visible(el)) {
                        el.click();
                        return text;
                    }
                }
                return null;
            }, COOKIE_LABELS)
            .catch(() => null);
}

// Animations jump to their end state (not removed), so reveal-on-scroll content stays visible.
const FREEZE_CSS = '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}';

// Consent containers hidden for the shot when no accept button worked, e.g. the Seznam consent wall
// (`szn-cwl`) on Czech publisher sites, which has no accept button of its own.
const CMP_CONTAINERS = [
    'szn-cwl', '#didomi-host', '#CybotCookiebotDialog', '#onetrust-consent-sdk', '#usercentrics-root',
    '#usercentrics-cmp-ui', '.cmplz-cookiebanner', '#cookie-notice', '.cky-consent-container', '#cc_div', '#cc-main',
    '.fc-consent-root', '#qc-cmp2-container', '#cmpbox', '#cmpbox2',
];
const CMP_HIDE_CSS = `${CMP_CONTAINERS.join(',')}{display:none!important}html,body{overflow:auto!important}`;

/** Hides consent containers still in the page; returns the first selector found or null. Hosts such as
 * `szn-cwl` have no box of their own (the dialog lives in the shadow root), so presence counts, not visibility. */
async function hideConsent(page) {
    for (const selector of CMP_CONTAINERS) {
        if ((await page.locator(selector).count().catch(() => 0)) > 0) {
            await page.addStyleTag({ content: CMP_HIDE_CSS }).catch(() => {});
            return selector;
        }
    }
    return null;
}

async function preparePage(page) {
    await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'))).catch(() => {});
    await page
        .evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
            for (let y = 0, i = 0; i < 80; i++) {
                y += step;
                window.scrollTo(0, y);
                await sleep(150);
                if (y >= document.documentElement.scrollHeight) break;
            }
            window.scrollTo(0, 0);
            await sleep(300);
        })
        .catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
}

async function shootDevice(page, target, paths, timeout) {
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => page.waitForLoadState('load', { timeout: 5000 }).catch(() => {}));
    const status = response?.status() ?? null;
    const info = { status, finalUrl: page.url(), title: await page.title().catch(() => '') };
    if (status !== null && status >= 400) return { ...info, error: `HTTP ${status}` };
    const clicked = await dismissCookies(page);
    const hidden = await hideConsent(page);
    info.cookies = clicked ?? (hidden ? `hidden:${hidden}` : 'none');
    await preparePage(page);
    await page.screenshot({ path: paths.fold, fullPage: false, animations: 'disabled', caret: 'hide' });
    await page.screenshot({ path: paths.full, fullPage: true, animations: 'disabled', caret: 'hide' });
    return info;
}

const addError = (record, message) => {
    record.error = record.error ? `${record.error}; ${message}` : message;
};

/**
 * Captures the pages of `entries` ([{ n, url, slug }]) into `<out>/<date>/` and writes manifest.json.
 * Needs Playwright with Google Chrome; Lighthouse only for lhCount > 0 without wayback. Returns the manifest.
 */
export async function captureSite({ base, entries, out, label = 'pred', date, deviceIds = ['desktop', 'mobile'], wayback = null, lhCount = 0, log = console.log }) {
    const pw = await loadPlaywright();
    if (!pw) throw new Error(`playwright is missing: ${INSTALL_PLAYWRIGHT}`);
    if (lhCount > 0 && !wayback && !(await hasLighthouse())) throw new Error(`lighthouse is missing: ${INSTALL_LIGHTHOUSE}`);
    const outDir = resolve(out, date);
    const width = String(entries.length).length > 2 ? 3 : 2;
    const nn = (n) => String(n).padStart(width, '0');
    for (const id of deviceIds) mkdirSync(join(outDir, id), { recursive: true });

    const notes = [];
    const pages = [];
    const timeout = wayback ? 90000 : 45000;
    const browser = await pw.chromium.launch({ channel: 'chrome', headless: true });
    try {
        const contexts = {};
        for (const id of deviceIds) contexts[id] = await browser.newContext({ ...DEVICES[id], locale: 'cs-CZ', reducedMotion: 'reduce', ignoreHTTPSErrors: true });
        for (const entry of entries) {
            const record = { n: entry.n, slug: entry.slug, url: entry.url, finalUrl: null, status: null, title: '', shots: {} };
            for (const id of deviceIds) {
                const rel = { full: `${id}/${nn(entry.n)}-${entry.slug}.png`, fold: `${id}/${nn(entry.n)}-${entry.slug}-fold.png` };
                const page = await contexts[id].newPage();
                try {
                    const info = await shootDevice(page, wayback ? waybackUrl(wayback, entry.url) : entry.url, { full: join(outDir, rel.full), fold: join(outDir, rel.fold) }, timeout);
                    if (!record.finalUrl) Object.assign(record, { finalUrl: info.finalUrl, status: info.status, title: info.title });
                    if (info.error) addError(record, `${id}: ${info.error}`);
                    else {
                        record.shots[id] = rel;
                        (record.cookies ??= {})[id] = info.cookies;
                    }
                    const actual = wayback && info.finalUrl.match(/\/web\/(\d{14})/);
                    if (actual) record.waybackActual = actual[1];
                } catch (error) {
                    addError(record, `${id}: ${String(error.message ?? error).split('\n')[0]}`);
                } finally {
                    await page.close().catch(() => {});
                }
            }
            if (Object.keys(record.shots).length === 0 && !record.error) record.error = 'no screenshots';
            pages.push(record);
            log(`${record.error ? '✗' : '✓'} ${nn(entry.n)} ${entry.url}${record.error ? ` – ${record.error}` : ''}`);
        }
    } finally {
        await browser.close();
    }

    let lighthouse = null;
    if (lhCount > 0 && wayback) notes.push('Lighthouse skipped: the source is the Wayback Machine, measuring an archive would say nothing.');
    else if (lhCount > 0) {
        const targets = entries.slice(0, lhCount).map((e) => ({ url: e.url, file: `lighthouse/${nn(e.n)}-${e.slug}.json` }));
        const measured = await runLighthouse(targets, outDir);
        lighthouse = (measured ?? []).map((m, i) => ({ n: entries[i].n, slug: entries[i].slug, ...m }));
        notes.push('Lighthouse: mobile emulation, simulated throttling, Lighthouse defaults.');
    } else notes.push('Lighthouse was not run (no --lighthouse).');
    if (wayback) notes.push(`Source: Wayback Machine, requested timestamp ${wayback}; the actual timestamps are in waybackActual of each page.`);
    if (pages.some((p) => Object.values(p.cookies ?? {}).includes('none'))) notes.push('No cookie banner was found on some pages; check the screenshots by eye.');
    notes.push('Check the screenshots for personal data (names in reviews, portraits without consent) before the push.');

    const devices = Object.fromEntries(deviceIds.map((id) => [id, { width: DEVICES[id].viewport.width, height: DEVICES[id].viewport.height, deviceScaleFactor: DEVICES[id].deviceScaleFactor }]));
    const manifest = buildManifest({ label, date, base, source: wayback ? 'wayback' : 'live', waybackTimestamp: wayback ?? undefined, devices, pages, lighthouse, notes });
    writeJsonAtomic(join(outDir, 'manifest.json'), manifest);
    return manifest;
}

// ---------------------------------------------------------------------------------------------
// CLI

const die = (m) => {
    console.error(`✗ ${m}`);
    process.exit(1);
};

function parseArgs(argv) {
    const o = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const key = argv[i].slice(2);
        o[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
    return o;
}

async function discover(o) {
    if (!o.base) die('Missing --base.');
    const max = o.max ? Number.parseInt(o.max, 10) : 200;
    if (!(max > 0)) die('--max must be a positive number.');
    const result = await discoverSite({ base: o.base, max });
    console.log(o.json ? JSON.stringify(result, null, 2) : formatDiscovery(result, max));
    if (result.total === 0) process.exitCode = 1;
}

async function capture(o) {
    let options;
    let entries;
    try {
        options = parseCaptureOptions(o);
        entries = parseUrlsFile(readFileSync(options.urls, 'utf8'), options.base);
    } catch (error) {
        die(error.message);
    }
    if (entries.length === 0) die('The URL file is empty.');
    const manifest = await captureSite({ ...options, entries }).catch((error) => die(error.message));
    const outDir = resolve(options.out, options.date);
    console.log(formatSummary(manifest, dirSize(outDir), outDir));
    if (summarize(manifest).ok === 0) process.exitCode = 1;
}

async function check() {
    const pw = await loadPlaywright();
    const lh = await hasLighthouse();
    console.log(pw ? '✓ playwright available' : `✗ playwright missing: ${INSTALL_PLAYWRIGHT}`);
    console.log(lh ? '✓ lighthouse available' : `✗ lighthouse missing (only for --lighthouse): ${INSTALL_LIGHTHOUSE}`);
    console.log(hasChrome() ? '✓ Google Chrome installed' : '✗ Google Chrome not found');
    process.exit(pw && hasChrome() ? 0 : 1);
}

async function main(argv) {
    const o = parseArgs(argv);
    const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
    if (o.check) return check();
    if (command === 'discover') return discover(o);
    if (command === 'capture') return capture(o);
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 21).join('\n'));
    process.exitCode = command || argv.length ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => die(error.stack ?? String(error)));
}
