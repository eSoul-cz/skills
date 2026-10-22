import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadCatalogue, parseChapter, validate } from './uat.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sample = join(here, '..', 'assets', 'templates', 'scenarios');
const cli = (...args) => execFileSync(process.execPath, [join(here, 'uat.mjs'), ...args], { encoding: 'utf8' });

test('sample chapter is valid', () => {
    const chapters = loadCatalogue(sample);
    const { errors, warnings } = validate(chapters);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    const aut = chapters[0];
    assert.equal(aut.meta.id, 'AUT');
    assert.equal(aut.scenarios.length, 4);
    assert.deepEqual(aut.scenarios[0].devices, ['all']);
    assert.deepEqual(aut.scenarios[1].devices, ['desktop']);
    assert.equal(aut.scenarios[3].steps[1].expectedByCode, 'Role se změní na Administrátor.');
});

test('validation reports broken scenarios', () => {
    const chapter = parseChapter(
        [
            '# Zvířata',
            '',
            '- **Kapitola:** ZV',
            '- **Část:** A',
            '',
            '## ZV-02 Špatné číslo',
            '- **Role:** B',
            '- **Typ:** neznamy',
            '- **Základ:** kod',
            '- **Zařízení:** watch',
            '',
            '| # | Akce | Očekávaný výsledek | Dle kódu dnes |',
            '|---|---|---|---|',
            '| 1 | Otevři `a \\| b`. | | jinak |',
        ].join('\n'),
        'zv.md',
    );
    chapter.scenarios = chapter.scenarios.map((s) => ({
        id: s.id,
        title: s.title,
        role: s.fields.Role,
        type: s.fields.Typ,
        basis: s.fields['Základ'],
        devices: [s.fields['Zařízení']],
        priority: 'P2',
        data: '',
        deviation: '',
        cancelled: '',
        steps: s.steps,
        line: s.line,
    }));
    assert.equal(chapter.scenarios[0].steps[0].action, 'Otevři `a | b`.');
    const { errors } = validate([chapter]);
    const text = errors.join('\n');
    assert.match(text, /očekáváno číslo 01/);
    assert.match(text, /Typ „neznamy“/);
    assert.match(text, /neznámé zařízení „watch“/);
    assert.match(text, /méně než 2 kroky/);
    assert.match(text, /nemá očekávaný výsledek/);
    assert.match(text, /chybí Odchylka/);
});

test('init, record, next and report form a resumable run', () => {
    const run = join(mkdtempSync(join(tmpdir(), 'esoul-uat-')), '2026-10-22-uat');
    cli('init', sample, run, '--env', 'uat', '--base-url', 'https://uat.example.cz', '--commit', 'abc1234', '--devices', 'desktop,mobile');
    let results = JSON.parse(readFileSync(join(run, 'results.json'), 'utf8'));
    // AUT-01 runs on all devices, AUT-02..04 on desktop only, AUT-04 is basis zadani in part A so it stays not-run.
    assert.deepEqual(results.results.map((r) => `${r.scenario}@${r.device}`), ['AUT-01@desktop', 'AUT-01@mobile', 'AUT-02@desktop', 'AUT-03@desktop', 'AUT-04@desktop']);
    assert.match(cli('next', run), /^AUT-01@desktop/);
    cli('record', run, 'AUT-01', '--device', 'desktop', '--status', 'pass');
    cli('record', run, 'AUT-01', '--device', 'mobile', '--status', 'fail', '--step', '2', '--url', 'https://uat.example.cz/', '--note', 'Menu | překrývá tlačítko.', '--evidence', 'screenshots/AUT-01-mobile-2.png');
    cli('record', run, 'AUT-04', '--device', 'desktop', '--status', 'deviation', '--note', 'Role se změnila.');
    assert.match(cli('next', run), /^AUT-02@desktop/);
    results = JSON.parse(readFileSync(join(run, 'results.json'), 'utf8'));
    results.layout.push({ url: 'https://uat.example.cz/', device: 'mobile', role: 'A', screenshot: 'screenshots/s.png', findings: [{ check: 'overlap', element: 'button „Uložit“', detail: 'zakrývá header', confirmed: true }] });
    writeFileSync(join(run, 'results.json'), JSON.stringify(results));
    cli('report', run);
    const report = readFileSync(join(run, 'report.md'), 'utf8');
    assert.match(report, /\| Testovaná verze \| abc1234 \|/);
    assert.match(report, /## Neprošlé scénáře/);
    assert.match(report, /Menu \\\| překrývá tlačítko\./);
    assert.match(report, /## Nálezy rozložení/);
    assert.match(report, /AUT-04 \(desktop\): Role se změnila\./);
});

test('record refuses scenarios outside the run', () => {
    const run = join(mkdtempSync(join(tmpdir(), 'esoul-uat-')), 'r');
    mkdirSync(run, { recursive: true });
    cli('init', sample, run, '--env', 'uat', '--base-url', 'https://x.cz', '--chapters', 'AUT', '--priority', 'P1');
    assert.throws(() => execFileSync(process.execPath, [join(here, 'uat.mjs'), 'record', run, 'AUT-01', '--device', 'tablet', '--status', 'pass'], { stdio: 'pipe' }));
});
