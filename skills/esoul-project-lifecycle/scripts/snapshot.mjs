#!/usr/bin/env node
/**
 * eSoul case-study snapshots of a client's ORIGINAL site (před) and the launched one (po).
 * Node >= 18; Playwright and Lighthouse are resolved at runtime from ~/.cache/esoul-uat.
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
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TOOL_NAME = 'esoul-project-lifecycle/snapshot.mjs';
export const TOOL_VERSION = '1.0.0';
const cacheRoot = join(homedir(), '.cache', 'esoul-uat');
const INSTALL_PLAYWRIGHT = `npm install --prefix ${cacheRoot} playwright@1`;
const INSTALL_LIGHTHOUSE = 'npm install --prefix ~/.cache/esoul-uat lighthouse@12';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
// Headless Chrome announces itself as "HeadlessChrome", which some old sites and WAFs answer with 403.
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
export const DEVICES = {
    desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: DESKTOP_UA },
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE_UA },
};

// ---------------------------------------------------------------------------------------------
// Pure helpers (tested without network or browser)

const SPECIAL = { ß: 'ss', ł: 'l', đ: 'd', ø: 'o', æ: 'ae', œ: 'oe' };

/** Lowercase ASCII slug; Czech and other Latin diacritics are folded. */
export function slugify(text, max = 60) {
    const slug = String(text)
        .toLowerCase()
        .replace(/[ßłđøæœ]/g, (c) => SPECIAL[c])
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max)
        .replace(/-+$/, '');
    return slug;
}

/** Default slug of a URL: `home` for the root, else the slugified path (and query). */
export function slugFromUrl(url) {
    const u = new URL(url);
    let pathname = u.pathname;
    try {
        pathname = decodeURIComponent(pathname); // /o-n%C3%A1s -> o-nas
    } catch {
        /* keep the encoded path */
    }
    const path = slugify(pathname);
    return slugify(u.search ? `${path}-${u.search}` : path) || 'home';
}

/** Resolves an href against a base, drops the fragment; null for non-http(s) or invalid values. */
export function normalizeUrl(href, base) {
    if (typeof href !== 'string') return null;
    const value = href.trim();
    if (!value || value.startsWith('#') || /^(mailto|tel|javascript|data|sms):/i.test(value)) return null;
    try {
        const u = new URL(value, base);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        u.hash = '';
        return u.href;
    } catch {
        return null;
    }
}

const hostKey = (url) => new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
export const sameSite = (a, b) => hostKey(a) === hostKey(b);

const ASSET_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|zip|rar|7z|gz|tar|css|js|mjs|map|json|xml|txt|csv|docx?|xlsx?|pptx?|mp[34]|mov|avi|webm|wav|woff2?|ttf|otf|eot)$/i;
const JUNK = /([?&]replytocom=|\/feed\/?$|[?&]feed=|\/wp-json(\/|$)|\/xmlrpc\.php|\/wp-(admin|login|content|includes)(\/|\.php|$)|\/cdn-cgi\/)/i;

export function isAssetUrl(url) {
    try {
        return ASSET_EXT.test(new URL(url).pathname);
    } catch {
        return false;
    }
}
export const isJunkUrl = (url) => JUNK.test(url);

/** Parses the urls file; relative paths are resolved against base. Returns [{ n, url, slug }]. */
export function parseUrlsFile(text, base) {
    const entries = [];
    const seenUrls = new Set();
    const seenSlugs = new Map();
    const lines = String(text).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;
        const [rawUrl, ...rest] = line.split('|');
        const target = rawUrl.replace(/\s+#\s.*$/, '').trim();
        const override = rest.join('|').replace(/\s+#\s.*$/, '').trim();
        const absolute = /^https?:\/\//i.test(target) ? target : base ? new URL(target.startsWith('/') ? target : `/${target}`, base).href : null;
        const url = absolute && normalizeUrl(absolute, absolute);
        if (!url) throw new Error(`Řádek ${i + 1}: neplatná URL „${target}“ (relativní cesta vyžaduje --base).`);
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        let slug = (override && slugify(override)) || slugFromUrl(url);
        const count = (seenSlugs.get(slug) ?? 0) + 1;
        seenSlugs.set(slug, count);
        if (count > 1) slug = `${slug}-${count}`;
        entries.push({ n: entries.length + 1, url, slug });
    }
    return entries;
}

const decodeXml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** Sitemap XML (urlset or sitemap index) to { type: 'index' | 'urlset', locs }. */
export function parseSitemapXml(xml) {
    const locs = [];
    for (const m of String(xml).matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([\s\S]*?)\s*(?:\]\]>)?\s*<\/loc>/gi)) locs.push(decodeXml(m[1]));
    return { type: /<sitemapindex[\s>]/i.test(xml) ? 'index' : 'urlset', locs };
}

