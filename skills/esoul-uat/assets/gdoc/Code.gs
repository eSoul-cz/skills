/**
 * eSoul UAT – synchronizace testovacích scénářů do nativního Google Docu (plugin esoul-skills, skill esoul-uat).
 *
 * Skript je svázaný s dokumentem (nebo samostatný) a nasazuje se jako Web App.
 * Lokální CLI (`scripts/gdoc.mjs`) volá `doPost` s JSON tělem `{ token, action, ... }`.
 * Scénáře do něj přicházejí už naparsované z Markdownu (`docs/testing/uat/scenarios/*.md`).
 *
 * Akce: ping, init, intro, sync, read, result, e2e. Podrobnosti jsou v references/gdoc.md.
 *
 * Rozložení dokumentu: záložka 1 „Úvod“ (bez scénářů) a pro každou kapitolu jedna záložka „ZKR · Název“.
 * Každá úprava obsahu sahá jen na tělo JEDNÉ záložky; ostatní záložky se nikdy neprocházejí.
 *
 * Soubor má dvě části:
 *   1) ČISTÁ LOGIKA (bez Apps Script globálů na nejvyšší úrovni). Načítá ji i Node přes `vm`
 *      v scripts/gdoc.test.mjs, proto zde nesmí být volání DocumentApp mimo funkce.
 *   2) APPS SCRIPT (DocumentApp, Docs, PropertiesService, ...).
 *
 * Vlastnictví buněk: skript vlastní záhlaví tabulek a sloupce Krok (číslo), Akce testera
 * a Očekávaný výsledek. Sloupce „Skutečný výsledek / chyba“, „Oprava“ a stav zaškrtávátka
 * patří testerům. Synchronizace je nikdy nepřepíše (výjimka: akce `result` a poznámka ⚠).
 * Volitelný šestý sloupec „Automatický test“ (požadavek s `automatedColumn: true`) zapisuje jen
 * akce `e2e` do řádku prvního kroku scénáře; synchronizace ho nikdy nemění.
 */

/* =========================================================================
 * 1) ČISTÁ LOGIKA
 * ======================================================================= */

var FONT = 'Calibri';
var MONO = 'Consolas';
var SIZE = 10.5;
var SIZE_SMALL = 8;
var SIZE_MONO = 8.5;

var COLORS = {
  heading: '#3D5A1E',
  text: '#1F1F1F',
  grey: '#666666',
  border: '#BFBFBF',
  tableHeader: '#E7EFE0',
  scenarioTitle: '#D5E3C3',
  deviation: '#FDECEA',
  deviationText: '#9F1D1D',
  byCode: '#7A1F1F',
  orphan: '#999999'
};

// A4 na šířku v bodech: 842 x 595. Okraje 1,5 cm (42,5 b) -> použitelná šířka 757 b.
var PAGE_WIDTH = 842;
var PAGE_HEIGHT = 595;
var PAGE_MARGIN = 42.5;
var BASE_COLUMN_COUNT = 5;
// Krok (1,6 cm = 45 b) | Akce | Očekávaný výsledek | Skutečný výsledek / chyba | Oprava [| Automatický test]
var BASE_COLUMN_WIDTHS = [45, 220, 220, 140, 132];
var BASE_COLUMN_LABELS = ['Krok', 'Akce testera', 'Očekávaný výsledek', 'Skutečný výsledek / chyba', 'Oprava'];
var AUTO_COLUMN_WIDTHS = [45, 190, 190, 120, 112, 100];
var AUTO_COLUMN_LABEL = 'Automatický test';
var AUTO_COLUMN_INDEX = 5;

// Aktivní rozložení sloupců; nastavuje `configureColumns` podle požadavku (každé spuštění skriptu je nový kontext).
var COLUMN_COUNT = BASE_COLUMN_COUNT;
var COLUMN_WIDTHS = BASE_COLUMN_WIDTHS;
var COLUMN_LABELS = BASE_COLUMN_LABELS;

/** Zapne nebo vypne volitelný šestý sloupec „Automatický test“ pro nově stavěné tabulky. */
function configureColumns(automated) {
  if (automated === true) {
    COLUMN_COUNT = BASE_COLUMN_COUNT + 1;
    COLUMN_WIDTHS = AUTO_COLUMN_WIDTHS;
    COLUMN_LABELS = BASE_COLUMN_LABELS.concat([AUTO_COLUMN_LABEL]);
  } else {
    COLUMN_COUNT = BASE_COLUMN_COUNT;
    COLUMN_WIDTHS = BASE_COLUMN_WIDTHS;
    COLUMN_LABELS = BASE_COLUMN_LABELS;
  }
}

var FLAG_NOTE = '⚠ Krok změněn po testu, přetestovat.';
var ORPHAN_PREFIX = '[zrušený krok] ';

/** Rozdělí text na segmenty podle `**tučně**` a `kód`. Značky se odstraní. */
function parseInline(text) {
  var value = String(text === null || text === undefined ? '' : text);
  var pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  var out = [];
  var last = 0;
  var match;
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > last) {
      out.push({ text: value.slice(last, match.index) });
    }
    var token = match[0];
    if (token.indexOf('**') === 0) {
      out.push({ text: token.slice(2, -2), bold: true });
    } else {
      out.push({ text: token.slice(1, -1), code: true });
    }
    last = match.index + token.length;
  }
  if (last < value.length) {
    out.push({ text: value.slice(last) });
  }
  return out;
}

/** Text bez inline značek. */
function stripInline(text) {
  return parseInline(text).map(function (segment) { return segment.text; }).join('');
}

/** Normalizace pro porovnávání: bez značek, bílé znaky sloučené, bez okrajových mezer. */
function normalizeText(text) {
  return stripInline(text).replace(/[\s\u000b ]+/g, ' ').trim();
}

/** Segmenty `parseInline` doplněné o společné vlastnosti (barva, velikost). */
function inlineRuns(text, extra) {
  return parseInline(text).map(function (segment) {
    var run = { text: segment.text };
    if (segment.bold) { run.bold = true; }
    if (segment.code) { run.code = true; }
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key) && run[key] === undefined) { run[key] = extra[key]; }
      }
    }
    return run;
  });
}

function runsToPlain(runs) {
  return runs.map(function (run) { return run.text; }).join('');
}

function linesToPlain(lines) {
  return lines.map(runsToPlain).join('\n');
}

/** Akce kroku jako řádky běhů (jediný řádek). */
function actionLines(step) {
  return [inlineRuns(step.action)];
}

/** Očekávaný výsledek jako řádky běhů; u odchylek dva řádky (dle zadání / dle kódu dnes). */
function expectedLines(step) {
  if (step.expectedByCode) {
    return [
      [{ text: 'Dle zadání: ', bold: true }].concat(inlineRuns(step.expected)),
      [{ text: 'Dle kódu dnes: ', bold: true, color: COLORS.byCode }].concat(
        inlineRuns(step.expectedByCode, { color: COLORS.byCode })
      )
    ];
  }
  return [inlineRuns(step.expected)];
}

/**
 * Má řádek textová data od testera (výsledek nebo oprava)? Stav zaškrtávátka skript přečíst neumí
 * (je jen vykreslení v Google Docs), proto se do toho nepočítá. Vynucené `keep` je pro cizí řádky.
 */
function hasTesterData(row) {
  return String(row.result || '').trim() !== '' || String(row.fix || '').trim() !== '' || row.keep === true;
}

function hasOrphanPrefix(action) {
  return String(action || '').replace(/^\s+/, '').indexOf(ORPHAN_PREFIX.trim()) === 0;
}

function stripOrphanPrefix(action) {
  return String(action || '').replace(/^\s*\[zrušený krok\]\s*/i, '');
}

/**
 * Plán synchronizace řádků kroků jednoho scénáře (čistá funkce).
 *
 * @param oldRows  řádky v dokumentu: [{ action, expected, result, fix, keep? }] v pořadí z dokumentu
 * @param newSteps kroky ze zdroje:   [{ action, expected, expectedByCode? }]
 * @returns pole operací v cílovém pořadí zobrazení:
 *   { op:'row', newIndex, oldIndex|null, actionChanged, expectedChanged, restore, flag }
 *       oldIndex null = nový řádek; restore = řádek byl dříve označen jako zrušený a opět platí
 *   { op:'orphan', oldIndex, mark }       starý řádek bez protějšku (vždy se ponechá jako „zrušený krok“;
 *                                         zaškrtnutí kroku nelze přečíst, proto se nic nemaže automaticky)
 *
 * Párování: 1) přesná shoda normalizovaného textu akce (u duplicit první nepoužitý v pořadí),
 * 2) zbylé podle polohy v mezeře mezi už spárovanými řádky (upravená akce zůstane na svém místě).
 */
