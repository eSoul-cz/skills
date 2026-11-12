import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
    applyExceptions,
    botResponseProblems,
    checkCaptcha,
    checkFacts,
    checkHtmlBasics,
    checkJsonLd,
    checkPolicies,
    checkProductData,
    checkRobots,
    candidatePool,
    classifyPage,
    computeScore,
    exitCodeOf,
    isPageUrl,
    loadSitemaps,
    pickUrls,
    parseCli,
    parseExceptions,
    parseRobots,
    parseSitemapEntries,
    robotsAllows,
    ssrCoverage,
    ssrFindings,
    validateFeed,
    xmlError,
} from './ai-readiness.mjs';
import { loadPlaywright } from './snapshot.mjs';

const SCRIPT = fileURLToPath(new URL('./ai-readiness.mjs', import.meta.url));
const run = promisify(execFile);

// --- robots.txt

const allows = (txt, agent, path) => robotsAllows(parseRobots(txt), agent, path);

test('robots: user-agent skupiny, fallback na *, sloučení skupin', () => {
    const txt = 'User-agent: *\nDisallow: /private\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: GPTBot\nAllow: /public\n';
    assert.equal(allows(txt, 'Googlebot', '/private/x'), false);
    assert.equal(allows(txt, 'Googlebot', '/a'), true);
    assert.equal(allows(txt, 'gptbot', '/a'), false); // vlastní skupina vytlačí *
    assert.equal(allows(txt, 'GPTBot', '/public/a'), true); // dvě skupiny se sloučí
    const multi = 'User-agent: A\nUser-agent: B\nDisallow: /x\n';
    assert.equal(allows(multi, 'B', '/x'), false);
    assert.equal(allows(multi, 'C', '/x'), true);
});

test('robots: nejdelší shoda, Allow vyhrává při shodě, prázdný Disallow', () => {
    const txt = 'User-agent: *\nDisallow: /shop\nAllow: /shop/open\nDisallow: /a\nAllow: /a\n';
    assert.equal(allows(txt, 'x', '/shop/closed'), false);
    assert.equal(allows(txt, 'x', '/shop/open/1'), true);
    assert.equal(allows(txt, 'x', '/a'), true);
    assert.equal(allows('User-agent: *\nDisallow:\n', 'x', '/a'), true);
    assert.equal(allows('', 'x', '/a'), true);
});

test('robots: wildcardy * a $', () => {
    const txt = 'User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp*/cache\nDisallow: /*?s=\n';
    assert.equal(allows(txt, 'x', '/doc.pdf'), false);
    assert.equal(allows(txt, 'x', '/doc.pdf?x=1'), true);
    assert.equal(allows(txt, 'x', '/tmp123/cache'), false);
    assert.equal(allows(txt, 'x', '/search?s=a'), false);
    assert.equal(allows(txt, 'x', '/a/b'), true);
});

test('robots: komentáře a Sitemap', () => {
    const p = parseRobots('# c\nUser-agent: * # all\nDisallow: /x # no\nSitemap: https://a.cz/s.xml\n');
    assert.deepEqual(p.sitemaps, ['https://a.cz/s.xml']);
    assert.equal(robotsAllows(p, 'x', '/x'), false);
});

test('checkRobots: blokace bota, staging a Sitemap', () => {
    const base = { pagePaths: ['/a'], staging: false };
    const ok = checkRobots({ ...base, robots: { status: 200, headers: { 'content-type': 'text/plain' }, text: 'User-agent: *\nAllow: /\nSitemap: https://a.cz/s.xml' } });
    assert.equal(ok.status, 'pass');
    const blocked = checkRobots({ ...base, robots: { status: 200, headers: {}, text: 'User-agent: GPTBot\nDisallow: /\nSitemap: https://a.cz/s.xml' } });
    assert.equal(blocked.status, 'fail');
    assert.match(blocked.details[0].finding, /GPTBot/);
    assert.equal(checkRobots({ ...base, robots: { status: 404, headers: {}, text: '' } }).status, 'fail');
    const all = { status: 200, headers: {}, text: 'User-agent: *\nDisallow: /' };
    assert.equal(checkRobots({ ...base, staging: true, robots: all }).status, 'info');
    assert.equal(checkRobots({ ...base, staging: true, robots: { status: 404, headers: {}, text: '' } }).status, 'fail');
});

// --- exceptions