export function parseRobotsSitemaps(text) {
    return [...String(text).matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
}

function collectHrefs(html, base) {
    const out = [];
    for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
        const url = normalizeUrl(decodeXml(m[1] ?? m[2] ?? m[3]), base);
        if (url) out.push(url);
    }
    return out;
}

/**
 * Same-origin page links of a HTML document: navigation (nav, header) first, then footer, then the
 * rest; assets and junk removed; deduped. `navOnly` returns only the navigation block links.
 */
export function extractLinks(html, base, { navOnly = false } = {}) {
    const blocks = (names) => [...html.matchAll(new RegExp(`<(${names})\\b[\\s\\S]*?<\\/\\1>`, 'gi'))].map((m) => m[0]);
    const ordered = [...blocks('nav|header'), ...(navOnly ? [] : [...blocks('footer'), html])];
    const seen = new Set();
    const out = [];
    for (const chunk of ordered) {
        for (const url of collectHrefs(chunk, base)) {
            if (seen.has(url) || !sameSite(url, base) || isAssetUrl(url) || isJunkUrl(url)) continue;
            seen.add(url);
            out.push(url);
        }
    }
    return out;
}

const LANG = /^[a-z]{2}(-[a-z]{2})?$/i;

/** Template guess of a URL: `/`, `/*` (top-level pages) or `/<first-segment>/*`; a language prefix is kept. */
export function patternOf(url) {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    let prefix = '';
    if (segments.length > 1 && LANG.test(segments[0])) prefix = `/${segments.shift()}`;
    if (segments.length === 0) return prefix ? `${prefix}/` : '/';
    return segments.length === 1 ? `${prefix}/*` : `${prefix}/${segments[0]}/*`;
}

/** Groups URLs by path pattern: [{ pattern, count, examples }], top-level pages and root first. */
export function groupByPattern(urls, { examples = 3, topLevelExamples = 15 } = {}) {
    const groups = new Map();
    for (const url of urls) {
        const pattern = patternOf(url);
        if (!groups.has(pattern)) groups.set(pattern, []);
        groups.get(pattern).push(url);
    }
    const topLevel = (p) => /^(\/[a-z]{2}(-[a-z]{2})?)?\/\*?$/i.test(p);
    const rank = (p) => (p === '/' ? 0 : topLevel(p) ? 1 : 2);
    return [...groups.entries()]
        .map(([pattern, list]) => ({
            pattern,
            count: list.length,
            examples: list.slice(0, topLevel(pattern) ? topLevelExamples : examples).map((u) => {
                const x = new URL(u);
                return x.pathname + x.search;
            }),
        }))
        .sort((a, b) => rank(a.pattern) - rank(b.pattern) || b.count - a.count || a.pattern.localeCompare(b.pattern));
}

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
    return `${manifest.label} ${manifest.date}: ${s.ok} stránek ok, ${s.failed} selhalo, ${s.shots} snímků${lh}, ${(bytes / 1048576).toFixed(1)} MB → ${dir}`;
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

// ---------------------------------------------------------------------------------------------
// Runtime (network, browser)

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
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** Imports a package normally, else from the esoul-uat cache (works for ESM-only packages). */
async function importPackage(name) {
    try {
        return await import(name);
    } catch {
        /* fall through to the cache */
    }
    try {
        const dir = join(cacheRoot, 'node_modules', name);
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        const exp = pkg.exports?.['.'] ?? pkg.exports;
        const entry = (typeof exp === 'string' ? exp : exp?.import?.default ?? exp?.import ?? exp?.default) ?? pkg.main ?? 'index.js';
        return await import(pathToFileURL(join(dir, typeof entry === 'string' ? entry : pkg.main ?? 'index.js')).href);
    } catch {
        return null;
    }
}