function planRows(oldRows, newSteps) {
  var oldKey = oldRows.map(function (row) { return normalizeText(stripOrphanPrefix(row.action)); });
  var newKey = newSteps.map(function (step) { return normalizeText(step.action); });
  var usedOld = [];
  var matchOfNew = [];
  var i;
  var j;

  for (i = 0; i < newKey.length; i++) {
    matchOfNew[i] = null;
    for (j = 0; j < oldKey.length; j++) {
      if (!usedOld[j] && oldKey[j] === newKey[i]) {
        usedOld[j] = true;
        matchOfNew[i] = j;
        break;
      }
    }
  }

  var lastOld = -1;
  for (i = 0; i < newKey.length; i++) {
    if (matchOfNew[i] !== null) {
      lastOld = matchOfNew[i];
      continue;
    }
    var upper = Infinity;
    for (var n = i + 1; n < newKey.length; n++) {
      if (matchOfNew[n] !== null) {
        if (matchOfNew[n] > lastOld) { upper = matchOfNew[n]; }
        break;
      }
    }
    for (j = lastOld + 1; j < oldKey.length && j < upper; j++) {
      if (!usedOld[j]) {
        usedOld[j] = true;
        matchOfNew[i] = j;
        lastOld = j;
        break;
      }
    }
  }

  // Nespárované staré řádky se zařadí za nejbližší předchozí spárovaný řádek (podle pořadí v dokumentu).
  var newIndexOfOld = [];
  matchOfNew.forEach(function (oldIndex, newIndex) {
    if (oldIndex !== null) { newIndexOfOld[oldIndex] = newIndex; }
  });
  var orphansByAnchor = {};
  for (j = 0; j < oldRows.length; j++) {
    if (usedOld[j]) { continue; }
    var anchor = -1;
    for (var k = j - 1; k >= 0; k--) {
      if (usedOld[k]) { anchor = newIndexOfOld[k]; break; }
    }
    (orphansByAnchor[anchor] = orphansByAnchor[anchor] || []).push(j);
  }

  var ops = [];
  function pushOrphans(anchorIndex) {
    (orphansByAnchor[anchorIndex] || []).forEach(function (oldIndex) {
      ops.push({ op: 'orphan', oldIndex: oldIndex, mark: !hasOrphanPrefix(oldRows[oldIndex].action) });
    });
  }

  pushOrphans(-1);
  for (i = 0; i < newSteps.length; i++) {
    var oldIndex = matchOfNew[i];
    var op = { op: 'row', newIndex: i, oldIndex: oldIndex, actionChanged: true, expectedChanged: true, restore: false, flag: false };
    if (oldIndex !== null) {
      var old = oldRows[oldIndex];
      op.actionChanged = normalizeText(stripOrphanPrefix(old.action)) !== newKey[i];
      op.expectedChanged = normalizeText(old.expected) !== normalizeText(linesToPlain(expectedLines(newSteps[i])));
      op.restore = hasOrphanPrefix(old.action);
      op.flag = (op.actionChanged || op.expectedChanged) && hasTesterData(old) &&
        String(old.result || '').indexOf(FLAG_NOTE) < 0;
    }
    ops.push(op);
    pushOrphans(i);
  }
  return ops;
}

/**
 * Text výsledku s poznámkou o změně kroku (právě jednou). Čistá část `appendFlagNote_`.
 */
function withFlagNote(result) {
  var text = String(result || '');
  if (text.indexOf(FLAG_NOTE) >= 0) { return text; }
  return text.trim() === '' ? FLAG_NOTE : text + '\n' + FLAG_NOTE;
}

/**
 * Pořadí operací s existujícími řádky (čistá funkce): simuluje, jak se tabulka mění, když se v cílovém pořadí
 * vkládají nové řádky a řádky na špatném místě se přesouvají (žádný řádek se nemaže).
 *
 * @param ops      výstup `planRows`
 * @param oldCount počet starých řádků kroků v tabulce
 * @returns pole pro každou operaci v cílovém pořadí:
 *   { k, kind:'insert' }                      nový řádek na pozici k (nic se nepřesouvá)
 *   { k, kind:'stay', oldIndex }              řádek už je na pozici k
 *   { k, kind:'move', oldIndex, from }        skutečný přesun existujícího řádku z pozice `from` na k
 * Vkládání nikdy nepřesouvá existující řádky; `move` vzniká jen při skutečném přeřazení kroků.
 */
function planOrder(ops, oldCount) {
  var order = [];
  var i;
  for (i = 0; i < oldCount; i++) { order.push(i); }
  var steps = [];
  ops.forEach(function (op, k) {
    if (op.op === 'row' && op.oldIndex === null) {
      order.splice(k, 0, 'new' + k);
      steps.push({ k: k, kind: 'insert' });
      return;
    }
    var position = order.indexOf(op.oldIndex);
    if (position === k) {
      steps.push({ k: k, kind: 'stay', oldIndex: op.oldIndex });
      return;
    }
    order.splice(position, 1);
    order.splice(k, 0, op.oldIndex);
    steps.push({ k: k, kind: 'move', oldIndex: op.oldIndex, from: position });
  });
  return steps;
}

/**
 * Slije hodnoty tabulky „Informace o dokumentu“ po přestavbě Úvodu (čistá funkce).
 * @param rows     nové řádky [[štítek, hodnota]] včetně záhlaví jako první řádek
 * @param oldPairs staré řádky bez záhlaví [[štítek, hodnota]] z dokumentu
 * @returns nové řádky: prázdnou hodnotu doplní stará hodnota stejného štítku (hodnoty od skriptu se
 *   aktualizují), řádky se štítkem, který už neexistuje a má hodnotu, se přidají na konec.
 */
function mergeInfoValues(rows, oldPairs) {
  var oldByLabel = {};
  oldPairs.forEach(function (pair) { oldByLabel[normalizeText(pair[0])] = String(pair[1] || ''); });
  var known = {};
  var out = rows.map(function (row, index) {
    var label = normalizeText(row[0]);
    known[label] = true;
    var restored = index > 0 && String(row[1] || '') === '' && oldByLabel[label] ? oldByLabel[label] : row[1];
    return [row[0], restored];
  });
  oldPairs.forEach(function (pair) {
    var label = normalizeText(pair[0]);
    if (label !== '' && !known[label] && String(pair[1] || '').trim() !== '') {
      known[label] = true;
      out.push([pair[0], String(pair[1])]);
    }
  });
  return out;
}

var INIT_CONFIRM = 'PREPSAT';
var INIT_CONFIRM_TESTER = 'PREPSAT_VCETNE_ZAPISU';

/** Počet řádků s daty testera (viz `hasTesterData`). */
function countTesterRows(rows) {
  return rows.filter(hasTesterData).length;
}

/** Odmítnutí `init` kapitoly, která obsahuje zápisy testerů; null = lze pokračovat. */
function initRefusal(chapterId, testerRows, confirm) {
  if (testerRows <= 0 || confirm === INIT_CONFIRM_TESTER) { return null; }
  return 'init kapitoly ' + chapterId + ' by smazal zápisy testerů (řádků s výsledkem, opravou nebo zaškrtnutím: ' +
    testerRows + '). Použij sync, který zápisy zachová. Chceš-li je opravdu smazat, pošli confirm "' +
    INIT_CONFIRM_TESTER + '" (CLI: --including-tester-data).';
}

/**
 * Odmítnutí plného `init` (Úvod maže všechny záložky kapitol): `entries` = [{ chapterId, rows }] s počty
 * řádků s daty testera po kapitolách. Null = lze pokračovat. Čistá funkce.
 */
function initIntroRefusal(entries, confirm) {
  var withData = entries.filter(function (entry) { return entry.rows > 0; });
  if (!withData.length || confirm === INIT_CONFIRM_TESTER) { return null; }
  return 'init by smazal všechny záložky kapitol, z nich tyto obsahují zápisy testerů: ' +
    withData.map(function (entry) { return entry.chapterId + ' (' + entry.rows + ')'; }).join(', ') +
    '. Použij sync. Chceš-li je opravdu smazat, pošli confirm "' + INIT_CONFIRM_TESTER + '" (CLI: --including-tester-data).';
}

/**
 * Záložka kapitoly mezi zadanými záložkami [{ tabId, title, index }] (první shoda podle ID v názvu;
 * záložka na indexu 0 je Úvod). Čistá část hledání po chybě `addDocumentTab`.
 */
function findChapterTab(tabs, chapterId) {
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].index > 0 && parseChapterHeading(tabs[i].title) === chapterId) { return tabs[i]; }
  }
  return null;
}

/**
 * Z více záložek téže kapitoly vybere první s obsahem (jinak první); ostatní jsou duplicity.
 * @param tabs       záložky kapitoly [{ tabId, title }]
 * @param hasContent funkce tab -> bool
 * @returns { tab, duplicates, warning } (tab null, když `tabs` je prázdné)
 */
function pickChapterTab(tabs, chapterId, hasContent) {
  if (!tabs.length) { return { tab: null, duplicates: [], warning: null }; }
  var chosen = tabs[0];
  if (tabs.length > 1) {
    for (var i = 0; i < tabs.length; i++) {
      if (hasContent(tabs[i])) { chosen = tabs[i]; break; }
    }
  }
  var duplicates = tabs.filter(function (tab) { return tab.tabId !== chosen.tabId; });
  return {
    tab: chosen,
    duplicates: duplicates,
    warning: duplicates.length
      ? 'kapitola ' + chapterId + ' má v dokumentu ' + tabs.length + ' záložek (' +
        tabs.map(function (tab) { return tab.tabId + ' „' + tab.title + '“'; }).join(', ') +
        '); použita ' + chosen.tabId + ', duplicitní záložky smaž ručně po kontrole obsahu'
      : null
  };
}

/** Nadpis kapitoly: „PRE · Název“. Parsovatelný přes `parseChapterHeading`. */
function chapterHeadingText(chapter) {
  return chapter.id + ' · ' + chapter.title;
}

function parseChapterHeading(text) {
  var match = /^([A-Z0-9]{2,4}) · /.exec(String(text || ''));
  return match ? match[1] : null;
}

/** Text záhlaví scénáře: „PRE-01 · Název“. */
function scenarioHeaderText(scenario) {
  return scenario.id + ' · ' + scenario.title;
}

function parseScenarioHeader(text) {
  var match = /^([A-Z0-9]{2,4}-\d{2,3}) · /.exec(String(text || ''));
  return match ? match[1] : null;
}

/** Maximální délka názvu záložky (limit Docs neznáme, bezpečná mez; ID kapitoly zůstává vždy na začátku). */
var TAB_TITLE_MAX = 50;
var INTRO_TAB_TITLE = 'Úvod';

/** Název záložky kapitoly: „PRE · Název“, případně zkrácený s „…“. Parsovatelný přes `parseChapterHeading`. */
function chapterTabTitle(chapter, maxLength) {
  var limit = maxLength || TAB_TITLE_MAX;
  var text = chapterHeadingText(chapter);
  return text.length <= limit ? text : text.slice(0, limit - 1).replace(/\s+$/, '') + '…';
}

/** ID kapitoly z ID scénáře: „PRE-01“ -> „PRE“. */
function chapterIdOfScenario(scenarioId) {
  var match = /^([A-Z0-9]{2,4})-\d{2,3}$/.exec(String(scenarioId || ''));
  return match ? match[1] : null;
}

/**
 * Index nové záložky kapitoly: Úvod je na indexu 0, kapitoly následují v pořadí `order`.
 * Počítají se jen už existující kapitoly, které jsou v pořadí před `id`.
 */
