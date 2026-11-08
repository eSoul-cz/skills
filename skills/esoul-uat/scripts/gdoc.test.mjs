import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
    aggregateE2e,
    buildPayload,
    call,
    E2E_ID,
    envFilePath,
    formatE2eCell,
    isConfigured,
    loadConfig,
    loadProjectConfig,
    parseArgs,
    reportDate,
    run,
    selectChapters,
} from './gdoc.mjs';
import { loadCatalogue, parseChapter, validate } from './uat.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const plain = (value) => JSON.parse(JSON.stringify(value));

const CHAPTER = [
    '# Firemní zákazníci',
    '',
    '- **Kapitola:** B2B',
    '- **Část:** A',
    '',
    'Kapitola pokrývá nákup za firmu.',
    'Druhý řádek téhož odstavce.',
    '',
    'Druhý odstavec.',
    '',
    '**Předpoklady:**',
    '',
    '- Přihlášen jako firemní zákazník.',
    '',
    '## B2B-01 Firemní cena',
    '',
    '- **Role:** B',
    '- **Typ:** happy',
    '- **Základ:** kod',
    '- **Předpoklad:** Existuje firemní účet.',
    '- **UI:** ne',
    '',
    '| # | Akce | Očekávaný výsledek |',
    '|---|---|---|',
    '| 1 | Otevři katalog. | Zobrazí se firemní ceny. |',
    '| 2 | Přidej do košíku. | Cena je bez DPH. |',
    '',
    '## B2B-02 Zrušený scénář',
    '',
    '- **Zrušeno:** už neplatí',
    '',
].join('\n');

/** Project repository in a temp dir with one chapter B2B. */
function makeRepo({ automatedColumn = false, projectKey = 'demo' } = {}) {
    const repo = mkdtempSync(join(tmpdir(), 'esoul-gdoc-repo-'));
    const uat = join(repo, 'docs', 'testing', 'uat');
    mkdirSync(join(uat, 'scenarios'), { recursive: true });
    writeFileSync(join(uat, 'uat.config.json'), JSON.stringify({ project: 'Demo', projectKey, automatedColumn }));
    writeFileSync(join(uat, 'scenarios', '01-b2b.md'), CHAPTER);
    return repo;
}

const ENV = { UAT_GDOC_URL: 'https://script.example/exec', UAT_GDOC_TOKEN: 'sekret-token' };

/** run() with captured output and a fetch mock that records bodies and answers with `reply`. */
async function exec(argv, { repo, env = ENV, reply = { ok: true }, home, now } = {}) {
    const lines = { out: [], err: [], bodies: [] };
    const fetchImpl = async (url, init) => {
        if (init.body) lines.bodies.push(JSON.parse(init.body));
        return new Response(JSON.stringify(typeof reply === 'function' ? reply(lines.bodies.at(-1)) : reply), { status: 200 });
    };
    const code = await run(argv, {
        env,
        cwd: repo,
        home: home ?? mkdtempSync(join(tmpdir(), 'esoul-gdoc-home-')),
        fetchImpl,
        now,
        out: (l) => lines.out.push(l),
        err: (l) => lines.err.push(l),
    });
    return { code, ...lines };
}

/* ------------------------------------------------------- uat.mjs sdílený parser */

test('prefix ID povoluje číslice a validace to přijme (B2B-01)', () => {
    const chapter = parseChapter(CHAPTER, 'b2b.md');
    assert.equal(chapter.meta.id, 'B2B');
    assert.deepEqual(chapter.scenarios.map((s) => s.id), ['B2B-01', 'B2B-02']);
    const repo = makeRepo();
    const chapters = loadCatalogue(join(repo, 'docs', 'testing', 'uat', 'scenarios'));
    assert.deepEqual(validate(chapters).errors, []);
});

test('prefix s neplatným znakem nebo délkou validace odmítne', () => {
    const bad = parseChapter(CHAPTER.replaceAll('B2B', 'b2b'), 'x.md');
    assert.ok(bad.errors.length > 0 || validate([{ ...bad, scenarios: [] }]).errors.length > 0);
    const long = CHAPTER.replaceAll('B2B', 'ABCDE');
    assert.ok(parseChapter(long, 'x.md').errors.length > 0);
});