const MD = `# AI readiness

## Výjimky

| Kontrola | Rozsah | Důvod | Potvrdil | Datum |
|---|---|---|---|---|
| robots | * | Klient nechce trénink | Jana Nováková | 2026-11-01 |
| markdown | /blog | Blog bez MD | Petr | |
| sitemap | /x | Bez potvrzení | | 2026-11-01 |
| nesmysl | * | x | A | 2026-11-01 |
| _(žádná)_ | | | | |

## Další
| robots | * | ignorováno mimo sekci | A | 2026-01-01 |
`;

test('výjimky: potvrzený řádek platí, řádek bez Potvrdil/Datum je ignorován a vypsán', () => {
    const { applied, ignored } = parseExceptions(MD);
    assert.equal(applied.length, 1);
    assert.deepEqual(applied[0], { check: 'robots', scope: '*', reason: 'Klient nechce trénink', by: 'Jana Nováková', date: '2026-11-01' });
    assert.equal(ignored.length, 3);
    assert.match(ignored[0].reason, /Potvrdil nebo Datum/);
    assert.match(ignored[2].reason, /neznámá kontrola/);
    assert.deepEqual(parseExceptions('bez sekce'), { applied: [], ignored: [] });
});

const failing = (id, urls) => ({ id, level: 'must', status: 'fail', message: 'x', details: urls.map((u) => ({ url: u, finding: 'f' })) });

test('výjimky: rozsah * i prefix cesty, částečné pokrytí', () => {
    const ex = (scope) => ({ applied: [{ check: 'markdown', scope, reason: 'r', by: 'A', date: '2026-11-01' }], ignored: [] });
    const star = applyExceptions([failing('markdown', ['https://a.cz/blog/1', 'https://a.cz/x'])], ex('*'));
    assert.equal(star.checks[0].status, 'excepted');
    assert.equal(star.exceptions[0].status, 'applied');
    const full = applyExceptions([failing('markdown', ['https://a.cz/blog/1', 'https://a.cz/blog/2'])], ex('/blog'));
    assert.equal(full.checks[0].status, 'excepted');
    const part = applyExceptions([failing('markdown', ['https://a.cz/blog/1', 'https://a.cz/x'])], ex('/blog'));
    assert.equal(part.checks[0].status, 'fail');
    assert.deepEqual(part.checks[0].details.map((d) => d.url), ['https://a.cz/x']);
    assert.equal(exitCodeOf(part.checks), 1);
    const unused = applyExceptions([failing('markdown', ['https://a.cz/x'])], ex('/blog'));
    assert.equal(unused.exceptions[0].status, 'unused');
    const other = applyExceptions([failing('robots', ['https://a.cz/robots.txt'])], ex('*'));
    assert.equal(other.checks[0].status, 'fail');
    const ignored = applyExceptions([failing('markdown', [])], { applied: [], ignored: [{ row: 'r', reason: 'x' }] });
    assert.equal(ignored.exceptions[0].status, 'ignored');
    assert.equal(applyExceptions([failing('markdown', [])], ex('/blog')).checks[0].status, 'fail'); // globální nález jen přes *
});

test('skóre a exit kód', () => {
    const checks = [
        { id: 'a', level: 'must', status: 'pass', details: [] },
        { id: 'b', level: 'must', status: 'excepted', details: [] },
        { id: 'c', level: 'must', status: 'skipped', details: [] },
        { id: 'd', level: 'should', status: 'warn', details: [] },
        { id: 'e', level: 'should', status: 'pass', details: [] },
    ];
    assert.deepEqual(computeScore(checks), { must: '2/2', should: '1/2' });
    assert.equal(exitCodeOf(checks), 0);
});

// --- pure checks

const page = (url, html, extra = {}) => {
    const p = { url, finalUrl: url, status: 200, headers: {}, html, ...extra };
    return { ...p, kind: classifyPage(p) };
};

test('klasifikace stránek', () => {
    assert.equal(page('https://a.cz/', '').kind, 'home');
    assert.equal(page('https://a.cz/kontakt', '').kind, 'contact');
    assert.equal(page('https://a.cz/x', '<meta property="og:type" content="article"><meta property="article:published_time" content="2026-01-01">').kind, 'article');
    assert.equal(page('https://a.cz/p', '<script type="application/ld+json">{"@type":"Product"}</script>').kind, 'product');
});