function chapterTabIndex(order, id, existingIds) {
  var position = order.indexOf(id);
  var before = 0;
  existingIds.forEach(function (existing) {
    var other = order.indexOf(existing);
    if (existing !== id && other >= 0 && other < position) { before += 1; }
  });
  return 1 + before;
}

/** Návod v záložce Úvod: [{ kind: 'para'|'bullet', runs }]. */
function introGuideItems() {
  return [
    { kind: 'para', runs: inlineRuns('Každá kapitola má vlastní záložku (panel záložek vlevo), označenou zkratkou, např. **PRE · …**. Scénář je tabulka, jeho kroky jsou řádky.') },
    { kind: 'bullet', runs: inlineRuns('**Krok**: u prošlého kroku zaškrtněte políčko u jeho čísla a do sloupce **Skutečný výsledek / chyba** napište OK. Samotné zaškrtnutí skript nevidí.') },
    { kind: 'bullet', runs: inlineRuns('**Akce testera** a **Očekávaný výsledek** neupravujte: při synchronizaci se přepíšou zněním ze zdroje scénářů.') },
    { kind: 'bullet', runs: inlineRuns('**Skutečný výsledek / chyba** a **Oprava** vyplňují testeři. Zapisuje do nich i agentní UAT. Tyto sloupce se synchronizací nikdy nepřepíšou.') },
    { kind: 'bullet', runs: inlineRuns('Krok označený **[zrušený krok]** už ve scénáři neplatí, krok netestujte. Skript takové řádky nikdy nemaže; po kontrole zápisů je můžete smazat ručně.') },
    { kind: 'bullet', runs: inlineRuns('Poznámka **⚠ Krok změněn po testu, přetestovat.** ve sloupci výsledku značí, že se znění kroku po vašem testu změnilo. Proveďte krok znovu.') }
  ].concat(COLUMN_COUNT > BASE_COLUMN_COUNT ? [
    { kind: 'bullet', runs: inlineRuns('**Automatický test** (u prvního kroku scénáře) plní skript z výsledků automatických testů: stav, datum a při selhání důvod. Sloupec neupravujte.') }
  ] : []);
}

/** Chyba Google API, u které má smysl zkusit volání znovu (nedostupnost, 5xx, vyčerpané kvóty na chvíli). */
function isRetryableError(message) {
  // Holá čísla 500 až 509 se neberou (mohou být kdekoli, např. v indexu); číslo jen v kontextu HTTP / status / code.
  return /unavailable|backend error|internal error|timed? ?out|deadline|rate limit|try again|\b(?:http|status|code)\b[^0-9a-z]{0,4}50[0-9]\b/i
    .test(String(message || ''));
}

/**
 * Plán finalizace JEDNÉ záložky (čistá funkce), bez čtení textu.
 *
 * @param layout     tabulky záložky v pořadí z DocumentApp: [{ id|null, columnHeaderIndex }]
 * @param docsTables tabulky téže záložky v pořadí z Docs API (elementy `{ startIndex, table }`)
 * @param tabId      ID záložky (všechny rozsahy a pozice musí nést tabId)
 * @returns { bullets: [požadavky], merges: [požadavky od konce], warning: string|null }
 * Idempotentní: řádek kroku bez odrážky ji dostane, nesloučené záhlaví se sloučí.
 */
function planFinalize(layout, docsTables, tabId) {
  var out = { bullets: [], merges: [], warning: null };
  if (layout.length !== docsTables.length) {
    out.warning = 'počet tabulek v záložce nesedí (DocumentApp ' + layout.length + ', Docs API ' + docsTables.length + '), finalizace přeskočena';
    return out;
  }
  layout.forEach(function (info, i) {
    if (!info || !info.id || !(info.columnHeaderIndex >= 0)) { return; }
    var element = docsTables[i];
    var rows = (element.table && element.table.tableRows) || [];
    var h;
    for (h = info.columnHeaderIndex - 1; h >= 0; h--) {
      var row = rows[h];
      if (!row || !row.tableCells || row.tableCells.length < 2) { continue; }
      var style = row.tableCells[0].tableCellStyle;
      if (!(style && style.columnSpan > 1)) {
        out.merges.push({
          mergeTableCells: {
            tableRange: {
              tableCellLocation: { tableStartLocation: { index: element.startIndex, tabId: tabId }, rowIndex: h, columnIndex: 0 },
              rowSpan: 1,
              columnSpan: row.tableCells.length
            }
          }
        });
      }
    }
    for (var s = info.columnHeaderIndex + 1; s < rows.length; s++) {
      var cells = rows[s].tableCells || [];
      if (cells.length < BASE_COLUMN_COUNT) { continue; }
      var block = cells[0].content && cells[0].content[0];
      // Při masce `paragraph/bullet/listId` může být `paragraph` bez odrážky vynecháno, proto se spoléháme na indexy.
      if (!block || typeof block.endIndex !== 'number' || typeof block.startIndex !== 'number') { continue; }
      if (block.paragraph && block.paragraph.bullet) { continue; }
      var range = { startIndex: block.startIndex, endIndex: block.endIndex, tabId: tabId };
      out.bullets.push({ createParagraphBullets: { range: range, bulletPreset: 'BULLET_CHECKBOX' } });
      // Výchozí odsazení odrážky (36 b) by v úzké buňce zalamovalo číslo kroku; odsazení zmenšíme.
      out.bullets.push({
        updateParagraphStyle: {
          range: { startIndex: block.startIndex, endIndex: block.endIndex, tabId: tabId },
          paragraphStyle: { indentStart: { magnitude: 16, unit: 'PT' }, indentFirstLine: { magnitude: 0, unit: 'PT' } },
          fields: 'indentStart,indentFirstLine'
        }
      });
    }
  });
  out.merges = orderMergesFromEnd_(out.merges);
  return out;
}

/** Řadí požadavky na sloučení sestupně podle počátku tabulky a řádku (od konce záložky). */
function orderMergesFromEnd_(requests) {
  return requests.slice().sort(function (a, b) {
    var la = a.mergeTableCells.tableRange.tableCellLocation;
    var lb = b.mergeTableCells.tableRange.tableCellLocation;
    if (la.tableStartLocation.index !== lb.tableStartLocation.index) {
      return lb.tableStartLocation.index - la.tableStartLocation.index;
    }
    return lb.rowIndex - la.rowIndex;
  });
}

/**
 * Řádky záhlaví tabulky scénáře: [{ kind, fill, runs }].
 * Zrušený scénář má místo předpokladu a odchylky řádek „ZRUŠENO: důvod“.
 */
function scenarioHeaderRows(scenario) {
  var small = { size: SIZE_SMALL };
  var rows = [];

  rows.push({
    kind: 'title',
    fill: COLORS.scenarioTitle,
    runs: [
      { text: scenario.id, bold: true },
      { text: ' · ' },
      { text: scenario.title, bold: true }
    ]
  });

  var meta = [
    { text: 'Role: ', bold: true, size: SIZE_SMALL },
    { text: scenario.roleLabel || '', size: SIZE_SMALL },
    { text: '     Typ: ', bold: true, size: SIZE_SMALL },
    { text: scenario.typeLabel || '', size: SIZE_SMALL, bold: true, color: scenario.typeColor ? '#' + String(scenario.typeColor).replace('#', '') : undefined },
    { text: '     Základ: ', bold: true, size: SIZE_SMALL },
    { text: scenario.basisLabel || '', size: SIZE_SMALL }
  ];
  if (scenario.ui === false) {
    meta.push({ text: '     bez obrazovky', size: SIZE_SMALL, bold: true, color: COLORS.byCode });
  }
  rows.push({ kind: 'meta', fill: null, runs: meta });

  if (scenario.cancelled) {
    rows.push({
      kind: 'cancelled',
      fill: COLORS.deviation,
      runs: [{ text: 'ZRUŠENO: ', bold: true, color: COLORS.deviationText }]
        .concat(inlineRuns(scenario.cancelled, { color: COLORS.deviationText }))
    });
    return rows;
  }

  if (scenario.precondition) {
    rows.push({
      kind: 'precondition',
      fill: null,
      runs: [{ text: 'Předpoklad: ', bold: true, size: SIZE_SMALL }].concat(inlineRuns(scenario.precondition, small))
    });
  }
  if (scenario.deviation) {
    rows.push({
      kind: 'deviation',
      fill: COLORS.deviation,
      runs: [{ text: '⚠ Odchylka: ', bold: true, size: SIZE_SMALL, color: COLORS.deviationText }]
        .concat(inlineRuns(scenario.deviation, { size: SIZE_SMALL, color: COLORS.deviationText }))
    });
  }
  return rows;
}

/** Úvod kapitoly: [{ kind: 'para'|'label'|'bullet', runs }]. */
function chapterPreambleItems(chapter) {
  var items = [];
  (chapter.intro || []).forEach(function (text) { items.push({ kind: 'para', runs: inlineRuns(text) }); });
  if (chapter.status && chapter.status.length) {
    items.push({ kind: 'label', runs: [{ text: 'Stav implementace', bold: true }] });
    chapter.status.forEach(function (text) { items.push({ kind: 'para', runs: inlineRuns(text) }); });
  }
  if (chapter.preconditions && chapter.preconditions.length) {
    items.push({ kind: 'label', runs: [{ text: 'Předpoklady kapitoly', bold: true }] });
    chapter.preconditions.forEach(function (text) { items.push({ kind: 'bullet', runs: inlineRuns(text) }); });
  }
  return items;
}

/**
 * Výsledky automatických testů seskupené podle kapitoly (čistá funkce).
 * @param results [{ id, text }]
 * @returns { byChapter: { ZKR: [{ id, text }] }, invalid: [id] } (neplatné ID nebo chybějící text)
 */
function groupE2eResults(results) {
  var out = { byChapter: {}, invalid: [] };
  (results || []).forEach(function (item) {
    var chapterId = chapterIdOfScenario(item && item.id);
    if (!chapterId || typeof item.text !== 'string') {
      out.invalid.push(String((item && item.id) || '?'));
      return;
    }
    (out.byChapter[chapterId] = out.byChapter[chapterId] || []).push({ id: item.id, text: item.text });
  });
  return out;
}

