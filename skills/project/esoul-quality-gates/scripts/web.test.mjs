// Self-test of web.mjs and lighthouse-gate.mjs (no network, no browser): node --test scripts/web.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BUDGETS, evaluate, formatReport, withBudgets } from './lighthouse-gate.mjs';
import {
    extractLinks,
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
} from './web.mjs';

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
        '# home page',
        '/',
        '',
        'kontakt | Kontaktní formulář',
        `${BASE}/blog/clanek-1 # inline comment`,
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
    assert.throws(() => parseUrlsFile('/kontakt', undefined), /Line 1/);
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

const good = { categories: { performance: 92, accessibility: 100, bestPractices: 100, seo: 100 }, metrics: { lcp: 2100, cls: 0.01 } };
const status = (checks) => Object.fromEntries(checks.map((c) => [c.metric, c.status]));

test('Lighthouse budgets: the eSoul defaults', () => {
    assert.deepEqual(BUDGETS, {
        performance: { min: 90 },
        accessibility: { min: 100 },
        bestPractices: { min: 100 },
        seo: { min: 100 },
        lcp: { max: 2500, unit: 'ms' },
        cls: { max: 0.05 },
    });
});

test('evaluate passes values on the budget and fails the ones beside it', () => {
    assert.ok(evaluate(good).every((c) => c.status === 'pass'));
    const edge = evaluate({ categories: { ...good.categories, performance: 90 }, metrics: { lcp: 2499, cls: 0.05 } });
    assert.deepEqual(status(edge), { performance: 'pass', accessibility: 'pass', bestPractices: 'pass', seo: 'pass', lcp: 'pass', cls: 'fail' });
    const bad = evaluate({ categories: { performance: 89, accessibility: 99, bestPractices: 100, seo: 100 }, metrics: { lcp: 2500, cls: 0.04 } });
    assert.deepEqual(status(bad), { performance: 'fail', accessibility: 'fail', bestPractices: 'pass', seo: 'pass', lcp: 'fail', cls: 'pass' });
});

test('evaluate skips SEO on staging and fails a missing value', () => {
    const staging = evaluate({ ...good, categories: { ...good.categories, seo: 66 } }, { staging: true });
    assert.equal(status(staging).seo, 'skipped');
    assert.equal(status(evaluate({ categories: {}, metrics: {} })).performance, 'fail');
});

test('withBudgets replaces numbers of the project and rejects unknown metrics or values', () => {
    const custom = withBudgets(['performance=80', 'lcp=3000', 'cls=0.1']);
    assert.deepEqual([custom.performance.min, custom.lcp.max, custom.cls.max], [80, 3000, 0.1]);
    assert.equal(BUDGETS.performance.min, 90, 'the defaults stay untouched');
    assert.equal(status(evaluate({ ...good, metrics: { lcp: 2800, cls: 0.08 } }, { budgets: custom })).lcp, 'pass');
    assert.throws(() => withBudgets(['speed=1']), /Invalid --budget/);
    assert.throws(() => withBudgets(['performance=high']), /Invalid --budget/);
    assert.throws(() => withBudgets(['performance']), /Invalid --budget/);
});

test('formatReport lists failures and the summary line', () => {
    const text = formatReport([
        { url: 'https://a.cz/', checks: evaluate(good) },
        { url: 'https://a.cz/x', checks: evaluate({ ...good, metrics: { lcp: 4000, cls: 0.01 } }) },
        { url: 'https://a.cz/y', error: 'timeout' },
    ]);
    assert.match(text, /OK {3}https:\/\/a\.cz\/\n/);
    assert.match(text, /FAIL https:\/\/a\.cz\/x/);
    assert.match(text, /FAIL https:\/\/a\.cz\/y: timeout/);
    assert.match(text, /1\/3 pages within budget\./);
});
