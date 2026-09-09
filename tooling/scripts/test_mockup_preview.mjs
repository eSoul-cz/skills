import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const skillRoot = fileURLToPath(new URL('../../skills/esoul-mockup-authoring/', import.meta.url));
const appRoot = process.env.ESOUL_MOCKUP_APP_ROOT;
const chrome = process.env.CHROME_BINARY;

/** Find a currently unused loopback port for the fixture's CLI invocation. */
async function freePort() {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

/** Wait for CLI readiness, rejecting startup failures instead of testing an unrelated listener. */
async function ready(child) {
    let output = '';
    let timer;
    try {
        await new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(new Error(`Preview startup timed out: ${output}`)), 10000);
            child.once('error', reject);
            child.once('exit', code => reject(new Error(`Preview exited ${code}: ${output}`)));
            child.stderr.on('data', chunk => { output += chunk; });
            child.stdout.on('data', chunk => {
                output += chunk;
                if (output.includes('Local design preview:')) resolve();
            });
        });
    } finally {
        clearTimeout(timer);
    }
}

test('opaque bundles load local modules without browser state access, while UI layout accepts only bounded declared-frame reports', {
    skip: !appRoot || !chrome ? 'Requires ESOUL_MOCKUP_APP_ROOT, compatible PHP_BINARY, and CHROME_BINARY.' : false,
    timeout: 60000,
}, async t => {
    const fixture = await mkdtemp(join(tmpdir(), 'mockup-isolation-'));
    let child;
    let browser;
    t.after(async () => {
        for (const process of [browser, child]) {
            if (process?.pid && process.exitCode === null && process.signalCode === null) {
                const exited = once(process, 'exit');
                process.kill('SIGKILL');
                await exited;
            }
        }
        await rm(fixture, { recursive: true, force: true });
    });
    const bundle = join(fixture, 'bundle');
    await cp(join(skillRoot, 'example'), bundle, { recursive: true });
    const page = join(bundle, 'pages/home-desktop.html');
    await writeFile(page, (await readFile(page, 'utf8')).replace('</body>', '<script src="../assets/attack.js"></script><script type="module" src="../assets/module.js"></script></body>'));
    await writeFile(join(bundle, 'assets/value.js'), 'export const value = "local module loaded";');
    await writeFile(join(bundle, 'assets/module.js'), 'import { value } from "./value.js"; document.querySelector("[data-mockup-screen]").dataset.moduleResult = value;');
    await writeFile(join(bundle, 'assets/attack.js'), `
const root = document.querySelector('[data-mockup-screen]');
root.style.minHeight = '2300px';
const denied = {};
// Deliberately bypass static API-name checks: sandboxing must remain the runtime security boundary.
for (const key of ['localStorage', 'sessionStorage']) {
    try { window[key]; denied[key] = false; } catch (error) { denied[key] = error.name === 'SecurityError'; }
}
try { document['cookie']; denied.cookie = false; } catch (error) { denied.cookie = error.name === 'SecurityError'; }
try {
    parent.document.documentElement.dataset.previewCompromised = 'true';
    parent.postMessage({ type: 'preview-test:done' }, location.origin);
} catch {}
try { window.frameElement.removeAttribute('sandbox'); } catch {}
// Only the controls may switch the authoring affordance on; a same-window message must not.
new MutationObserver(() => {
    if (!document.documentElement.hasAttribute('data-esoul-preview-hints')) return;
    const link = document.querySelector('[data-mockup-screen] a[href]');
    parent.postMessage({ type: 'preview-test:hints', outlined: getComputedStyle(link).outlineStyle === 'dashed' }, '*');
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-esoul-preview-hints'] });
window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'esoul-preview:inspect') return;
    const report = { type: 'esoul-preview:frame', nonce: event.data.nonce, entry: 'pages/home-desktop.html', screenId: 'workshop', frameId: 'desktop', height: 9999 };
    setTimeout(async () => {
        let networkBlocked = false;
        try { await window['fetch']('../assets/value.js'); } catch (error) { networkBlocked = error.name === 'TypeError'; }
        parent.postMessage(report, event.origin); // Bundle scripts can spoof geometry within the accepted bounds.
        parent.postMessage({ ...report, nonce: 'wrong-load', height: 8888 }, event.origin);
        parent.postMessage({ ...report, height: 0 }, event.origin);
        parent.postMessage({ ...report, height: 65537 }, event.origin);
        parent.postMessage({ ...report, height: '8888' }, event.origin);
        parent.postMessage({ ...report, entry: 'not-a-frame.html', height: 8888 }, event.origin);
        window.postMessage({ type: 'esoul-preview:hints', nonce: event.data.nonce, on: true, scale: 1 }, location.origin);
        await new Promise(resolve => setTimeout(resolve, 50));
        const hintsForced = document.documentElement.hasAttribute('data-esoul-preview-hints');
        parent.postMessage({ type: 'preview-test:done', origin: window.origin, denied, networkBlocked, hintsForced, moduleResult: root.dataset.moduleResult }, event.origin);
    }, 200);
});
`);
    const port = await freePort();
    const uiOrigin = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [join(skillRoot, 'scripts/mockup.mjs'), 'preview', bundle, '--app-root', resolve(appRoot), '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    await ready(child);

    // Chrome's native CDP pipe avoids external browser dependencies and virtual-time capture races.
    browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${join(fixture, 'chrome')}`], {
        stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'],
    });
    await once(browser, 'spawn', { signal: t.signal });
    const messages = new EventEmitter();
    let sequence = 0;
    let buffer = '';
    browser.stdio[4].setEncoding('utf8').on('data', chunk => {
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf('\0')) !== -1) {
            const message = JSON.parse(buffer.slice(0, end));
            buffer = buffer.slice(end + 1);
            messages.emit(message.id === undefined ? message.method : String(message.id), message);
        }
    });
    /** Send one CDP command and reject browser errors instead of accepting a forced capture. */
    async function command(method, params = {}, sessionId) {
        const id = ++sequence;
        const reply = once(messages, String(id), { signal: t.signal });
        browser.stdio[3].write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
        const [message] = await reply;
        if (message.error) throw new Error(message.error.message);
        return message.result;
    }
    const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
    await command('Page.enable', {}, sessionId);
    await command('Page.addScriptToEvaluateOnNewDocument', { source: `
const fromDesign = event => event.source === document.querySelector('#design')?.contentWindow;
window.previewTestDone = new Promise(resolve => {
    addEventListener('message', event => {
        if (fromDesign(event) && event.data?.type === 'preview-test:done') resolve({ ...event.data, messageOrigin: event.origin });
    });
});
window.previewTestHints = new Promise(resolve => {
    addEventListener('message', event => {
        if (fromDesign(event) && event.data?.type === 'preview-test:hints') resolve(event.data);
    });
});
` }, sessionId);
    const loaded = once(messages, 'Page.loadEventFired', { signal: t.signal });
    await command('Page.navigate', { url: uiOrigin }, sessionId);
    await loaded;
    const capture = await command('Runtime.evaluate', {
        expression: 'window.previewTestDone.then(report => ({ report, html: document.documentElement.outerHTML }))',
        awaitPromise: true, returnByValue: true,
    }, sessionId);
    assert.equal(capture.exceptionDetails, undefined, 'Browser verification failed');
    const { html, report } = capture.result.value;
    assert.equal(report.origin, 'null', 'Generated code must execute with an opaque origin');
    assert.equal(report.messageOrigin, 'null', 'Frame messages must carry the opaque origin');
    assert.deepEqual(report.denied, { localStorage: true, sessionStorage: true, cookie: true });
    assert.equal(report.moduleResult, 'local module loaded', 'Opaque frames must load relative ES module imports');
    assert.equal(report.networkBlocked, true, 'Prototype network requests must be blocked even to local bundle assets');
    assert.doesNotMatch(html, /data-preview-compromised=/, 'Bundle JavaScript modified the parent document');
    assert.match(html, /height: 9999px/, 'The UI must accept bounded reports from bundle scripts without treating them as trusted measurements');
    assert.doesNotMatch(html, /height: (?:0|8888|65537)px/, 'An invalid nonce, identity, type, or out-of-range report changed preview geometry');
    assert.equal(report.hintsForced, false, 'Bundle scripts must not switch the authoring affordance on');
    // Switching it on paints outlines and must leave the reported geometry untouched; anything that
    // reserved layout space would resize the frame and move every pin placed against it.
    const hints = await command('Runtime.evaluate', {
        expression: `(async () => {
            const design = document.querySelector('#design');
            const before = design.style.height;
            document.querySelector('#hints').click();
            const painted = await window.previewTestHints;
            await new Promise(resolve => setTimeout(resolve, 200));
            return { ...painted, before, after: design.style.height };
        })()`,
        awaitPromise: true, returnByValue: true,
    }, sessionId);
    assert.equal(hints.exceptionDetails, undefined, 'Enabling the authoring affordance failed');
    assert.equal(hints.result.value.outlined, true, 'The affordance must outline a declared link');
    assert.equal(hints.result.value.after, hints.result.value.before, 'The affordance changed the measured frame height');
    const configResponse = await fetch(`${uiOrigin}/preview-config.json`);
    assert.equal(configResponse.status, 200);
    const { bundleOrigin } = await configResponse.json();
    assert.notEqual(bundleOrigin, uiOrigin);
    assert.equal(new URL(bundleOrigin).hostname, '127.0.0.1');
    assert.equal((await fetch(`${uiOrigin}/bundle/pages/home-desktop.html`)).status, 404, 'UI origin must never serve bundle code');
    assert.equal((await fetch(`${bundleOrigin}/preview.js`)).status, 404, 'Bundle origin must never serve the control UI');
    const asset = await fetch(`${bundleOrigin}/bundle/assets/attack.js`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('access-control-allow-origin'), '*');
    assert.equal(asset.headers.get('access-control-allow-credentials'), null);
    const missing = await fetch(`${bundleOrigin}/bundle/assets/missing.js`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('access-control-allow-origin'), null);
});
