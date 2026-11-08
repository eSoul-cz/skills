#!/usr/bin/env node
/**
 * eSoul UAT: Google Doc bridge. No dependencies, Node >= 22. Run it from the root of the project repository.
 *
 *   gdoc.mjs ping
 *   gdoc.mjs init  --confirm [--from ID] [--chapter ID[,ID]] [--including-tester-data]
 *                    (deletes the Doc content and builds the Úvod tab and one tab per chapter; once!)
 *   gdoc.mjs intro --confirm                 (rebuilds only the Úvod tab)
 *   gdoc.mjs sync  [--chapter ID[,ID]] [--from ID] [--force] [--keep-going]
 *   gdoc.mjs read  [--chapter ID] [--out file.json]
 *   gdoc.mjs result --id ABC-01 --step N --result "…" [--fix "…"] [--append] [--if-configured]
 *   gdoc.mjs e2e   --report test-results/e2e.json      (Playwright JSON reporter → column "Automatický test")
 *   gdoc.mjs configured                      (exit 0 when the bridge is configured, 1 otherwise; silent)
 *
 * Common options: --repo DIR (default: cwd), --scenarios DIR (default: <repo>/docs/testing/uat/scenarios),
 * --dry-run (prints sizes or the planned writes, calls nothing).
 *
 * Configuration: env UAT_GDOC_URL and UAT_GDOC_TOKEN, otherwise ~/.config/esoul/<projectKey>-uat-gdoc.env
 * (lines KEY=VALUE), where <projectKey> comes from docs/testing/uat/uat.config.json. The token is never printed.
 * The optional sixth column "Automatický test" is switched on by "automatedColumn": true in uat.config.json.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ID_PREFIX, loadCatalogue, validate } from './uat.mjs';

const COMMANDS = ['ping', 'init', 'intro', 'sync', 'read', 'result', 'e2e', 'configured'];
const USAGE =
    'Použití: gdoc.mjs ping | init --confirm [--from ID] [--chapter ID[,ID]] | intro --confirm | sync [--chapter ID[,ID]] [--from ID] [--force] [--keep-going] | read [--chapter ID] [--out f.json] | result --id ID --step N --result "…" [--fix "…"] [--append] [--if-configured] | e2e --report test-results/e2e.json | configured';

const TYPE_LABELS = {
    happy: 'Hlavní tok',
    validace: 'Validace',
    opravneni: 'Oprávnění',
    negativni: 'Negativní',
    okrajovy: 'Okrajový případ',
    vykon: 'Výkon',
    design: 'Design',
    priprava: 'Příprava',
};
const TYPE_COLORS = {
    happy: '2E7D32',
    validace: '1565C0',
    opravneni: '6A1B9A',
    negativni: 'C62828',
    okrajovy: 'B26A00',
    vykon: '00695C',
    design: '8E24AA',
    priprava: '555555',
};
const BASIS_LABELS = { kod: 'dle kódu', zadani: 'dle zadání' };

/** Test title prefix "[ABC-03] …"; the prefix is 2–4 capital letters or digits (B2B). */
export const E2E_ID = new RegExp(`^\\[(${ID_PREFIX}-\\d+)\\]`);

/* ----------------------------------------------------------------- args */

/** Options `--key value`, `--key=value` (the value may start with `--`) and `--key` (true). */
export function parseArgs(argv) {
    const [command, ...rest] = argv;
    const flags = {};
    for (let i = 0; i < rest.length; i++) {
        if (!rest[i].startsWith('--')) {
            throw new Error(`Neočekávaný argument: ${rest[i]}`);
        }
        const equals = rest[i].indexOf('=');
        if (equals > 2) {
            flags[rest[i].slice(2, equals)] = rest[i].slice(equals + 1);
            continue;
        }
        const key = rest[i].slice(2);
        const next = rest[i + 1];
        if (next === undefined || next.startsWith('--')) {
            flags[key] = true;
        } else {
            flags[key] = next;
            i += 1;
        }
    }
    return { command, flags };
}

/* --------------------------------------------------------------- config */

