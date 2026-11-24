// Self-test of snapshot.mjs: node --test scripts/snapshot.test.mjs
// The URL, sitemap and slug helpers are tested with web.mjs in the esoul-quality-gates skill. Discovery runs against a
// local HTTP server; the capture test needs Playwright and Google Chrome and is skipped without them.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { hasChrome, loadPlaywright } from '../../esoul-quality-gates/scripts/web.mjs';
import {
    TOOL_NAME,
    buildManifest,
    captureSite,
    dirSize,
    discoverSite,
    formatDiscovery,
    formatSummary,
    parseCaptureOptions,
    summarize,
    waybackUrl,
    writeJsonAtomic,
} from './snapshot.mjs';

const SCRIPT = fileURLToPath(new URL('./snapshot.mjs', import.meta.url));
const run = promisify(execFile);
const temp = mkdtempSync(path.join(tmpdir(), 'esoul-snapshot-'));
after(() => rmSync(temp, { recursive: true, force: true }));

const BASE = 'https://stary.example.cz';

test('waybackUrl uses the if_ mode', () => {
    assert.equal(waybackUrl('20200115', 'https://example.com/'), 'https://web.archive.org/web/20200115if_/https://example.com/');
});

test('buildManifest has the documented shape; waybackTimestamp only for wayback', () => {
    const pages = [
        { n: 1, slug: 'home', url: `${BASE}/`, finalUrl: `${BASE}/`, status: 200, title: 'Úvod', shots: { desktop: { full: 'desktop/01-home.png', fold: 'desktop/01-home-fold.png' } } },
        { n: 2, slug: 'x', url: `${BASE}/x`, finalUrl: null, status: null, title: '', shots: {}, error: 'HTTP 404' },
    ];
    const live = buildManifest({ label: 'pred', date: '2026-11-12', base: BASE, devices: { desktop: { width: 1440 } }, pages, capturedAt: '2026-11-12T10:00:00.000Z' });
    assert.deepEqual(Object.keys(live), ['label', 'date', 'base', 'source', 'capturedAt', 'tool', 'toolVersion', 'devices', 'pages', 'lighthouse', 'notes']);
    assert.equal(live.source, 'live');
    assert.equal(live.tool, TOOL_NAME);
    assert.equal(live.lighthouse, null);
    const old = buildManifest({ label: 'pred', date: '2026-11-12', base: BASE, source: 'wayback', waybackTimestamp: '20200115', devices: {}, pages: [] });
    assert.equal(old.waybackTimestamp, '20200115');
    assert.deepEqual(summarize(live), { ok: 1, failed: 1, shots: 2, lighthouse: 0 });
    assert.match(formatSummary(live, 3 * 1048576, '/out'), /1 pages ok, 1 failed, 2 screenshots, 3\.0 MB/);
});

test('writeJsonAtomic leaves only the final file; dirSize sums nested files', () => {
    const dir = path.join(temp, 'out');
    mkdirSync(path.join(dir, 'desktop'), { recursive: true });
    writeFileSync(path.join(dir, 'desktop', 'a.png'), Buffer.alloc(1000));
    writeJsonAtomic(path.join(dir, 'manifest.json'), { a: 1 });
    assert.deepEqual(readdirSync(dir).sort(), ['desktop', 'manifest.json']);
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')), { a: 1 });
    assert.ok(dirSize(dir) > 1000);
});

test('parseCaptureOptions applies defaults and rejects invalid options', () => {
    const ok = parseCaptureOptions({ base: BASE, urls: 'u.txt', out: 'o', date: '2026-11-12' });
    assert.deepEqual([ok.label, ok.date, ok.deviceIds, ok.wayback, ok.lhCount], ['pred', '2026-11-12', ['desktop', 'mobile'], null, 0]);
    assert.equal(parseCaptureOptions({ base: BASE, urls: 'u', out: 'o', lighthouse: true }).lhCount, 3);
    assert.equal(parseCaptureOptions({ base: BASE, urls: 'u', out: 'o', lighthouse: '5', devices: 'mobile', label: 'po', wayback: '20200115' }).lhCount, 5);
    assert.throws(() => parseCaptureOptions({ urls: 'u', out: 'o' }), /Missing --base/);
    assert.throws(() => parseCaptureOptions({ base: BASE, urls: 'u', out: 'o', label: 'x' }), /--label/);
    assert.throws(() => parseCaptureOptions({ base: BASE, urls: 'u', out: 'o', date: '12.11.2026' }), /--date/);
    assert.throws(() => parseCaptureOptions({ base: BASE, urls: 'u', out: 'o', devices: 'tablet' }), /Unknown device tablet/);
    assert.throws(() => parseCaptureOptions({ base: BASE, urls: 'u', out: 'o', wayback: true }), /--wayback/);
    assert.throws(() => parseCaptureOptions({ base: BASE, urls: 'u', out: 'o', lighthouse: '0' }), /--lighthouse/);
});

