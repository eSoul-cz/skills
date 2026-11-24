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
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/** Reads the secrets file; throws when it is missing or readable by other users (must be chmod 600). */
export function readSecrets(file) {
    if (!existsSync(file)) throw new Error(`Secrets file ${file} does not exist (see references/access.md).`);
    const mode = statSync(file).mode & 0o777;
    if (mode & 0o077) throw new Error(`${file} has mode ${mode.toString(8)}, run chmod 600.`);
    const env = {};
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
}

const slug = (s) => s.replace(/^https?:\/\/[^/]+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';

/** The run and the secrets must point at the same origin, so one environment's credentials never log in to another. */
export function assertSameOrigin(run, base) {
    if (new URL(run.base_url).origin !== new URL(base).origin) {
        throw new Error(`UAT_BASE_URL ${base} does not match the run ${run.id} (${run.base_url}). Use the secrets of the same environment.`);
    }
}

const orDie = (fn) => {
    try {
        return fn();
    } catch (error) {
        return die(error.message);
    }
};

async function main() {
    const o = args(process.argv.slice(2));
    const pw = await loadPlaywright();
    if (o.check) {
        console.log(pw ? '✓ playwright available' : `✗ playwright missing: npm install --prefix ${cacheRoot} playwright@1`);
        const chrome = ['/Applications/Google Chrome.app', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].some(existsSync);
        console.log(chrome ? '✓ Google Chrome installed' : '✗ Google Chrome not found');
        process.exit(pw && chrome ? 0 : 1);
    }
    if (!pw) die(`playwright missing: npm install --prefix ${cacheRoot} playwright@1`);
    if (!o.config || !o.secrets || !o.run) die('Missing --config, --secrets or --run.');

    const config = JSON.parse(readFileSync(o.config, 'utf8'));
    const secrets = orDie(() => readSecrets(o.secrets.replace(/^~/, homedir())));
    const base = secrets.UAT_BASE_URL || die('UAT_BASE_URL is missing in the secrets file.');
    const runDir = resolve(o.run);
    const resultsFile = join(runDir, 'results.json');
    if (!existsSync(resultsFile)) die(`${resultsFile} does not exist, run uat.mjs init.`);
    const results = JSON.parse(readFileSync(resultsFile, 'utf8'));
    orDie(() => assertSameOrigin(results.run, base));
    const shotsDir = join(runDir, 'screenshots');
    mkdirSync(shotsDir, { recursive: true });
    const project = config.project || 'project';
    // Stored sessions contain cookies: keep the directory and every state file private.
    const sessionDir = join(cacheRoot, project);
    mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
    chmodSync(sessionDir, 0o700);
    for (const name of readdirSync(sessionDir)) chmodSync(join(sessionDir, name), 0o600);
    const runUuid = results.run.uuid ?? null;
    const auditSource = readFileSync(join(here, 'layout-audit.js'), 'utf8');
    const devices = { ...DEVICES, ...(config.devices ?? {}) };
    const login = config.login ?? {};

    const single = Boolean(o.url);
    const roleCodes = single ? [o.role || die('--url requires --role')] : list(o.roles).length ? list(o.roles) : Object.keys(config.roles ?? {});
    const deviceIds = single ? [o.device || 'desktop'] : list(o.devices).length ? list(o.devices) : ['tablet', 'mobile'];

    const browser = await pw.chromium.launch({ channel: 'chrome', headless: o.headed ? false : true });
    try {
        for (const role of roleCodes) {
            const routes = single ? [o.url] : config.roles?.[role]?.routes ?? [];
            for (const deviceId of deviceIds) {
                const device = devices[deviceId] || die(`Unknown device ${deviceId}.`);
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
                        if (!email || !password) die(`UAT_ROLE_${role}_EMAIL or UAT_ROLE_${role}_PASSWORD is missing in the secrets file.`);
                        await page.goto(new URL(login.path ?? '/login', base).href);
                        await page.fill(login.email ?? 'input[type=email]', email);
                        await page.fill(login.password ?? 'input[type=password]', password);
                        await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), page.click(login.submit ?? 'button[type=submit]')]);
                        await page.waitForTimeout(500);
                        if (page.url().includes(login.path ?? '/login')) die(`Login of role ${role} failed.`);
                        await context.storageState({ path: statePath });
                        chmodSync(statePath, 0o600);
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
                    }, runUuid);
                    console.log(`${role} ${deviceId} ${route}: ${(audit.findings ?? []).length} findings, ${consoleErrors.length} console errors, ${failed.length} failed requests${error ? `, ${error}` : ''}`);
                }
                await context.close();
            }
        }
    } finally {
        // Closing Chrome occasionally stalls after the last page; results are already written.
        await Promise.race([browser.close(), new Promise((done) => setTimeout(done, 5000))]);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main()
        .then(() => process.exit(0))
        .catch((e) => die(e.stack || e.message));
}