/** Porovnání řetězců s konstantním časem vůči délce delšího z nich. */
function safeEqual(a, b) {
  var x = String(a === null || a === undefined ? '' : a);
  var y = String(b === null || b === undefined ? '' : b);
  var diff = x.length ^ y.length;
  var length = Math.max(x.length, y.length);
  for (var i = 0; i < length; i++) {
    diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/* =========================================================================
 * 2) APPS SCRIPT
 * ======================================================================= */

function doGet() {
  return json_({ ok: true, service: 'esoul-uat-gdoc', note: 'Použij POST s tokenem.' });
}

function doPost(e) {
  try {
    var request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('TOKEN');
    if (!token || !safeEqual(request.token, token)) {
      return json_({ ok: false, error: 'Neplatný token.' });
    }
    var docId = props.getProperty('DOC_ID');
    if (!docId) {
      return json_({ ok: false, error: 'Chybí Script Property DOC_ID.' });
    }

    // Jeden zápis do dokumentu v jednu chvíli (testeři i CLI mohou volat souběžně).
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return json_(dispatch_(request, docId));
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}

function dispatch_(request, docId) {
  configureColumns(request.automatedColumn === true);
  switch (request.action) {
    case 'ping': return actionPing_(docId);
    case 'init': return actionInit_(request, docId);
    case 'intro': return actionIntro_(request, docId);
    case 'sync': return actionSync_(request, docId);
    case 'read': return actionRead_(request, docId);
    case 'result': return actionResult_(request, docId);
    case 'e2e': return actionE2e_(request, docId);
    default: return { ok: false, error: 'Neznámá akce: ' + request.action };
  }
}

/* ------------------------------------------------------------------ ping */

function actionPing_(docId) {
  var doc = DocumentApp.openById(docId);
  return { ok: true, title: doc.getName(), tabs: doc.getTabs().map(function (tab) { return tab.getTitle(); }) };
}

/* ------------------------------------------------- záložky a volání Docs API */

var RETRY_DELAYS_MS = [2000, 5000, 10000];

/** Zopakuje volání při dočasné chybě Googlu (nedostupnost, 5xx): 1 pokus + 3 opakování s prodlevou 2/5/10 s. */
function withRetry_(label, fn) {
  for (var attempt = 0; ; attempt++) {
    try {
      return fn();
    } catch (err) {
      var message = String((err && err.message) || err);
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryableError(message)) {
        throw new Error(label + ': ' + message);
      }
      Utilities.sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

function docsBatch_(docId, requests, label) {
  return withRetry_(label, function () {
    return Docs.Documents.batchUpdate({ requests: requests }, docId);
  });
}

/** Záložky dokumentu: [{ tabId, title, index, chapterId }]. Záložka na indexu 0 je Úvod a kapitolou není. */
function listTabs_(doc) {
  return doc.getTabs().map(function (tab, index) {
    var title = tab.getTitle();
    return { tabId: tab.getId(), title: title, index: index, chapterId: index > 0 ? parseChapterHeading(title) : null };
  });
}

function findTab_(doc, tabId) {
  var tabs = doc.getTabs();
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].getId() === tabId) { return tabs[i]; }
  }
  throw new Error('Záložka ' + tabId + ' v dokumentu není.');
}

function tabBody_(doc, tabId) {
  return findTab_(doc, tabId).asDocumentTab().getBody();
}

/*
 * --- Tvary požadavků Docs API pro záložky (izolované, ať se případně snadno opraví po prvním ostrém běhu) ---
 * addDocumentTab:  { addDocumentTab: { tabProperties: { title, index } } }
 *                  odpověď: replies[i].addDocumentTab.tabProperties.tabId
 * deleteTab:       { deleteTab: { tabId } }   (smaže i podřízené záložky)
 * přejmenování:    { updateDocumentTabProperties: { tabProperties: { tabId, title }, fields: 'title' } }
 */
function createChapterTab_(docId, chapter, order, existingChapterIds) {
  var index = chapterTabIndex(order, chapter.id, existingChapterIds);
  var requests = [{ addDocumentTab: { tabProperties: { title: chapterTabTitle(chapter), index: index } } }];
  // addDocumentTab NENÍ idempotentní: po chybě (např. timeout) mohla záložka vzniknout. Proto se nevolá přes
  // obecné `withRetry_`; po každé chybě se nejdřív znovu vypíšou záložky a nalezená se použije.
  for (var attempt = 0; ; attempt++) {
    try {
      var response = Docs.Documents.batchUpdate({ requests: requests }, docId);
      var reply = response.replies && response.replies[0] && response.replies[0].addDocumentTab;
      var tabId = reply && reply.tabProperties && reply.tabProperties.tabId;
      if (!tabId) {
        throw new Error('addDocumentTab nevrátil tabId: ' + JSON.stringify(response).slice(0, 300));
      }
      return tabId;
    } catch (err) {
      var message = String((err && err.message) || err);
      var found;
      try {
        found = findChapterTab(listDocsTabProperties_(docId), chapter.id);
      } catch (listError) {
        throw new Error('addDocumentTab: ' + message + ' (záložky nelze ověřit: ' + String((listError && listError.message) || listError) +
          '; před dalším spuštěním zkontroluj dokument, aby nevznikla duplicitní záložka)');
      }
      if (found) { return found.tabId; }
      if (attempt >= RETRY_DELAYS_MS.length || !isRetryableError(message)) {
        throw new Error('addDocumentTab: ' + message);
      }
      Utilities.sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

/**
 * Vlastnosti záložek nejvyšší úrovně [{ tabId, title, index }] přes Docs API bez obsahu.
 * `includeTabsContent: true` je nutné, aby se pole `tabs` vůbec vyplnilo; maska `tabs/tabProperties` obsah vynechá.
 * Izolováno zde, kdyby Google masku odmítl.
 */
function listDocsTabProperties_(docId) {
  var document = withRetry_('Docs.get(tabs)', function () {
    return Docs.Documents.get(docId, { includeTabsContent: true, fields: 'tabs/tabProperties(tabId,title,index)' });
  });
  return (document.tabs || []).map(function (tab) {
    var properties = tab.tabProperties || {};
    return { tabId: properties.tabId, title: properties.title || '', index: properties.index || 0 };
  });
}

function deleteTabs_(docId, tabIds) {
  for (var i = 0; i < tabIds.length; i += 50) {
    docsBatch_(docId, tabIds.slice(i, i + 50).map(function (tabId) {
      return { deleteTab: { tabId: tabId } };
    }), 'deleteTab');
  }
}

function renameTab_(docId, tabId, title) {
  docsBatch_(docId, [
    { updateDocumentTabProperties: { tabProperties: { tabId: tabId, title: title }, fields: 'title' } }
  ], 'updateDocumentTabProperties');
}

/** Najde záložku v odpovědi Docs API (i mezi podřízenými). */
function findDocsTab_(tabs, tabId) {
  for (var i = 0; i < (tabs || []).length; i++) {
    var tab = tabs[i];
    if (tab.tabProperties && tab.tabProperties.tabId === tabId) { return tab; }
    var nested = findDocsTab_(tab.childTabs, tabId);
    if (nested) { return nested; }
  }
  return null;
}

// Jen koncové indexy prvků těla (bez textu), pro vyprázdnění záložky.
var DOCS_FIELDS_END = 'tabs(tabProperties/tabId,documentTab/body/content/endIndex)';

/** Smaže obsah záložky přes Docs API (rychlé i u obří záložky); DocumentApp `body.clear()` je jen záloha. */
function clearTabBodyViaDocs_(docId, tabId) {
  var document = withRetry_('Docs.get(endIndex)', function () {
    return Docs.Documents.get(docId, { includeTabsContent: true, fields: DOCS_FIELDS_END });
  });
  var tab = findDocsTab_(document.tabs, tabId);
  var content = tab && tab.documentTab && tab.documentTab.body && tab.documentTab.body.content;
  if (!content || !content.length) { throw new Error('nelze zjistit konec záložky ' + tabId); }
  var end = content[content.length - 1].endIndex;
  var requests = [];
  if (end > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: end - 1, tabId: tabId } } });
  }
  // Zbylý poslední odstavec si drží odrážku (Úvod končí seznamem) a DocumentApp `body.clear()`
  // pak padá na „Nelze odstranit poslední odstavec…“. Odrážka se proto zruší už tady.
  requests.push({ deleteParagraphBullets: { range: { startIndex: 1, endIndex: 2, tabId: tabId } } });
  docsBatch_(docId, requests, 'deleteContentRange');
}

function isEmptyBody_(body) {
  if (body.getNumChildren() !== 1) { return false; }
  var child = body.getChild(0);
  var type = child.getType();
  if (type === DocumentApp.ElementType.PARAGRAPH) { return child.asParagraph().getText() === ''; }
  if (type === DocumentApp.ElementType.LIST_ITEM) { return child.asListItem().getText() === ''; }
  return false;
}

function emptyReport_() {
  return { added: 0, updated: 0, removedRows: 0, keptCancelledRows: 0, flagged: 0, addedRows: 0 };
}

/* ------------------------------------------------------------------ init */

function actionInit_(request, docId) {
  if (request.confirm !== INIT_CONFIRM && request.confirm !== INIT_CONFIRM_TESTER) {
    return { ok: false, error: 'init vyžaduje confirm: "' + INIT_CONFIRM + '" (smaže obsah).' };
  }
  if (!request.chapters) { return initIntro_(request, docId); }

  var report = emptyReport_();
  report.warnings = [];
  report.ms = { documentApp: 0, finalize: 0 };
  request.chapters.forEach(function (chapter) {
    processChapter_(docId, chapter, request.order || [], 'init', false, report, request.confirm);
  });
  report.ok = true;
  return report;
}

/**
 * Úvodní záložka: obsah se smaže a postaví znovu, ostatní záložky (kapitoly) se smažou.
 * Záložka Úvod (první) si drží své tabId.
 */
function initIntro_(request, docId) {
  var started = Date.now();
  var warnings = [];
  var doc = DocumentApp.openById(docId);
  var tabs = listTabs_(doc);
  var introId = tabs[0].tabId;
  var others = tabs.slice(1).map(function (tab) { return tab.tabId; });

  // Všechny mazané záložky (i přejmenované či ručně přidané) se před smazáním kontrolují po jedné;
  // zápisy testerů vyžadují silné potvrzení.
  if (request.confirm !== INIT_CONFIRM_TESTER) {
    var entries = [];
    tabs.slice(1).forEach(function (tab) {
      entries.push({ chapterId: tab.chapterId || ('„' + tab.title + '“'), rows: countTesterRows(readStepRows_(tabBody_(doc, tab.tabId))) });
    });
    var refusal = initIntroRefusal(entries, request.confirm);
    if (refusal) { throw new Error(refusal); }
  }

  if (others.length) { deleteTabs_(docId, others); }
  if (tabs[0].title !== INTRO_TAB_TITLE) {
    try { renameTab_(docId, introId, INTRO_TAB_TITLE); } catch (err) { warnings.push(String(err.message || err)); }
  }
  rebuildIntroBody_(docId, introId, request.meta || {}, [], warnings);
  return { ok: true, tabsDeleted: others.length, warnings: warnings, ms: { documentApp: Date.now() - started, finalize: 0 } };
}

/** Vyprázdní a znovu postaví tělo záložky Úvod (jiné záložky se nedotýká). */
function rebuildIntroBody_(docId, introId, meta, oldInfoPairs, warnings) {
  try {
    clearTabBodyViaDocs_(docId, introId);
  } catch (err) {
    warnings.push('vyprázdnění přes Docs API selhalo, použije se DocumentApp: ' + String(err.message || err));
  }
  var doc = DocumentApp.openById(docId);
  buildIntro_(tabBody_(doc, introId), meta, oldInfoPairs);
  doc.saveAndClose();
}

/** Hodnoty tabulky „Informace o dokumentu“ v těle Úvodu: [[štítek, hodnota]] bez záhlaví. */
function readInfoPairs_(body) {
  var tables = body.getTables();
  for (var t = 0; t < tables.length; t++) {
    var table = tables[t];
    if (table.getNumRows() === 0 || table.getRow(0).getNumCells() < 2) { continue; }
    if (table.getRow(0).getCell(0).getText().trim() !== 'Údaj' || table.getRow(0).getCell(1).getText().trim() !== 'Hodnota') { continue; }
    var pairs = [];
    for (var r = 1; r < table.getNumRows(); r++) {
      var row = table.getRow(r);
      if (row.getNumCells() >= 2) { pairs.push([row.getCell(0).getText(), row.getCell(1).getText()]); }
    }
    return pairs;
  }
  return [];
}

/**
 * Přestaví JEN první záložku (Úvod); ostatní záložky se nemažou ani nečtou. Hodnoty, které do tabulky
 * „Informace o dokumentu“ doplnili testeři, se obnoví podle štítku řádku (viz `mergeInfoValues`).
 */
function actionIntro_(request, docId) {
  var started = Date.now();
  var warnings = [];
  var doc = DocumentApp.openById(docId);
  var tabs = listTabs_(doc);
  var introId = tabs[0].tabId;
  var oldPairs = readInfoPairs_(tabBody_(doc, introId));
  if (tabs[0].title !== INTRO_TAB_TITLE) {
    try { renameTab_(docId, introId, INTRO_TAB_TITLE); } catch (err) { warnings.push(String(err.message || err)); }
  }
  try {
    rebuildIntroBody_(docId, introId, request.meta || {}, oldPairs, warnings);
  } catch (err) {
    // Úvod už může být vyprázdněný: původní hodnoty vrátit v chybě, aby šly ručně doplnit.
    throw new Error(String(err.message || err) + ' | původní „Informace o dokumentu“: ' + JSON.stringify(oldPairs));
  }
  return { ok: true, previousValues: oldPairs.filter(function (pair) { return String(pair[1]).trim() !== ''; }).length,
    warnings: warnings, ms: { documentApp: Date.now() - started, finalize: 0 } };
}

function setPageSetup_(body) {
  // Velikost a okraje stránky jsou v Docs s kartami nastavení záložky; zda je DocumentApp zapisuje per záložka, ověřit při prvním běhu.
  body.setPageWidth(PAGE_WIDTH);
  body.setPageHeight(PAGE_HEIGHT);
  body.setMarginTop(PAGE_MARGIN);
  body.setMarginBottom(PAGE_MARGIN);
  body.setMarginLeft(PAGE_MARGIN);
  body.setMarginRight(PAGE_MARGIN);
}

/**
 * Vyprázdní tělo záložky na jediný prázdný odstavec. `body.clear()` na těle záložky padá
 * („Nelze odstranit poslední odstavec v části dokumentu“), proto se maže po prvcích a poslední
 * (nesmazatelný) odstavec se jen vyprázdní.
 */
function resetBody_(body) {
  while (body.getNumChildren() > 1) { body.getChild(0).removeFromParent(); }
  var last = body.getChild(0);
  if (last.getType() === DocumentApp.ElementType.PARAGRAPH) {
    last.asParagraph().clear();
  } else if (last.getType() === DocumentApp.ElementType.LIST_ITEM) {
    last.asListItem().clear();
  }
}

function buildIntro_(body, meta, oldInfoPairs) {
  resetBody_(body);
  setPageSetup_(body);

  // Po clear() zůstává jediný prázdný odstavec, použijeme ho jako titulek.
  var title = body.getChild(0).asParagraph();
  title.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  writeRuns_(title, [{ text: meta.title || 'Testovací scénáře', bold: true, size: 26, color: COLORS.heading }], {});
  title.setSpacingAfter(4);

  var sub = body.appendParagraph('');
  sub.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  writeRuns_(sub, [{ text: [meta.subtitle, meta.kicker].filter(Boolean).join(' · '), size: 13, color: COLORS.grey }], {});
  var by = body.appendParagraph('');
  by.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  writeRuns_(by, [{
    text: 'Zpracoval ' + (meta.author || '') + ' pro ' + (meta.client || '') + '. Verze ' + (meta.version || '') +
      ' · ' + (meta.state || ''),
    size: 10, color: COLORS.grey
  }], {});

  addHeading_(body, body.getNumChildren(), 'Informace o dokumentu', DocumentApp.ParagraphHeading.HEADING1);
  var rows = [
    ['Údaj', 'Hodnota'],
    ['Dokument', (meta.title || '') + ' – ' + (meta.subtitle || '')],
    ['Verze', meta.version || ''],
    ['Stav', meta.state || ''],
    ['Datum sestavení', meta.date || ''],
    ['Zpracoval', meta.author || ''],
    ['Určeno pro', meta.client || ''],
    ['Verze aplikace (commit)', meta.commit || ''],
    ['Větev', meta.branch || ''],
    ['Testovací prostředí (doplní vývoj)', ''],
    ['Datum přípravy dat (doplní tester)', ''],
    ['Počet scénářů', meta.scenarios !== undefined ? String(meta.scenarios) : '']
  ];
  rows = mergeInfoValues(rows, oldInfoPairs || []);
  var info = body.appendTable(rows);
  info.setBorderColor(COLORS.border);
  info.setBorderWidth(0.5);
  info.setColumnWidth(0, 200);
  info.setColumnWidth(1, PAGE_WIDTH - 2 * PAGE_MARGIN - 200);
  for (var r = 0; r < rows.length; r++) {
    for (var c = 0; c < 2; c++) {
      var cell = info.getRow(r).getCell(c);
      styleCell_(cell, r === 0 ? COLORS.tableHeader : null);
      writeCell_(cell, [[{ text: rows[r][c], bold: r === 0 }]], {});
    }
  }
  var gap = body.appendParagraph('');
  gap.setAttributes(spacerAttributes_());

  addHeading_(body, body.getNumChildren(), 'Jak s dokumentem pracovat', DocumentApp.ParagraphHeading.HEADING1);
  insertItems_(body, body.getNumChildren(), introGuideItems());
}

/* ------------------------------------------------------------------ sync */

function actionSync_(request, docId) {
  var chapter = request.chapter;
  if (!chapter || !chapter.id || !chapter.scenarios) {
    return { ok: false, error: 'sync vyžaduje objekt chapter s id a scenarios.' };
  }
  var report = emptyReport_();
  report.warnings = [];
  report.ms = { documentApp: 0, finalize: 0 };
  processChapter_(docId, chapter, request.order || [], 'sync', request.force === true, report);
  report.ok = true;
  return report;
}

/**
 * Zpracuje jednu kapitolu = jednu záložku. Fáze:
 *  1) zajistí záložku (Docs API addDocumentTab), 2) úprava těla JEN této záložky přes DocumentApp,
 *  3) finalizace (odrážky a sloučení záhlaví) přes Docs API. Selhání finalizace jen přidá varování.
 * `mode` 'init': obsah záložky se smaže a postaví znovu; 'sync': přírůstkově.
 */
function processChapter_(docId, chapter, order, mode, force, report, confirm) {
  var started = Date.now();
  var doc = DocumentApp.openById(docId);
  var tabs = listTabs_(doc);
  // Záložka se hledá podle názvu při každém běhu. Proto stačí, aby klient po „Záložka t.… v dokumentu není“
  // (nová záložka z Docs API, kterou DocumentApp ve stejném běhu ještě nevidí) volání zopakoval: nový běh ji najde
  // a nevytvoří druhou.
  var matching = tabs.filter(function (tab) { return tab.chapterId === chapter.id; });
  var picked = pickChapterTab(matching, chapter.id, function (tab) { return !isEmptyBody_(tabBody_(doc, tab.tabId)); });
  var existing = picked.tab;
  if (picked.warning) { report.warnings.push(picked.warning); }

  var tabId;
  var stale = false; // po zápisu přes Docs API je třeba dokument otevřít znovu
  if (!existing) {
    var ids = tabs.filter(function (tab) { return tab.chapterId; }).map(function (tab) { return tab.chapterId; });
    tabId = createChapterTab_(docId, chapter, order, ids);
    stale = true;
  } else {
    tabId = existing.tabId;
    var title = chapterTabTitle(chapter);
    if (existing.title !== title) {
      try { renameTab_(docId, tabId, title); stale = true; } catch (err) { report.warnings.push(String(err.message || err)); }
    }
  }
  if (stale) { doc = DocumentApp.openById(docId); }

  var body = tabBody_(doc, tabId);
  if (mode === 'init' && !isEmptyBody_(body)) {
    var refusal = initRefusal(chapter.id, countTesterRows(readStepRows_(body)), confirm);
    if (refusal) { throw new Error(refusal); }
    resetBody_(body);
  }
  if (isEmptyBody_(body)) {
    buildChapterTab_(body, chapter);
    report.added += chapter.scenarios.length;
    report.addedRows += chapter.scenarios.reduce(function (sum, scenario) {
      return sum + (scenario.cancelled ? 0 : scenario.steps.length);
    }, 0);
  } else {
    upsertChapter_(body, chapter, force, report);
  }
  var layout = tabLayout_(body);
  doc.saveAndClose();
  var afterDocumentApp = Date.now();
  report.ms.documentApp += afterDocumentApp - started;

  report.warnings = report.warnings.concat(finalizeTab_(docId, tabId, layout));
  report.ms.finalize += Date.now() - afterDocumentApp;
}

/** Řádky kroků všech scénářů v těle záložky ve tvaru pro `hasTesterData` (jen textové sloupce testera). */
function readStepRows_(body) {
  var rows = [];
  body.getTables().forEach(function (table) {
    if (table.getNumRows() === 0 || !parseScenarioHeader(table.getRow(0).getCell(0).getText())) { return; }
    var headerIndex = columnHeaderIndex_(table);
    for (var r = headerIndex + 1; headerIndex >= 0 && r < table.getNumRows(); r++) {
      var row = table.getRow(r);
      if (row.getNumCells() < BASE_COLUMN_COUNT) { continue; }
      rows.push({ result: row.getCell(3).getText(), fix: row.getCell(4).getText() });
    }
  });
  return rows;
}

/** Tabulky záložky v pořadí těla: [{ id|null, columnHeaderIndex }]. Pořadí slouží ke spárování s Docs API. */
function tabLayout_(body) {
  return body.getTables().map(function (table) {
    if (table.getNumRows() === 0) { return { id: null, columnHeaderIndex: -1 }; }
    var id = parseScenarioHeader(table.getRow(0).getCell(0).getText());
    return { id: id, columnHeaderIndex: id ? columnHeaderIndex_(table) : -1 };
  });
}

function columnHeaderIndex_(table) {
  var limit = Math.min(table.getNumRows(), 8);
  for (var r = 0; r < limit; r++) {
    if (table.getRow(r).getCell(0).getText().trim() === COLUMN_LABELS[0]) { return r; }
  }
  return -1;
}

function isHeading_(element) {
  if (element.getType() !== DocumentApp.ElementType.PARAGRAPH) { return false; }
  var heading = element.asParagraph().getHeading();
  return heading === DocumentApp.ParagraphHeading.HEADING1 || heading === DocumentApp.ParagraphHeading.HEADING2;
}

/** Postaví obsah prázdné záložky: nadpis kapitoly, úvod a tabulky scénářů. */
function buildChapterTab_(body, chapter) {
  setPageSetup_(body);
  var first = body.getChild(0);
  var heading;
  if (first.getType() === DocumentApp.ElementType.PARAGRAPH) {
    heading = first.asParagraph();
    heading.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    heading.setText(chapterHeadingText(chapter));
    styleHeading_(heading, DocumentApp.ParagraphHeading.HEADING1);
  } else {
    heading = addHeading_(body, 0, chapterHeadingText(chapter), DocumentApp.ParagraphHeading.HEADING1);
  }
  var at = body.getChildIndex(heading) + 1;
  at = insertPreamble_(body, at, chapter);
  chapter.scenarios.forEach(function (scenario) {
    var spacer = buildScenarioAt_(body, at, scenario);
    at = body.getChildIndex(spacer) + 1;
  });
}

/** Přírůstková aktualizace záložky kapitoly (tester sloupce a zaškrtnutí se nepřepisují). */
function upsertChapter_(body, chapter, force, report) {
  var heading = null;
  for (var h = 0; h < body.getNumChildren(); h++) {
    var candidate = body.getChild(h);
    if (candidate.getType() === DocumentApp.ElementType.TABLE) { break; }
    if (isHeading_(candidate)) { heading = candidate.asParagraph(); break; }
  }
  if (!heading) {
    heading = addHeading_(body, 0, chapterHeadingText(chapter), DocumentApp.ParagraphHeading.HEADING1);
  } else if (heading.getText() !== chapterHeadingText(chapter)) {
    heading.setText(chapterHeadingText(chapter));
    styleHeading_(heading, DocumentApp.ParagraphHeading.HEADING1);
  }
  rewritePreamble_(body, heading, chapter);

  // Tabulky scénářů v záložce (jen ta jedna, nic jiného neprohledáváme).
  var tables = {};
  var firstTable = null;
  var index = body.getChildIndex(heading) + 1;
  for (; index < body.getNumChildren(); index++) {
    var child = body.getChild(index);
    if (child.getType() === DocumentApp.ElementType.TABLE) {
      var table = child.asTable();
      var id = parseScenarioHeader(table.getRow(0).getCell(0).getText());
      if (id && !tables[id]) { tables[id] = table; }
      if (!firstTable) { firstTable = table; }
    }
  }

  // Kurzor = prvek, za který se vkládají nové tabulky (drží se jako reference, ne jako index).
  var cursor = firstTable ? firstTable.getPreviousSibling() : body.getChild(index - 1);
  chapter.scenarios.forEach(function (scenario) {
    var table = tables[scenario.id];
    if (!table) {
      var at = body.getChildIndex(cursor) + 1;
      var spacer = buildScenarioAt_(body, at, scenario);
      report.added += 1;
      report.addedRows += scenario.cancelled ? 0 : scenario.steps.length;
      cursor = spacer;
      return;
    }
    if (syncTable_(table, scenario, report, force === true)) { report.updated += 1; }
    var after = table.getNextSibling();
    if (!after || after.getType() !== DocumentApp.ElementType.PARAGRAPH) {
      after = body.insertParagraph(body.getChildIndex(table) + 1, '');
      after.setAttributes(spacerAttributes_());
    }
    cursor = after;
  });
}

/** Vloží položky (odstavce a odrážky) na dané místo těla; vrací index za nimi. */
function insertItems_(body, index, items) {
  var at = index;
  items.forEach(function (item) {
    var element;
    if (item.kind === 'bullet') {
      element = body.insertListItem(at, '');
      element.setGlyphType(DocumentApp.GlyphType.BULLET);
    } else {
      element = body.insertParagraph(at, '');
      element.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    }
    writeRuns_(element, item.runs, {});
    element.setSpacingAfter(item.kind === 'label' ? 2 : 4);
    at += 1;
  });
  return at;
}

function insertPreamble_(body, index, chapter) {
  return insertItems_(body, index, chapterPreambleItems(chapter));
}

/** Úvod kapitoly nepatří testerům: přepíše se jen když se text liší. */
function rewritePreamble_(body, heading, chapter) {
  var start = body.getChildIndex(heading) + 1;
  var end = start;
  var oldTexts = [];
  while (end < body.getNumChildren()) {
    var child = body.getChild(end);
    if (child.getType() === DocumentApp.ElementType.TABLE || isHeading_(child)) { break; }
    var type = child.getType();
    oldTexts.push(type === DocumentApp.ElementType.LIST_ITEM ? child.asListItem().getText()
      : type === DocumentApp.ElementType.PARAGRAPH ? child.asParagraph().getText() : '?');
    end += 1;
  }
  var items = chapterPreambleItems(chapter);
  var newTexts = items.map(function (item) { return runsToPlain(item.runs); });
  if (JSON.stringify(oldTexts) === JSON.stringify(newTexts)) { return; }

  // Nový úvod se vloží před starý a starý se pak smaže (tělo nesmí zůstat bez posledního odstavce).
  var inserted = insertPreamble_(body, start, chapter) - start;
  for (var i = 0; i < end - start; i++) {
    var old = body.getChild(start + inserted);
    try {
      old.removeFromParent();
    } catch (err) {
      old.asParagraph().clear(); // poslední prvek těla nejde odstranit
    }
  }
}

/* ---------------------------------------------------------- tabulka scénáře */

/** Vytvoří tabulku scénáře + oddělovací odstavec; vrací oddělovač (nový kurzor). */
function buildScenarioAt_(body, index, scenario) {
  var headers = scenarioHeaderRows(scenario);
  var steps = scenario.cancelled ? [] : scenario.steps;
  var grid = [];
  var rowCount = headers.length + 1 + steps.length;
  for (var r = 0; r < rowCount; r++) { grid.push(columnBlanks_()); }

  // Dvě tabulky těsně za sebou by Google Docs slil; proto za každou následuje prázdný odstavec.
  var table = body.insertTable(index, grid);
  var spacer = body.insertParagraph(index + 1, '');
  spacer.setAttributes(spacerAttributes_());

  styleTable_(table);
  headers.forEach(function (header, i) { writeHeaderRow_(table.getRow(i), header); });
  writeColumnHeaderRow_(table.getRow(headers.length));
  steps.forEach(function (step, i) {
    writeStepRow_(table.getRow(headers.length + 1 + i), i + 1, step, true);
  });
  return spacer;
}

function columnBlanks_() {
  var blanks = [];
  for (var c = 0; c < COLUMN_COUNT; c++) { blanks.push(''); }
  return blanks;
}

function styleTable_(table) {
  table.setBorderColor(COLORS.border);
  table.setBorderWidth(0.5);
  COLUMN_WIDTHS.forEach(function (width, i) { table.setColumnWidth(i, width); });
}

function spacerAttributes_() {
  var attributes = {};
  attributes[DocumentApp.Attribute.FONT_SIZE] = 4;
  attributes[DocumentApp.Attribute.SPACING_AFTER] = 0;
  attributes[DocumentApp.Attribute.SPACING_BEFORE] = 0;
  return attributes;
}

function styleCell_(cell, fill) {
  cell.setPaddingTop(3);
  cell.setPaddingBottom(3);
  cell.setPaddingLeft(5);
  cell.setPaddingRight(5);
  cell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
  if (fill) { cell.setBackgroundColor(fill); }
}

/**
 * Záhlaví: text patří do první buňky, ostatní zůstanou prázdné se stejnou výplní.
 * Sloučení přes celých 5 sloupců doplní `finalizeTables_` (Docs API mergeTableCells).
 */
function writeHeaderRow_(row, header) {
  var count = ensureCells_(row);
  for (var c = 0; c < count; c++) {
    styleCell_(row.getCell(c), header.fill);
  }
  writeCell_(row.getCell(0), [header.runs], {});
}

function writeColumnHeaderRow_(row) {
  var count = ensureCells_(row);
  for (var c = 0; c < count; c++) {
    var cell = row.getCell(c);
    styleCell_(cell, COLORS.tableHeader);
    writeCell_(cell, [[{ text: COLUMN_LABELS[c], bold: true }]], {});
  }
}

/**
 * Nový řádek mívá počet buněk jako tabulka; pro jistotu doplníme. Cíl je počet sloupců té tabulky
 * (tabulka postavená bez sloupce „Automatický test“ ho nedostane ani po jeho zapnutí). Vrací počet buněk.
 */
function ensureCells_(row) {
  var table = row.getParent().asTable();
  var target = BASE_COLUMN_COUNT;
  for (var r = 0; r < table.getNumRows(); r++) { target = Math.max(target, table.getRow(r).getNumCells()); }
  while (row.getNumCells() < target) { row.appendTableCell(''); }
  return row.getNumCells();
}

/** Zapíše vlastní sloupce řádku kroku. `isNew`: nastaví i formát prázdných buněk testera. */
function writeStepRow_(row, number, step, isNew) {
  var count = ensureCells_(row);
  if (isNew) {
    for (var c = 0; c < count; c++) { styleCell_(row.getCell(c), null); }
    // Prázdné buňky testera (a sloupce Automatický test) dostanou písmo, ať se psaní nezačíná v jiném fontu.
    [3, 4, AUTO_COLUMN_INDEX].filter(function (c) { return c < count; }).forEach(function (c) {
      var attributes = {};
      attributes[DocumentApp.Attribute.FONT_FAMILY] = FONT;
      attributes[DocumentApp.Attribute.FONT_SIZE] = SIZE;
      try { row.getCell(c).setAttributes(attributes); } catch (err) { /* formát je jen kosmetika */ }
    });
  }
  setStepNumber_(row.getCell(0), String(number));
  writeCell_(row.getCell(1), actionLines(step), {});
  writeCell_(row.getCell(2), expectedLines(step), {});
}

/**
 * Přečíslování buňky Krok. Buňka je odstavec nebo (po Docs API) položka seznamu se zaškrtávátkem;
 * měníme jen text, takže odrážka i její stav zůstanou.
 */
function setStepNumber_(cell, text) {
  var child = cell.getChild(0);
  var element = child.getType() === DocumentApp.ElementType.LIST_ITEM ? child.asListItem() : child.asParagraph();
  var t = element.editAsText();
  if (t.getText() === text) { return false; }
  t.setText(text);
  t.setFontFamily(FONT).setFontSize(SIZE).setBold(false).setForegroundColor(COLORS.text);
  return true;
}

/**
 * Aktualizuje existující tabulku scénáře. Vrací true, pokud se něco změnilo.
 * Tester sloupce (3, 4) a zaškrtávátko se nikdy nepřepisují.
 */
function syncTable_(table, scenario, report, force) {
  var changed = false;
  var headers = scenarioHeaderRows(scenario);

  var columnHeaderIndex = -1;
  var limit = Math.min(table.getNumRows(), 8);
  for (var r = 0; r < limit; r++) {
    if (table.getRow(r).getCell(0).getText().trim() === COLUMN_LABELS[0]) { columnHeaderIndex = r; break; }
  }
  if (columnHeaderIndex < 0) { return false; } // cizí struktura, nesahat

  if (columnHeaderIndex === headers.length) {
    // Stejný počet řádků záhlaví: přepsat jen buňku 0 (po sloučení je v ní všechen obsah).
    headers.forEach(function (header, i) {
      var cell = table.getRow(i).getCell(0);
      if (force || normalizeText(cell.getText()) !== normalizeText(runsToPlain(header.runs))) {
        styleCell_(cell, header.fill);
        writeCell_(cell, [header.runs], {});
        changed = true;
      }
    });
  } else {
    // Změnil se počet řádků záhlaví (např. přibyl předpoklad nebo odchylka): záhlaví se postaví znovu.
    for (var k = 0; k < columnHeaderIndex; k++) { table.removeRow(0); }
    headers.forEach(function (header, i) {
      var row = table.insertTableRow(i);
      writeHeaderRow_(row, header);
    });
    changed = true;
  }

  if (scenario.cancelled) { return changed; } // kroky zrušeného scénáře se nemění, data testerů zůstávají

  var base = headers.length + 1;
  if (syncSteps_(table, base, scenario, report, force)) { changed = true; }
  return changed;
}

/** Synchronizace řádků kroků podle plánu z `planRows`. */
function syncSteps_(table, base, scenario, report, force) {
  var changed = false;
  var oldEls = [];
  var oldRows = [];
  for (var r = base; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    oldEls.push(row);
    if (row.getNumCells() >= BASE_COLUMN_COUNT) {
      oldRows.push({
        action: row.getCell(1).getText(),
        expected: row.getCell(2).getText(),
        result: row.getCell(3).getText(),
        fix: row.getCell(4).getText()
      });
    } else {
      oldRows.push({ action: '', expected: '', result: '', fix: '', keep: true }); // cizí řádek, nesahat
    }
  }

  var ops = planRows(oldRows, scenario.steps);
  var order = oldRows.map(function (_, i) { return i; }); // aktuální pořadí řádků v tabulce (indexy starých řádků)

  // 1) Cílové pořadí podle `planOrder`: nový krok = nový řádek na cílové pozici, existující řádky zůstávají.
  //    Nic se nemaže (řádek bez protějšku zůstane jako zrušený krok). Přesun (kopie + smazání originálu)
  //    jen při skutečném přeřazení existujících kroků.
  var sequence = ops;
  planOrder(ops, oldRows.length).forEach(function (move) {
    var op = sequence[move.k];
    if (move.kind === 'insert') {
      op.element = table.insertTableRow(base + move.k);
      changed = true;
      return;
    }
    if (move.kind === 'move') {
      // Řádek nejde v DocumentApp přesunout; vložíme jeho kopii na správné místo a originál smažeme.
      // Nejistota: zda kopie zachová odrážku (zaškrtávátko) a jeho stav. Chybějící odrážku doplní finalizeTables_.
      var copy = oldEls[move.oldIndex].copy();
      table.insertTableRow(base + move.k, copy);
      table.removeRow(base + move.from + 1);
      changed = true;
      // Zaškrtnutí nejde přečíst, takže ztrátu nepoznáme: varování pro každý přesunutý řádek.
      report.warnings = report.warnings || [];
      report.warnings.push(scenario.id + ' krok ' + (op.op === 'row' ? op.newIndex + 1 : 'zrušený') + ': přesunutý krok – zkontroluj zaškrtnutí');
    }
    op.element = table.getRow(base + move.k);
  });

  // 3) Obsah vlastních sloupců.
  sequence.forEach(function (op) {
    var row = op.element;
    ensureCells_(row);
    if (op.op === 'orphan') {
      report.keptCancelledRows += 1;
      if (op.mark || force) {
        var actionText = ORPHAN_PREFIX + stripOrphanPrefix(row.getCell(1).getText());
        writeCell_(row.getCell(1), [[{ text: actionText, color: COLORS.orphan }]], {});
        var expectedText = row.getCell(2).getText();
        writeCell_(row.getCell(2), expectedText.split('\n').map(function (line) { return [{ text: line, color: COLORS.orphan }]; }), {});
        setStepNumber_(row.getCell(0), '–');
        changed = true;
      }
      return;
    }

    var step = scenario.steps[op.newIndex];
    var isNew = op.oldIndex === null;
    var number = String(op.newIndex + 1);
    if (isNew) {
      writeStepRow_(row, op.newIndex + 1, step, true);
      report.addedRows += 1;
      return;
    }
    if (setStepNumber_(row.getCell(0), number)) { changed = true; }
    if (force || op.actionChanged || op.restore) {
      writeCell_(row.getCell(1), actionLines(step), {});
      changed = true;
    }
    if (force || op.expectedChanged || op.restore) {
      writeCell_(row.getCell(2), expectedLines(step), {});
      changed = true;
    }
    if (op.flag) {
      appendFlagNote_(row.getCell(3));
      report.flagged += 1;
      changed = true;
    }
  });
  return changed;
}

/** Připojí poznámku ⚠ do buňky výsledku (jen jednou, existující text zůstane). */
function appendFlagNote_(cell) {
  if (withFlagNote(cell.getText()) === cell.getText()) { return; }
  var empty = cell.getText().trim() === '';
  var paragraph = empty ? cell.getChild(0).asParagraph() : cell.appendParagraph('');
  writeRuns_(paragraph, [{ text: FLAG_NOTE, bold: true, color: COLORS.deviationText }], {});
}

/* ------------------------------------------------------------ zápis textu */

function addHeading_(body, index, text, level) {
  var paragraph = body.insertParagraph(index, '');
  paragraph.setHeading(level);
  paragraph.setText(text);
  styleHeading_(paragraph, level);
  return paragraph;
}

// Pojmenované styly nadpisů DocumentApp měnit neumí, proto se vzhled nastaví přímo na odstavci.
function styleHeading_(paragraph, level) {
  var size = level === DocumentApp.ParagraphHeading.HEADING1 ? 17 : 13.5;
  var t = paragraph.editAsText();
  if (t.getText() !== '') {
    t.setFontFamily(FONT).setFontSize(size).setBold(true).setForegroundColor(COLORS.heading);
  }
}

/** Vyčistí buňku (jen buňky ve vlastnictví skriptu!) a zapíše řádky běhů. */
function writeCell_(cell, lines, base) {
  cell.clear();
  lines.forEach(function (runs, i) {
    var paragraph = i === 0 ? cell.getChild(0).asParagraph() : cell.appendParagraph('');
    paragraph.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    writeRuns_(paragraph, runs, base);
  });
}

/** Zapíše běhy [{ text, bold, code, color, size }] do odstavce / položky seznamu. */
function writeRuns_(element, runs, base) {
  var plain = runsToPlain(runs);
  element.setSpacingAfter(0);
  if (plain === '') { return; }
  var t = element.editAsText();
  t.setText(plain);
  t.setFontFamily(base.font || FONT)
    .setFontSize(base.size || SIZE)
    .setBold(false)
    .setItalic(false)
    .setForegroundColor(base.color || COLORS.text);
  var position = 0;
  runs.forEach(function (run) {
    var length = run.text.length;
    if (length > 0) {
      var from = position;
      var to = position + length - 1; // koncový index je včetně
      if (run.size) { t.setFontSize(from, to, run.size); }
      if (run.color) { t.setForegroundColor(from, to, run.color); }
      if (run.bold) { t.setBold(from, to, true); }
      if (run.code) {
        t.setFontFamily(from, to, MONO);
        t.setFontSize(from, to, run.size || SIZE_MONO);
      }
    }
    position += length;
  });
}

/* ------------------------------------------------- Docs API: odrážky a merge */

/**
 * Po úpravách přes DocumentApp (a po saveAndClose) doplní přes Docs API v JEDNÉ záložce:
 *  1) zaškrtávátko (BULLET_CHECKBOX) v buňce Krok u každého řádku, který ještě odrážku nemá,
 *  2) sloučení řádků záhlaví přes všech 5 sloupců, pokud ještě sloučené nejsou.
 * Je idempotentní a samoopravná: opakování opraví, co minule selhalo. Plán dělá čistá `planFinalize`.
 * Docs API neumí vrátit jen jednu záložku, proto se čte maska bez textu a filtruje se podle tabId.
 * Odrážky indexy nemění, proto jdou první; sloučení indexy posouvá, takže jde od konce záložky.
 *
 * @returns pole varování (selhání Docs API nezastaví synchronizaci textu)
 */
var DOCS_FIELDS_FINALIZE = 'tabs(tabProperties/tabId,documentTab/body/content(startIndex,table/tableRows/tableCells(' +
  'tableCellStyle/columnSpan,content(startIndex,endIndex,paragraph/bullet/listId))))';

function finalizeTab_(docId, tabId, layout) {
  var warnings = [];
  if (!layout.some(function (info) { return info.id; })) { return warnings; }

  var document;
  try {
    document = withRetry_('Docs.get', function () {
      return Docs.Documents.get(docId, { includeTabsContent: true, fields: DOCS_FIELDS_FINALIZE });
    });
  } catch (err) {
    return ['finalizace záložky přeskočena (' + String((err && err.message) || err) + '); zaškrtávátka a sloučení záhlaví doplní opakované spuštění'];
  }
  var tab = findDocsTab_(document.tabs, tabId);
  var content = (tab && tab.documentTab && tab.documentTab.body && tab.documentTab.body.content) || [];
  var plan = planFinalize(layout, content.filter(function (element) { return element.table; }), tabId);
  if (plan.warning) { warnings.push(plan.warning); }

  [plan.bullets, plan.merges].forEach(function (requests, pass) {
    for (var i = 0; i < requests.length; i += 300) {
      try {
        docsBatch_(docId, requests.slice(i, i + 300), pass === 0 ? 'zaškrtávátka' : 'sloučení záhlaví');
      } catch (err) {
        warnings.push(String((err && err.message) || err) + ' (opakované spuštění to opraví)');
        break;
      }
    }
  });
  return warnings;
}

/* ------------------------------------------------------------------ read */

function actionRead_(request, docId) {
  var doc = DocumentApp.openById(docId);
  var scenarios = [];
  // Záložky se čtou po jedné; bez `chapter` všechny kapitoly (každá zvlášť).
  listTabs_(doc).forEach(function (info) {
    if (!info.chapterId || (request.chapter && request.chapter !== info.chapterId)) { return; }
    var body = tabBody_(doc, info.tabId);
    body.getTables().forEach(function (table) {
      if (table.getNumRows() === 0) { return; }
      var id = parseScenarioHeader(table.getRow(0).getCell(0).getText());
      if (!id) { return; }
      var headerIndex = columnHeaderIndex_(table);
      var steps = [];
      for (var s = headerIndex + 1; headerIndex >= 0 && s < table.getNumRows(); s++) {
        var row = table.getRow(s);
        if (row.getNumCells() < BASE_COLUMN_COUNT) { continue; }
        var label = row.getCell(0).getText().trim();
        steps.push({
          n: /^\d+$/.test(label) ? parseInt(label, 10) : null,
          action: row.getCell(1).getText(),
          expected: row.getCell(2).getText(),
          result: row.getCell(3).getText(),
          fix: row.getCell(4).getText(),
          auto: row.getNumCells() > AUTO_COLUMN_INDEX ? row.getCell(AUTO_COLUMN_INDEX).getText() : '',
          // Stav zaškrtnutí nejde přečíst (Docs API ani DocumentApp ho nevystavují; přeškrtnutí je jen
          // vykreslení), proto vždy null.
          checked: null
        });
      }
      scenarios.push({
        chapter: info.chapterId,
        id: id,
        title: table.getRow(0).getCell(0).getText().split(' · ').slice(1).join(' · '),
        steps: steps
      });
    });
  });
  return { ok: true, checkedSupported: false, scenarios: scenarios };
}

/* ---------------------------------------------------------------- result */

function actionResult_(request, docId) {
  if (!request.id || !request.step) {
    return { ok: false, error: 'result vyžaduje id a step.' };
  }
  var chapterId = chapterIdOfScenario(request.id);
  if (!chapterId) {
    return { ok: false, error: 'Neplatné ID scénáře: ' + request.id };
  }
  var doc = DocumentApp.openById(docId);
  var picked = pickChapterTab(
    listTabs_(doc).filter(function (info) { return info.chapterId === chapterId; }),
    chapterId,
    function (info) { return !isEmptyBody_(tabBody_(doc, info.tabId)); }
  );
  var tab = picked.tab;
  if (!tab) {
    return { ok: false, error: 'Záložka kapitoly ' + chapterId + ' v dokumentu není.' };
  }
  var append = request.mode === 'append';
  var tables = tabBody_(doc, tab.tabId).getTables();

  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    if (table.getNumRows() === 0 || parseScenarioHeader(table.getRow(0).getCell(0).getText()) !== request.id) { continue; }

    for (var r = 0; r < table.getNumRows(); r++) {
      var row = table.getRow(r);
      if (row.getNumCells() < BASE_COLUMN_COUNT || row.getCell(0).getText().trim() !== String(request.step)) { continue; }
      if (request.result !== undefined && request.result !== null) { writeTesterCell_(row.getCell(3), String(request.result), append); }
      if (request.fix !== undefined && request.fix !== null) { writeTesterCell_(row.getCell(4), String(request.fix), append); }
      doc.saveAndClose();
      return { ok: true, id: request.id, step: request.step };
    }
    return { ok: false, error: 'Scénář ' + request.id + ' nemá krok ' + request.step + '.' };
  }
  return { ok: false, error: 'Scénář ' + request.id + ' v dokumentu není.' };
}