async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch {
        try {
            return createRequire(join(cacheRoot, 'package.json'))('playwright');
        } catch {
            return null;
        }
    }
}

const hasChrome = () => ['/Applications/Google Chrome.app', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].some(existsSync);

async function fetchText(url, timeout = 20000) {
    try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), headers: { 'user-agent': 'esoul-snapshot/1.0', accept: 'text/html,application/xml,text/plain,*/*' } });
        return { ok: res.ok, status: res.status, finalUrl: res.url, text: res.ok ? await res.text() : '' };
    } catch (error) {
        return { ok: false, status: 0, finalUrl: url, text: '', error: String(error.message ?? error) };
    }
}

async function discover(o) {
    if (!o.base) die('Chybí --base.');
    const max = o.max ? Number.parseInt(o.max, 10) : 200;
    if (!(max > 0)) die('--max musí být kladné číslo.');
    const home = await fetchText(o.base);
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
        sources.push(`${home.finalUrl} (odkazy z home)`);
    }
    const seen = new Set();
    const urls = [];
    for (const raw of candidates) {
        const url = normalizeUrl(raw, origin);
        if (!url || seen.has(url) || !sameSite(url, origin) || isAssetUrl(url) || isJunkUrl(url)) continue;
        seen.add(url);
        urls.push(url);
    }
    const result = { base: origin, sources, total: urls.length, shown: Math.min(urls.length, max), nav, groups: groupByPattern(urls.slice(0, max)) };
    if (o.json) return console.log(JSON.stringify(result, null, 2));
    console.log(`Základ: ${origin}\nZdroje: ${sources.join('; ') || 'žádné (home se nepodařilo načíst)'}`);
    console.log(`Kandidátů: ${result.total}${result.total > max ? ` (zobrazeno prvních ${max})` : ''}\n`);
    if (nav.length) console.log(`Hlavní navigace (${nav.length}):\n${nav.map((u) => `  ${u}`).join('\n')}\n`);
    console.log('Šablony podle cesty:');
    for (const g of result.groups) console.log(`  ${g.pattern}  (${g.count})  např. ${g.examples.join(', ')}`);
    if (result.total === 0) process.exitCode = 1;
}

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

async function runLighthouse(entries, outDir, notes) {
    const lighthouse = (await importPackage('lighthouse'))?.default;
    const chromeLauncher = await importPackage('chrome-launcher');
    if (!lighthouse || !chromeLauncher) return null;
    mkdirSync(join(outDir, 'lighthouse'), { recursive: true });
    const results = [];
    for (const { n, slug, url, nn } of entries) {
        const entry = { n, slug, url, formFactor: 'mobile' };
        const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
        try {
            const run = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error' });
            const lhr = run.lhr;
            const file = `lighthouse/${nn}-${slug}.json`;
            writeFileSync(join(outDir, file), typeof run.report === 'string' ? run.report : JSON.stringify(lhr));
            const score = (id) => (lhr.categories[id]?.score == null ? null : Math.round(lhr.categories[id].score * 100));
            const metric = (id) => lhr.audits[id]?.numericValue ?? null;
            Object.assign(entry, {
                lighthouseVersion: lhr.lighthouseVersion,
                categories: { performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), seo: score('seo') },
                metrics: { lcp: metric('largest-contentful-paint'), cls: metric('cumulative-layout-shift'), tbt: metric('total-blocking-time'), fcp: metric('first-contentful-paint'), speedIndex: metric('speed-index') },
                report: file,
            });
        } catch (error) {
            entry.error = String(error.message ?? error);
        } finally {
            await chrome.kill();
        }
        results.push(entry);
    }
    notes.push('Lighthouse: mobile emulace, simulované throttling, výchozí nastavení Lighthouse.');
    return results;
}

const addError = (record, message) => {
    record.error = record.error ? `${record.error}; ${message}` : message;
};