test('html-basics: chybějící prvky a hreflang', () => {
    const bad = checkHtmlBasics([page('https://a.cz/', '<html><head><title></title><link rel="canonical" href="/x"></head>')]);
    assert.equal(bad.status, 'fail');
    assert.ok(bad.details.length >= 3);
    const good = `<html lang="cs"><head><title>T</title><meta name="description" content="d"><link rel="canonical" href="https://a.cz/">
        <link rel="alternate" hreflang="cs" href="https://a.cz/"><link rel="alternate" hreflang="x-default" href="https://a.cz/"></head>`;
    assert.equal(checkHtmlBasics([page('https://a.cz/', good)]).status, 'pass');
    const noX = good.replace('hreflang="x-default"', 'hreflang="en"');
    assert.match(checkHtmlBasics([page('https://a.cz/', noX)]).details[0].finding, /x-default/);
});

test('jsonld: rozbité bloky, home bez Organization, článek bez autora', () => {
    assert.equal(checkJsonLd([page('https://a.cz/', '<script type="application/ld+json">{oops</script>')]).status, 'fail');
    const home = '<script type="application/ld+json">{"@graph":[{"@type":"LocalBusiness"},{"@type":"WebSite"}]}</script>';
    assert.equal(checkJsonLd([page('https://a.cz/', home)]).status, 'pass');
    const art = '<script type="application/ld+json">{"@type":"BlogPosting","author":"A","datePublished":"2026-01-01"}</script>';
    const r = checkJsonLd([page('https://a.cz/blog/x', art)]);
    assert.equal(r.status, 'fail');
    assert.match(r.details[0].finding, /dateModified/);
    const crumbs = checkJsonLd([page('https://a.cz/o-nas', '<p>x</p>')]);
    assert.equal(crumbs.status, 'warn');
});

test('facts: telefon, adresa a IČO pro české weby', () => {
    const html = '<html lang="cs"><body><footer>Tel. 777 123 456, info@a.cz, Dlouhá 1, 110 00 Praha 1, IČO: 12345678</footer></body></html>';
    assert.equal(checkFacts([page('https://a.cz/', html)]).status, 'pass');
    assert.equal(checkFacts([page('https://a.cz/', html.replace('IČO: 12345678', ''))]).status, 'fail');
    assert.equal(checkFacts([page('https://a.cz/', html.replace('lang="cs"', 'lang="en"').replace('IČO: 12345678', ''))]).status, 'pass');
});

test('policies: eshop vyžaduje obchodní podmínky, doprava, vrácení', () => {
    const home = '<a href="/gdpr">Ochrana osobních údajů</a><a href="/vop">Obchodní podmínky</a>';
    assert.equal(checkPolicies([page('https://a.cz/', home)], 'website').status, 'pass');
    const r = checkPolicies([page('https://a.cz/', home)], 'eshop');
    assert.equal(r.status, 'fail');
    assert.equal(r.details.length, 2);
});

test('product-data: chybějící cena, upozornění na doručení a viditelnou cenu', () => {
    const ld = (offer) => `<script type="application/ld+json">{"@type":"Product","name":"N","image":"i.jpg","offers":${offer}}</script><p>Cena 1 290 Kč</p>`;
    const full = '{"price":"1290","priceCurrency":"CZK","availability":"InStock","shippingDetails":{},"hasMerchantReturnPolicy":{}}';
    assert.equal(checkProductData([page('https://a.cz/p', ld(full))]).status, 'pass');
    assert.equal(checkProductData([page('https://a.cz/p', ld('{"priceCurrency":"CZK","availability":"InStock"}'))]).status, 'fail');
    assert.equal(checkProductData([page('https://a.cz/p', ld(full.replace('1290', '990')))]).status, 'warn');
    assert.equal(checkProductData([page('https://a.cz/', '')]).status, 'fail');
});

