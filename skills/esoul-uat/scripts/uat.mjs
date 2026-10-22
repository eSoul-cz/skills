#!/usr/bin/env node
/**
 * eSoul UAT catalogue and run tool. No dependencies, Node >= 18.
 *
 *   uat.mjs validate <scenarios-dir>
 *   uat.mjs stats    <scenarios-dir | run-dir>
 *   uat.mjs init     <scenarios-dir> <run-dir> --env uat --base-url URL [--commit SHA]
 *                    [--devices desktop,mobile] [--chapters PRE,AUT] [--priority P1,P2] [--force]
 *   uat.mjs next     <run-dir>
 *   uat.mjs record   <run-dir> <SCENARIO-ID> --device D --status S [--step N] [--url U]
 *                    [--note T] [--evidence PATH]... [--bug REF]
 *   uat.mjs report   <run-dir>
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEVICES = ['desktop', 'laptop', 'tablet', 'mobile', 'mobile-s'];
const TYPES = ['happy', 'validace', 'opravneni', 'negativni', 'okrajovy', 'vykon', 'design', 'priprava'];
const BASES = ['kod', 'zadani'];
const PRIORITIES = ['P1', 'P2', 'P3'];
const DATA = ['čte', 'zapisuje', 'maže'];
const STATUSES = ['pass', 'fail', 'deviation', 'blocked', 'skipped', 'not-run'];
const STATUS_LABEL = {
    pass: 'Prošlo',
    fail: 'Neprošlo',
    deviation: 'Odchylka',
    blocked: 'Blokováno',
    skipped: 'Přeskočeno',
    'not-run': 'Neprovedeno',
};
const FIELD_KEYS = {
    role: 'Role',
    type: 'Typ',
    basis: 'Základ',
    devices: 'Zařízení',
    priority: 'Priorita',
    source: 'Zdroj',
    precondition: 'Předpoklad',
    data: 'Data',
    deviation: 'Odchylka',
    ui: 'UI',
    cancelled: 'Zrušeno',
};

function fail(message) {
    console.error(`✗ ${message}`);
    process.exit(1);
}

function parseArgs(argv) {
    const positional = [];
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
            if (options[key] === undefined) options[key] = value;
            else options[key] = [].concat(options[key], value);
        } else {
            positional.push(arg);
        }
    }
    return { positional, options };
}

const list = (value) => (value === undefined || value === true ? [] : [].concat(value).flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean));

function splitRow(line) {
    const cells = [];
    let current = '';
    let inCode = false;
    const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === '`') inCode = !inCode;
        if (ch === '\\' && body[i + 1] === '|') {
            current += '|';
            i++;
            continue;
        }
        if (ch === '|' && !inCode) {
            cells.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    cells.push(current.trim());
    return cells;
}

export function parseChapter(text, file = 'chapter') {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const chapter = { file, meta: {}, scenarios: [], errors: [] };
    // Chapter header: "# Title" followed by "- **Kapitola:** ID" and "- **Část:** A|B" before
    // the first scenario. No YAML front matter: chapters are concatenated into one PDF.
    let i = 0;
    for (; i < lines.length && !/^##\s/.test(lines[i]); i++) {
        const title = lines[i].match(/^#\s+(.+?)\s*$/);
        if (title && !chapter.meta.title) chapter.meta.title = title[1];
        const field = lines[i].match(/^\s*-\s+\*\*(Kapitola|Část):\*\*\s*(.*)$/);
        if (field) chapter.meta[field[1] === 'Kapitola' ? 'id' : 'part'] = field[2].trim().replace(/^`|`$/g, '');
    }
    if (!chapter.meta.id) chapter.errors.push(`${file}: chybí „- **Kapitola:** ID“ pod nadpisem`);
    let current = null;
    let headerSeen = false;
    for (; i < lines.length; i++) {
        const line = lines[i];
        const heading = line.match(/^##\s+([A-Z]{2,4}-\d{2,3})\s+(.+?)\s*$/);
        if (!heading && /^##\s+[A-Za-z]{1,6}-?\d/.test(line)) {
            chapter.errors.push(`${file}:${i + 1}: nadpis „${line.trim()}“ vypadá jako scénář, ale neodpovídá tvaru „## ABC-01 Název“`);
            current = null;
            continue;
        }
        if (heading) {
            current = { id: heading[1], title: heading[2], fields: {}, steps: [], line: i + 1 };
            chapter.scenarios.push(current);
            headerSeen = false;
            continue;
        }
        if (/^##\s/.test(line)) {
            current = null;
            continue;
        }
        if (!current) continue;
        const field = line.match(/^\s*-\s+\*\*([^*:]+):\*\*\s*(.*)$/);
        if (field) {
            current.fields[field[1].trim()] = field[2].trim();
            continue;
        }
        if (/^\s*\|/.test(line)) {
            const cells = splitRow(line);
            if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
            if (!headerSeen && cells[0] === '#') {
                headerSeen = true;
                current.hasByCodeColumn = cells.length >= 4;
                continue;
            }
            current.steps.push({ n: Number(cells[0]), action: cells[1] ?? '', expected: cells[2] ?? '', expectedByCode: cells[3] ?? '' });
        }
    }
    return chapter;
}

function normalise(scenario) {
    const f = scenario.fields;
    return {
        id: scenario.id,
        title: scenario.title,
        role: f[FIELD_KEYS.role] ?? '',
        type: f[FIELD_KEYS.type] ?? '',
        basis: f[FIELD_KEYS.basis] ?? '',
        devices: list(f[FIELD_KEYS.devices] ?? 'desktop'),
        priority: f[FIELD_KEYS.priority] ?? 'P2',
        data: f[FIELD_KEYS.data] ?? '',
        deviation: f[FIELD_KEYS.deviation] ?? '',
        cancelled: f[FIELD_KEYS.cancelled] ?? '',
        steps: scenario.steps,
        line: scenario.line,
    };
}

export function loadCatalogue(dir) {
    if (!existsSync(dir)) fail(`Adresář ${dir} neexistuje.`);
    const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
    return files.map((file) => {
        const chapter = parseChapter(readFileSync(join(dir, file), 'utf8'), file);
        chapter.scenarios = chapter.scenarios.map(normalise);
        return chapter;
    });
}

export function validate(chapters, devices = DEVICES) {
    const errors = [];
    const warnings = [];
    const seenIds = new Set();
    for (const chapter of chapters) {
        const { file, meta } = chapter;
        errors.push(...chapter.errors);
        if (meta.id && !/^[A-Z]{2,4}$/.test(meta.id)) errors.push(`${file}: Kapitola musí být 2–4 velká písmena`);
        if (!meta.title) errors.push(`${file}: chybí nadpis kapitoly „# …“`);
        if (!['A', 'B'].includes(meta.part)) errors.push(`${file}: Část musí být A nebo B`);
        if (chapter.scenarios.length === 0) errors.push(`${file}: kapitola nemá žádný scénář`);
        let expected = 1;
        const types = [];
        for (const s of chapter.scenarios) {
            const where = `${file}:${s.line} ${s.id}`;
            if (seenIds.has(s.id)) errors.push(`${where}: duplicitní ID`);
            seenIds.add(s.id);
            const [prefix, num] = s.id.split('-');
            if (prefix !== meta.id) errors.push(`${where}: prefix neodpovídá kapitole ${meta.id}`);
            if (Number(num) !== expected) errors.push(`${where}: očekáváno číslo ${String(expected).padStart(2, '0')}`);
            expected = Number(num) + 1;
            if (s.cancelled) continue;
            types.push(s.type);
            if (!s.role) errors.push(`${where}: chybí Role`);
            if (!TYPES.includes(s.type)) errors.push(`${where}: Typ „${s.type}“ není z ${TYPES.join(', ')}`);
            if (!BASES.includes(s.basis)) errors.push(`${where}: Základ „${s.basis}“ není kod nebo zadani`);
            if (!PRIORITIES.includes(s.priority)) errors.push(`${where}: Priorita „${s.priority}“ není P1–P3`);
            if (s.data && !DATA.includes(s.data)) errors.push(`${where}: Data „${s.data}“ není z ${DATA.join(', ')}`);
            for (const d of s.devices) if (d !== 'all' && !devices.includes(d)) errors.push(`${where}: neznámé zařízení „${d}“`);
            if (s.steps.length < 2 && s.type !== 'priprava') errors.push(`${where}: méně než 2 kroky`);
            if (s.steps.length > 8) warnings.push(`${where}: více než 8 kroků, zvaž rozdělení`);
            s.steps.forEach((step, index) => {
                if (step.n !== index + 1) errors.push(`${where}: krok ${index + 1} má číslo ${step.n}`);
                if (!step.action) errors.push(`${where}: krok ${index + 1} nemá akci`);
                if (!step.expected) errors.push(`${where}: krok ${index + 1} nemá očekávaný výsledek`);
            });
            const hasByCode = s.steps.some((step) => step.expectedByCode);
            if (hasByCode && !s.deviation) errors.push(`${where}: krok má „Dle kódu dnes“, ale chybí Odchylka`);
            if (s.deviation && !hasByCode) warnings.push(`${where}: Odchylka bez sloupce „Dle kódu dnes“`);
        }
        if (meta.part === 'A' && chapter.scenarios.length > 0 && meta.id !== 'PRE') {
            if (types.filter((t) => t === 'opravneni').length < 2) warnings.push(`${file}: méně než 2 scénáře typu opravneni`);
            if (!types.some((t) => t === 'validace' || t === 'negativni')) warnings.push(`${file}: chybí scénář validace nebo negativni`);
        }
    }
    return { errors, warnings };
}

function catalogueStats(chapters) {
    const all = chapters.flatMap((c) => c.scenarios).filter((s) => !s.cancelled);
    return {
        chapters: chapters.length,
        scenarios: all.length,
        steps: all.reduce((n, s) => n + s.steps.length, 0),
        deviations: all.filter((s) => s.deviation).length,
        byPart: Object.fromEntries(['A', 'B'].map((p) => [p, chapters.filter((c) => c.meta.part === p).reduce((n, c) => n + c.scenarios.filter((s) => !s.cancelled).length, 0)])),
    };
}

function readRun(runDir) {
    const file = join(runDir, 'results.json');
    if (!existsSync(file)) fail(`${file} neexistuje, nejdřív spusť init.`);
    return JSON.parse(readFileSync(file, 'utf8'));
}

function writeRun(runDir, run) {
    const file = join(runDir, 'results.json');
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(run, null, 2)}\n`);
    renameSync(temporary, file);
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Read-modify-write of results.json under a lock file shared by uat.mjs and sweep.mjs, so
 * a sweep running next to functional scenarios never overwrites a newer result.
 */