test('úvod kapitoly a předpoklady se vyčtou z Markdownu', () => {
    const chapter = parseChapter(CHAPTER, 'b2b.md');
    assert.deepEqual(chapter.intro, ['Kapitola pokrývá nákup za firmu. Druhý řádek téhož odstavce.', 'Druhý odstavec.']);
    assert.deepEqual(chapter.preconditions, ['Přihlášen jako firemní zákazník.']);
});

/* ---------------------------------------------------------------- payload */

test('payload: mapování scénářů, popisků a pořadí kapitol', () => {
    const repo = makeRepo();
    const catalogue = loadCatalogue(join(repo, 'docs', 'testing', 'uat', 'scenarios'));
    const payload = buildPayload(catalogue, { project: { project: 'Demo' }, repo });
    assert.deepEqual(payload.order, ['B2B']);
    assert.equal(payload.meta.scenarios, 1, 'zrušený scénář se nepočítá');
    const [first, cancelled] = payload.chapters[0].scenarios;
    assert.equal(first.typeLabel, 'Hlavní tok');
    assert.equal(first.basisLabel, 'dle kódu');
    assert.equal(first.ui, false);
    assert.equal(first.precondition, 'Existuje firemní účet.');
    assert.deepEqual(first.steps[1], { action: 'Přidej do košíku.', expected: 'Cena je bez DPH.' });
    assert.equal(cancelled.cancelled, 'už neplatí');
    assert.deepEqual(payload.chapters[0].preconditions, ['Přihlášen jako firemní zákazník.']);
});

test('výběr kapitol: --chapter, --from a neznámá kapitola', () => {
    const payload = { order: ['PRE', 'AUT', 'B2B'], chapters: ['PRE', 'AUT', 'B2B'].map((id) => ({ id })) };
    assert.deepEqual(selectChapters(payload, { chapter: 'AUT,B2B' }).map((c) => c.id), ['AUT', 'B2B']);
    assert.deepEqual(selectChapters(payload, { from: 'AUT' }).map((c) => c.id), ['AUT', 'B2B']);
    assert.throws(() => selectChapters(payload, { chapter: 'XX' }), /Neznámá kapitola XX/);
});

/* ----------------------------------------------------------------- e2e */

test('ID z názvu testu: B2B, 2–4 znaky, jen na začátku', () => {
    assert.equal(E2E_ID.exec('[B2B-03] Firemní cena')[1], 'B2B-03');
    assert.equal(E2E_ID.exec('[AUT-12] x')?.[0], '[AUT-12]');
    assert.equal(E2E_ID.exec('[AB-1] x')?.[1], 'AB-1');
    assert.equal(E2E_ID.exec('[ABCD-01] x')?.[1], 'ABCD-01');
    assert.equal(E2E_ID.exec('[ABCDE-01] x'), null);
    assert.equal(E2E_ID.exec('[A-01] x'), null);
    assert.equal(E2E_ID.exec('[abc-01] x'), null);
    assert.equal(E2E_ID.exec('Test [ABC-01]'), null);
});

const test_ = (status, results = [{ status: status === 'expected' ? 'passed' : 'failed' }]) => ({ status, results });
const report = (specs) => ({ suites: [{ title: 'a.spec.ts', specs: [], suites: [{ title: 'describe', specs, suites: [] }] }] });

