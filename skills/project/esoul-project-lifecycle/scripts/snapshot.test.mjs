// Self-test of snapshot.mjs (no network, no browser): node --test scripts/snapshot.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
    TOOL_NAME,
    buildManifest,
    dirSize,
    extractLinks,
    formatSummary,
    groupByPattern,
    isAssetUrl,
    isJunkUrl,
    normalizeUrl,
    parseRobotsSitemaps,
    parseSitemapXml,
    parseUrlsFile,
    patternOf,
    slugFromUrl,
    slugify,
    summarize,
    waybackUrl,
    writeJsonAtomic,
} from './snapshot.mjs';

const temp = mkdtempSync(path.join(tmpdir(), 'esoul-snapshot-'));
after(() => rmSync(temp, { recursive: true, force: true }));

const BASE = 'https://stary.example.cz';

test('slugify folds Czech diacritics and punctuation', () => {
    assert.equal(slugify('Příliš žluťoučký kůň'), 'prilis-zlutoucky-kun');
    assert.equal(slugify('  Kontakt & Mapa!  '), 'kontakt-mapa');
    assert.equal(slugify('Łódź ß'), 'lodz-ss');
    assert.equal(slugify('---'), '');
    assert.ok(slugify('a'.repeat(100)).length <= 60);
});

test('slugFromUrl uses home for the root and the path otherwise', () => {
    assert.equal(slugFromUrl(`${BASE}/`), 'home');
    assert.equal(slugFromUrl(`${BASE}/o-nás/tým/`), 'o-nas-tym');
    assert.equal(slugFromUrl(`${BASE}/hledat?q=boty`), 'hledat-q-boty');
    assert.equal(slugFromUrl(`${BASE}/?p=12`), 'p-12');
});

test('parseUrlsFile handles comments, slug overrides, relative paths and duplicates', () => {
    const text = [
        '# domovská stránka',
        '/',
        '',
        'kontakt | Kontaktní formulář',
        `${BASE}/blog/clanek-1 # inline komentář`,
        '/kontakt',
        '/produkt/a',
        '/produkt/a#recenze',
        '/produkt/b | kontakt-formular',
        '/produkt/c | kontakt-formular',
    ].join('\n');
    const entries = parseUrlsFile(text, BASE);
    assert.deepEqual(
        entries.map((e) => [e.n, e.url, e.slug]),
        [
            [1, `${BASE}/`, 'home'],
            [2, `${BASE}/kontakt`, 'kontaktni-formular'],
            [3, `${BASE}/blog/clanek-1`, 'blog-clanek-1'],
            [4, `${BASE}/produkt/a`, 'produkt-a'],
            [5, `${BASE}/produkt/b`, 'kontakt-formular'],
            [6, `${BASE}/produkt/c`, 'kontakt-formular-2'],
        ],
    );
});

test('parseUrlsFile rejects a relative path without a base', () => {
    assert.throws(() => parseUrlsFile('/kontakt', undefined), /Řádek 1/);
    assert.equal(parseUrlsFile('https://a.cz/x', undefined)[0].url, 'https://a.cz/x');
});

test('parseSitemapXml reads urlsets, indexes, CDATA and entities', () => {
    const urlset = `<?xml version="1.0"?><urlset xmlns:xhtml="x"><url><loc>https://a.cz/?a=1&amp;b=2</loc><xhtml:link href="https://a.cz/en"/></url>
        <url><loc><![CDATA[https://a.cz/kontakt]]></loc></url></urlset>`;
    assert.deepEqual(parseSitemapXml(urlset), { type: 'urlset', locs: ['https://a.cz/?a=1&b=2', 'https://a.cz/kontakt'] });
    const index = '<sitemapindex><sitemap><loc>https://a.cz/s1.xml</loc></sitemap><sitemap><loc> https://a.cz/s2.xml </loc></sitemap></sitemapindex>';
    assert.deepEqual(parseSitemapXml(index), { type: 'index', locs: ['https://a.cz/s1.xml', 'https://a.cz/s2.xml'] });
});