test('feedy: Zboží, Heureka, Google a duplicitní ID', () => {
    const zbozi = (item) => `<?xml version="1.0"?><SHOP xmlns="http://www.zbozi.cz/ns/offer/1.0">${item}</SHOP>`;
    const zItem = '<SHOPITEM><PRODUCTNAME>N</PRODUCTNAME><DESCRIPTION>D</DESCRIPTION><URL>u</URL><PRICE_VAT>1</PRICE_VAT><DELIVERY_DATE>0</DELIVERY_DATE><IMGURL>i</IMGURL></SHOPITEM>';
    assert.deepEqual(validateFeed('zbozi', zbozi(zItem)).problems, []);
    assert.match(validateFeed('zbozi', zbozi('<SHOPITEM><PRODUCTNAME>N</PRODUCTNAME></SHOPITEM>')).problems[0], /DESCRIPTION/);
    const hItem = (id) => `<SHOPITEM><ITEM_ID>${id}</ITEM_ID><PRODUCTNAME>N</PRODUCTNAME><URL>u</URL><IMGURL>i</IMGURL><PRICE_VAT>1</PRICE_VAT><CATEGORYTEXT>c</CATEGORYTEXT><DELIVERY_DATE>0</DELIVERY_DATE></SHOPITEM>`;
    assert.deepEqual(validateFeed('heureka', `<SHOP>${hItem(1)}${hItem(2)}</SHOP>`).problems, []);
    assert.match(validateFeed('heureka', `<SHOP>${hItem(1)}${hItem(1)}</SHOP>`).problems[0], /duplicitní/);
    const g = '<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:id>1</g:id><title>t</title><link>l</link><g:price>1 CZK</g:price><g:availability>in stock</g:availability><g:image_link>i</g:image_link></item></channel></rss>';
    assert.deepEqual(validateFeed('google', g).problems, []);
    assert.ok(validateFeed('google', g.replace('<g:price>1 CZK</g:price>', '')).problems.length > 0);
    assert.match(validateFeed('google', '<rss><item>').problems[0], /XML/);
});

test('sitemapa: lastmod, index a dobře formované XML', () => {
    const { type, entries } = parseSitemapEntries('<urlset><url><loc>https://a.cz/</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://a.cz/x</loc></url></urlset>');
    assert.equal(type, 'urlset');
    assert.deepEqual(entries.map((e) => e.lastmod), ['2026-01-01', null]);
    assert.equal(parseSitemapEntries('<sitemapindex><sitemap><loc>https://a.cz/s1.xml</loc></sitemap></sitemapindex>').type, 'index');
    assert.equal(xmlError('<?xml version="1.0"?><a><b/></a>'), null);
    assert.match(xmlError('<a><b></a>'), /zanořený|neuzavřený/);
});

test('ssr: pokrytí slov a chybějící h1/navigace v surovém HTML', () => {
    const rendered = 'Vítejte u nás vyrábíme skvělé výrobky pro všechny zákazníky již mnoho let a těšíme se na vaši návštěvu v naší dílně kde vás čeká káva i ukázky práce';
    const raw = `<main><h1>Nadpis</h1><p>${rendered}</p></main>`;
    assert.ok(ssrCoverage(raw, rendered) > 0.99);
    assert.deepEqual(ssrFindings({ url: 'https://a.cz/', rawHtml: raw, renderedText: rendered }), []);
    const shell = '<div id="app"></div>';
    const f = ssrFindings({ url: 'https://a.cz/', rawHtml: shell, renderedText: rendered, renderedNavLinks: ['https://a.cz/o-nas'] });
    assert.equal(f.length, 3);
});

test('boti: challenge, 403 a malé tělo', () => {
    assert.deepEqual(botResponseProblems({ status: 200, headers: {}, text: 'x'.repeat(100) }, 100), []);
    assert.ok(botResponseProblems({ status: 403, headers: {}, text: '' }, 100)[0].includes('403'));
    assert.ok(botResponseProblems({ status: 200, headers: { 'cf-mitigated': 'challenge' }, text: 'x'.repeat(100) }, 100).length);
    assert.ok(botResponseProblems({ status: 200, headers: {}, text: 'Just a moment...' }, 10).length);
    assert.ok(botResponseProblems({ status: 200, headers: {}, text: 'x' }, 100).length);
});

test('CLI parser: opakované --header, chyby', () => {
    const { o, command, errors } = parseCli(['run', '--base', 'https://a.cz', '--header', 'X-A: 1', '--header', 'X-B: 2', '--staging']);
    assert.equal(command, 'run');
    assert.deepEqual(o.headers, { 'x-a': '1', 'x-b': '2' });
    assert.equal(o.staging, true);
    assert.equal(errors.length, 0);
    assert.equal(parseCli(['run', '--header', 'bad']).errors.length, 1);
});

// --- regrese z reálného WordPress/WooCommerce webu