export function updateRun(runDir, change) {
    const lock = join(runDir, 'results.json.lock');
    const deadline = Date.now() + 30000;
    for (;;) {
        try {
            closeSync(openSync(lock, 'wx'));
            break;
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > 60000) rmSync(lock, { force: true });
            if (Date.now() > deadline) fail(`Zámek ${lock} je obsazený déle než 30 s.`);
            sleep(50);
        }
    }
    try {
        const run = readRun(runDir);
        const result = change(run);
        writeRun(runDir, run);
        return result;
    } finally {
        rmSync(lock, { force: true });
    }
}

function runCounts(items) {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const item of items) counts[item.status]++;
    return counts;
}

function cmdInit(scenariosDir, runDir, options) {
    if (!options.env || !options['base-url']) fail('init vyžaduje --env a --base-url');
    if (existsSync(join(runDir, 'results.json')) && !options.force) fail(`${join(runDir, 'results.json')} už existuje. Pokračuj v běhu, nebo zvol nový adresář; přepsání jen s --force.`);
    const chapters = loadCatalogue(scenariosDir);
    const devices = list(options.devices).length ? list(options.devices) : ['desktop'];
    const { errors } = validate(chapters, [...new Set([...DEVICES, ...devices])]);
    if (errors.length) fail(`Katalog má ${errors.length} chyb, spusť validate.`);
    const chapterFilter = list(options.chapters);
    const priorities = list(options.priority);
    const items = [];
    for (const chapter of chapters) {
        if (chapterFilter.length && !chapterFilter.includes(chapter.meta.id)) continue;
        for (const s of chapter.scenarios) {
            if (s.cancelled) continue;
            if (priorities.length && !priorities.includes(s.priority)) continue;
            const targets = s.devices.includes('all') ? devices : s.devices.filter((d) => devices.includes(d));
            for (const device of targets) {
                const blockedByPart = chapter.meta.part === 'B' && s.basis === 'zadani';
                items.push({
                    scenario: s.id,
                    chapter: chapter.meta.id,
                    title: s.title,
                    role: s.role,
                    device,
                    priority: s.priority,
                    status: blockedByPart ? 'skipped' : 'not-run',
                    note: blockedByPart ? 'Dle zadání, modul není hotový.' : '',
                    step: null,
                    url: null,
                    evidence: [],
                    bug: null,
                    at: null,
                });
            }
        }
    }
    mkdirSync(join(runDir, 'screenshots'), { recursive: true });
    const run = {
        run: {
            id: basename(runDir),
            environment: options.env,
            base_url: options['base-url'],
            commit: options.commit ?? 'neznámý',
            devices,
            chapters: chapterFilter,
            priority: priorities,
            started_at: new Date().toISOString(),
            finished_at: null,
            catalogue: relative(runDir, scenariosDir),
        },
        results: items,
        layout: [],
        design: [],
    };
    writeRun(runDir, run);
    console.log(`✓ ${join(runDir, 'results.json')}: ${items.length} položek (${devices.join(', ')})`);
}

