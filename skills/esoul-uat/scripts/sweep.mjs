#!/usr/bin/env node
/**
 * eSoul UAT responsive sweep with Playwright and the installed Google Chrome.
 *
 *   sweep.mjs --check
 *   sweep.mjs --config docs/testing/uat/uat.config.json --secrets ~/.config/esoul-uat/<repo>.<env>.env \
 *             --run docs/testing/uat/runs/<id> [--devices tablet,mobile] [--roles A,B]
 *   sweep.mjs --config … --secrets … --run … --role B --device mobile --url /animals/sheep --shot name
 *   --reset  discard the manual triage of findings on revisited routes
 *
 * Logs in per role through the configured form, visits routes, saves full-page screenshots,
 * runs layout-audit.js, and appends findings to <run>/results.json under "layout".
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { updateRun } from './uat.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cacheRoot = join(homedir(), '.cache', 'esoul-uat');

const DEVICES = {
    desktop: { viewport: { width: 1440, height: 900 } },
    laptop: { viewport: { width: 1280, height: 800 } },
    tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
    'mobile-s': { viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' },
};

function args(argv) {
    const o = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const key = argv[i].slice(2);
        o[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
    return o;
}
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const die = (m) => {
    console.error(`✗ ${m}`);
    process.exit(1);
};

async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch {
        try {
            const require = createRequire(join(cacheRoot, 'package.json'));
            return require('playwright');
        } catch {
            return null;
        }
    }
}

function readSecrets(file) {
    if (!existsSync(file)) die(`Soubor s přístupy ${file} neexistuje (viz references/access.md).`);
    const mode = statSync(file).mode & 0o777;
    if (mode & 0o077) die(`${file} má práva ${mode.toString(8)}, nastav chmod 600.`);
    const env = {};
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
}

const slug = (s) => s.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';

async function main() {
    const o = args(process.argv.slice(2));
    const pw = await loadPlaywright();
    if (o.check) {
        console.log(pw ? '✓ playwright dostupný' : `✗ playwright chybí: npm install --prefix ${cacheRoot} playwright@1`);
        const chrome = ['/Applications/Google Chrome.app', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].some(existsSync);
        console.log(chrome ? '✓ Google Chrome nainstalovaný' : '✗ Google Chrome nenalezen');
        process.exit(pw && chrome ? 0 : 1);
    }
    if (!pw) die(`playwright chybí: npm install --prefix ${cacheRoot} playwright@1`);
    if (!o.config || !o.secrets || !o.run) die('Chybí --config, --secrets nebo --run.');

    const config = JSON.parse(readFileSync(o.config, 'utf8'));
    const secrets = readSecrets(o.secrets.replace(/^~/, homedir()));
    const base = secrets.UAT_BASE_URL || die('V přístupech chybí UAT_BASE_URL.');
    const runDir = resolve(o.run);
    const resultsFile = join(runDir, 'results.json');
    if (!existsSync(resultsFile)) die(`${resultsFile} neexistuje, spusť uat.mjs init.`);
    const results = JSON.parse(readFileSync(resultsFile, 'utf8'));
    if (new URL(results.run.base_url).origin !== new URL(base).origin) {
        die(`UAT_BASE_URL ${base} neodpovídá běhu ${results.run.id} (${results.run.base_url}). Použij přístupy ke stejnému prostředí.`);
    }
    const shotsDir = join(runDir, 'screenshots');
    mkdirSync(shotsDir, { recursive: true });
    const project = config.project || 'project';
    const sessionDir = join(cacheRoot, project);
    mkdirSync(sessionDir, { recursive: true });
    const auditSource = readFileSync(join(here, 'layout-audit.js'), 'utf8');
    const devices = { ...DEVICES, ...(config.devices ?? {}) };
    const login = config.login ?? {};

    const single = Boolean(o.url);
    const roleCodes = single ? [o.role || die('--url vyžaduje --role')] : list(o.roles).length ? list(o.roles) : Object.keys(config.roles ?? {});
    const deviceIds = single ? [o.device || 'desktop'] : list(o.devices).length ? list(o.devices) : ['tablet', 'mobile'];

    const browser = await pw.chromium.launch({ channel: 'chrome', headless: o.headed ? false : true });
    try {
        for (const role of roleCodes) {
            const routes = single ? [o.url] : config.roles?.[role]?.routes ?? [];
            for (const deviceId of deviceIds) {
                const device = devices[deviceId] || die(`Neznámé zařízení ${deviceId}.`);
                const statePath = join(sessionDir, `${role}.json`);
                const httpCredentials = secrets.UAT_BASIC_AUTH_USER ? { username: secrets.UAT_BASIC_AUTH_USER, password: secrets.UAT_BASIC_AUTH_PASSWORD } : undefined;
                const context = await browser.newContext({
                    ...device,
                    locale: config.locale ?? 'cs-CZ',
                    bypassCSP: true,
                    httpCredentials,
                    storageState: role !== 'N' && existsSync(statePath) ? statePath : undefined,
                });
                const page = await context.newPage();
                if (role !== 'N') {
                    await page.goto(new URL(routes[0] ?? '/', base).href, { waitUntil: 'domcontentloaded' });
                    if (page.url().includes(login.path ?? '/login')) {
                        const email = secrets[`UAT_ROLE_${role}_EMAIL`];
                        const password = secrets[`UAT_ROLE_${role}_PASSWORD`];
                        if (!email || !password) die(`V přístupech chybí UAT_ROLE_${role}_EMAIL nebo _PASSWORD.`);
                        await page.goto(new URL(login.path ?? '/login', base).href);
                        await page.fill(login.email ?? 'input[type=email]', email);
                        await page.fill(login.password ?? 'input[type=password]', password);
                        await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(login.submit ?? 'button[type=submit]')]);
                        await page.waitForTimeout(500);
                        if (page.url().includes(login.path ?? '/login')) die(`Přihlášení role ${role} selhalo.`);
                        await context.storageState({ path: statePath });
                    }
                }
                for (const route of routes) {
                    const consoleErrors = [];
                    const failed = [];
                    const onConsole = (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300));
                    const onResponse = (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.request().method()} ${r.url()}`);
                    page.on('console', onConsole);
                    page.on('response', onResponse);
                    const url = new URL(route, base).href;
                    let error = null;
                    try {
                        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                    } catch (e) {
                        error = e.message.split('\n')[0];
                    }
                    await page.waitForTimeout(300);
                    const name = single && typeof o.shot === 'string' ? o.shot : `sweep-${role}-${deviceId}-${slug(route)}`;
                    const shot = join(shotsDir, `${name}.png`);
                    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
                    const audit = await page
                        .evaluate(({ src, opts }) => new Function(`${src}\nreturn __esoulLayoutAudit;`)()(opts), { src: auditSource, opts: { touch: Boolean(device.hasTouch), viewportWidth: device.viewport.width, viewportHeight: device.viewport.height } })
                        .catch((e) => ({ findings: [], error: e.message }));
                    page.off('console', onConsole);
                    page.off('response', onResponse);
                    const entry = {
                        url,
                        final_url: page.url(),
                        role,
                        device: deviceId,
                        screenshot: relative(runDir, shot),
                        findings: (audit.findings ?? []).map((f) => ({ ...f, confirmed: null })),
                        console: consoleErrors,
                        network: failed,
                        error: error ?? audit.error ?? null,
                        at: new Date().toISOString(),
                    };
                    // Merge into the current results.json under the shared lock and keep the manual
                    // triage (confirmed true/false) of findings that are still present.
                    updateRun(runDir, (current) => {
                        const same = (l) => l.url === url && l.device === deviceId && l.role === role;
                        const previous = current.layout.find(same);
                        const key = (f) => `${f.check}\u0000${f.element}\u0000${f.detail}`;
                        const triage = new Map((previous?.findings ?? []).filter((f) => f.confirmed !== null && f.confirmed !== undefined).map((f) => [key(f), f.confirmed]));
                        if (!o.reset) entry.findings = entry.findings.map((f) => (triage.has(key(f)) ? { ...f, confirmed: triage.get(key(f)) } : f));
                        current.layout = current.layout.filter((l) => !same(l));
                        current.layout.push(entry);
                    });
                    console.log(`${role} ${deviceId} ${route}: ${(audit.findings ?? []).length} nálezů, ${consoleErrors.length} chyb konzole, ${failed.length} chybných požadavků${error ? `, ${error}` : ''}`);
                }
                await context.close();
            }
        }
    } finally {
        // Closing Chrome occasionally stalls after the last page; results are already written.
        await Promise.race([browser.close(), new Promise((done) => setTimeout(done, 5000))]);
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => die(e.stack || e.message));