test('discovery: tel:/mailto: ve sitemapě i odkazech a cizí hosty nikdy nejsou stránky', () => {
    assert.equal(isPageUrl('http://a.cz/tel:+420 775 101 116'), false);
    assert.equal(isPageUrl('http://a.cz/tel:+420775101116'), false);
    assert.equal(isPageUrl('https://a.cz/x/mailto:a@b.cz'), false);
    assert.equal(isPageUrl('tel:+420775101116'), false);
    assert.equal(isPageUrl('https://a.cz/kontakt'), true);
    const origin = 'https://www.a.cz';
    const pool = candidatePool({
        origin,
        sitemapLocs: ['http://a.cz/tel:+420 775 101 116', 'https://www.a.cz/o-nas', 'https://cizi.cz/x'],
        homeLinks: ['tel:+420775101116', 'mailto:a@a.cz', 'javascript:void(0)', 'https://www.a.cz/#top', 'https://www.a.cz/kontakt'],
    });
    assert.ok(pool.every((u) => !u.includes('tel:') && !u.includes('cizi')), pool.join());
    assert.ok(pool.includes('https://www.a.cz/kontakt'));
});

test('sitemap: kontroluje jen URL ze sitemapy a uvádí zdrojový soubor; neplatné URL hlásí', async () => {
    const xml = '<urlset><url><loc>https://a.cz/tel:+420 775</loc><lastmod>2021-01-01</lastmod></url><url><loc>https://a.cz/stary/</loc><lastmod>2021-01-01</lastmod></url></urlset>';
    const get = async (url) => (url === 'https://a.cz/sitemap.xml' ? { status: 200, headers: {}, text: xml } : { status: 404, headers: {}, text: '' });
    const sm = await loadSitemaps(get, 'https://a.cz', '');
    assert.equal(sm.locSource.get('https://a.cz/stary/'), 'https://a.cz/sitemap.xml');
    const { CHECKS } = await import('./ai-readiness.mjs');
    const r = await CHECKS.find((c) => c.id === 'sitemap').run({ sitemap: sm, origin: 'https://a.cz', get });
    const texts = r.details.map((d) => `${d.url}: ${d.finding}`).join('\n');
    assert.match(texts, /tel:.*neplatná URL ve sitemapě https:\/\/a\.cz\/sitemap\.xml/);
    assert.match(texts, /stary\/: URL ze sitemapy https:\/\/a\.cz\/sitemap\.xml vrací HTTP 404/);
    assert.ok(!texts.includes('army-kurzy'));
});

test('klasifikace: kontakt s og:type article není článek; článek jen s JSON-LD nebo og:type + published_time', () => {
    const og = '<meta property="og:type" content="article">';
    assert.equal(page('https://a.cz/kontakt', og).kind, 'contact');
    assert.equal(page('https://a.cz/x', `${og}<h1>Kontakt</h1>`).kind, 'contact');
    assert.equal(page('https://a.cz/x', og).kind, 'other');
    assert.equal(page('https://a.cz/x', `${og}<meta property="article:published_time" content="2026-01-01">`).kind, 'article');
    assert.equal(page('https://a.cz/x', '<script type="application/ld+json">{"@type":"NewsArticle"}</script>').kind, 'article');
});

test('klasifikace: produkt podle URL, og:type a product:price:amount; product-data hlásí chybějící JSON-LD', () => {
    for (const path of ['/produkt/a/', '/product/a', '/p/a', '/zbozi/a']) assert.equal(page(`https://a.cz${path}`, '').kind, 'product', path);
    assert.equal(page('https://a.cz/kategorie-produktu/a/', '').kind, 'other');
    assert.equal(page('https://a.cz/x', '<meta property="og:type" content="og:product">').kind, 'product');
    assert.equal(page('https://a.cz/x', '<meta property="og:type" content="product">').kind, 'product');
    assert.equal(page('https://a.cz/x', '<meta property="product:price:amount" content="10">').kind, 'product');
    const r = checkProductData([page('https://a.cz/produkt/box/', '<h1>Box</h1>')]);
    assert.equal(r.status, 'fail');
    assert.match(r.details[0].finding, /nemá Product JSON-LD/);
});