// --- local site: discovery and capture

const CONSENT_BUTTON = '<div id="banner" style="position:fixed;bottom:0;left:0;background:#eee"><button onclick="document.getElementById(\'banner\').remove()">Přijmout vše</button></div>';
const PAGES = {
    '/': `<html><head><title>Úvod</title></head><body><header><nav><a href="/sluzby">Služby</a><a href="/kontakt">Kontakt</a></nav></header>
        <main><h1>Úvod</h1><a href="/blog/a">A</a><a href="/cenik.pdf">PDF</a><a href="/wp-json/x">json</a><a href="https://example.org/">external</a></main></body></html>`,
    '/sluzby': '<html><head><title>Služby</title></head><body><h1>Služby</h1><p>Text</p></body></html>',
    '/kontakt': `<html><head><title>Kontakt</title></head><body><h1>Kontakt</h1>${CONSENT_BUTTON}</body></html>`,
    '/blog/a': '<html><head><title>Článek</title></head><body><h1>Článek</h1><img loading="lazy" alt="" src="/pixel.png"><div id="onetrust-consent-sdk">consent</div></body></html>',
};

function startSite({ sitemap = true } = {}) {
    let origin = '';
    const server = createServer((req, res) => {
        const p = new URL(req.url, origin).pathname;
        const send = (status, type, body) => {
            res.writeHead(status, { 'content-type': type });
            res.end(body);
        };
        if (p === '/robots.txt') return send(200, 'text/plain', sitemap ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap_index.xml\n` : 'User-agent: *\nAllow: /\n');
        if (sitemap && p === '/sitemap_index.xml') return send(200, 'application/xml', `<sitemapindex><sitemap><loc>${origin}/s1.xml</loc></sitemap></sitemapindex>`);
        if (sitemap && p === '/s1.xml') {
            const locs = ['/', '/sluzby', '/kontakt', '/blog/a', '/cenik.pdf', '/feed/', '/wp-json/x'].map((x) => `<url><loc>${origin}${x}</loc></url>`);
            return send(200, 'application/xml', `<urlset>${locs.join('')}<url><loc>https://example.org/cizi</loc></url></urlset>`);
        }
        if (p === '/pixel.png') return send(200, 'image/png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
        if (PAGES[p]) return send(200, 'text/html; charset=utf-8', PAGES[p]);
        return send(404, 'text/html', '<h1>nope</h1>');
    });
    return new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () => {
            origin = `http://127.0.0.1:${server.address().port}`;
            resolve({ origin, close: () => new Promise((r) => server.close(r)) });
        }),
    );
}

test('discoverSite reads robots.txt, a sitemap index and groups templates; assets, junk and foreign hosts are dropped', async () => {
    const site = await startSite();
    try {
        const result = await discoverSite({ base: site.origin });
        assert.equal(result.base, site.origin);
        assert.equal(result.sources.length, 2);
        assert.match(result.sources[0], /sitemap_index\.xml \(index, 1\)/);
        assert.match(result.sources[1], /s1\.xml \(urlset, 8\)/);
        assert.equal(result.total, 4);
        assert.deepEqual(result.nav, [`${site.origin}/sluzby`, `${site.origin}/kontakt`]);
        assert.deepEqual(result.groups.map((g) => [g.pattern, g.count]), [['/', 1], ['/*', 2], ['/blog/*', 1]]);
        const text = formatDiscovery(result, 200);
        assert.match(text, /Candidates: 4\n/);
        assert.match(text, /Main navigation \(2\)/);
        assert.match(text, /\/blog\/\*  \(1\)  e\.g\. \/blog\/a/);
    } finally {
        await site.close();
    }
});