test('agregace e2e: pass / fail / skip podle pravidel, vnořené suites, testy bez ID se ignorují', () => {
    const aggregated = aggregateE2e(
        report([
            { title: '[ABC-01] vše projde', tests: [test_('expected'), test_('expected')] },
            { title: '[ABC-02] jeden selže', tests: [test_('expected'), { status: 'unexpected', results: [{ status: 'failed', error: { message: '\u001b[31mExpected: 1\u001b[0m\nReceived: 2' } }] }] },
            { title: '[ABC-03] timeout', tests: [{ status: 'unexpected', results: [{ status: 'timedOut' }] }] },
            { title: '[ABC-04] jen skip', tests: [test_('skipped', [{ status: 'skipped' }])] },
            { title: '[ABC-05] pass a skip', tests: [test_('expected'), test_('skipped', [{ status: 'skipped' }])] },
            { title: '[ABC-06] flaky', tests: [test_('flaky', [{ status: 'failed' }, { status: 'passed' }])] },
            { title: '[B2B-01] firemní', tests: [test_('expected')] },
            { title: 'bez ID', tests: [test_('unexpected')] },
            { title: '[ABC-07] bez testů', tests: [] },
        ]),
    );
    assert.deepEqual(Object.keys(aggregated).sort(), ['ABC-01', 'ABC-02', 'ABC-03', 'ABC-04', 'ABC-05', 'ABC-06', 'B2B-01']);
    assert.equal(aggregated['ABC-01'].status, 'pass');
    assert.equal(aggregated['ABC-01'].tests, 2);
    assert.equal(aggregated['ABC-02'].status, 'fail');
    assert.equal(aggregated['ABC-02'].reason, 'Expected: 1', 'bez ANSI, první řádek');
    assert.equal(aggregated['ABC-03'].status, 'fail');
    assert.equal(aggregated['ABC-03'].reason, 'vypršel časový limit');
    assert.equal(aggregated['ABC-04'].status, 'skip');
    assert.equal(aggregated['ABC-05'].status, 'skip');
    assert.equal(aggregated['ABC-06'].status, 'pass');
    assert.equal(aggregated['B2B-01'].status, 'pass');
});

test('agregace e2e: stav z posledního výsledku, když chybí test.status', () => {
    const aggregated = aggregateE2e(report([{ title: '[ABC-01] a', tests: [{ results: [{ status: 'failed' }, { status: 'passed' }] }] }, { title: '[ABC-02] b', tests: [{ results: [{ status: 'timedOut' }] }] }]));
    assert.equal(aggregated['ABC-01'].status, 'pass');
    assert.equal(aggregated['ABC-02'].status, 'fail');
});

test('text buňky: stav, datum a při selhání důvod (zkrácený)', () => {
    const date = new Date(2026, 10, 8);
    assert.equal(formatE2eCell({ status: 'pass' }, date), '✅ Prošlo · 2026-11-08');
    assert.equal(formatE2eCell({ status: 'skip' }, date), '⏭ Přeskočeno · 2026-11-08');
    assert.equal(formatE2eCell({ status: 'fail', failed: 2, reason: 'boom' }, date), '❌ Selhalo · 2026-11-08 · boom (+1 další)');
    const long = aggregateE2e(report([{ title: '[ABC-01] a', tests: [{ status: 'unexpected', results: [{ status: 'failed', error: { message: 'x'.repeat(500) } }] }] }]));
    assert.equal(long['ABC-01'].reason.length, 140);
    assert.equal(reportDate({ stats: { startTime: '2026-11-07T10:00:00.000Z' } }, new Date(0)).getUTCFullYear(), 2026);
    assert.equal(reportDate({}, new Date(5)).getTime(), 5);
});

test('příkaz e2e: zapíše agregát známých scénářů, neznámé ID jen varuje', async () => {
    const repo = makeRepo({ automatedColumn: true });
    writeFileSync(
        join(repo, 'e2e.json'),
        JSON.stringify({
            stats: { startTime: '2026-11-08T08:00:00.000Z' },
            ...report([
                { title: '[B2B-01] firemní cena', tests: [test_('expected')] },
                { title: '[ZZZ-09] neznámý', tests: [test_('expected')] },
                { title: 'bez ID', tests: [test_('expected')] },
            ]),
        }),
    );
    const result = await exec(['e2e', '--report', 'e2e.json'], { repo, reply: { ok: true, written: 1, missing: [] } });
    assert.equal(result.code, 0);
    assert.equal(result.bodies.length, 1);
    assert.equal(result.bodies[0].action, 'e2e');
    assert.equal(result.bodies[0].automatedColumn, true);
    assert.equal(result.bodies[0].token, ENV.UAT_GDOC_TOKEN);
    assert.deepEqual(result.bodies[0].results.map((r) => r.id), ['B2B-01']);
    assert.match(result.bodies[0].results[0].text, /^✅ Prošlo · 2026-11-0[78]$/);
    assert.match(result.err.join('\n'), /ZZZ-09: scénář není v katalogu/);
    assert.match(result.out.join('\n'), /Zapsáno 1 z 1/);
});