async function capture(o) {
    for (const key of ['base', 'urls', 'out']) if (typeof o[key] !== 'string') die(`Chybí --${key}.`);
    const label = o.label ?? 'pred';
    if (!['pred', 'po'].includes(label)) die('--label musí být pred nebo po.');
    const date = o.date ?? new Date().toLocaleDateString('sv-SE');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die('--date musí být YYYY-MM-DD.');
    const deviceIds = list(o.devices).length ? list(o.devices) : ['desktop', 'mobile'];
    for (const id of deviceIds) if (!DEVICES[id]) die(`Neznámé zařízení ${id} (${Object.keys(DEVICES).join(', ')}).`);
    const wayback = typeof o.wayback === 'string' ? o.wayback : null;
    if (o.wayback !== undefined && !/^\d{4,14}$/.test(wayback ?? '')) die('--wayback vyžaduje časové razítko (YYYYMMDD nebo YYYYMMDDhhmmss).');
    let lhCount = 0;
    if (o.lighthouse !== undefined) {
        lhCount = o.lighthouse === true ? 3 : Number.parseInt(o.lighthouse, 10);
        if (!(lhCount > 0)) die('--lighthouse očekává kladné číslo.');
    }
    const pw = await loadPlaywright();
    if (!pw) die(`playwright chybí: ${INSTALL_PLAYWRIGHT}`);
    if (lhCount > 0 && !wayback && !((await importPackage('lighthouse')) && (await importPackage('chrome-launcher')))) die(`lighthouse chybí: ${INSTALL_LIGHTHOUSE}`);

    let entries;
    try {
        entries = parseUrlsFile(readFileSync(o.urls, 'utf8'), o.base);
    } catch (error) {
        die(error.message);
    }
    if (entries.length === 0) die('Soubor s URL je prázdný.');
    const outDir = resolve(o.out, date);
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
            if (Object.keys(record.shots).length === 0 && !record.error) record.error = 'bez snímků';
            pages.push(record);
            console.log(`${record.error ? '✗' : '✓'} ${nn(entry.n)} ${entry.url}${record.error ? ` – ${record.error}` : ''}`);
        }
    } finally {
        await browser.close();
    }

    let lighthouse = null;
    if (lhCount > 0 && wayback) notes.push('Lighthouse přeskočen: zdrojem je Wayback Machine, měření archivu by nebylo vypovídající.');
    else if (lhCount > 0) {
        lighthouse = await runLighthouse(entries.slice(0, lhCount).map((e) => ({ ...e, nn: nn(e.n) })), outDir, notes);
    } else notes.push('Lighthouse nebyl spuštěn (bez --lighthouse).');
    if (wayback) notes.push(`Zdroj: Wayback Machine, požadované razítko ${wayback}; skutečná razítka jsou u stránek v waybackActual.`);
    if (pages.some((p) => Object.values(p.cookies ?? {}).includes('none'))) notes.push('U některých stránek nebyla nalezena cookie lišta; ověř snímky očima.');
    notes.push('Zkontroluj osobní údaje na snímcích (jména v recenzích, portréty bez souhlasu) před pushem.');

    const devices = Object.fromEntries(deviceIds.map((id) => [id, { width: DEVICES[id].viewport.width, height: DEVICES[id].viewport.height, deviceScaleFactor: DEVICES[id].deviceScaleFactor }]));
    const manifest = buildManifest({ label, date, base: o.base, source: wayback ? 'wayback' : 'live', waybackTimestamp: wayback ?? undefined, devices, pages, lighthouse, notes });
    writeJsonAtomic(join(outDir, 'manifest.json'), manifest);
    console.log(formatSummary(manifest, dirSize(outDir), outDir));
    if (summarize(manifest).ok === 0) process.exitCode = 1;
}

async function check() {
    const pw = await loadPlaywright();
    const lh = (await importPackage('lighthouse')) && (await importPackage('chrome-launcher'));
    console.log(pw ? '✓ playwright dostupný' : `✗ playwright chybí: ${INSTALL_PLAYWRIGHT}`);
    console.log(lh ? '✓ lighthouse dostupný' : `✗ lighthouse chybí (jen pro --lighthouse): ${INSTALL_LIGHTHOUSE}`);
    console.log(hasChrome() ? '✓ Google Chrome nainstalovaný' : '✗ Google Chrome nenalezen');
    process.exit(pw && hasChrome() ? 0 : 1);
}

async function main(argv) {
    const o = parseArgs(argv);
    const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
    if (o.check) return check();
    if (command === 'discover') return discover(o);
    if (command === 'capture') return capture(o);
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n'));
    process.exitCode = command || argv.length ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => die(error.stack ?? String(error)));
}