function cmdRecord(runDir, id, options) {
    if (!options.device || !options.status) fail('record vyžaduje --device a --status');
    if (!STATUSES.includes(options.status)) fail(`--status musí být z ${STATUSES.join(', ')}`);
    if (!readRun(runDir).results.some((r) => r.scenario === id && r.device === options.device)) {
        fail(`${id}@${options.device} není v rozsahu běhu.`);
    }
    const item = updateRun(runDir, (run) => {
        const found = run.results.find((r) => r.scenario === id && r.device === options.device);
        found.status = options.status;
        if (options.step !== undefined) found.step = Number(options.step);
        if (options.url) found.url = options.url;
        if (options.note) found.note = String(options.note);
        if (options.evidence) found.evidence = [...new Set([...found.evidence, ...list(options.evidence)])];
        if (options.bug) found.bug = String(options.bug);
        found.at = new Date().toISOString();
        if (run.results.every((r) => r.status !== 'not-run')) run.run.finished_at = found.at;
        return found;
    });
    console.log(`✓ ${id}@${options.device}: ${item.status}`);
}

function cmdNext(runDir) {
    const run = readRun(runDir);
    const next = run.results.find((r) => r.status === 'not-run');
    if (!next) return console.log('Hotovo, nic dalšího k provedení.');
    const left = run.results.filter((r) => r.status === 'not-run').length;
    console.log(`${next.scenario}@${next.device} (role ${next.role}) – ${next.title} · zbývá ${left}`);
}