test('příkaz e2e: vypnutý sloupec, chybějící report, --dry-run bez volání', async () => {
    const off = makeRepo({ automatedColumn: false });
    writeFileSync(join(off, 'e2e.json'), JSON.stringify(report([])));
    const refused = await exec(['e2e', '--report', 'e2e.json'], { repo: off });
    assert.equal(refused.code, 2);
    assert.match(refused.err.join('\n'), /automatedColumn/);
    assert.equal(refused.bodies.length, 0);

    const on = makeRepo({ automatedColumn: true });
    assert.equal((await exec(['e2e', '--report', 'neni.json'], { repo: on })).code, 2);
    assert.equal((await exec(['e2e'], { repo: on })).code, 2);
    writeFileSync(join(on, 'e2e.json'), JSON.stringify(report([{ title: '[B2B-01] x', tests: [test_('unexpected')] }])));
    const dry = await exec(['e2e', '--report', 'e2e.json', '--dry-run'], { repo: on, env: {} });
    assert.equal(dry.code, 0);
    assert.equal(dry.bodies.length, 0);
    assert.match(dry.out.join('\n'), /B2B-01: ❌ Selhalo/);
});

test('příkaz e2e: server hlásí chybějící scénář jako varování', async () => {
    const repo = makeRepo({ automatedColumn: true });
    writeFileSync(join(repo, 'e2e.json'), JSON.stringify(report([{ title: '[B2B-01] x', tests: [test_('expected')] }])));
    const result = await exec(['e2e', '--report', 'e2e.json'], { repo, reply: { ok: true, written: 0, missing: ['B2B-01'] } });
    assert.equal(result.code, 0);
    assert.match(result.err.join('\n'), /B2B-01: scénář nebo sloupec/);
});

/* --------------------------------------------------------------- config */

test('konfigurace: env má přednost, jinak soubor ~/.config/esoul/<projekt>-uat-gdoc.env', () => {
    const home = mkdtempSync(join(tmpdir(), 'esoul-gdoc-home-'));
    mkdirSync(join(home, '.config', 'esoul'), { recursive: true });
    writeFileSync(join(home, '.config', 'esoul', 'indcom-uat-gdoc.env'), '# komentář\nUAT_GDOC_URL="https://file.example/exec"\nUAT_GDOC_TOKEN=ze-souboru\n');
    assert.equal(envFilePath('indcom', home), join(home, '.config', 'esoul', 'indcom-uat-gdoc.env'));
    const fromFile = loadConfig({ env: {}, key: 'indcom', home });
    assert.deepEqual([fromFile.url, fromFile.token], ['https://file.example/exec', 'ze-souboru']);
    const mixed = loadConfig({ env: { UAT_GDOC_URL: 'https://env.example/exec' }, key: 'indcom', home });
    assert.deepEqual([mixed.url, mixed.token], ['https://env.example/exec', 'ze-souboru']);
    assert.equal(isConfigured(loadConfig({ env: {}, key: 'jiny', home })), false);
    assert.equal(isConfigured(loadConfig({ env: {}, key: null, home })), false);
});