test('captcha: widget, loader a volání API ano; cookie lišta s _GRECAPTCHA ne', () => {
    const p = (html) => ({ url: 'https://a.cz/', status: 200, html });
    assert.equal(checkCaptcha([p('<li>_GRECAPTCHA · Google reCAPTCHA</li><p>grecaptcha cookie</p>')]).status, 'pass');
    for (const html of [
        '<div class="g-recaptcha" data-sitekey="x"></div>',
        '<script src="https://www.google.com/recaptcha/api.js?render=x"></script>',
        '<div class="cf-turnstile"></div>',
        '<script src="https://js.hcaptcha.com/1/api.js"></script>',
        '<script>grecaptcha.ready(() => {})</script>',
    ]) assert.equal(checkCaptcha([p(html)]).status, 'warn', html);
});

test('discovery eshopu zahrne produktovou URL i při malém --max', () => {
    const sitemapLocs = ['/', '/a', '/b', '/c', '/d', '/e'].map((p) => `https://a.cz${p}`).concat('https://a.cz/produkt/x/');
    const urls = pickUrls({ origin: 'https://a.cz', sitemapLocs, homeLinks: [], max: 3, type: 'eshop' });
    assert.ok(urls.includes('https://a.cz/produkt/x/'), urls.join());
    assert.ok(!pickUrls({ origin: 'https://a.cz', sitemapLocs, homeLinks: [], max: 2, type: 'website' }).includes('https://a.cz/produkt/x/'));
});

// --- end-to-end

const PAGES = {
    '/': { h1: 'Domů', body: '<p>Vítejte v naší firmě Test s.r.o.</p>' },
    '/kontakt': { h1: 'Kontakt', body: '<p>Pište nám.</p>' },
    '/clanek': { h1: 'Článek', og: 'article', body: '<p>Autor: Jana Nováková, <time datetime="2026-01-02">2. 1. 2026</time></p>' },
    '/produkt': { h1: 'Produkt', body: '<p>Cena: 1 290 Kč</p>' },
    '/gdpr': { h1: 'Ochrana osobních údajů', body: '<p>Zásady.</p>' },
    '/vop': { h1: 'Obchodní podmínky', body: '<p>Podmínky.</p>' },
    '/doprava': { h1: 'Doprava a platba', body: '<p>Doprava.</p>' },
    '/reklamace': { h1: 'Reklamace a vrácení', body: '<p>Reklamace.</p>' },
};

