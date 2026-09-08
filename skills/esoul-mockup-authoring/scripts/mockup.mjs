#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Usage: node scripts/mockup.mjs validate|preview [bundle] [--app-root PATH] [--php PATH] [--port NUMBER]
Defaults: bundle = skill example; app root = ESOUL_MOCKUP_APP_ROOT or current directory; PHP = PHP_BINARY or php; port = 8731.
Relative explicit paths use the current working directory. Internal paths use the skill directory.
Validation executes the application's BundleValidator with its authoritative schema; it needs PHP and Composer dependencies.
Preview is loopback-only markup/design inspection: no app bridge, feedback editor, database, or persistence.`;

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
    const validation = spawnSync(php, [resolve(skillRoot, 'scripts/validate.php'), appRoot, bundle], {
        encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    });
    if (validation.error) throw new Error(`Cannot execute PHP: ${validation.error.message}`);
    if (validation.status !== 0) throw new Error(validation.stderr.trim() || 'Application bundle validation failed.');
    const manifest = JSON.parse(validation.stdout);
    console.log(`Valid bundle: ${manifest.title} (${manifest.screens.reduce((count, screen) => count + screen.frames.length, 0)} frames)`);
    if (command === 'validate') return;
    bundle = await realpath(bundle);

    const localFiles = new Map([
        ['/', ['text/html; charset=utf-8', resolve(skillRoot, 'scripts/preview.html')]],
        ['/preview.js', ['text/javascript; charset=utf-8', resolve(skillRoot, 'scripts/preview.js')]],
    ]);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' };
    const server = createServer(async (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
        try {
            // Reject DNS rebinding and writes. This is a local design tool, not a public host.
            if (request.headers.host !== `127.0.0.1:${port}` || !['GET', 'HEAD'].includes(request.method)) {
                response.writeHead(403).end('Forbidden');
                return;
            }
            const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
            if (pathname === '/manifest.json') {
                response.setHeader('Content-Type', 'application/json');
                response.end(request.method === 'HEAD' ? undefined : JSON.stringify(manifest));
                return;
            }
            let file;
            let type;
            if (localFiles.has(pathname)) [type, file] = localFiles.get(pathname);
            else {
                if (!pathname.startsWith('/bundle/') || pathname.includes('\\') || pathname.includes('\0')) throw new Error('Not found');
                file = await realpath(resolve(bundle, pathname.slice('/bundle/'.length)));
                const inside = relative(bundle, file);
                if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside) || !(await stat(file)).isFile()) throw new Error('Not found');
                type = types[extname(file).toLowerCase()];
                if (!type) throw new Error('Unsupported file');
            }
            response.setHeader('Content-Type', type);
            if (request.method === 'HEAD') response.end();
            else if (localFiles.has(pathname)) response.end(await readFile(file));
            else createReadStream(file).on('error', () => response.destroy()).pipe(response);
        } catch {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        }
    });
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => {
        console.log(`Local design preview: http://127.0.0.1:${port}/`);
        console.log('NO FEEDBACK PERSISTENCE. Restart after manifest changes; refresh after asset changes. Ctrl+C stops.');
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