test('konfigurace projektu: projectKey, náhrada z project, nevyplněná šablona, výchozí automatedColumn', () => {
    const dir = mkdtempSync(join(tmpdir(), 'esoul-gdoc-cfg-'));
    mkdirSync(join(dir, 'docs', 'testing', 'uat'), { recursive: true });
    const write = (json) => writeFileSync(join(dir, 'docs', 'testing', 'uat', 'uat.config.json'), JSON.stringify(json));
    assert.equal(loadProjectConfig(dir).exists, false);
    write({ projectKey: 'vono', automatedColumn: true });
    assert.deepEqual([loadProjectConfig(dir).key, loadProjectConfig(dir).automatedColumn], ['vono', true]);
    write({ project: 'Moje Aplikace 2' });
    assert.deepEqual([loadProjectConfig(dir).key, loadProjectConfig(dir).automatedColumn], ['moje-aplikace-2', false]);
    write({ project: '{{REPOSITORY}}', projectKey: '{{REPOSITORY}}' });
    assert.equal(loadProjectConfig(dir).key, null);
});

test('šablona uat.config.json obsahuje projectKey a automatedColumn: false', () => {
    const template = JSON.parse(readFileSync(join(here, '..', 'assets', 'templates', 'uat.config.json'), 'utf8'));
    assert.ok('projectKey' in template);
    assert.equal(template.automatedColumn, false);
});

/* -------------------------------------------------------- HTTP (mock fetch) */

test('call: POST s tokenem, přesměrování 302 se sleduje jako GET bez těla', async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
        seen.push({ url, method: init.method, body: init.body });
        if (seen.length === 1) return new Response(null, { status: 302, headers: { location: 'https://script.googleusercontent.com/echo?x=1' } });
        return new Response(JSON.stringify({ ok: true, title: 'Doc' }), { status: 200 });
    };
    const data = await call({ url: ENV.UAT_GDOC_URL, token: 'tok' }, { action: 'ping' }, { fetchImpl });
    assert.equal(data.title, 'Doc');
    assert.equal(seen[0].method, 'POST');
    assert.deepEqual(JSON.parse(seen[0].body), { token: 'tok', action: 'ping' });
    assert.equal(seen[1].method, 'GET');
    assert.equal(seen[1].body, undefined);
    assert.equal(seen[1].url, 'https://script.googleusercontent.com/echo?x=1');
});

test('call: chyby (HTML místo JSON, ok:false, síť) nikdy neobsahují token ani URL', async () => {
    const config = { url: 'https://script.example/secret-deployment/exec', token: 'sekret-token' };
    const html = async () => new Response('<html><title>Chyba</title><body>Skript selhal &amp; skončil</body></html>', { status: 500 });
    await assert.rejects(call(config, { action: 'ping' }, { fetchImpl: html }), (error) => /HTTP 500/.test(error.message) && /Skript selhal & skončil/.test(error.message) && !/sekret|secret-deployment/.test(error.message));
    const refused = async () => new Response(JSON.stringify({ ok: false, error: 'Neplatný token.' }), { status: 200 });
    await assert.rejects(call(config, { action: 'ping' }, { fetchImpl: refused }), /Chyba z Apps Scriptu: Neplatný token\./);
    const network = async () => {
        throw new Error('getaddrinfo ENOTFOUND');
    };
    await assert.rejects(call(config, { action: 'ping' }, { fetchImpl: network }), (error) => /neodpověděl/.test(error.message) && !/sekret/.test(error.message));
    const echo = async (url) => {
        throw new TypeError(`Failed to parse URL from ${url} with sekret-token`);
    };
    await assert.rejects(call(config, { action: 'ping' }, { fetchImpl: echo }), (error) => /neodpověděl/.test(error.message) && !/sekret|secret-deployment/.test(error.message));
    const invalid = { url: 'script.example/secret-deployment/exec', token: 'sekret-token' };
    await assert.rejects(call(invalid, { action: 'ping' }, { fetchImpl: network }), (error) => /není platná URL/.test(error.message) && !/secret-deployment/.test(error.message));
});

/* --------------------------------------------------------------- příkazy */