/** Project settings from docs/testing/uat/uat.config.json (missing file = defaults). */
export function loadProjectConfig(repo) {
    const file = join(repo, 'docs', 'testing', 'uat', 'uat.config.json');
    if (!existsSync(file)) return { file, exists: false, key: null, automatedColumn: false, project: null, title: null, client: null };
    let json;
    try {
        json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
        throw new Error(`${file} není platný JSON: ${error.message}`);
    }
    const usable = (value) => (typeof value === 'string' && value.trim() && !value.includes('{{') ? value.trim() : null);
    const key = usable(json.projectKey) ?? slug(usable(json.project));
    return {
        file,
        exists: true,
        key,
        automatedColumn: json.automatedColumn === true,
        project: usable(json.project),
        title: usable(json.title),
        client: usable(json.client),
    };
}

const slug = (value) => (value ? value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || null : null);

export const envFilePath = (key, home = homedir()) => (key ? join(home, '.config', 'esoul', `${key}-uat-gdoc.env`) : null);

/** { url, token, file }: environment first, then the project's env file. `url`/`token` are undefined when missing. */
export function loadConfig({ env = process.env, key = null, home = homedir() } = {}) {
    const file = envFilePath(key, home);
    const config = { url: env.UAT_GDOC_URL || undefined, token: env.UAT_GDOC_TOKEN || undefined, file };
    if ((!config.url || !config.token) && file && existsSync(file)) {
        for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
            if (line.trim().startsWith('#')) continue;
            const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
            if (!match) continue;
            const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
            if (match[1] === 'UAT_GDOC_URL' && !config.url) config.url = value;
            if (match[1] === 'UAT_GDOC_TOKEN' && !config.token) config.token = value;
        }
    }
    return config;
}

export const isConfigured = (config) => Boolean(config.url && config.token);

/* ------------------------------------------------------------ transport */

const REQUEST_TIMEOUT_MS = 420_000; // Apps Script runs up to 6 minutes per call
const MAX_REDIRECTS = 5;

/**
 * POST JSON to the Apps Script Web App. It answers with a 302 to script.googleusercontent.com, and the second
 * request must be a GET without a body, so redirects are followed by hand. Errors never contain the URL or the token.
 */
export async function call(config, body, { fetchImpl = globalThis.fetch } = {}) {
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    let response;
    try {
        response = await fetchImpl(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain: the body is JSON, no CORS preflight
            body: JSON.stringify({ token: config.token, ...body }),
            redirect: 'manual',
            signal,
        });
        let location = config.url;
        for (let hop = 0; hop < MAX_REDIRECTS && response.status >= 300 && response.status < 400 && response.headers.get('location'); hop++) {
            location = new URL(response.headers.get('location'), location).toString();
            response = await fetchImpl(location, { method: 'GET', redirect: 'manual', signal });
        }
    } catch (error) {
        throw new Error(`Web App neodpověděl (${error.name === 'TimeoutError' ? `limit ${REQUEST_TIMEOUT_MS / 1000} s` : error.message}).`);
    }
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        const title = /<title>([^<]*)<\/title>/i.exec(text)?.[1];
        // Apps Script returns a runtime error as an HTML page; the message is in the body, not in <title>.
        const bodyText = text
            .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
        const hint = [title, bodyText.slice(0, 400)].filter(Boolean).join(' – ');
        throw new Error(
            `Web App nevrátil JSON (HTTP ${response.status}, „${hint}“). Zkontroluj URL nasazení, přístup „Kdokoli“ a že je nasazená aktuální verze skriptu.`,
        );
    }
    if (!data.ok) {
        throw new Error(`Chyba z Apps Scriptu: ${data.error ?? 'neznámá'}`);
    }
    return data;
}

/* -------------------------------------------------------------- payload */

export function exportScenario(scenario) {
    return {
        id: scenario.id,
        title: scenario.title,
        roleLabel: scenario.role,
        typeLabel: TYPE_LABELS[scenario.type] ?? scenario.type,
        typeColor: TYPE_COLORS[scenario.type] ?? null,
        basisLabel: BASIS_LABELS[scenario.basis] ?? scenario.basis,
        ui: scenario.ui !== false,
        precondition: scenario.precondition || '',
        deviation: scenario.deviation || '',
        cancelled: scenario.cancelled || '',
        steps: scenario.steps.map((step) => ({
            action: step.action,
            expected: step.expected,
            ...(step.expectedByCode ? { expectedByCode: step.expectedByCode } : {}),
        })),
    };
}

export function exportChapter(chapter) {
    return {
        id: chapter.meta.id,
        part: chapter.meta.part,
        title: chapter.meta.title,
        intro: chapter.intro ?? [],
        status: [],
        preconditions: chapter.preconditions ?? [],
        scenarios: chapter.scenarios.map(exportScenario),
    };
}

