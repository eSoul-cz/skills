#!/usr/bin/env node
/**
 * eSoul AI-readiness check of a public website (roboti, obsah v HTML, JSON-LD, llms.txt, Markdown, feedy).
 * Node >= 18; only local fetch and local headless Chrome (Playwright from ~/.cache/esoul-uat). No external services.
 *
 *   ai-readiness.mjs --check
 *   ai-readiness.mjs run --base https://site.cz [--urls file | --max 20] [--type website|website-admin|eshop|application]
 *       [--staging] [--exceptions docs/ai-readiness.md] [--feeds google=/feed.xml,zbozi=/zbozi.xml,heureka=/heureka.xml]
 *       [--indexnow-key <key>] [--header 'Name: value']... [--auth user:pass] [--out dir] [--json] [--no-browser]
 *
 * Exit code: 0 = every `must` passed or has a confirmed exception, 1 = an unexcepted `must` failed, 2 = usage/tool error.
 * Exceptions: `## Výjimky` table `| Kontrola | Rozsah | Důvod | Potvrdil | Datum |`; a row without Potvrdil or Datum is ignored.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    DESKTOP_UA,
    INSTALL_PLAYWRIGHT,
    decodeXml,
    extractLinks,
    groupByPattern,
    hasChrome,
    isAssetUrl,
    isJunkUrl,
    loadPlaywright,
    normalizeUrl,
    parseRobotsSitemaps,
    parseSitemapXml,
    parseUrlsFile,
    sameSite,
} from './snapshot.mjs';

export const TOOL_VERSION = '1.0.0';

/** Bots used for robots.txt and UA checks. `robotsOnly` tokens have no crawler UA of their own. */
export const BOTS = [
    { name: 'Googlebot', kind: 'search', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    { name: 'Bingbot', kind: 'search', ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
    { name: 'SeznamBot', kind: 'search', ua: 'Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)' },
    { name: 'OAI-SearchBot', kind: 'search', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot' },
    { name: 'ChatGPT-User', kind: 'search', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot' },
    { name: 'Claude-SearchBot', kind: 'search', ua: 'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)' },
    { name: 'Claude-User', kind: 'search', ua: 'Mozilla/5.0 (compatible; Claude-User/1.0; +https://www.anthropic.com)' },
    { name: 'PerplexityBot', kind: 'search', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' },
    { name: 'Perplexity-User', kind: 'search', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)' },
    { name: 'Applebot', kind: 'search', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)' },
    { name: 'GPTBot', kind: 'training', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot' },
    { name: 'ClaudeBot', kind: 'training', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' },
    { name: 'CCBot', kind: 'training', ua: 'CCBot/2.0 (https://commoncrawl.org/faq/)' },
    { name: 'Google-Extended', kind: 'training', robotsOnly: true },
    { name: 'Applebot-Extended', kind: 'training', robotsOnly: true },
];

export const CHECK_IDS = ['robots', 'bot-access', 'indexable', 'sitemap', 'ssr-content', 'html-basics', 'semantics', 'jsonld', 'facts', 'policies', 'llms-txt', 'markdown', 'product-data', 'feeds', 'indexnow', 'og', 'article-meta', 'captcha', 'images-alt', 'webmcp'];
const TYPES = ['website', 'website-admin', 'eshop', 'application'];

// ---------------------------------------------------------------------------------------------
// robots.txt

/** Parses robots.txt into groups [{ agents: [lowercase tokens], rules: [{ allow, path }] }] and sitemaps. */
export function parseRobots(text) {
    const groups = [];
    const sitemaps = [];
    let current = null;
    let collectingAgents = false;
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '').trim();
        const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
        if (!m) continue;
        const field = m[1].toLowerCase();
        const value = m[2].trim();
        if (field === 'sitemap') {
            if (value) sitemaps.push(value);
        } else if (field === 'user-agent') {
            if (!current || !collectingAgents) {
                current = { agents: [], rules: [] };
                groups.push(current);
            }
            current.agents.push(value.toLowerCase());
            collectingAgents = true;
        } else if (field === 'allow' || field === 'disallow') {
            collectingAgents = false;
            if (current && value) current.rules.push({ allow: field === 'allow', path: value });
        } else {
            collectingAgents = false;
        }
    }
    return { groups, sitemaps };
}

/** Robots path pattern (`*` wildcard, `$` end anchor) to a RegExp anchored at the path start. */
export function robotsPatternToRegex(pattern) {
    const anchored = pattern.endsWith('$');
    const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** Group matching: all groups naming the agent (merged), else the `*` groups; longest match wins, Allow wins a tie. */
export function robotsAllows(parsed, agent, path) {
    const token = agent.toLowerCase();
    let groups = parsed.groups.filter((g) => g.agents.includes(token));
    if (groups.length === 0) groups = parsed.groups.filter((g) => g.agents.includes('*'));
    let best = null;
    for (const rule of groups.flatMap((g) => g.rules)) {
        if (!robotsPatternToRegex(rule.path).test(path)) continue;
        if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow && !best.allow)) best = rule;
    }
    return best ? best.allow : true;
}

// ---------------------------------------------------------------------------------------------
// HTML / XML helpers (regex based, no DOM dependency)

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeEntities = (s) =>
    String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
        if (e[0] === '#') {
            const code = e[1].toLowerCase() === 'x' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : all;
        }
        return ENTITIES[e.toLowerCase()] ?? all;
    });

export function parseAttrs(source) {
    const attrs = {};
    for (const m of source.matchAll(/([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
    return attrs;
}
export const tagsOf = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map((m) => parseAttrs(m[1]));
export const stripBlocks = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, '');
export const textOf = (html) => decodeEntities(stripBlocks(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
export const metaContent = (html, key, attr = 'name') => tagsOf(html, 'meta').find((a) => a[attr]?.toLowerCase() === key)?.content;
export const titleOf = (html) => decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim();
export const h1sOf = (html) => [...stripBlocks(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => textOf(m[1]));
const isAbsolute = (u) => /^https?:\/\//i.test(u ?? '');
const pathOf = (url) => {
    try {
        const u = new URL(url);
        return u.pathname + u.search;
    } catch {
        return url;
    }
};
const finding = (url, text) => ({ url, finding: text });

/** Minimal well-formedness check: balanced tags, one root. Returns an error string or null. */
export function xmlError(xml) {
    const text = String(xml).replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
    const stack = [];
    let roots = 0;
    for (const m of text.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
        if (m[4]) {
            if (stack.length === 0) roots++;
        } else if (m[1]) {
            if (stack.pop() !== m[2]) return `neuzavřený nebo nesprávně zanořený prvek </${m[2]}>`;
        } else {
            if (stack.length === 0) roots++;
            stack.push(m[2]);
        }
    }
    if (stack.length > 0) return `neuzavřený prvek <${stack.at(-1)}>`;
    return roots === 1 ? null : 'dokument nemá právě jeden kořenový prvek';
}

/** Sitemap with lastmod: { type, entries: [{ loc, lastmod }] } for urlset and sitemap index. */
export function parseSitemapEntries(xml) {
    const type = parseSitemapXml(xml).type;
    const blockTag = type === 'index' ? 'sitemap' : 'url';
    const entries = [];
    for (const m of String(xml).matchAll(new RegExp(`<${blockTag}>([\\s\\S]*?)</${blockTag}>`, 'gi'))) {
        const loc = /<loc>\s*(?:<!\[CDATA\[)?\s*([\s\S]*?)\s*(?:\]\]>)?\s*<\/loc>/i.exec(m[1])?.[1];
        const lastmod = /<lastmod>\s*([^<\s][^<]*?)\s*<\/lastmod>/i.exec(m[1])?.[1] ?? null;
        if (loc) entries.push({ loc: decodeXml(loc), lastmod });
    }
    return { type, entries };
}

// JSON-LD

export function extractJsonLd(html) {
    const nodes = [];
    const errors = [];
    const walk = (v) => {
        if (Array.isArray(v)) return v.forEach(walk);
        if (v && typeof v === 'object') {
            nodes.push(v);
            if (v['@graph']) walk(v['@graph']);
        }
    };
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!/application\/ld\+json/i.test(m[1])) continue;
        try {
            walk(JSON.parse(m[2].trim()));
        } catch (error) {
            errors.push(error.message);
        }
    }
    return { nodes, errors };
}
export const typesOf = (node) => [].concat(node?.['@type'] ?? []).map((t) => String(t).replace(/^.*[/#]/, ''));
const hasType = (nodes, re) => nodes.some((n) => typesOf(n).some((t) => re.test(t)));
const ORG_RE = /^(Organization|Corporation|NGO|LocalBusiness|Store|OnlineStore|OnlineBusiness|ProfessionalService|Restaurant|Hotel|MedicalBusiness|Dentist|AutoRepair|HomeAndConstructionBusiness|FinancialService|LegalService|RealEstateAgent|TravelAgency|SportsActivityLocation|EntertainmentBusiness|FoodEstablishment|HealthAndBeautyBusiness|Library|SelfStorage|ShoppingCenter|[A-Za-z]*Store|[A-Za-z]*Business)$/;
const ARTICLE_RE = /^(Article|BlogPosting|NewsArticle|TechArticle|Report|ScholarlyArticle)$/;

// ---------------------------------------------------------------------------------------------
// Pages

const PRODUCT_URL_RE = /(^|\/)(produkt|product|p|zbozi)\/[^/]+/i;
export const isProductUrl = (url) => {
    try {
        return PRODUCT_URL_RE.test(new URL(url).pathname);
    } catch {
        return false;
    }
};

/** Real page URL: http(s), no `tel:`/`mailto:`/... smuggled into the path (seen in stale sitemaps). */
export function isPageUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        return !u.pathname.split('/').some((seg) => /^(tel|mailto|javascript|data|sms):/i.test(decodeURIComponent(seg)));
    } catch {
        return false;
    }
}

/** Kind order: home, product, contact, article (SEO plugins set og:type article even on contact pages). */
export function classifyPage(page) {
    const path = new URL(page.finalUrl ?? page.url).pathname;
    const html = page.html ?? '';
    const nodes = extractJsonLd(html).nodes;
    const ogType = metaContent(html, 'og:type', 'property')?.toLowerCase();
    if (path === '/' || /^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(path)) return 'home';
    if (hasType(nodes, /^Product$/) || isProductUrl(page.finalUrl ?? page.url) || ogType === 'product' || ogType === 'og:product' || metaContent(html, 'product:price:amount', 'property') != null) return 'product';
    if (/kontakt|contact/i.test(path) || /^(kontakt|contact)/i.test(h1sOf(html)[0] ?? '')) return 'contact';
    if (hasType(nodes, ARTICLE_RE) || (ogType === 'article' && metaContent(html, 'article:published_time', 'property'))) return 'article';
    return 'other';
}

/** Sample for per-page network checks: home, then one per kind, then the rest. */
export function samplePages(pages, n) {
    const ok = pages.filter((p) => p.status === 200);
    const picked = [];
    const add = (p) => p && !picked.includes(p) && picked.length < n && picked.push(p);
    add(ok.find((p) => p.kind === 'home'));
    for (const kind of ['contact', 'article', 'product', 'other']) add(ok.find((p) => p.kind === kind));
    ok.forEach(add);
    return picked;
}

// ---------------------------------------------------------------------------------------------
// Results

const res = (status, message, details = []) => ({ status, message, details });

const MARKERS = /just a moment|cf-browser-verification|challenge-platform|\/cdn-cgi\/challenge|attention required! \| cloudflare|checking your browser|px-captcha|captcha-delivery|access denied/i;

/** One bot response against the browser response: list of problems (empty = ok). */
export function botResponseProblems(r, baselineLength) {
    const problems = [];
    if (r.status !== 200) problems.push(`HTTP ${r.status || 'chyba spojení'}`);
    if (r.headers?.['cf-mitigated']) problems.push(`hlavička cf-mitigated: ${r.headers['cf-mitigated']}`);
    if (MARKERS.test(r.text ?? '')) problems.push('odpověď obsahuje challenge/captcha');
    if (r.status === 200 && baselineLength > 0 && (r.text?.length ?? 0) < baselineLength * 0.5) problems.push(`tělo odpovědi je menší než 50 % odpovědi pro prohlížeč (${r.text.length} / ${baselineLength} znaků)`);
    return problems;
}

// --- robots

export function checkRobots({ robots, pagePaths, staging }) {
    if (robots.status !== 200) return res('fail', `robots.txt chybí (HTTP ${robots.status || 'chyba spojení'}).`, [finding('/robots.txt', 'nedostupný')]);
    const ct = (robots.headers?.['content-type'] ?? 'text/plain').toLowerCase();
    if (!ct.startsWith('text/') || ct.startsWith('text/html')) return res('fail', `robots.txt nemá textový Content-Type (${ct}).`, [finding('/robots.txt', ct)]);
    const parsed = parseRobots(robots.text);
    const paths = ['/', ...new Set(pagePaths.filter((p) => p !== '/'))];
    const blocked = [];
    for (const bot of BOTS) {
        const denied = paths.filter((p) => !robotsAllows(parsed, bot.name, p));
        if (denied.length) blocked.push(finding('/robots.txt', `${bot.name} (${bot.kind === 'training' ? 'trénink' : 'vyhledávání'}) nesmí: ${denied.slice(0, 3).join(', ')}`));
    }
    const noSitemap = parsed.sitemaps.length === 0;
    if (staging) return res('info', `Staging: ${blocked.length ? `pravidla robotů blokují ${blocked.length} botů (očekáváno)` : 'pravidla robotů nic neblokují'}${noSitemap ? ', chybí Sitemap:' : ''}.`, blocked);
    const details = [...blocked];
    if (noSitemap) details.push(finding('/robots.txt', 'chybí řádek Sitemap:'));
    return details.length ? res('fail', `robots.txt blokuje boty (${blocked.length}) nebo nemá Sitemap:.`, details) : res('pass', 'robots.txt povoluje všechny boty a odkazuje na sitemapu.');
}

// --- html-basics

export function checkHtmlBasics(pages) {
    const details = [];
    const byUrl = new Map(pages.map((p) => [p.finalUrl ?? p.url, p]));
    for (const p of pages.filter((x) => x.status === 200)) {
        const html = p.html;
        const url = p.url;
        if (!/<html\b[^>]*\slang\s*=\s*["']?[a-z]/i.test(html)) details.push(finding(url, 'chybí <html lang>'));
        if (!titleOf(html)) details.push(finding(url, 'prázdný <title>'));
        if (!metaContent(html, 'description')?.trim()) details.push(finding(url, 'chybí meta description'));
        const canonical = tagsOf(html, 'link').find((a) => a.rel?.toLowerCase() === 'canonical')?.href;
        if (!canonical) details.push(finding(url, 'chybí canonical'));
        else if (!isAbsolute(canonical)) details.push(finding(url, `canonical není absolutní (${canonical})`));
        const alternates = tagsOf(html, 'link').filter((a) => a.rel?.toLowerCase() === 'alternate' && a.hreflang);
        if (alternates.length) {
            if (!alternates.some((a) => a.hreflang.toLowerCase() === 'x-default')) details.push(finding(url, 'hreflang bez x-default'));
            for (const alt of alternates) {
                const target = byUrl.get(new URL(alt.href, url).href);
                if (!target || target === p || target.status !== 200) continue;
                const back = tagsOf(target.html, 'link').some((a) => a.rel?.toLowerCase() === 'alternate' && a.hreflang && new URL(a.href, target.url).href === (p.finalUrl ?? p.url));
                if (!back) details.push(finding(url, `hreflang ${alt.hreflang} není reciproční (${pathOf(target.url)} neodkazuje zpět)`));
            }
        }
    }
    return details.length ? res('fail', `Základní HTML: ${details.length} nedostatků.`, details) : res('pass', 'lang, title, description, canonical a hreflang jsou v pořádku.');
}

// --- jsonld

export function checkJsonLd(pages) {
    const details = [];
    const warns = [];
    for (const p of pages.filter((x) => x.status === 200)) {
        const { nodes, errors } = extractJsonLd(p.html);
        for (const e of errors) details.push(finding(p.url, `JSON-LD se nedá parsovat: ${e}`));
        if (p.kind === 'home') {
            if (!hasType(nodes, ORG_RE)) details.push(finding(p.url, 'home nemá Organization/LocalBusiness'));
            if (!hasType(nodes, /^WebSite$/)) details.push(finding(p.url, 'home nemá WebSite'));
        } else if (!hasType(nodes, /^BreadcrumbList$/)) warns.push(finding(p.url, 'chybí BreadcrumbList'));
        if (p.kind === 'article') {
            const article = nodes.find((n) => typesOf(n).some((t) => ARTICLE_RE.test(t)));
            if (!article) details.push(finding(p.url, 'článek nemá Article/BlogPosting v JSON-LD'));
            else for (const f of ['author', 'datePublished', 'dateModified']) if (!article[f]) details.push(finding(p.url, `Article nemá ${f}`));
        }
    }
    if (details.length) return res('fail', `JSON-LD: ${details.length} chyb.`, [...details, ...warns]);
    return warns.length ? res('warn', `JSON-LD je v pořádku, ${warns.length}× chybí BreadcrumbList.`, warns) : res('pass', 'JSON-LD je validní a úplné.');
}

// --- facts

export function checkFacts(pages) {
    const sources = pages.filter((p) => p.status === 200 && (p.kind === 'home' || p.kind === 'contact'));
    if (sources.length === 0) return res('fail', 'Home ani kontakt se nepodařilo načíst.');
    const raw = sources.map((p) => p.html).join('\n');
    const text = textOf(raw);
    const czech = /<html\b[^>]*\slang\s*=\s*["']?cs/i.test(sources[0].html);
    const phone = /href\s*=\s*["']tel:/i.test(raw) || /(?:\+\s?\d{2,3}[\s.-]?)?\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b/.test(text);
    const email = /href\s*=\s*["']mailto:/i.test(raw) || /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text);
    const address = /PostalAddress|<address\b/i.test(raw) || /\b\d{3}\s?\d{2}\s+\p{Lu}[\p{L}]+/u.test(text);
    const ico = /\bIČO?\b[^\d]{0,20}(\d{8}|\d{2}\s?\d{3}\s?\d{3})\b/i.test(text);
    const details = [];
    if (!phone && !email) details.push(finding(sources[0].url, 'chybí telefon i e-mail'));
    if (!address) details.push(finding(sources[0].url, 'chybí poštovní adresa'));
    if (czech && !ico) details.push(finding(sources[0].url, 'chybí IČO'));
    return details.length ? res('fail', 'Fakta o firmě nejsou v HTML textu.', details) : res('pass', 'Kontakt, adresa a IČO jsou v HTML.');
}

// --- policies

const POLICY_PATTERNS = {
    privacy: { label: 'ochrana osobních údajů', re: /ochran[ayu]\s+osobn|osobn[ií]ch\s+[uú]daj|privacy|gdpr|cookies?-policy/i },
    terms: { label: 'obchodní podmínky', re: /obchodn[ií]\s+podm[ií]nk|terms|\bvop\b/i },
    shipping: { label: 'doprava a platba', re: /doprav|shipping|delivery/i },
    returns: { label: 'vrácení/reklamace', re: /vr[aá]cen[ií]|reklamac|returns?\b|refund|odstoupen/i },
};

export function checkPolicies(pages, type) {
    const home = pages.find((p) => p.kind === 'home' && p.status === 200);
    if (!home) return res('fail', 'Home se nepodařilo načíst.');
    const links = [...home.html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((m) => `${parseAttrs(m[1]).href ?? ''} ${textOf(m[2])}`);
    const wanted = type === 'eshop' ? ['privacy', 'terms', 'shipping', 'returns'] : ['privacy'];
    const missing = wanted.filter((k) => !links.some((l) => POLICY_PATTERNS[k].re.test(l)));
    return missing.length ? res('fail', `Chybí odkaz: ${missing.map((k) => POLICY_PATTERNS[k].label).join(', ')}.`, missing.map((k) => finding(home.url, `žádný odkaz na ${POLICY_PATTERNS[k].label}`))) : res('pass', 'Právní stránky jsou odkazované z home.');
}

// --- product-data

export function checkProductData(pages) {
    const products = pages.filter((p) => p.status === 200 && p.kind === 'product');
    if (products.length === 0) return res('fail', 'Ve vzorku není žádná produktová stránka (Product v JSON-LD); doplňte URL produktu do --urls.', [finding('/', 'žádný produkt ve vzorku')]);
    const details = [];
    const warns = [];
    for (const p of products) {
        const { nodes } = extractJsonLd(p.html);
        const product = nodes.find((n) => typesOf(n).includes('Product'));
        if (!product) {
            details.push(finding(p.url, 'produktová stránka nemá Product JSON-LD'));
            continue;
        }
        const offer = [].concat(product?.offers ?? [])[0];
        const offerNode = offer && (offer.offers ? [].concat(offer.offers)[0] : offer);
        for (const f of ['name', 'image']) if (!product?.[f]) details.push(finding(p.url, `Product nemá ${f}`));
        for (const f of ['price', 'priceCurrency', 'availability']) if (offerNode?.[f] == null || offerNode[f] === '') details.push(finding(p.url, `Product.offers nemá ${f}`));
        if (!offerNode?.shippingDetails && !product?.shippingDetails) warns.push(finding(p.url, 'chybí shippingDetails'));
        if (!offerNode?.hasMerchantReturnPolicy && !product?.hasMerchantReturnPolicy) warns.push(finding(p.url, 'chybí hasMerchantReturnPolicy'));
        const price = offerNode?.price ?? offerNode?.priceSpecification?.price;
        if (price != null) {
            const plain = textOf(p.html).replace(/[\s ]/g, '');
            const num = String(price).replace(/\.0+$/, '');
            if (!plain.includes(num) && !plain.includes(num.replace('.', ','))) warns.push(finding(p.url, `cena ${price} z JSON-LD není viditelná na stránce`));
        }
    }
    if (details.length) return res('fail', `Produktová data: ${details.length} chyb.`, [...details, ...warns]);
    return warns.length ? res('warn', `Produktová data jsou kompletní, ${warns.length} upozornění.`, warns) : res('pass', 'Produkty mají kompletní Product/Offer.');
}

// --- feeds

const FEED_SPECS = {
    zbozi: { item: 'SHOPITEM', required: ['PRODUCTNAME', 'DESCRIPTION', 'URL', 'PRICE_VAT', 'DELIVERY_DATE', 'IMGURL'], ns: 'http://www.zbozi.cz/ns/offer/1.0' },
    heureka: { item: 'SHOPITEM', required: ['ITEM_ID', 'PRODUCTNAME', 'URL', 'IMGURL', 'PRICE_VAT', 'CATEGORYTEXT', 'DELIVERY_DATE'] },
    google: { required: ['g:id', 'title', 'link', 'g:price', 'g:availability', 'g:image_link'] },
};
const hasField = (block, name) => (name === 'link' ? /<link\b[^>]*(?:href=|>[^<]*\S)/i.test(block) : new RegExp(`<${name}\\b[^>]*>\\s*(?:<!\\[CDATA\\[)?\\s*\\S`, 'i').test(block));

/** Validates one feed document: { items, problems[] }. */
export function validateFeed(kind, xml) {
    const spec = FEED_SPECS[kind];
    if (!spec) return { items: 0, problems: [`neznámý typ feedu „${kind}“ (google|zbozi|heureka)`] };
    const err = xmlError(xml);
    if (err) return { items: 0, problems: [`XML není validní: ${err}`] };
    const problems = [];
    let blocks;
    if (kind === 'google') {
        if (!/xmlns:g\s*=\s*["']http:\/\/base\.google\.com\/ns\/1\.0["']/i.test(xml)) problems.push('chybí jmenný prostor xmlns:g');
        blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
    } else {
        if (kind === 'zbozi' && !xml.includes(spec.ns)) problems.push(`chybí jmenný prostor ${spec.ns}`);
        if (!/<SHOP\b/.test(xml)) problems.push('chybí kořen <SHOP>');
        blocks = [...xml.matchAll(/<SHOPITEM\b[\s\S]*?<\/SHOPITEM>/g)].map((m) => m[0]);
    }
    if (blocks.length === 0) problems.push('feed neobsahuje žádné položky');
    const missing = new Map();
    const ids = new Map();
    blocks.forEach((b, i) => {
        for (const f of spec.required) if (!hasField(b, f)) missing.set(f, [...(missing.get(f) ?? []), i + 1]);
        const id = /<(?:ITEM_ID|g:id)\b[^>]*>\s*(?:<!\[CDATA\[)?\s*([^<\]\s][^<\]]*?)\s*(?:\]\]>)?\s*<\//i.exec(b)?.[1];
        if (id) ids.set(id, (ids.get(id) ?? 0) + 1);
    });
    for (const [f, rows] of missing) problems.push(`${f} chybí u ${rows.length} položek (např. č. ${rows.slice(0, 3).join(', ')})`);
    const dup = [...ids].filter(([, n]) => n > 1).map(([id]) => id);
    if (dup.length) problems.push(`duplicitní ID: ${dup.slice(0, 3).join(', ')}`);
    return { items: blocks.length, problems };
}

// --- should checks (pure)

export function checkArticleMeta(pages) {
    const articles = pages.filter((p) => p.status === 200 && p.kind === 'article');
    if (articles.length === 0) return res('skipped', 'Ve vzorku není žádný článek.');
    const details = [];
    for (const p of articles) {
        const html = p.html;
        const author = /rel\s*=\s*["']author|itemprop\s*=\s*["']author|class\s*=\s*["'][^"']*author|\bautor\b|\bby\s+\p{Lu}/iu.test(stripBlocks(html));
        const date = /<time\b/i.test(html) || /\b\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/.test(textOf(html));
        if (!author) details.push(finding(p.url, 'v HTML není vidět autor'));
        if (!date) details.push(finding(p.url, 'v HTML není vidět datum'));
    }
    return details.length ? res('warn', 'Článek bez viditelného autora nebo data.', details) : res('pass', 'Články mají autora a datum.');
}

export function checkCaptcha(pages) {
    const details = pages.filter((p) => p.status === 200 && /g-recaptcha|grecaptcha|h-captcha|hcaptcha\.com|cf-turnstile|challenges\.cloudflare\.com\/turnstile/i.test(p.html)).map((p) => finding(p.url, 'CAPTCHA v HTML'));
    return details.length ? res('warn', 'Na stránkách je CAPTCHA; ověřte, že neblokuje obsah ani kontakt.', details) : res('pass', 'Žádná CAPTCHA ve vzorku.');
}

export function checkImagesAlt(pages) {
    const details = [];
    for (const p of pages.filter((x) => x.status === 200)) {
        const bad = tagsOf(stripBlocks(p.html), 'img').filter((a) => !('alt' in a) && a.role !== 'presentation' && !/^1$/.test(a.width ?? '') && a['aria-hidden'] !== 'true');
        if (bad.length) details.push(finding(p.url, `${bad.length}× <img> bez atributu alt`));
    }
    return details.length ? res('warn', 'Obrázky bez alt.', details) : res('pass', 'Obrázky mají alt.');
}

export function checkWebmcp(pages) {
    const hits = pages.filter((p) => /\btoolname\s*=|\btooldescription\s*=|navigator\.modelContext/i.test(p.html ?? '')).map((p) => finding(p.url, 'WebMCP'));
    return res('info', hits.length ? `WebMCP nalezeno na ${hits.length} stránkách.` : 'WebMCP nenalezeno (informativní).', hits);
}

export function checkIndexable(pages, staging) {
    const noindex = [];
    const indexable = [];
    for (const p of pages.filter((x) => x.status === 200)) {
        const meta = [metaContent(p.html, 'robots'), metaContent(p.html, 'googlebot')].filter(Boolean).join(',');
        const header = p.headers?.['x-robots-tag'] ?? '';
        const reason = /noindex|none/i.test(meta) ? 'meta robots noindex' : /noindex|none/i.test(header) ? 'X-Robots-Tag noindex' : null;
        (reason ? noindex : indexable).push(finding(p.url, reason ?? 'indexovatelná'));
    }
    if (staging) return res('info', noindex.length ? 'Staging je noindex (očekáváno).' : 'Pozor: staging je indexovatelný, před spuštěním přidejte noindex.', indexable);
    return noindex.length ? res('fail', `${noindex.length} stránek má noindex.`, noindex) : res('pass', 'Vzorek je indexovatelný.');
}

// --- ssr (pure part; the rendered text comes from the browser)

const tokens = (text) => text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
const mainHtml = (html) => /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ?? /<body\b[\s\S]*?<\/body>/i.exec(html)?.[0] ?? html;

/** Share of rendered words found in the raw HTML (0..1). */
export function ssrCoverage(rawHtml, renderedText) {
    const rendered = tokens(renderedText);
    if (rendered.length === 0) return 1;
    const raw = new Set(tokens(textOf(mainHtml(rawHtml))));
    return rendered.filter((t) => raw.has(t)).length / rendered.length;
}

export function ssrFindings({ url, rawHtml, renderedText, renderedNavLinks = [] }) {
    const out = [];
    if (h1sOf(rawHtml).length === 0) out.push(finding(url, 'v HTML bez JavaScriptu chybí h1'));
    const coverage = ssrCoverage(rawHtml, renderedText);
    if (tokens(renderedText).length >= 20 && coverage < 0.7) out.push(finding(url, `HTML bez JavaScriptu obsahuje jen ${Math.round(coverage * 100)} % slov vykresleného obsahu (min. 70 %)`));
    const rawLinks = new Set(extractLinks(rawHtml, url));
    const missing = renderedNavLinks.filter((l) => !rawLinks.has(l));
    if (missing.length) out.push(finding(url, `navigační odkazy chybí v HTML bez JS: ${missing.slice(0, 3).map(pathOf).join(', ')}${missing.length > 3 ? '…' : ''}`));
    return out;
}

/** Runs inside the browser page: structural facts for the `semantics` check. */
export function collectSemantics() {
    const all = (s) => [...document.querySelectorAll(s)];
    const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const describe = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '');
    const labelledBy = (el) => (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join('').trim();
    const named = (el) => Boolean(el.getAttribute('aria-label')?.trim() || labelledBy(el) || el.getAttribute('title')?.trim() || [...(el.labels ?? [])].some((l) => l.textContent.trim()));
    const buttonNamed = (el) => named(el) || Boolean(el.textContent.trim() || el.getAttribute('value')?.trim() || el.querySelector('img[alt]:not([alt=""])'));
    const unnamed = [];
    for (const el of all('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), textarea, select')) if (visible(el) && !named(el)) unnamed.push(describe(el));
    for (const el of all('button, [role=button], a[href], input[type=submit], input[type=button]')) if (visible(el) && !buttonNamed(el)) unnamed.push(describe(el));
    const clickable = all('[onclick]').filter((el) => visible(el) && !el.matches('a, button, input, select, textarea, summary, label') && !el.getAttribute('role') && !el.hasAttribute('tabindex')).map(describe);
    return { h1: all('h1').filter(visible).length, main: all('main, [role=main]').length, unnamed, clickable };
}

export function semanticsFindings(url, s) {
    const out = [];
    if (s.h1 !== 1) out.push(finding(url, `na stránce je ${s.h1} h1 (má být právě jedno)`));
    if (!s.main) out.push(finding(url, 'chybí landmark main'));
    if (s.unnamed.length) out.push(finding(url, `prvky bez přístupného názvu: ${s.unnamed.slice(0, 5).join(', ')}`));
    if (s.clickable.length) out.push(finding(url, `klikací prvky bez role: ${s.clickable.slice(0, 5).join(', ')}`));
    return out;
}

// ---------------------------------------------------------------------------------------------
// Exceptions

/** Parses the `## Výjimky` table: { applied: [{ check, scope, reason, by, date }], ignored: [{ row, reason }] }. */
export function parseExceptions(markdown) {
    const applied = [];
    const ignored = [];
    const section = /^##\s+Výjimky[^\n]*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(String(markdown));
    if (!section) return { applied, ignored };
    for (const line of section[1].split(/\r?\n/)) {
        if (!line.trim().startsWith('|')) continue;
        const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (cells.every((c) => /^:?-*:?$/.test(c))) continue; // separator
        if (/^kontrola$/i.test(cells[0])) continue; // header
        const clean = (c) => (c ?? '').replace(/^[_*`]+|[_*`]+$/g, '').trim();
        const [check, scope, reason, by, date] = cells.map(clean);
        if (!check || /^[(—–-]/.test(check)) continue; // empty / placeholder row
        if (!CHECK_IDS.includes(check)) ignored.push({ row: line.trim(), reason: `neznámá kontrola „${check}“` });
        else if (!by || !date) ignored.push({ row: line.trim(), reason: 'chybí Potvrdil nebo Datum (výjimka není potvrzená)' });
        else applied.push({ check, scope: scope || '*', reason, by, date });
    }
    return { applied, ignored };
}

const scopeCovers = (scope, url) => scope === '*' || pathOf(url).startsWith(scope.startsWith('/') ? scope : pathOf(scope));

/** Turns failed checks covered by a confirmed exception into `excepted`; partly covered ones keep the uncovered details. */
export function applyExceptions(checks, { applied, ignored }) {
    const report = [...ignored.map((i) => ({ status: 'ignored', ...i }))];
    const used = new Set();
    const out = checks.map((c) => {
        if (c.status !== 'fail') return c;
        const rows = applied.filter((e) => e.check === c.id);
        if (rows.length === 0) return c;
        const covered = (d) => rows.find((e) => scopeCovers(e.scope, d.url));
        let remaining;
        if (c.details.length === 0) {
            const star = rows.find((e) => e.scope === '*');
            remaining = star ? [] : [null];
            if (star) used.add(star);
        } else {
            remaining = c.details.filter((d) => {
                const row = covered(d);
                if (row) used.add(row);
                return !row;
            });
        }
        if (remaining.length === 0) return { ...c, status: 'excepted', message: `${c.message} (výjimka: ${rows.map((e) => `${e.by}, ${e.date}`).join('; ')})` };
        return remaining[0] === null ? c : { ...c, details: remaining, message: `${c.message} (část pokrytá výjimkou)` };
    });
    for (const e of applied) report.push({ status: used.has(e) ? 'applied' : 'unused', ...e });
    return { checks: out, exceptions: report };
}

export function computeScore(checks) {
    const ratio = (list, ok) => `${list.filter(ok).length}/${list.length}`;
    const live = checks.filter((c) => !['skipped', 'info'].includes(c.status));
    return {
        must: ratio(live.filter((c) => c.level === 'must'), (c) => ['pass', 'warn', 'excepted'].includes(c.status)),
        should: ratio(live.filter((c) => c.level === 'should'), (c) => c.status === 'pass'),
    };
}

export const exitCodeOf = (checks) => (checks.some((c) => c.level === 'must' && c.status === 'fail') ? 1 : 0);

// ---------------------------------------------------------------------------------------------
// Report

const STATUS_CS = { pass: 'OK', fail: 'CHYBA', warn: 'VAROVÁNÍ', info: 'INFO', skipped: 'PŘESKOČENO', excepted: 'VÝJIMKA' };

export function formatConsole(report) {
    const lines = report.checks.map((c) => `[${c.level}] ${STATUS_CS[c.status].padEnd(10)} ${c.id.padEnd(13)} ${c.message}`);
    for (const n of report.notes ?? []) lines.push(`Poznámka: ${n}`);
    lines.push('', `Skóre: must ${report.score.must}, should ${report.score.should}${report.staging ? ' (staging)' : ''}`);
    const ign = report.exceptions.filter((e) => e.status === 'ignored');
    if (ign.length) lines.push(`Ignorované výjimky (${ign.length}): ${ign.map((e) => e.reason).join('; ')}`);
    return lines.join('\n');
}

export function formatMarkdown(report) {
    const out = [`# AI readiness – ${report.base}`, '', `Datum: ${report.date} · typ: ${report.type}${report.staging ? ' · staging' : ''} · nástroj ${report.toolVersion}`, '', `**Skóre:** must ${report.score.must}, should ${report.score.should}`, '', '| Úroveň | Stav | Kontrola | Zpráva |', '|---|---|---|---|'];
    for (const c of report.checks) out.push(`| ${c.level} | ${STATUS_CS[c.status]} | ${c.id} | ${c.message.replace(/\|/g, '\\|')} |`);
    out.push('', '## Nálezy', '');
    for (const c of report.checks.filter((x) => x.details.length)) {
        out.push(`### ${c.id} (${STATUS_CS[c.status]})`, '', ...c.details.slice(0, 30).map((d) => `- ${d.url}: ${d.finding}`));
        if (c.details.length > 30) out.push(`- … a dalších ${c.details.length - 30}`);
        out.push('');
    }
    out.push('## Stránky', '', ...report.pages.map((p) => `- ${p.kind} · HTTP ${p.status} · ${p.url}${p.source ? ` · zdroj: ${p.source}` : ''}`), '');
    if (report.notes?.length) out.push('## Poznámky', '', ...report.notes.map((n) => `- ${n}`), '');
    if (report.exceptions.length) {
        out.push('## Výjimky', '', ...report.exceptions.map((e) => `- ${e.status}: ${e.check ? `${e.check} ${e.scope} (${e.by}, ${e.date})` : e.row} ${e.reason ? `– ${e.reason}` : ''}`), '');
    }
    return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Runtime (network, browser)

export function makeGet({ headers = {}, timeout = 20000 } = {}) {
    return async (url, { ua = DESKTOP_UA, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } = {}) => {
        try {
            const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), headers: { accept, ...headers, 'user-agent': ua } });
            const text = await r.text();
            return { url, finalUrl: r.url, status: r.status, headers: Object.fromEntries(r.headers), text };
        } catch (error) {
            return { url, finalUrl: url, status: 0, headers: {}, text: '', error: String(error.message ?? error) };
        }
    };
}

async function pmap(items, fn, limit = 6) {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    }));
    return results;
}

/** Sitemap tree: { sources: [{ url, status, type, entries, error }], locs } (index files followed, max 20 files). */
export async function loadSitemaps(get, origin, robotsText) {
    let queue = robotsText ? parseRobotsSitemaps(robotsText).map((u) => new URL(u, origin).href) : [];
    if (queue.length === 0) queue = [`${origin}/sitemap.xml`];
    const sources = [];
    const seen = new Set();
    while (queue.length && seen.size < 20) {
        const url = queue.shift();
        if (seen.has(url)) continue;
        seen.add(url);
        const r = await get(url);
        const src = { url, status: r.status, type: null, entries: [], error: null, text: r.text };
        if (r.status === 200) {
            src.error = xmlError(r.text);
            const parsed = parseSitemapEntries(r.text);
            src.type = parsed.type;
            src.entries = parsed.entries;
            if (parsed.type === 'index') queue.push(...parsed.entries.map((e) => e.loc));
        }
        sources.push(src);
    }
    const locSource = new Map();
    for (const src of sources.filter((x) => x.type === 'urlset')) for (const e of src.entries) if (!locSource.has(e.loc)) locSource.set(e.loc, src.url);
    return { sources, locs: [...locSource.keys()], locSource };
}

async function checkSitemap(ctx) {
    const { sources } = ctx.sitemap;
    const ok = sources.filter((s) => s.status === 200);
    if (ok.length === 0) return res('fail', 'Sitemapa nenalezena (robots.txt Sitemap: ani /sitemap.xml).', [finding(`${ctx.origin}/sitemap.xml`, `HTTP ${sources[0]?.status || 'chyba spojení'}`)]);
    const details = [];
    for (const s of sources.filter((x) => x.status !== 200)) details.push(finding(s.url, `HTTP ${s.status || 'chyba spojení'}`));
    for (const s of ok) {
        if (s.error) details.push(finding(s.url, `neplatné XML: ${s.error}`));
        if (s.type === 'urlset') {
            const foreign = s.entries.filter((e) => !isAbsolute(e.loc) || !sameSite(e.loc, ctx.origin));
            if (foreign.length) details.push(finding(s.url, `${foreign.length}× URL není absolutní nebo je na jiném hostu (např. ${foreign[0].loc})`));
            const noMod = s.entries.filter((e) => !e.lastmod);
            if (noMod.length) details.push(finding(s.url, `${noMod.length} z ${s.entries.length} URL nemá <lastmod> (např. ${pathOf(noMod[0].loc)})`));
            if (s.entries.length === 0) details.push(finding(s.url, 'sitemapa je prázdná'));
        }
    }
    for (const loc of ctx.sitemap.locs.filter((u) => !isPageUrl(u))) details.push(finding(loc, `neplatná URL ve sitemapě ${ctx.sitemap.locSource.get(loc)} (není stránka)`));
    const sample = ctx.sitemap.locs.filter((u) => isAbsolute(u) && sameSite(u, ctx.origin) && isPageUrl(u)).filter((_, i, a) => i % Math.max(1, Math.ceil(a.length / 5)) === 0).slice(0, 5);
    const results = await pmap(sample, (u) => ctx.get(u));
    results.forEach((r, i) => r.status !== 200 && details.push(finding(sample[i], `URL ze sitemapy ${ctx.sitemap.locSource.get(sample[i])} vrací HTTP ${r.status || 'chyba spojení'}`)));
    return details.length ? res('fail', `Sitemapa: ${details.length} nedostatků.`, details) : res('pass', `Sitemapa je validní (${ctx.sitemap.locs.length} URL, všechna s lastmod).`);
}

async function checkBotAccess(ctx) {
    const sample = samplePages(ctx.pages, 5);
    const bots = BOTS.filter((b) => !b.robotsOnly);
    const jobs = bots.flatMap((bot) => sample.map((page) => ({ bot, page })));
    const results = await pmap(jobs, async ({ bot, page }) => ({ bot, page, r: await ctx.get(page.url, { ua: bot.ua }) }), 8);
    const details = [];
    for (const { bot, page, r } of results) {
        const problems = botResponseProblems(r, page.html.length);
        if (problems.length) details.push(finding(page.url, `${bot.name}: ${problems.join('; ')}`));
    }
    const hint = ' Pozn.: 403 na podvržené UA může být ochrana proti falešným botům; před výjimkou ověřte v přístupových lozích, že skutečné IP botů projdou.';
    return details.length ? res('fail', `Boti nedostanou stejný obsah jako prohlížeč (${details.length} nálezů).${hint}`, details) : res('pass', `${bots.length} UA botů dostává plný obsah (${sample.length} stránek).`);
}

async function checkLlmsTxt(ctx) {
    const url = `${ctx.origin}/llms.txt`;
    const r = await ctx.get(url, { accept: 'text/plain,text/markdown,*/*' });
    if (r.status !== 200) return res('fail', `/llms.txt chybí (HTTP ${r.status || 'chyba spojení'}).`, [finding(url, 'nedostupný')]);
    const ct = (r.headers['content-type'] ?? '').toLowerCase();
    const details = [];
    if (!/^text\/(plain|markdown)/.test(ct)) details.push(finding(url, `Content-Type má být text/plain nebo text/markdown (je ${ct || 'prázdný'})`));
    if (!r.text.startsWith('# ')) details.push(finding(url, 'soubor nezačíná nadpisem „# “'));
    const body = r.text.split('\n').slice(1).join('\n');
    if (!/^>\s*\S/m.test(body) && body.replace(/\[[^\]]*\]\([^)]*\)/g, '').trim().length < 20) details.push(finding(url, 'chybí shrnutí (řádek „>“) nebo popis'));
    const links = [...new Set([...r.text.matchAll(/\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map((m) => normalizeUrl(m[1], ctx.origin)).filter(Boolean))];
    if (links.length < 3) details.push(finding(url, `jen ${links.length} odkazů (min. 3)`));
    const checked = await pmap(links.slice(0, 5), (u) => ctx.get(u, { accept: '*/*' }));
    checked.forEach((x, i) => x.status !== 200 && details.push(finding(links[i], `odkaz z llms.txt vrací HTTP ${x.status || 'chyba spojení'}`)));
    return details.length ? res('fail', `llms.txt: ${details.length} nedostatků.`, details) : res('pass', `llms.txt je v pořádku (${links.length} odkazů).`);
}

async function checkMarkdown(ctx) {
    const sample = samplePages(ctx.pages, 5);
    const details = [];
    await pmap(sample, async (page) => {
        const h1 = h1sOf(page.html)[0]?.toLowerCase();
        const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ');
        const via = async (url, accept) => {
            const r = await ctx.get(url, { accept });
            return r.status === 200 && (r.headers['content-type'] ?? '').toLowerCase().includes('text/markdown') ? r : null;
        };
        let md = await via(page.url, 'text/markdown');
        if (md && !/accept/i.test(md.headers.vary ?? '')) {
            details.push(finding(page.url, 'Markdown přes Accept bez hlavičky Vary: Accept'));
            return;
        }
        if (!md) {
            const alt = tagsOf(page.html, 'link').find((a) => a.rel?.toLowerCase() === 'alternate' && a.type?.toLowerCase() === 'text/markdown')?.href;
            const u = new URL(page.finalUrl ?? page.url);
            const guess = u.pathname === '/' ? `${u.origin}/index.md` : `${u.origin}${u.pathname.replace(/\/$/, '')}.md`;
            md = (alt && (await via(new URL(alt, page.url).href, 'text/markdown'))) || (await via(guess, 'text/markdown'));
        }
        if (!md) details.push(finding(page.url, 'žádná Markdown verze (Accept: text/markdown ani <link rel=alternate> ani .md)'));
        else if (h1 && !norm(md.text).includes(norm(h1))) details.push(finding(page.url, `Markdown neobsahuje h1 „${h1}“`));
    });
    return details.length ? res('fail', `Markdown verze: ${details.length} nedostatků.`, details) : res('pass', `Markdown verze mají všechny vzorkované stránky (${sample.length}).`);
}

async function checkFeeds(ctx) {
    const entries = Object.entries(ctx.feeds);
    if (entries.length === 0) return res('fail', 'Eshop nemá zadané feedy; přidejte --feeds google=/feed.xml,zbozi=/zbozi.xml,heureka=/heureka.xml.', [finding('/', 'chybí --feeds')]);
    const details = [];
    const parts = [];
    for (const [kind, path] of entries) {
        const url = new URL(path, ctx.origin).href;
        const r = await ctx.get(url, { accept: 'application/xml,text/xml,*/*' });
        if (r.status !== 200) {
            details.push(finding(url, `${kind}: HTTP ${r.status || 'chyba spojení'}`));
            continue;
        }
        if (!/xml/i.test(r.headers['content-type'] ?? '') && !r.text.trimStart().startsWith('<?xml')) details.push(finding(url, `${kind}: odpověď není XML`));
        const v = validateFeed(kind, r.text);
        v.problems.forEach((p) => details.push(finding(url, `${kind}: ${p}`)));
        parts.push(`${kind} ${v.items}`);
    }
    return details.length ? res('fail', `Feedy: ${details.length} nedostatků.`, details) : res('pass', `Feedy jsou v pořádku (${parts.join(', ')} položek).`);
}

async function checkIndexNow(ctx) {
    if (!ctx.indexnowKey) return res('warn', 'IndexNow klíč neověřen (zadejte --indexnow-key).');
    const url = `${ctx.origin}/${ctx.indexnowKey}.txt`;
    const r = await ctx.get(url, { accept: 'text/plain,*/*' });
    if (r.status !== 200) return res('warn', `IndexNow soubor nedostupný (HTTP ${r.status || 'chyba spojení'}).`, [finding(url, 'nedostupný')]);
    return r.text.trim() === ctx.indexnowKey ? res('pass', 'IndexNow klíčový soubor sedí.') : res('warn', 'Obsah IndexNow souboru neodpovídá klíči.', [finding(url, 'jiný obsah')]);
}

async function checkOg(ctx) {
    const details = [];
    for (const p of samplePages(ctx.pages, 3)) {
        for (const k of ['og:title', 'og:description', 'og:image', 'og:url']) if (!metaContent(p.html, k, 'property')?.trim()) details.push(finding(p.url, `chybí ${k}`));
        const img = metaContent(p.html, 'og:image', 'property');
        if (img) {
            if (!isAbsolute(img)) details.push(finding(p.url, `og:image není absolutní (${img})`));
            else if ((await ctx.get(img, { accept: 'image/*' })).status !== 200) details.push(finding(p.url, 'og:image nevrací 200'));
        }
    }
    return details.length ? res('warn', 'Open Graph je neúplný.', details) : res('pass', 'Open Graph je kompletní.');
}

async function withBrowser(ctx, fn) {
    const page = await ctx.browser.newPage({ userAgent: DESKTOP_UA, extraHTTPHeaders: ctx.headers });
    try {
        return await fn(page);
    } finally {
        await page.close();
    }
}

async function checkSsr(ctx) {
    const details = [];
    for (const p of samplePages(ctx.pages, 4)) {
        await withBrowser(ctx, async (page) => {
            await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
            const rendered = await page.evaluate(() => ({
                text: (document.querySelector('main') ?? document.body).innerText,
                nav: [...document.querySelectorAll('nav a[href], header a[href]')].map((a) => a.href),
            }));
            details.push(...ssrFindings({ url: p.url, rawHtml: p.html, renderedText: rendered.text, renderedNavLinks: p.kind === 'home' ? rendered.nav.map((l) => normalizeUrl(l, p.url)).filter((l) => l && sameSite(l, ctx.origin) && !isAssetUrl(l)) : [] }));
        });
    }
    return details.length ? res('fail', `Obsah závisí na JavaScriptu (${details.length} nálezů).`, details) : res('pass', 'Obsah a navigace jsou v HTML bez JavaScriptu.');
}

async function checkSemantics(ctx) {
    const details = [];
    for (const p of samplePages(ctx.pages, 4)) {
        await withBrowser(ctx, async (page) => {
            await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
            details.push(...semanticsFindings(p.url, await page.evaluate(collectSemantics)));
        });
    }
    return details.length ? res('fail', `Sémantika: ${details.length} nálezů.`, details) : res('pass', 'h1, main a přístupné názvy jsou v pořádku.');
}

/** Check catalogue. `level(type)` gives the level, `only` limits the types, `browser` marks Playwright checks. */
export const CHECKS = [
    { id: 'robots', level: () => 'must', run: (c) => checkRobots({ robots: c.robots, pagePaths: c.pages.map((p) => new URL(p.url).pathname), staging: c.staging }) },
    { id: 'bot-access', level: () => 'must', run: checkBotAccess },
    { id: 'indexable', level: () => 'must', run: (c) => checkIndexable(c.pages, c.staging) },
    { id: 'sitemap', level: () => 'must', run: checkSitemap },
    { id: 'ssr-content', level: () => 'must', browser: true, run: checkSsr },
    { id: 'html-basics', level: () => 'must', run: (c) => checkHtmlBasics(c.pages) },
    { id: 'semantics', level: () => 'must', browser: true, run: checkSemantics },
    { id: 'jsonld', level: () => 'must', run: (c) => checkJsonLd(c.pages) },
    { id: 'facts', level: () => 'must', run: (c) => checkFacts(c.pages) },
    { id: 'policies', level: (t) => (t === 'eshop' ? 'must' : 'should'), run: (c) => checkPolicies(c.pages, c.type) },
    { id: 'llms-txt', level: () => 'must', run: checkLlmsTxt },
    { id: 'markdown', level: () => 'must', run: checkMarkdown },
    { id: 'product-data', level: () => 'must', only: ['eshop'], run: (c) => checkProductData(c.pages) },
    { id: 'feeds', level: () => 'must', only: ['eshop'], run: checkFeeds },
    { id: 'indexnow', level: () => 'should', run: checkIndexNow },
    { id: 'og', level: () => 'should', run: checkOg },
    { id: 'article-meta', level: () => 'should', run: (c) => checkArticleMeta(c.pages) },
    { id: 'captcha', level: () => 'should', run: (c) => checkCaptcha(c.pages) },
    { id: 'images-alt', level: () => 'should', run: (c) => checkImagesAlt(c.pages) },
    { id: 'webmcp', level: () => 'info', run: (c) => checkWebmcp(c.pages) },
];

export async function runChecks(ctx) {
    const out = [];
    for (const def of CHECKS) {
        const level = def.level(ctx.type);
        const base = { id: def.id, level };
        if (def.only && !def.only.includes(ctx.type)) {
            out.push({ ...base, ...res('skipped', `Netýká se typu ${ctx.type}.`) });
            continue;
        }
        if (def.browser && !ctx.browser) {
            out.push({ ...base, ...res('skipped', ctx.noBrowser ? 'Přeskočeno (--no-browser).' : 'Přeskočeno (prohlížeč není dostupný).') });
            continue;
        }
        let r;
        try {
            r = await def.run(ctx);
        } catch (error) {
            r = res('fail', `Kontrola selhala: ${error.message ?? error}`);
        }
        if (level === 'should' && r.status === 'fail') r.status = 'warn';
        out.push({ ...base, ...r });
    }
    return out;
}

/** Candidate page URLs from the sitemap and home links: same site, http(s), no assets, junk or `tel:`-like paths. */
export function candidatePool({ origin, sitemapLocs, homeLinks }) {
    const ok = (u) => u && isPageUrl(u) && sameSite(u, origin) && !isAssetUrl(u) && !isJunkUrl(u);
    return [...new Set([...sitemapLocs, ...homeLinks].map((u) => normalizeUrl(u, origin)).filter(ok))];
}

/** Picks the audited pages: home, contact, one per template round-robin, up to max; eshop also gets a product URL. */
export function pickUrls({ origin, sitemapLocs, homeLinks, max, type }) {
    const pool = candidatePool({ origin, sitemapLocs, homeLinks });
    const groups = groupByPattern(pool, { examples: max, topLevelExamples: max });
    const picked = [`${origin}/`];
    const contact = pool.find((u) => /kontakt|contact/i.test(new URL(u).pathname));
    if (contact) picked.push(contact);
    const product = type === 'eshop' ? pool.find(isProductUrl) : null;
    if (product && !picked.includes(product)) picked.push(product);
    const lists = groups.map((g) => g.examples.map((p) => new URL(p, origin).href));
    for (let i = 0; picked.length < max && lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i] && !picked.includes(l[i]) && picked.length < max) picked.push(l[i]);
    return picked;
}

export async function runAudit(o) {
    const type = o.type ?? 'website';
    const headers = { ...o.headers };
    if (o.auth) headers.authorization = `Basic ${Buffer.from(o.auth).toString('base64')}`;
    const get = makeGet({ headers });
    const homeRes = await get(o.base);
    if (homeRes.status === 0) throw new Error(`Home ${o.base} se nepodařilo načíst: ${homeRes.error}`);
    const origin = new URL(homeRes.finalUrl).origin;
    const robots = await get(`${origin}/robots.txt`, { accept: 'text/plain,*/*' });
    const sitemap = await loadSitemaps(get, origin, robots.status === 200 ? robots.text : '');
    const homeLinks = extractLinks(homeRes.text, homeRes.finalUrl);
    const urls = o.urls ? parseUrlsFile(o.urls, origin).map((e) => e.url) : pickUrls({ origin, sitemapLocs: sitemap.locs, homeLinks, max: o.max ?? 20, type });
    const fetched = await pmap(urls, async (u) => (u === `${origin}/` && homeRes.finalUrl.replace(/\/$/, '') === origin ? { ...homeRes, url: u } : get(u)), 5);
    const toPage = (r, source) => {
        const page = { url: r.url, finalUrl: r.finalUrl, status: r.status, headers: r.headers, html: r.status === 200 ? r.text : '' };
        return { ...page, kind: classifyPage(page), source };
    };
    const sourceOf = (u) => (o.urls ? 'urls' : sitemap.locSource.has(u) ? `sitemap ${sitemap.locSource.get(u)}` : 'odkaz z home');
    const pages = fetched.map((r) => toPage(r, sourceOf(r.url)));
    if (type === 'eshop' && !pages.some((p) => p.kind === 'product' && p.status === 200)) {
        // vzorek bez fungujícího produktu: zkusíme další produktové URL
        const tried = new Set(pages.map((p) => p.url));
        const more = candidatePool({ origin, sitemapLocs: sitemap.locs, homeLinks }).filter((u) => isProductUrl(u) && !tried.has(u)).slice(0, 5);
        for (const u of more) {
            const p = toPage(await get(u), sourceOf(u));
            pages.push(p);
            if (p.status === 200) break;
        }
    }
    const notes = pages.filter((p) => p.status !== 200).map((p) => `Stránka ${p.url} (zdroj: ${p.source}) vrací HTTP ${p.status || 'chyba spojení'}.`);
    let browser = null;
    let playwright = null;
    if (!o.noBrowser) {
        playwright = await loadPlaywright();
        if (!playwright) throw new Error(`Playwright chybí (${INSTALL_PLAYWRIGHT}); použijte --no-browser pro přeskočení ssr-content a semantics.`);
        browser = await playwright.chromium.launch({ channel: 'chrome', headless: true }).catch((e) => {
            throw new Error(`Chrome se nepodařilo spustit (${e.message.split('\n')[0]}); použijte --no-browser.`);
        });
    }
    try {
        const ctx = { base: o.base, origin, type, staging: Boolean(o.staging), noBrowser: Boolean(o.noBrowser), headers, get, browser, robots, sitemap, pages, feeds: o.feeds ?? {}, indexnowKey: o.indexnowKey };
        const raw = await runChecks(ctx);
        const exceptions = o.exceptionsText ? parseExceptions(o.exceptionsText) : { applied: [], ignored: [] };
        const applied = applyExceptions(raw, exceptions);
        return {
            base: o.base,
            date: new Date().toISOString().slice(0, 10),
            type,
            staging: Boolean(o.staging),
            toolVersion: TOOL_VERSION,
            pages: pages.map(({ url, kind, status, source }) => ({ url, kind, status, source })),
            notes,
            checks: applied.checks,
            score: computeScore(applied.checks),
            exceptions: applied.exceptions,
        };
    } finally {
        await browser?.close();
    }
}

// ---------------------------------------------------------------------------------------------
// CLI

const BOOLEAN = new Set(['check', 'staging', 'json', 'no-browser']);

export function parseCli(argv) {
    const o = { headers: {} };
    const errors = [];
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) {
            positional.push(arg);
            continue;
        }
        const key = arg.slice(2);
        if (BOOLEAN.has(key)) {
            o[key] = true;
            continue;
        }
        const value = argv[++i];
        if (value === undefined) {
            errors.push(`Volba --${key} vyžaduje hodnotu.`);
            continue;
        }
        if (key === 'header') {
            const idx = value.indexOf(':');
            if (idx < 1) errors.push(`Neplatná hlavička „${value}“ (očekáváno 'Name: value').`);
            else o.headers[value.slice(0, idx).trim().toLowerCase()] = value.slice(idx + 1).trim();
        } else o[key] = value;
    }
    return { o, command: positional[0] ?? null, errors };
}

export function parseFeeds(value) {
    const feeds = {};
    for (const part of String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
        const [kind, path] = part.split('=');
        if (!FEED_SPECS[kind] || !path) throw new Error(`Neplatný --feeds záznam „${part}“ (google|zbozi|heureka=/cesta).`);
        feeds[kind] = path;
    }
    return feeds;
}

async function check() {
    const pw = await loadPlaywright();
    console.log(pw ? '✓ playwright dostupný' : `✗ playwright chybí: ${INSTALL_PLAYWRIGHT}`);
    console.log(hasChrome() ? '✓ Google Chrome nainstalovaný' : '✗ Google Chrome nenalezen');
    return pw && hasChrome() ? 0 : 1;
}

const usage = () => readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 14).join('\n');

export async function main(argv) {
    const { o, command, errors } = parseCli(argv);
    if (o.check) return check();
    if (command !== 'run') {
        console.log(usage());
        return argv.length ? 2 : 0;
    }
    try {
        if (!o.base) errors.push('Chybí --base.');
        else new URL(o.base);
        if (o.type && !TYPES.includes(o.type)) errors.push(`--type musí být ${TYPES.join('|')}.`);
        const max = o.max ? Number.parseInt(o.max, 10) : 20;
        if (!(max > 0)) errors.push('--max musí být kladné číslo.');
        if (errors.length) throw new Error(errors.join(' '));
        const report = await runAudit({
            base: o.base,
            type: o.type,
            max,
            staging: o.staging,
            noBrowser: o['no-browser'],
            headers: o.headers,
            auth: o.auth,
            indexnowKey: o['indexnow-key'],
            feeds: parseFeeds(o.feeds),
            urls: o.urls ? readFileSync(resolve(o.urls), 'utf8') : null,
            exceptionsText: o.exceptions ? readFileSync(resolve(o.exceptions), 'utf8') : null,
        });
        if (o.out) {
            mkdirSync(o.out, { recursive: true });
            writeFileSync(join(o.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
            writeFileSync(join(o.out, 'report.md'), `${formatMarkdown(report)}\n`);
        }
        console.log(o.json ? JSON.stringify(report, null, 2) : formatConsole(report));
        return exitCodeOf(report.checks);
    } catch (error) {
        console.error(`✗ ${error.message ?? error}`);
        return 2;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
        console.error(`✗ ${error.stack ?? error}`);
        process.exit(2);
    });
}