function cmdStats(path) {
    if (existsSync(join(path, 'results.json'))) {
        const run = readRun(path);
        const byChapter = {};
        for (const r of run.results) (byChapter[r.chapter] ??= []).push(r);
        console.log(`Běh ${run.run.id} · ${run.run.environment} · ${run.run.commit}`);
        console.log(`Celkem ${JSON.stringify(runCounts(run.results))}`);
        for (const [chapter, items] of Object.entries(byChapter)) console.log(`  ${chapter}: ${JSON.stringify(runCounts(items))}`);
        console.log(`Rozložení: ${run.layout.reduce((n, l) => n + l.findings.length, 0)} nálezů · Design: ${run.design.length} položek`);
        return;
    }
    const chapters = loadCatalogue(path);
    console.log(JSON.stringify(catalogueStats(chapters), null, 2));
}

const md = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function cmdReport(runDir) {
    const run = readRun(runDir);
    const r = run.run;
    const counts = runCounts(run.results);
    const out = [];
    out.push(`# Report UAT – ${r.id}`, '');
    out.push('| Položka | Hodnota |', '|---|---|');
    out.push(`| Prostředí | ${r.environment} (${r.base_url}) |`);
    out.push(`| Testovaná verze | ${r.commit} |`);
    out.push(`| Zahájeno | ${r.started_at ?? '—'} |`);
    out.push(`| Dokončeno | ${r.finished_at ?? 'neukončeno'} |`);
    out.push(`| Zařízení | ${r.devices.join(', ')} |`);
    out.push(`| Rozsah | kapitoly ${r.chapters.length ? r.chapters.join(', ') : 'všechny'}; priority ${r.priority.length ? r.priority.join(', ') : 'všechny'} |`);
    out.push('', '## Souhrn', '');
    out.push(`| ${STATUSES.map((s) => STATUS_LABEL[s]).join(' | ')} |`, `|${STATUSES.map(() => '---:').join('|')}|`);
    out.push(`| ${STATUSES.map((s) => counts[s]).join(' | ')} |`);
    out.push('', '## Podle kapitol a zařízení', '');
    out.push(`| Kapitola | Zařízení | ${STATUSES.map((s) => STATUS_LABEL[s]).join(' | ')} |`, `|---|---|${STATUSES.map(() => '---:').join('|')}|`);
    const groups = {};
    for (const item of run.results) (groups[`${item.chapter}\u0000${item.device}`] ??= []).push(item);
    for (const [key, items] of Object.entries(groups)) {
        const [chapter, device] = key.split('\u0000');
        const c = runCounts(items);
        out.push(`| ${chapter} | ${device} | ${STATUSES.map((s) => c[s]).join(' | ')} |`);
    }
    const section = (title, statuses) => {
        const items = run.results.filter((i) => statuses.includes(i.status));
        if (!items.length) return;
        out.push('', `## ${title}`, '');
        out.push('| Scénář | Zařízení | Role | Krok | Skutečnost | URL | Důkaz | Chyba |', '|---|---|---|---:|---|---|---|---|');
        for (const i of items) {
            const evidence = i.evidence.map((e) => `[${basename(e)}](${e})`).join(', ');
            out.push(`| ${i.scenario} ${md(i.title)} | ${i.device} | ${i.role} | ${i.step ?? ''} | ${md(i.note)} | ${i.url ? `<${i.url}>` : ''} | ${evidence} | ${md(i.bug ?? '')} |`);
        }
    };
    section('Neprošlé scénáře', ['fail']);
    section('Odchylky', ['deviation']);
    section('Blokované a přeskočené', ['blocked', 'skipped']);
    const broken = run.layout.filter((l) => l.error || (l.console ?? []).length || (l.network ?? []).length);
    if (broken.length) {
        out.push('', '## Chyby stránek při průchodu', '');
        out.push('| URL | Zařízení | Role | Navigace | Konzole | Síť | Důkaz |', '|---|---|---|---|---|---|---|');
        for (const l of broken) out.push(`| <${l.url}> | ${l.device} | ${l.role ?? ''} | ${md(l.error ?? '')} | ${md((l.console ?? []).join('; '))} | ${md((l.network ?? []).join('; '))} | ${l.screenshot ? `[${basename(l.screenshot)}](${l.screenshot})` : ''} |`);
    }
    const layout = run.layout.filter((l) => l.findings.length);
    if (layout.length) {
        out.push('', '## Nálezy rozložení', '');
        out.push('| URL | Zařízení | Kontrola | Prvek | Detail | Potvrzeno | Důkaz |', '|---|---|---|---|---|---|---|');
        for (const l of layout) for (const f of l.findings) out.push(`| <${l.url}> | ${l.device} | ${f.check} | ${md(f.element)} | ${md(f.detail)} | ${f.confirmed === true ? 'ano' : f.confirmed === false ? 'ne' : 'neověřeno'} | ${l.screenshot ? `[${basename(l.screenshot)}](${l.screenshot})` : ''} |`);
    }
    if (run.design.length) {
        out.push('', '## Porovnání s návrhem', '');
        out.push('| Obrazovka | Zařízení | Rámec | Výsledek | Nálezy | Chyba |', '|---|---|---|---|---|---|');
        for (const d of run.design) out.push(`| ${md(d.screen)} | ${d.device} | ${md(d.frame)} | ${d.status} | ${md((d.findings ?? []).join('; '))} | ${md(d.bug ?? '')} |`);
    }
    const manual = run.results.filter((i) => i.status === 'deviation' || i.status === 'blocked');
    out.push('', '## K ručnímu ověření', '');
    out.push(manual.length ? manual.map((i) => `- ${i.scenario} (${i.device}): ${i.note || 'bez poznámky'}`).join('\n') : 'Nic.');
    out.push('');
    writeFileSync(join(runDir, 'report.md'), out.join('\n'));
    console.log(`✓ ${join(runDir, 'report.md')}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
    const [command, ...rest] = process.argv.slice(2);
    const { positional, options } = parseArgs(rest);
    switch (command) {
        case 'validate': {
            const chapters = loadCatalogue(positional[0] ?? fail('Chybí adresář se scénáři.'));
            const { errors, warnings } = validate(chapters, list(options.devices).length ? list(options.devices) : DEVICES);
            for (const w of warnings) console.warn(`! ${w}`);
            for (const e of errors) console.error(`✗ ${e}`);
            const s = catalogueStats(chapters);
            console.log(`${errors.length ? '✗' : '✓'} kapitol ${s.chapters} · scénářů ${s.scenarios} · kroků ${s.steps} · odchylek ${s.deviations} · chyb ${errors.length} · varování ${warnings.length}`);
            process.exit(errors.length ? 1 : 0);
        }
        case 'stats':
            cmdStats(positional[0] ?? fail('Chybí cesta.'));
            break;
        case 'init':
            cmdInit(positional[0], positional[1] ?? fail('Chybí adresář běhu.'), options);
            break;
        case 'next':
            cmdNext(positional[0] ?? fail('Chybí adresář běhu.'));
            break;
        case 'record':
            cmdRecord(positional[0] ?? fail('Chybí adresář běhu.'), positional[1] ?? fail('Chybí ID scénáře.'), options);
            break;
        case 'report':
            cmdReport(positional[0] ?? fail('Chybí adresář běhu.'));
            break;
        default:
            console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).join('\n'));
            process.exit(command ? 1 : 0);
    }
}