function git(args, cwd, fallback) {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || fallback;
    } catch {
        return fallback;
    }
}

/** Payload for the Web App: { meta, order, chapters } from the parsed Markdown catalogue (see loadCatalogue). */
export function buildPayload(catalogue, { project = {}, repo = process.cwd(), now = new Date() } = {}) {
    const chapters = catalogue.map(exportChapter);
    return {
        meta: {
            title: project.title ?? 'Testovací scénáře',
            subtitle: project.project ?? '',
            kicker: '',
            author: 'eSoul',
            client: project.client ?? '',
            version: '',
            state: '',
            date: now.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }),
            commit: git(['rev-parse', '--short', 'HEAD'], repo, 'neurčeno'),
            branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], repo, 'neurčeno'),
            scenarios: chapters.reduce((sum, chapter) => sum + chapter.scenarios.filter((s) => !s.cancelled).length, 0),
        },
        order: chapters.map((chapter) => chapter.id),
        chapters,
    };
}

/** Chapters picked by --chapter (comma separated) and --from (this chapter onwards, in source order). */
export function selectChapters(payload, flags) {
    const order = payload.order;
    let ids = order;
    if (typeof flags.chapter === 'string') {
        const wanted = flags.chapter.split(',').map((id) => id.trim()).filter(Boolean);
        const unknown = wanted.filter((id) => !order.includes(id));
        if (unknown.length) {
            throw new Error(`Neznámá kapitola ${unknown.join(', ')}. Dostupné: ${order.join(', ')}`);
        }
        ids = ids.filter((id) => wanted.includes(id));
    }
    if (typeof flags.from === 'string') {
        if (!order.includes(flags.from)) {
            throw new Error(`Neznámá kapitola ${flags.from} v --from. Dostupné: ${order.join(', ')}`);
        }
        ids = ids.filter((id) => order.indexOf(id) >= order.indexOf(flags.from));
    }
    return payload.chapters.filter((chapter) => ids.includes(chapter.id));
}

/* ------------------------------------------------------------------ e2e */

