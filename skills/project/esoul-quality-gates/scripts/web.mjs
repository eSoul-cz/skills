/**
 * Shared helpers of the eSoul website scripts: URL, sitemap and link handling, and runtime
 * loading of Playwright and Lighthouse from the shared cache (`~/.cache/esoul-uat`).
 * Used by `ai-readiness.mjs`, `lighthouse-gate.mjs` and by `snapshot.mjs` of `esoul-website-launch`.
 * Node >= 22. The pure helpers need neither network nor browser.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const cacheRoot = join(homedir(), '.cache', 'esoul-uat');
export const INSTALL_PLAYWRIGHT = `npm install --prefix ${cacheRoot} playwright@1`;
export const INSTALL_LIGHTHOUSE = `npm install --prefix ${cacheRoot} lighthouse@12`;

// Headless Chrome announces itself as "HeadlessChrome", which some old sites and WAFs answer with 403.
export const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------------------------
// Pure helpers

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
        if (!url) throw new Error(`Line ${i + 1}: invalid URL "${target}" (a relative path needs --base).`);
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

export const decodeXml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

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

// ---------------------------------------------------------------------------------------------
// Runtime (browser, Lighthouse)

/** Imports a package normally, else from the esoul-uat cache (works for ESM-only packages). */
export async function importPackage(name) {
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

export async function loadPlaywright() {
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

export const hasChrome = () => ['/Applications/Google Chrome.app', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].some(existsSync);

/** True when both Lighthouse and the Chrome launcher can be imported. */
export async function hasLighthouse() {
    return Boolean((await importPackage('lighthouse')) && (await importPackage('chrome-launcher')));
}

/**
 * Mobile Lighthouse (default emulation and simulated throttling) for [{ url, file }]; writes the full
 * JSON report to `<outDir>/<file>`. Returns [{ url, file, categories, metrics, lighthouseVersion }] or
 * { url, error } per URL, null when Lighthouse is not installed.
 */
export async function runLighthouse(targets, outDir, { headers } = {}) {
    const lighthouse = (await importPackage('lighthouse'))?.default;
    const chromeLauncher = await importPackage('chrome-launcher');
    if (!lighthouse || !chromeLauncher) return null;
    const results = [];
    for (const { url, file } of targets) {
        const entry = { url, formFactor: 'mobile' };
        const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] });
        try {
            const run = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', ...(headers ? { extraHeaders: headers } : {}) });
            const lhr = run.lhr;
            mkdirSync(join(outDir, file, '..'), { recursive: true });
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
    return results;
}