function startSite(variant) {
    const bad = variant === 'bad';
    let origin = '';
    const ld = (path) => {
        const crumbs = { '@type': 'BreadcrumbList', itemListElement: [] };
        if (bad) return '{broken';
        if (path === '/') return JSON.stringify({ '@graph': [{ '@type': 'Organization', name: 'Test' }, { '@type': 'WebSite', url: origin }] });
        if (path === '/clanek') return JSON.stringify({ '@graph': [crumbs, { '@type': 'Article', author: { name: 'Jana' }, datePublished: '2026-01-02', dateModified: '2026-01-03' }] });
        if (path === '/produkt') return JSON.stringify({ '@graph': [crumbs, { '@type': 'Product', name: 'P', image: `${origin}/og.png`, offers: { price: '1290', priceCurrency: 'CZK', availability: 'InStock', shippingDetails: {}, hasMerchantReturnPolicy: {} } }] });
        return JSON.stringify(crumbs);
    };
    const html = (path) => {
        const p = PAGES[path];
        const inner = `<h1>${p.h1}</h1>${p.body}`;
        const content = bad ? '<div id="app"></div><script>document.getElementById("app").innerHTML=' + JSON.stringify(inner) + '</script>' : inner;
        return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${p.h1}</title><meta name="description" content="Popis">
<link rel="canonical" href="${origin}${path}"><link rel="alternate" type="text/markdown" href="${path === '/' ? '/index' : path}.md">
<meta property="og:title" content="${p.h1}"><meta property="og:description" content="d"><meta property="og:image" content="${origin}/og.png"><meta property="og:url" content="${origin}${path}">
${p.og ? '<meta property="og:type" content="article">' : ''}<script type="application/ld+json">${ld(path)}</script></head>
<body><header><nav><a href="/">Domů</a> <a href="/kontakt">Kontakt</a> <a href="/clanek">Blog</a> <a href="/produkt">Produkt</a></nav></header>
<main>${content}</main><footer><a href="/gdpr">Ochrana osobních údajů</a> <a href="/vop">Obchodní podmínky</a> <a href="/doprava">Doprava a platba</a> <a href="/reklamace">Reklamace a vrácení</a>
Tel. 777 123 456, info@test.cz, Dlouhá 1, 110 00 Praha 1, IČO: 12345678</footer></body></html>`;
    };
    const mdOf = (path) => `# ${PAGES[path].h1}\n\nObsah.\n`;
    const feed = {
        '/feed.xml': '<?xml version="1.0"?><rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:id>1</g:id><title>P</title><link>l</link><g:price>1290 CZK</g:price><g:availability>in stock</g:availability><g:image_link>i</g:image_link></item></channel></rss>',
        '/zbozi.xml': '<?xml version="1.0"?><SHOP xmlns="http://www.zbozi.cz/ns/offer/1.0"><SHOPITEM><PRODUCTNAME>P</PRODUCTNAME><DESCRIPTION>D</DESCRIPTION><URL>u</URL><PRICE_VAT>1290</PRICE_VAT><DELIVERY_DATE>0</DELIVERY_DATE><IMGURL>i</IMGURL></SHOPITEM></SHOP>',
        '/heureka.xml': '<?xml version="1.0"?><SHOP><SHOPITEM><ITEM_ID>1</ITEM_ID><PRODUCTNAME>P</PRODUCTNAME><URL>u</URL><IMGURL>i</IMGURL><PRICE_VAT>1290</PRICE_VAT><CATEGORYTEXT>c</CATEGORYTEXT><DELIVERY_DATE>0</DELIVERY_DATE></SHOPITEM></SHOP>',
    };
    const server = createServer((req, res) => {
        const path = new URL(req.url, origin).pathname;
        const ua = req.headers['user-agent'] ?? '';
        const send = (status, type, body, headers = {}) => {
            res.writeHead(status, { 'content-type': type, ...headers });
            res.end(body);
        };
        if (bad && /ClaudeBot|GPTBot|PerplexityBot/.test(ua)) return send(403, 'text/html', 'Forbidden');
        if (path === '/robots.txt') return send(200, 'text/plain', `User-agent: *\n${bad ? 'Allow: /\n\nUser-agent: GPTBot\nDisallow: /\n' : 'Allow: /\n'}Sitemap: ${origin}/sitemap.xml\n`);
        if (path === '/sitemap.xml') {
            const urls = Object.keys(PAGES).map((p) => `<url><loc>${origin}${p}</loc>${bad ? '' : '<lastmod>2026-01-01</lastmod>'}</url>`);
            return send(200, 'application/xml', `<?xml version="1.0"?><urlset>${urls.join('')}</urlset>`);
        }
        if (path === '/llms.txt' && !bad) return send(200, 'text/plain; charset=utf-8', `# Test\n\n> Firma Test.\n\n- [Kontakt](${origin}/kontakt)\n- [Blog](${origin}/clanek)\n- [Produkt](${origin}/produkt)\n`);
        if (path === '/tajny.txt') return send(200, 'text/plain', 'tajny');
        if (path === '/og.png') return send(200, 'image/png', 'png');
        if (feed[path]) return send(200, 'application/xml', feed[path]);
        const mdPath = path.replace(/\.md$/, '').replace(/^\/index$/, '/') || '/';
        if (PAGES[path]) {
            if (!bad && /text\/markdown/.test(req.headers.accept ?? '')) return send(200, 'text/markdown; charset=utf-8', mdOf(path), { vary: 'Accept' });
            return send(200, 'text/html; charset=utf-8', html(path), bad ? {} : { vary: 'Accept' });
        }
        if (/\.md$/.test(path) && PAGES[mdPath] && !bad) return send(200, 'text/markdown; charset=utf-8', mdOf(mdPath));
        return send(404, 'text/html', '<h1>x</h1>');
    });
    return new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () => {
            origin = `http://127.0.0.1:${server.address().port}`;
            resolve({ origin, close: () => new Promise((r) => server.close(r)) });
        }),
    );
}

const cli = async (args) => {
    try {
        const { stdout } = await run('node', [SCRIPT, ...args], { timeout: 120000 });
        return { code: 0, stdout };
    } catch (error) {
        return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
    }
};
const statusOf = (stdout, id) => new RegExp(`\\[(?:must|should|info)\\] (\\S+)\\s+${id}\\s`).exec(stdout)?.[1];
const hasPlaywright = Boolean(await loadPlaywright());
const browserArgs = hasPlaywright ? [] : ['--no-browser'];