const stripAnsi = (text) => String(text ?? '').replace(/\u001b\[[0-9;]*m/g, '');

function collectSpecs(suite, out = []) {
    for (const spec of suite.specs ?? []) out.push(spec);
    for (const child of suite.suites ?? []) collectSpecs(child, out);
    return out;
}

/** pass | fail | skip of one Playwright test (all retries): unexpected = fail, flaky = pass. */
function testOutcome(test) {
    const last = (test.results ?? []).at(-1);
    if (test.status === 'unexpected') return 'fail';
    if (test.status === 'flaky') return 'pass';
    if (test.status === 'skipped') return 'skip';
    if (test.status === 'expected') return last?.status === 'skipped' ? 'skip' : 'pass';
    if (last?.status === 'passed') return 'pass';
    if (last?.status === 'failed' || last?.status === 'timedOut') return 'fail';
    return 'skip';
}

function failureReason(test) {
    const failed = [...(test.results ?? [])].reverse().find((r) => r.status === 'failed' || r.status === 'timedOut');
    const message = failed?.error?.message ?? failed?.errors?.[0]?.message ?? '';
    const line = stripAnsi(message).split('\n').map((l) => l.trim()).find(Boolean);
    const reason = line || (failed?.status === 'timedOut' ? 'vypršel časový limit' : 'test selhal');
    return reason.length > 140 ? `${reason.slice(0, 139)}…` : reason;
}

/**
 * Playwright JSON report (nested suites → specs → tests) to { ID: { status, tests, failed, reason } }.
 * The ID is taken from the start of the spec title ("[ABC-03] …"); tests without an ID are ignored.
 * One ID with several tests: all pass = pass, any fail or timeout = fail, otherwise skip.
 */
export function aggregateE2e(report) {
    const out = {};
    for (const suite of report.suites ?? []) {
        for (const spec of collectSpecs(suite)) {
            const id = E2E_ID.exec(String(spec.title ?? '').trim())?.[1];
            if (!id) continue;
            const entry = (out[id] ??= { outcomes: [], reason: null });
            for (const test of spec.tests ?? []) {
                const outcome = testOutcome(test);
                entry.outcomes.push(outcome);
                if (outcome === 'fail' && !entry.reason) entry.reason = failureReason(test);
            }
        }
    }
    const result = {};
    for (const [id, { outcomes, reason }] of Object.entries(out)) {
        if (outcomes.length === 0) continue;
        const failed = outcomes.filter((o) => o === 'fail').length;
        const status = failed ? 'fail' : outcomes.every((o) => o === 'pass') ? 'pass' : 'skip';
        result[id] = { status, tests: outcomes.length, failed, reason: failed ? reason : null };
    }
    return result;
}

const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Text of the cell "Automatický test": status, date and a short reason on failure. */
export function formatE2eCell(entry, date) {
    const day = isoDate(date);
    if (entry.status === 'pass') return `✅ Prošlo · ${day}`;
    if (entry.status === 'skip') return `⏭ Přeskočeno · ${day}`;
    const more = entry.failed > 1 ? ` (+${entry.failed - 1} další)` : '';
    return `❌ Selhalo · ${day} · ${entry.reason}${more}`;
}

/** Date of the run: stats.startTime of the report, otherwise now. */
export function reportDate(report, now = new Date()) {
    const started = new Date(report.stats?.startTime ?? NaN);
    return Number.isNaN(started.getTime()) ? now : started;
}

/* ----------------------------------------------------------------- main */

const kb = (value) => `${(Buffer.byteLength(JSON.stringify(value)) / 1024).toFixed(1)} kB`;

function formatReport(report) {
    const { added, updated, removedRows, keptCancelledRows, flagged, addedRows } = report;
    return `přidáno scénářů ${added}, nových kroků ${addedRows ?? 0}, upraveno ${updated}, smazáno řádků ${removedRows}, ponecháno zrušených ${keptCancelledRows}, označeno ke ztestování ${flagged}`;
}

const formatTimings = (ms) =>
    ms ? `DocumentApp ${((ms.documentApp ?? 0) / 1000).toFixed(1)} s, finalizace ${((ms.finalize ?? 0) / 1000).toFixed(1)} s` : '';

function addReport(total, report) {
    for (const key of ['added', 'addedRows', 'updated', 'removedRows', 'keptCancelledRows', 'flagged']) {
        total[key] = (total[key] ?? 0) + (report[key] ?? 0);
    }
}

/**
 * Runs one command and returns the exit code (no process.exit, so tests can drive it).
 * `io`: { env, home, cwd, fetchImpl, now, out(line), err(line) }.
 */
export async function run(argv, io = {}) {
    const env = io.env ?? process.env;
    const out = io.out ?? ((line) => console.log(line));
    const err = io.err ?? ((line) => console.error(line));
    const call_ = (config, body) => call(config, body, { fetchImpl: io.fetchImpl });
    let parsed;
    try {
        parsed = parseArgs(argv);
    } catch (error) {
        err(`✗ ${error.message}`);
        return 2;
    }
    const { command, flags } = parsed;
    if (!COMMANDS.includes(command)) {
        err(USAGE);
        return 2;
    }
    const dryRun = flags['dry-run'] === true;
    const repo = resolve(io.cwd ?? process.cwd(), typeof flags.repo === 'string' ? flags.repo : '.');
    let project;
    try {
        project = loadProjectConfig(repo);
    } catch (error) {
        err(`✗ ${error.message}`);
        return 1;
    }
    const config = loadConfig({ env, key: project.key, home: io.home });
    const configured = isConfigured(config);

    if (command === 'configured') return configured ? 0 : 1;
    if (command === 'result' && flags['if-configured'] === true && !configured) return 0; // project without a bridge: skip silently
    if (!dryRun && !configured) {
        err(
            `Chybí UAT_GDOC_URL nebo UAT_GDOC_TOKEN (proměnné prostředí${config.file ? ` nebo ${config.file}` : `; klíč projektu chybí v ${project.file}, doplň „projectKey“`}).`,
        );
        return 2;
    }

    try {
        const auto = project.automatedColumn ? { automatedColumn: true } : {};
        const scenariosDir = resolve(repo, typeof flags.scenarios === 'string' ? flags.scenarios : join('docs', 'testing', 'uat', 'scenarios'));
        const catalogue = () => {
            if (!existsSync(scenariosDir)) throw new Error(`Adresář scénářů ${scenariosDir} neexistuje (spouštěj z kořene projektu nebo zadej --repo).`);
            const chapters = loadCatalogue(scenariosDir);
            const { errors } = validate(chapters);
            if (errors.length) throw new Error(`Katalog má ${errors.length} chyb, spusť uat.mjs validate.`);
            return chapters;
        };

        if (command === 'ping') {
            out(JSON.stringify(await call_(config, { action: 'ping', ...auto })));
            return 0;
        }

        if (command === 'init' || command === 'sync') {
            if (command === 'init' && !flags.confirm && !dryRun) {
                err('init SMAŽE obsah dokumentu včetně zápisů testerů. Přidej --confirm, pokud to opravdu chceš.');
                return 2;
            }
            const includingTesterData = flags['including-tester-data'] === true;
            if (includingTesterData && !flags.confirm) {
                err('--including-tester-data se používá jen spolu s --confirm.');
                return 2;
            }
            const payload = buildPayload(catalogue(), { project, repo, now: io.now });
            const chapters = selectChapters(payload, flags);
            const total = {};
            const warnings = [];
            const failed = [];
            const force = flags.force === true;
            const confirm = includingTesterData ? 'PREPSAT_VCETNE_ZAPISU' : 'PREPSAT';
            const keepGoing = flags['keep-going'] === true;
            const partial = typeof flags.chapter === 'string' || typeof flags.from === 'string';

            if (command === 'init' && !partial) {
                const body = { action: 'init', confirm, meta: payload.meta, order: payload.order, ...auto };
                out(`init Úvod (smaže všechny záložky), ${kb(body)}`);
                if (!dryRun) {
                    const started = Date.now();
                    const report = await call_(config, body);
                    out(`  ${((Date.now() - started) / 1000).toFixed(1)} s, smazáno záložek ${report.tabsDeleted ?? 0}, ${formatTimings(report.ms)}`);
                    for (const warning of report.warnings ?? []) {
                        out(`  VAROVÁNÍ [Úvod]: ${warning}`);
                        warnings.push(`Úvod: ${warning}`);
                    }
                }
            }
            for (const chapter of chapters) {
                const body =
                    command === 'init'
                        ? { action: 'init', confirm, order: payload.order, chapters: [chapter], ...auto }
                        : { action: 'sync', order: payload.order, chapter, force, ...auto };
                const label = `${chapter.id} (${chapter.scenarios.length} scénářů)`;
                if (dryRun) {
                    out(`[dry-run] ${command} ${label}, ${kb(body)}`);
                    continue;
                }
                const started = Date.now();
                try {
                    let report;
                    try {
                        report = await call_(config, body);
                    } catch (error) {
                        // A tab just created through the Docs API is not yet visible to DocumentApp in the same run;
                        // a new run finds it by its title, so repeating the call is enough.
                        if (!/Záložka t\.\S+ v dokumentu není/.test(error.message)) throw error;
                        report = await call_(config, body);
                    }
                    addReport(total, report);
                    out(`${command} ${label} … ${((Date.now() - started) / 1000).toFixed(1)} s, ${formatReport(report)} [${formatTimings(report.ms)}]`);
                    for (const warning of report.warnings ?? []) {
                        out(`  VAROVÁNÍ [${chapter.id}]: ${warning}`);
                        warnings.push(`${chapter.id}: ${warning}`);
                    }
                } catch (error) {
                    err(`✗ ${chapter.id}: ${error.message}`);
                    failed.push(chapter.id);
                    if (!keepGoing) {
                        const resume = command === 'init' ? ` --confirm${includingTesterData ? ' --including-tester-data' : ''}` : '';
                        err(`Zastaveno. Pokračování: gdoc.mjs ${command}${resume} --from ${chapter.id}`);
                        if (command === 'init') {
                            err('POZOR: init kapitolu přepíše a smaže její obsah. Pokud kapitola obsahuje zápisy testerů, použij raději sync.');
                        }
                        return 1;
                    }
                }
            }
            if (!dryRun) {
                out(`Hotovo: ${formatReport(total)}`);
                if (warnings.length) {
                    out(`\nVAROVÁNÍ (${warnings.length}): text je zapsaný, ale něco se nepodařilo dokončit. Opakování sync pro dotčené kapitoly to opraví:`);
                    warnings.forEach((warning) => out(`  - ${warning}`));
                }
                if (failed.length) {
                    err(`\nSelhaly kapitoly: ${failed.join(', ')}`);
                    return 1;
                }
            }
            return 0;
        }

        if (command === 'intro') {
            if (!flags.confirm && !dryRun) {
                err('intro přepíše záložku Úvod (hodnoty v tabulce Informace o dokumentu zachová). Přidej --confirm.');
                return 2;
            }
            const payload = buildPayload(catalogue(), { project, repo, now: io.now });
            const body = { action: 'intro', meta: payload.meta, ...auto };
            if (dryRun) {
                out(`[dry-run] intro Úvod, ${kb(body)}`);
                return 0;
            }
            const report = await call_(config, body);
            out(`Úvod přestavěn, vyplněných hodnot v původní tabulce ${report.previousValues ?? 0}, ${formatTimings(report.ms)}`);
            for (const warning of report.warnings ?? []) out(`  VAROVÁNÍ [Úvod]: ${warning}`);
            return 0;
        }

        if (command === 'read') {
            const body = { action: 'read', ...(typeof flags.chapter === 'string' ? { chapter: flags.chapter } : {}), ...auto };
            if (dryRun) {
                out(`[dry-run] read, ${kb(body)}`);
                return 0;
            }
            const data = await call_(config, body);
            const json = JSON.stringify(data, null, 2);
            if (typeof flags.out === 'string') {
                writeFileSync(flags.out, `${json}\n`);
                out(`Zapsáno ${data.scenarios.length} scénářů do ${flags.out}`);
            } else {
                out(json);
            }
            return 0;
        }

        if (command === 'e2e') {
            if (typeof flags.report !== 'string') {
                err('e2e vyžaduje --report <cesta k Playwright JSON reportu>.');
                return 2;
            }
            if (!project.automatedColumn) {
                err(`e2e zapisuje do sloupce „Automatický test“: zapni ho přes "automatedColumn": true v ${project.file} a znovu postav tabulky (viz references/gdoc.md).`);
                return 2;
            }
            const reportFile = resolve(io.cwd ?? process.cwd(), flags.report);
            if (!existsSync(reportFile)) {
                err(`Report ${reportFile} neexistuje.`);
                return 2;
            }
            let report;
            try {
                report = JSON.parse(readFileSync(reportFile, 'utf8'));
            } catch (error) {
                err(`✗ ${reportFile} není platný JSON: ${error.message}`);
                return 2;
            }
            const known = new Set(catalogue().flatMap((chapter) => chapter.scenarios.filter((s) => !s.cancelled).map((s) => s.id)));
            const date = reportDate(report, io.now);
            const aggregated = aggregateE2e(report);
            const results = [];
            for (const [id, entry] of Object.entries(aggregated)) {
                if (!known.has(id)) {
                    err(`! ${id}: scénář není v katalogu, přeskakuji.`);
                    continue;
                }
                results.push({ id, text: formatE2eCell(entry, date), status: entry.status });
            }
            const counts = { pass: 0, fail: 0, skip: 0 };
            results.forEach((r) => (counts[r.status] += 1));
            const summary = `scénářů ${results.length}: prošlo ${counts.pass}, selhalo ${counts.fail}, přeskočeno ${counts.skip}`;
            if (dryRun) {
                results.forEach((r) => out(`[dry-run] ${r.id}: ${r.text}`));
                out(`[dry-run] ${summary}`);
                return 0;
            }
            if (results.length === 0) {
                out('V reportu není žádný test s ID scénáře z katalogu, nic se nezapisuje.');
                return 0;
            }
            const data = await call_(config, { action: 'e2e', automatedColumn: true, results: results.map(({ id, text }) => ({ id, text })) });
            for (const id of data.missing ?? []) err(`! ${id}: scénář nebo sloupec „Automatický test“ v dokumentu není (spusť sync).`);
            out(`Zapsáno ${data.written ?? 0} z ${results.length}, ${summary}.`);
            return 0;
        }

        // result
        if (typeof flags.id !== 'string' || flags.step === undefined || flags.step === true) {
            err('result vyžaduje --id ABC-01 --step N a aspoň jedno z --result, --fix.');
            return 2;
        }
        const body = { action: 'result', id: flags.id, step: Number(flags.step), mode: flags.append === true ? 'append' : 'replace', ...auto };
        if (typeof flags.result === 'string') body.result = flags.result;
        if (typeof flags.fix === 'string') body.fix = flags.fix;
        if (body.result === undefined && body.fix === undefined) {
            err('result vyžaduje aspoň jedno z --result, --fix.');
            return 2;
        }
        if (dryRun) {
            out(`[dry-run] result ${body.id} krok ${body.step}, ${kb(body)}`);
            return 0;
        }
        await call_(config, body);
        out(`Zapsáno: ${body.id} krok ${body.step} (${body.mode}).`);
        return 0;
    } catch (error) {
        err(`✗ ${error.message}`);
        return 1;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    process.exitCode = await run(process.argv.slice(2));
}