test('result: tělo požadavku kompatibilní se SCHOK sync.mjs (replace, append, --result=--- OK ---)', async () => {
    const repo = makeRepo();
    const replace = await exec(['result', '--id', 'B2B-01', '--step', '2', '--result', '✅ OK', '--fix', 'oprava'], { repo });
    assert.equal(replace.code, 0);
    assert.deepEqual(replace.bodies[0], { token: ENV.UAT_GDOC_TOKEN, action: 'result', id: 'B2B-01', step: 2, mode: 'replace', result: '✅ OK', fix: 'oprava' });
    const append = await exec(['result', '--id', 'B2B-01', '--step', '1', '--result=--- OK ---', '--append'], { repo });
    assert.deepEqual(append.bodies[0], { token: ENV.UAT_GDOC_TOKEN, action: 'result', id: 'B2B-01', step: 1, mode: 'append', result: '--- OK ---' });
    assert.equal((await exec(['result', '--id', 'B2B-01', '--step', '1'], { repo })).code, 2);
    assert.equal((await exec(['result', '--step', '1', '--result', 'x'], { repo })).code, 2);
    assert.equal(parseArgs(['result', '--result=--- OK ---']).flags.result, '--- OK ---');
});

test('result: s vypnutým sloupcem se automatedColumn do požadavku nepřidá, se zapnutým ano', async () => {
    const off = await exec(['result', '--id', 'B2B-01', '--step', '1', '--result', 'x'], { repo: makeRepo() });
    assert.equal('automatedColumn' in off.bodies[0], false);
    const on = await exec(['result', '--id', 'B2B-01', '--step', '1', '--result', 'x'], { repo: makeRepo({ automatedColumn: true }) });
    assert.equal(on.bodies[0].automatedColumn, true);
});

test('chybějící konfigurace: srozumitelná chyba bez tajemství; result --if-configured mlčky přeskočí', async () => {
    const repo = makeRepo({ projectKey: 'demo' });
    const home = mkdtempSync(join(tmpdir(), 'esoul-gdoc-home-'));
    const missing = await exec(['ping'], { repo, env: {}, home });
    assert.equal(missing.code, 2);
    assert.match(missing.err.join('\n'), /demo-uat-gdoc\.env/);
    assert.equal(missing.bodies.length, 0);

    const skipped = await exec(['result', '--id', 'B2B-01', '--step', '1', '--result', 'x', '--if-configured'], { repo, env: {}, home });
    assert.equal(skipped.code, 0);
    assert.deepEqual([skipped.out, skipped.err, skipped.bodies], [[], [], []]);

    const strict = await exec(['result', '--id', 'B2B-01', '--step', '1', '--result', 'x'], { repo, env: {}, home });
    assert.equal(strict.code, 2);

    assert.equal((await exec(['configured'], { repo, env: {}, home })).code, 1);
    assert.equal((await exec(['configured'], { repo })).code, 0);
    // --if-configured s nastavenou konfigurací normálně zapisuje
    assert.equal((await exec(['result', '--id', 'B2B-01', '--step', '1', '--result', 'x', '--if-configured'], { repo })).bodies.length, 1);
});

test('chybějící konfigurace bez klíče projektu: chyba radí doplnit projectKey', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'esoul-gdoc-empty-'));
    const result = await exec(['ping'], { repo: dir, env: {} });
    assert.equal(result.code, 2);
    assert.match(result.err.join('\n'), /projectKey/);
});

test('sync: kapitola po kapitole, init bez --confirm odmítnut, --dry-run nevolá', async () => {
    const repo = makeRepo();
    const sync = await exec(['sync', '--chapter', 'B2B'], { repo, reply: { ok: true, added: 1, updated: 0, removedRows: 0, keptCancelledRows: 0, flagged: 0, addedRows: 2 } });
    assert.equal(sync.code, 0);
    assert.equal(sync.bodies[0].action, 'sync');
    assert.equal(sync.bodies[0].chapter.id, 'B2B');
    assert.deepEqual(sync.bodies[0].order, ['B2B']);
    assert.equal(sync.bodies[0].force, false);

    const init = await exec(['init'], { repo });
    assert.equal(init.code, 2);
    assert.equal(init.bodies.length, 0);

    const dry = await exec(['init', '--dry-run'], { repo, env: {} });
    assert.equal(dry.code, 0);
    assert.equal(dry.bodies.length, 0);

    const full = await exec(['init', '--confirm'], { repo, reply: { ok: true, tabsDeleted: 0 } });
    assert.deepEqual(full.bodies.map((b) => b.action), ['init', 'init']);
    assert.equal(full.bodies[0].confirm, 'PREPSAT');
    assert.equal(full.bodies[1].chapters[0].id, 'B2B');
});