test('discoverSite falls back to the links of the home page and honours --max', async () => {
    const site = await startSite({ sitemap: false });
    try {
        const result = await discoverSite({ base: site.origin, max: 2 });
        assert.match(result.sources[0], /links from home/);
        assert.equal(result.total, 3);
        assert.equal(result.shown, 2);
        assert.match(formatDiscovery(result, 2), /Candidates: 3 \(first 2 shown\)/);
    } finally {
        await site.close();
    }
});

test('CLI: discover prints the template groups; a site that cannot be read exits 1; bad usage exits 2', async () => {
    const site = await startSite();
    try {
        const ok = await run('node', [SCRIPT, 'discover', '--base', site.origin, '--max', '10']);
        assert.match(ok.stdout, /Templates by path:/);
        const json = JSON.parse((await run('node', [SCRIPT, 'discover', '--base', site.origin, '--json'])).stdout);
        assert.equal(json.total, 4);
    } finally {
        await site.close();
    }
    await assert.rejects(run('node', [SCRIPT, 'discover', '--base', 'http://127.0.0.1:1']), (error) => error.code === 1);
    await assert.rejects(run('node', [SCRIPT, 'capture', '--base', BASE]), (error) => error.code === 1 && /Missing --urls/.test(error.stderr));
    await assert.rejects(run('node', [SCRIPT, 'nonsense']), (error) => error.code === 2);
});

const browserReady = Boolean(await loadPlaywright()) && hasChrome();

test('captureSite shoots every page and device, dismisses or hides the cookie banner and records failures', { skip: !browserReady }, async () => {
    const site = await startSite();
    try {
        const entries = [
            { n: 1, url: `${site.origin}/kontakt`, slug: 'kontakt' },
            { n: 2, url: `${site.origin}/blog/a`, slug: 'blog-a' },
            { n: 3, url: `${site.origin}/sluzby`, slug: 'sluzby' },
            { n: 4, url: `${site.origin}/missing`, slug: 'missing' },
        ];
        const out = path.join(temp, 'case-study', 'pred');
        const manifest = await captureSite({ base: site.origin, entries, out, label: 'pred', date: '2026-11-12', deviceIds: ['desktop', 'mobile'], log: () => {} });
        const dir = path.join(out, '2026-11-12');
        assert.deepEqual(JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')), JSON.parse(JSON.stringify(manifest)));
        assert.deepEqual(summarize(manifest), { ok: 3, failed: 1, shots: 12, lighthouse: 0 });
        for (const file of ['desktop/01-kontakt.png', 'desktop/01-kontakt-fold.png', 'mobile/02-blog-a.png', 'mobile/03-sluzby-fold.png']) assert.ok(existsSync(path.join(dir, file)), file);
        const [kontakt, blog, sluzby, missing] = manifest.pages;
        assert.equal(kontakt.cookies.desktop, 'přijmout vše');
        assert.equal(blog.cookies.desktop, 'hidden:#onetrust-consent-sdk');
        assert.equal(sluzby.cookies.desktop, 'none');
        assert.equal(sluzby.status, 200);
        assert.match(missing.error, /HTTP 404/);
        assert.deepEqual(missing.shots, {});
        assert.equal(manifest.source, 'live');
        assert.equal(manifest.lighthouse, null);
        assert.ok(manifest.notes.some((n) => /Lighthouse was not run/.test(n)));
        assert.ok(manifest.notes.some((n) => /No cookie banner/.test(n)));
    } finally {
        await site.close();
    }
});

test('CLI: capture writes the manifest and prints the summary', { skip: !browserReady }, async () => {
    const site = await startSite();
    try {
        const urls = path.join(temp, 'urls.txt');
        writeFileSync(urls, '/sluzby | Services\n');
        const out = path.join(temp, 'cli', 'pred');
        const { stdout } = await run('node', [SCRIPT, 'capture', '--base', site.origin, '--urls', urls, '--out', out, '--date', '2026-11-12', '--devices', 'desktop']);
        assert.match(stdout, /pred 2026-11-12: 1 pages ok, 0 failed, 2 screenshots/);
        assert.ok(existsSync(path.join(out, '2026-11-12', 'desktop', '01-services.png')));
    } finally {
        await site.close();
    }
});
