#!/usr/bin/env node
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Usage: node scripts/mockup.mjs validate|preview [bundle] [--app-root PATH] [--php PATH] [--port NUMBER]
Defaults: bundle = skill example; app root = ESOUL_MOCKUP_APP_ROOT or current directory; PHP = PHP_BINARY or php; port = 8731.
Relative explicit paths use the current working directory. Internal paths use the skill directory.
Validation executes the application's BundleValidator with its authoritative schema; it needs PHP and Composer dependencies.
Preview validates the same way when the application checkout is available; without one it previews the bundle standalone (an unvalidated structural read of mockup.json, announced as UNVALIDATED), and never counts as validation.
Preview is loopback-only markup/design inspection: no app bridge, feedback editor, database, or persistence.`;

const frameCount = (manifest) => manifest.screens.reduce((count, screen) => count + screen.frames.length, 0);

/** The application's validator and schema are both present in the checkout. */
function hasApplicationValidator(appRoot) {
    return existsSync(resolve(appRoot, 'vendor/autoload.php')) && existsSync(resolve(appRoot, 'config/mockups/manifest.schema.json'));
}

/** Structural read for the standalone preview only: it proves the manifest loads, not that the application accepts it. */
function standaloneManifest(bundle) {
    let manifest;
    try {
        manifest = JSON.parse(readFileSync(resolve(bundle, 'mockup.json'), 'utf8'));
    } catch (error) {
        throw new Error(`Cannot read mockup.json in ${bundle}: ${error.message}`);
    }
    if (!manifest || typeof manifest.title !== 'string' || !Array.isArray(manifest.screens) || manifest.screens.length === 0) {
        throw new Error('mockup.json needs a title and at least one screen.');
    }
    for (const screen of manifest.screens) {
        if (!Array.isArray(screen.frames) || screen.frames.length === 0) throw new Error(`Screen ${screen.id}: needs at least one frame.`);
        for (const frame of screen.frames) {
            if (typeof frame.entry !== 'string' || !existsSync(resolve(bundle, frame.entry))) throw new Error(`Frame ${screen.id}/${frame.id}: entry ${frame.entry} does not exist in the bundle.`);
        }
    }
    return manifest;
}

/**
 * Validate with the application's canonical validator before exposing any content.
 * Preview uses opaque sandbox origins so executable bundles cannot access browser state or the UI.
 */

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('--help')) {
        console.log(usage);
        return;
    }
    const command = args.shift();
    if (!['validate', 'preview'].includes(command)) throw new Error(usage);
    let bundle = resolve(skillRoot, 'example');
    let appRoot = resolve(process.env.ESOUL_MOCKUP_APP_ROOT || process.cwd());
    let php = process.env.PHP_BINARY || 'php';
    let port = 8731;
    let suppliedBundle = false;
    while (args.length) {
        const value = args.shift();
        if (['--app-root', '--php', '--port'].includes(value)) {
            const next = args.shift();
            if (!next || next.startsWith('--')) throw new Error(`Missing value for ${value}`);
            if (value === '--app-root') appRoot = resolve(next);
            else if (value === '--php') php = next;
            else port = Number(next);
        } else if (!suppliedBundle && !value.startsWith('--')) {
            bundle = resolve(value);
            suppliedBundle = true;
        } else throw new Error(`Unexpected argument: ${value}`);
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer from 1 to 65535.');
    let manifest;
    if (command === 'preview' && !hasApplicationValidator(appRoot)) {
        // No application checkout: the in-app validator is optional for a local look at the bundle.
        manifest = standaloneManifest(bundle);
        console.log(`Standalone preview: ${manifest.title} (${frameCount(manifest)} frames). UNVALIDATED: the application validator did not run (no application checkout at ${appRoot}); run \`validate\` with --app-root before any publish.`);
    } else {
        const validation = spawnSync(php, [resolve(skillRoot, 'scripts/validate.php'), appRoot, bundle], {
            encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
        });
        if (validation.error) throw new Error(`Cannot execute PHP: ${validation.error.message}`);
        if (validation.status !== 0) throw new Error(validation.stderr.trim() || 'Application bundle validation failed.');
        manifest = JSON.parse(validation.stdout);
        console.log(`Valid bundle: ${manifest.title} (${frameCount(manifest)} frames)`);
    }
    if (command === 'validate') return;
    bundle = await realpath(bundle);

    const localFiles = new Map([
        ['/', ['text/html; charset=utf-8', resolve(skillRoot, 'scripts/preview.html')]],
        ['/preview.js', ['text/javascript; charset=utf-8', resolve(skillRoot, 'scripts/preview.js')]],
    ]);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' };
    const uiOrigin = `http://127.0.0.1:${port}`;
    let bundleOrigin;

    /**
     * Serve either the trusted controls or the untrusted bundle, never both on one origin.
     * Host checks bind requests to their listener; real paths keep assets inside the bundle.
     */
    async function serve(request, response, controls) {
        const origin = controls ? uiOrigin : bundleOrigin;
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.setHeader('Content-Security-Policy', controls
            ? `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src ${bundleOrigin}; connect-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
            : `default-src 'none'; script-src ${bundleOrigin}/bundle/ ${bundleOrigin}/__preview-frame.js 'unsafe-inline'; style-src ${bundleOrigin}/bundle/ 'unsafe-inline'; img-src ${bundleOrigin}/bundle/ data:; font-src ${bundleOrigin}/bundle/ data:; media-src ${bundleOrigin}/bundle/; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors ${uiOrigin}; sandbox allow-scripts`);
        try {
            if (request.headers.host !== `127.0.0.1:${request.socket.localPort}` || !['GET', 'HEAD'].includes(request.method)) {
                response.writeHead(403).end('Forbidden');
                return;
            }
            const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
            if (controls) {
                if (pathname === '/manifest.json' || pathname === '/preview-config.json') {
                    response.setHeader('Content-Type', 'application/json');
                    const payload = pathname === '/manifest.json' ? manifest : { bundleOrigin };
                    response.end(request.method === 'HEAD' ? undefined : JSON.stringify(payload));
                    return;
                }
                if (!localFiles.has(pathname)) throw new Error('Not found');
                const [type, file] = localFiles.get(pathname);
                response.setHeader('Content-Type', type);
                response.end(request.method === 'HEAD' ? undefined : await readFile(file));
                return;
            }
            if (pathname === '/__preview-frame.js') {
                response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
                response.setHeader('Access-Control-Allow-Origin', '*');
                response.end(request.method === 'HEAD' ? undefined : await readFile(resolve(skillRoot, 'scripts/preview-frame.js')));
                return;
            }
            if (!pathname.startsWith('/bundle/') || pathname.includes('\\') || pathname.includes('\0')) throw new Error('Not found');
            const file = await realpath(resolve(bundle, pathname.slice('/bundle/'.length)));
            const inside = relative(bundle, file);
            if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside) || !(await stat(file)).isFile()) throw new Error('Not found');
            const type = types[extname(file).toLowerCase()];
            if (!type) throw new Error('Unsupported file');
            // Opaque-origin modules and fonts need CORS, but never credentialed access.
            response.setHeader('Access-Control-Allow-Origin', '*');
            response.setHeader('Content-Type', type);
            if (request.method === 'HEAD') response.end();
            else if (extname(file).toLowerCase() === '.html') {
                const html = await readFile(file, 'utf8');
                // Appended rather than replacing markup inside author scripts or comments.
                response.end(`${html}\n<script src="/__preview-frame.js?uiOrigin=${encodeURIComponent(uiOrigin)}" crossorigin="anonymous"></script>`);
            } else createReadStream(file).on('error', () => response.destroy()).pipe(response);
        } catch {
            response.removeHeader('Access-Control-Allow-Origin');
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        }
    }
    const server = createServer((request, response) => serve(request, response, true));
    const bundleServer = createServer((request, response) => serve(request, response, false));

    /** Close both origins, including keep-alive connections, on shutdown or startup failure. */
    function stop() {
        for (const listener of [server, bundleServer]) {
            listener.close();
            listener.closeAllConnections();
        }
    }
    try {
        bundleServer.listen(0, '127.0.0.1');
        await once(bundleServer, 'listening');
        bundleOrigin = `http://127.0.0.1:${bundleServer.address().port}`;
        server.listen(port, '127.0.0.1');
        await once(server, 'listening');
    } catch (error) {
        stop();
        throw error;
    }
    for (const listener of [server, bundleServer]) listener.on('error', error => {
        console.error(error.message);
        process.exitCode = 1;
        stop();
    });
    console.log(`Local design preview: ${uiOrigin}/`);
    console.log(`Isolated bundle origin: ${bundleOrigin}`);
    console.log('NO FEEDBACK PERSISTENCE. Restart after manifest changes; refresh after asset changes. Ctrl+C stops.');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