test('sync: chyba kapitoly zastaví běh s pokračováním, --keep-going pokračuje a vrátí 1', async () => {
    const repo = makeRepo();
    const fail = { ok: false, error: 'rozbité' };
    const stopped = await exec(['sync'], { repo, reply: fail });
    assert.equal(stopped.code, 1);
    assert.match(stopped.err.join('\n'), /Pokračování: gdoc\.mjs sync --from B2B/);
    const kept = await exec(['sync', '--keep-going'], { repo, reply: fail });
    assert.equal(kept.code, 1);
    assert.match(kept.err.join('\n'), /Selhaly kapitoly: B2B/);
});

test('neznámý příkaz a chybný argument končí kódem 2', async () => {
    assert.equal((await exec(['nic'], { repo: makeRepo() })).code, 2);
    assert.equal((await exec(['ping', 'navic'], { repo: makeRepo() })).code, 2);
});

/* ------------------------------------------------ Code.gs (čistá logika přes vm) */

const sandbox = vm.createContext({});
vm.runInContext(readFileSync(join(here, '..', 'assets', 'gdoc', 'Code.gs'), 'utf8'), sandbox, { filename: 'Code.gs' });
const gs = (name, ...args) => plain(sandbox[name](...args));

test('Code.gs: ID s číslicí (B2B) se parsuje v nadpisech, záhlavích i ID kapitoly', () => {
    assert.equal(sandbox.parseChapterHeading('B2B · Firemní zákazníci'), 'B2B');
    assert.equal(sandbox.parseScenarioHeader('B2B-01 · Cena'), 'B2B-01');
    assert.equal(sandbox.chapterIdOfScenario('B2B-01'), 'B2B');
    assert.equal(sandbox.chapterIdOfScenario('b2b-01'), null);
    assert.equal(sandbox.chapterIdOfScenario('ABCDE-01'), null);
});

test('Code.gs: sloupec Automatický test je ve výchozím stavu vypnutý, configureColumns ho zapne a vypne', () => {
    assert.equal(sandbox.COLUMN_COUNT, 5);
    assert.equal(sandbox.COLUMN_LABELS.includes('Automatický test'), false);
    sandbox.configureColumns(true);
    assert.equal(sandbox.COLUMN_COUNT, 6);
    assert.equal(plain(sandbox.COLUMN_LABELS)[5], 'Automatický test');
    assert.equal(plain(sandbox.COLUMN_WIDTHS).reduce((a, b) => a + b, 0), 757, 'šířka odpovídá A4 na šířku');
    sandbox.configureColumns(false);
    assert.equal(sandbox.COLUMN_COUNT, 5);
    sandbox.configureColumns('true');
    assert.equal(sandbox.COLUMN_COUNT, 5, 'jen přesně true');
});