/** Zápis do buňky testera jako prostý text (bez inline značek). Zaškrtávátko se nedotýká. */
function writeTesterCell_(cell, text, append) {
  var lines = text.split('\n');
  var existing = cell.getText().trim();
  if (append && existing !== '') {
    lines.forEach(function (line) {
      writeRuns_(cell.appendParagraph(''), [{ text: line }], {});
    });
    return;
  }
  writeCell_(cell, lines.map(function (line) { return [{ text: line }]; }), {});
}

/* ------------------------------------------------------------------- e2e */

/**
 * Zapíše souhrn automatického testu do sloupce „Automatický test“ v řádku prvního kroku scénáře.
 * Tělo: { automatedColumn: true, results: [{ id, text }] }. Nic jiného v řádku ani tabulce se nemění.
 * Scénáře, které v dokumentu nejsou (nebo jejich tabulka nemá sloupec), vrací v `missing`.
 */
function actionE2e_(request, docId) {
  if (request.automatedColumn !== true) {
    return { ok: false, error: 'e2e vyžaduje zapnutý sloupec Automatický test (automatedColumn: true v uat.config.json).' };
  }
  var grouped = groupE2eResults(request.results);
  var missing = grouped.invalid.slice();
  var written = 0;
  var doc = DocumentApp.openById(docId);
  var tabs = listTabs_(doc);

  Object.keys(grouped.byChapter).forEach(function (chapterId) {
    var items = grouped.byChapter[chapterId];
    var picked = pickChapterTab(
      tabs.filter(function (info) { return info.chapterId === chapterId; }),
      chapterId,
      function (info) { return !isEmptyBody_(tabBody_(doc, info.tabId)); }
    );
    if (!picked.tab) {
      items.forEach(function (item) { missing.push(item.id); });
      return;
    }
    var tables = {};
    tabBody_(doc, picked.tab.tabId).getTables().forEach(function (table) {
      if (table.getNumRows() === 0) { return; }
      var id = parseScenarioHeader(table.getRow(0).getCell(0).getText());
      if (id && !tables[id]) { tables[id] = table; }
    });
    items.forEach(function (item) {
      var table = tables[item.id];
      var headerIndex = table ? columnHeaderIndex_(table) : -1;
      var row = headerIndex >= 0 && headerIndex + 1 < table.getNumRows() ? table.getRow(headerIndex + 1) : null;
      if (!row || row.getNumCells() <= AUTO_COLUMN_INDEX) { missing.push(item.id); return; }
      writeTesterCell_(row.getCell(AUTO_COLUMN_INDEX), item.text, false);
      written += 1;
    });
  });
  doc.saveAndClose();
  return { ok: true, written: written, missing: missing };
}