test('e2e: dobrý eshop projde všemi must kontrolami (exit 0)', async () => {
    const site = await startSite('good');
    try {
        const r = await cli(['run', '--base', site.origin, '--type', 'eshop', '--feeds', 'google=/feed.xml,zbozi=/zbozi.xml,heureka=/heureka.xml', '--indexnow-key', 'tajny', '--json', ...browserArgs, '--no-browser']);
        const report = JSON.parse(r.stdout);
        const fails = report.checks.filter((c) => c.status === 'fail');
        assert.deepEqual(fails, [], JSON.stringify(fails, null, 1));
        assert.equal(r.code, 0);
        const st = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
        for (const id of ['robots', 'bot-access', 'indexable', 'sitemap', 'html-basics', 'jsonld', 'facts', 'policies', 'llms-txt', 'markdown', 'product-data', 'feeds']) assert.equal(st[id], 'pass', id);
        assert.equal(st['ssr-content'], 'skipped');
        assert.equal(st.semantics, 'skipped');
        assert.ok(report.pages.length >= 4);
    } finally {
        await site.close();
    }
});

test('e2e: špatný web selže (exit 1), --staging mění robots a indexable na info', async () => {
    const site = await startSite('bad');
    try {
        const out = await cli(['run', '--base', site.origin, '--no-browser', '--type', 'website']);
        assert.equal(out.code, 1);
        for (const id of ['robots', 'bot-access', 'sitemap', 'jsonld', 'llms-txt', 'markdown']) assert.equal(statusOf(out.stdout, id), 'CHYBA', id);
        assert.equal(statusOf(out.stdout, 'ssr-content'), 'PŘESKOČENO');
        const staging = await cli(['run', '--base', site.origin, '--no-browser', '--staging', '--json']);
        const st = Object.fromEntries(JSON.parse(staging.stdout).checks.map((c) => [c.id, c.status]));
        assert.equal(st.robots, 'info');
        assert.equal(st.indexable, 'info');
        assert.equal(st.sitemap, 'fail');
        assert.equal(staging.code, 1);
    } finally {
        await site.close();
    }
});

test('e2e: potvrzené výjimky převedou selhání na excepted a exit 0', async () => {
    const site = await startSite('bad');
    try {
        const { mkdtempSync, writeFileSync } = await import('node:fs');
        const { tmpdir } = await import('node:os');
        const { join } = await import('node:path');
        const dir = mkdtempSync(join(tmpdir(), 'ai-ready-'));
        const rows = ['robots', 'bot-access', 'sitemap', 'jsonld', 'llms-txt', 'markdown'].map((c) => `| ${c} | * | test | Vedoucí | 2026-11-12 |`);
        writeFileSync(join(dir, 'ai.md'), `## Výjimky\n\n| Kontrola | Rozsah | Důvod | Potvrdil | Datum |\n|---|---|---|---|---|\n${rows.join('\n')}\n| facts | * | bez potvrzení | | |\n`);
        const r = await cli(['run', '--base', site.origin, '--no-browser', '--exceptions', join(dir, 'ai.md'), '--out', join(dir, 'out'), '--json']);
        const report = JSON.parse(r.stdout);
        assert.equal(r.code, 0, JSON.stringify(report.checks.filter((c) => c.status === 'fail')));
        assert.equal(report.checks.find((c) => c.id === 'robots').status, 'excepted');
        assert.equal(report.exceptions.filter((e) => e.status === 'ignored').length, 1);
        const { existsSync } = await import('node:fs');
        assert.ok(existsSync(join(dir, 'out', 'report.json')) && existsSync(join(dir, 'out', 'report.md')));
    } finally {
        await site.close();
    }
});

test('e2e: chybné použití vrací exit 2', async () => {
    assert.equal((await cli(['run'])).code, 2);
    assert.equal((await cli(['run', '--base', 'https://a.cz', '--type', 'blog'])).code, 2);
    assert.equal((await cli(['run', '--base', 'http://127.0.0.1:1', '--no-browser'])).code, 2);
    assert.equal((await cli(['nesmysl'])).code, 2);
});

test('e2e: s Playwrightem fungují ssr-content a semantics (JS-only web selže)', { skip: !hasPlaywright }, async () => {
    const site = await startSite('bad');
    try {
        const out = await cli(['run', '--base', site.origin, '--json']);
        const st = Object.fromEntries(JSON.parse(out.stdout).checks.map((c) => [c.id, c.status]));
        assert.equal(st['ssr-content'], 'fail');
    } finally {
        await site.close();
    }
});