test('Code.gs: sync nepřepisuje sloupce testerů ani Automatický test (plán kroků je nikdy nenese ani nemění)', () => {
    const step = (action, expected = 'ok') => ({ action, expected });
    const old = [
        { action: 'A', expected: 'ok', result: 'OK od testera', fix: 'oprava' },
        { action: 'B', expected: 'ok', result: '', fix: '' },
    ];
    const ops = gs('planRows', old, [step('A'), step('B', 'jiný výsledek')]);
    assert.equal(ops[0].flag, false);
    assert.equal(ops[0].actionChanged, false);
    assert.equal(ops[1].expectedChanged, true);
    assert.equal(ops[1].flag, false, 'bez dat testera se krok neoznačuje');
    const changed = gs('planRows', old, [step('A', 'změněno'), step('B')]);
    assert.equal(changed[0].flag, true, 'změna kroku s daty testera: jen poznámka ⚠, text testera zůstává');
    // Zdroj Code.gs: zápis do buněk 3, 4 a 5 jen mimo syncSteps_ (result a e2e); syncSteps_ sahá na 0, 1, 2 a poznámku do 3.
    const source = readFileSync(join(here, '..', 'assets', 'gdoc', 'Code.gs'), 'utf8');
    const syncSteps = source.slice(source.indexOf('function syncSteps_'), source.indexOf('/** Připojí poznámku'));
    assert.doesNotMatch(syncSteps, /getCell\((4|5|AUTO_COLUMN_INDEX)\)\s*,/);
    assert.doesNotMatch(syncSteps, /writeCell_\(row\.getCell\((3|4|5)\)/);
});

test('Code.gs: krok bez protějšku se nikdy nemaže (zůstane jako zrušený krok)', () => {
    const ops = gs('planRows', [{ action: 'A', expected: 'x', result: '', fix: '' }, { action: 'B', expected: 'x', result: '', fix: '' }], [{ action: 'A', expected: 'x' }]);
    assert.deepEqual(ops.map((op) => op.op), ['row', 'orphan']);
    assert.equal(ops[1].mark, true);
});

test('Code.gs: finalizace slučuje záhlaví přes skutečný počet sloupců tabulky (5 i 6)', () => {
    const cell = (extra = {}) => ({ tableCellStyle: {}, content: [{ startIndex: 1, endIndex: 2, paragraph: {} }], ...extra });
    for (const n of [5, 6]) {
        const rows = [{ tableCells: Array.from({ length: n }, () => cell()) }, { tableCells: Array.from({ length: n }, () => cell()) }, { tableCells: Array.from({ length: n }, () => cell()) }];
        const plan = gs('planFinalize', [{ id: 'B2B-01', columnHeaderIndex: 1 }], [{ startIndex: 10, table: { tableRows: rows } }], 't.1');
        assert.equal(plan.merges[0].mergeTableCells.tableRange.columnSpan, n);
        assert.equal(plan.bullets.length, 2, 'odrážka s odsazením u řádku kroku');
    }
});

test('Code.gs: e2e výsledky se seskupí podle kapitoly, neplatné ID se vrátí zvlášť', () => {
    const grouped = gs('groupE2eResults', [
        { id: 'B2B-01', text: 'a' },
        { id: 'B2B-02', text: 'b' },
        { id: 'AUT-01', text: 'c' },
        { id: 'špatné', text: 'd' },
        { id: 'AUT-02' },
    ]);
    assert.deepEqual(Object.keys(grouped.byChapter).sort(), ['AUT', 'B2B']);
    assert.equal(grouped.byChapter.B2B.length, 2);
    assert.deepEqual(grouped.invalid, ['špatné', 'AUT-02']);
});

test('Code.gs: návod v Úvodu zmiňuje sloupec Automatický test jen když je zapnutý', () => {
    const base = sandbox.introGuideItems().length;
    sandbox.configureColumns(true);
    const withAuto = sandbox.introGuideItems().length;
    sandbox.configureColumns(false);
    assert.equal(withAuto, base + 1);
});

test('Code.gs: konstantní porovnání tokenu', () => {
    assert.equal(sandbox.safeEqual('abc', 'abc'), true);
    assert.equal(sandbox.safeEqual('abc', 'abd'), false);
    assert.equal(sandbox.safeEqual('abc', undefined), false);
});

test('appsscript.json: Web App pod vlastníkem, přístup Kdokoli, služba Docs', () => {
    const manifest = JSON.parse(readFileSync(join(here, '..', 'assets', 'gdoc', 'appsscript.json'), 'utf8'));
    assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
    assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
    assert.equal(manifest.dependencies.enabledAdvancedServices[0].userSymbol, 'Docs');
});