test('parseRobotsSitemaps collects Sitemap lines case-insensitively', () => {
    assert.deepEqual(parseRobotsSitemaps('User-agent: *\nDisallow: /x\nSitemap: https://a.cz/s.xml\nsitemap:https://a.cz/t.xml\n'), ['https://a.cz/s.xml', 'https://a.cz/t.xml']);
});

test('normalizeUrl strips fragments and ignores non-page schemes', () => {
    assert.equal(normalizeUrl('/a#x', BASE), `${BASE}/a`);
    assert.equal(normalizeUrl('mailto:a@b.cz', BASE), null);
    assert.equal(normalizeUrl('tel:123', BASE), null);
    assert.equal(normalizeUrl('#top', BASE), null);
    assert.equal(normalizeUrl('javascript:void(0)', BASE), null);
});

test('asset and junk filters', () => {
    assert.ok(isAssetUrl(`${BASE}/files/cenik.PDF`));
    assert.ok(isAssetUrl(`${BASE}/img/a.webp?x=1`));
    assert.ok(!isAssetUrl(`${BASE}/produkt/a`));
    assert.ok(isJunkUrl(`${BASE}/clanek/?replytocom=5`));
    assert.ok(isJunkUrl(`${BASE}/feed/`));
    assert.ok(isJunkUrl(`${BASE}/wp-json/wp/v2/posts`));
    assert.ok(!isJunkUrl(`${BASE}/blog/feedback`));
});

const HTML = `<html><body>
<a href="/zapati-only">footer-ish first in source</a>
<header><nav><a href="/sluzby">Služby</a><a href="https://www.stary.example.cz/kontakt#form">Kontakt</a><a href="https://facebook.com/x">FB</a></nav></header>
<main><a href="/blog/a">A</a><a href='/blog/a#komentare'>A again</a><a href="/cenik.pdf">PDF</a><a href="/feed/">RSS</a><a href="mailto:x@y.cz">mail</a></main>
<footer><a href="/ochrana-udaju">GDPR</a><a href="/sluzby">dup</a></footer></body></html>`;

test('extractLinks: same-site only, navigation first, assets and junk dropped, deduped', () => {
    assert.deepEqual(extractLinks(HTML, `${BASE}/`), [
        `${BASE}/sluzby`,
        'https://www.stary.example.cz/kontakt',
        `${BASE}/ochrana-udaju`,
        `${BASE}/zapati-only`,
        `${BASE}/blog/a`,
    ]);
    assert.deepEqual(extractLinks(HTML, `${BASE}/`, { navOnly: true }), [`${BASE}/sluzby`, 'https://www.stary.example.cz/kontakt']);
});

test('patternOf and groupByPattern guess templates', () => {
    assert.equal(patternOf(`${BASE}/`), '/');
    assert.equal(patternOf(`${BASE}/kontakt`), '/*');
    assert.equal(patternOf(`${BASE}/produkt/a`), '/produkt/*');
    assert.equal(patternOf(`${BASE}/produkt/a/b`), '/produkt/*');
    assert.equal(patternOf(`${BASE}/cs/kontakt`), '/cs/*');
    assert.equal(patternOf(`${BASE}/cs/blog/a`), '/cs/blog/*');
    const urls = [
        `${BASE}/`,
        `${BASE}/o-nas`,
        `${BASE}/kontakt`,
        ...Array.from({ length: 5 }, (_, i) => `${BASE}/produkt/p${i}`),
        `${BASE}/blog/a?x=1`,
        `${BASE}/blog/b`,
    ];
    const groups = groupByPattern(urls, { examples: 2 });
    assert.deepEqual(groups.map((g) => [g.pattern, g.count]), [['/', 1], ['/*', 2], ['/produkt/*', 5], ['/blog/*', 2]]);
    assert.deepEqual(groups[2].examples, ['/produkt/p0', '/produkt/p1']);
    assert.deepEqual(groups[3].examples, ['/blog/a?x=1', '/blog/b']);
    assert.deepEqual(groups[1].examples, ['/o-nas', '/kontakt']);
});

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
    assert.match(formatSummary(live, 3 * 1048576, '/out'), /1 stránek ok, 1 selhalo, 2 snímků, 3\.0 MB/);
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
