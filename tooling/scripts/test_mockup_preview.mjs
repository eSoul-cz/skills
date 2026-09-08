import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const run = promisify(execFile);
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

test('script-capable bundles cannot modify the UI, whose layout accepts only bounded declared-frame reports', {
    skip: !appRoot || !chrome ? 'Requires ESOUL_MOCKUP_APP_ROOT, compatible PHP_BINARY, and CHROME_BINARY.' : false,
    timeout: 60000,
}, async t => {
    const fixture = await mkdtemp(join(tmpdir(), 'mockup-isolation-'));
    t.after(() => rm(fixture, { recursive: true, force: true }));
    const bundle = join(fixture, 'bundle');
    await cp(join(skillRoot, 'example'), bundle, { recursive: true });
    const page = join(bundle, 'pages/home-desktop.html');
    await writeFile(page, (await readFile(page, 'utf8')).replace('</body>', '<script src="../assets/attack.js"></script></body>'));
    await writeFile(join(bundle, 'assets/attack.js'), `
const root = document.querySelector('[data-mockup-screen]');
root.style.minHeight = '2300px';
try { parent.document.documentElement.dataset.previewCompromised = 'true'; } catch {}
try { window.frameElement.removeAttribute('sandbox'); } catch {}
window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'esoul-preview:inspect') return;
    const report = { type: 'esoul-preview:frame', nonce: event.data.nonce, entry: 'pages/home-desktop.html', screenId: 'workshop', frameId: 'desktop', height: 9999 };
    setTimeout(() => {
        parent.postMessage(report, event.origin); // Bundle scripts can spoof geometry within the accepted bounds.
        parent.postMessage({ ...report, nonce: 'wrong-load', height: 8888 }, event.origin);
        parent.postMessage({ ...report, height: 0 }, event.origin);
        parent.postMessage({ ...report, height: 65537 }, event.origin);
        parent.postMessage({ ...report, height: '8888' }, event.origin);
        parent.postMessage({ ...report, entry: 'not-a-frame.html', height: 8888 }, event.origin);
    }, 200);
});
`);
    const port = await freePort();
    const uiOrigin = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [join(skillRoot, 'scripts/mockup.mjs'), 'preview', bundle, '--app-root', resolve(appRoot), '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGTERM');
            await once(child, 'exit');
        }
    });
    await ready(child);
    const { stdout: html } = await run(chrome, [
        '--headless=new', '--no-first-run', '--no-default-browser-check',
        `--user-data-dir=${join(fixture, 'chrome')}`, '--dump-dom', '--virtual-time-budget=3000', uiOrigin,
    ], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    assert.doesNotMatch(html, /data-preview-compromised=/, 'Bundle JavaScript modified the parent document');
    assert.match(html, /height: 9999px/, 'The UI must accept bounded reports from bundle scripts without treating them as trusted measurements');
    assert.doesNotMatch(html, /height: (?:0|8888|65537)px/, 'An invalid nonce, identity, type, or out-of-range report changed preview geometry');
    const configResponse = await fetch(`${uiOrigin}/preview-config.json`);
    assert.equal(configResponse.status, 200);
    const { bundleOrigin } = await configResponse.json();
    assert.notEqual(bundleOrigin, uiOrigin);
    assert.equal(new URL(bundleOrigin).hostname, '127.0.0.1');
    assert.equal((await fetch(`${uiOrigin}/bundle/pages/home-desktop.html`)).status, 404, 'UI origin must never serve bundle code');
    assert.equal((await fetch(`${bundleOrigin}/preview.js`)).status, 404, 'Bundle origin must never serve the control UI');
    assert.equal((await fetch(`${bundleOrigin}/bundle/assets/attack.js`)).status, 200);
});
