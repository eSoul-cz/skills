# Seznam slices

**Stav: plán, nic z popsaného není implementováno.** Dokument obsahuje úplný seznam vertikálních
slices po fázích. Každý slice je pár **GitHub issue + Freelo task** podle `## Tasking convention`
v [CONTEXT.md](../../CONTEXT.md); slice kategorie `pm` je jen Freelo task. Issue sedí v
milníku své fáze, sloupec Issue na něj odkazuje a závislosti mezi issues jsou v GitHubu nativní
vazby „blocked by“, které Freelo zrcadlí.

Cíle fází, brány a kritické cesty jsou ve [fázích a milnících](faze-a-milniky.md), zařazení
rozsahu v [rozsahu díla](rozsah.md), co který slice blokuje u klienta v
[podkladech a otázkách](podklady-a-otazky.md). Úplná legenda je v [README](README.md#legenda).

## 1. Legenda ve zkratce

- **ID** `F<fáze>-<nn>` se nikdy nepřečísluje ani nepoužije znovu; standardní řezy AI-ready webu mají ID `AI-<nn>`. Zrušený slice zůstává v
  tabulce s rozsahem `—` a zdůvodněním; nový slice dostane další volné číslo své fáze.
- **Titulek** je ve tvaru `Kontext: Akční výsledek` a je zároveň titulkem issue i Freelo tasku —
  bez prefixu kategorie a bez ID slice. V novém projektu je anglicky; projekt s českou historií
  drží české titulky trackeru (`## Tasking convention` v CONTEXT.md). ID nese hlavička issue
  (`**Slice:** F1-17 · **Fáze:** F1 (brána G1) · **Rozsah:** S`) a první řádek popisu Freelo
  tasku.
- **Kat.:** `fe`, `be`, `data` (s doplňkem `+int` u integrací) = štítek na obou stranách páru;
  `pm` = jen Freelo task bez GitHub issue (řízení, práce s klientem, předání).
- **Závislosti:** ID slices, `ADR-NNNN`, `#N` = otevřená otázka (issue se štítkem `question`),
  `K-nn` = podklad od klienta.
  „(podmíněně)“ = platí, jen když se realizuje varianta, na kterou odkazuje.
- **Rozsah:** `S` smlouva, `P` navýšení, `N` nová položka, `E` rozhodnutí eSoul, `—` nestaví
  se ([legenda](README.md#rozsah)).
- **Obrazovky:** kódy rámů z návrhu v `docs/design_pencil/`; `—` u slices bez obrazovky.
- **Issue:** `#N` odkaz na issue, u slices `pm` odkaz na Freelo task, `—` dokud pár nevznikl.
- **Akceptace:** `Role@kontext: kroky → očekávaný výsledek` podle
  [README](README.md#akceptace). **Jakmile issue existuje, rozsah a úplný scénář UAT žijí v
  issue**; buňka se zkrátí na stav a odkaz („UAT v #N“) a mění se jen značkami **Hotovo.** a
  **Zrušeno.**
- **Granularita:** slice je jedno issue, jeden PR a jeden scénář UAT. Slice,
  jehož odhad lidského času (zadání agentovi, kontrola, review, UAT, opravy) přesáhne 4 h, se
  rozdělí.

## 2. Slices po fázích

### 2.1 F0 Příprava

Nultá etapa před první funkcí: rozhodnutí, podklady od klienta, infrastruktura a průřezové
základy.

| ID | Titulek | Kat. | Závislosti | Rozsah | Obrazovky | Issue | Akceptace |
|---|---|---|---|---|---|---|---|
| F0-01 | Freelo: Project with state lists and category labels | pm | — | S | — | — | Vývojář eSoul: projekt má listy Backlog, LTT, To Do, In progress, Code review, Testing a Done; ID projektu je v [CONTEXT.md](../../CONTEXT.md#freelo). |
| F0-02 | Plan: Update after every client session | pm | — | S | — | — | Vývojář eSoul: po každém sezení je v jednom PR aktualizovaný stav plánu, ADR, dotčené slices a issues a uzavřené zodpovězené otázky; čas se vykazuje na tasku v listu LTT. |
| F0-03 | CI: Block merge to `main` on failing checks | be | — | S | — | — | Vývojář eSoul: pull request spustí kontroly z profilu stacku v Jenkinsu; červená kontrola nebo chybějící lidské schválení zablokuje merge. |
| F0-04 | Staging: Deploy from `main` after a green pipeline | be | F0-03 | S | — | — | Vývojář eSoul: merge do `main`, který projde pipeline, se nasadí na staging; staging má vlastní doménu s TLS a není indexovaný. |
| F0-05 | Tasks: Issue and Freelo pairs for the first-phase slices | pm | F0-01 | S | — | — | Vývojář eSoul: každý slice první fáze kromě `pm` má issue v milníku fáze a Freelo task se stejným titulkem; závislosti jsou vazby „blocked by“; sloupec Issue odkazuje na issue. |

<!-- Další fáze: „### 2.n Fn Název fáze“, jedna věta o cíli fáze a tabulka se stejnými
     sloupci. Slices řaďte podle závislostí, ne podle kategorie. -->

### 2.2 Standardní řezy: AI-ready web

Jen u projektu s veřejným webem (`website`, `website-admin`, `eshop`; u `application` pro veřejnou
část). Řezy se nemažou, jen upraví na stack, a patří do první dávky úkolů hned po bootstrapu;
u projektu bez veřejného webu je smaž celý blok. AI-06 jen u e-shopu. ID `AI-<nn>` se
nepřečísluje. Pravidla, kontroly a výjimky: [ai-readiness.md](../ai-readiness.md). Slice delší
než 4 h se rozdělí.

| ID | Titulek | Kat. | Závislosti | Rozsah | Obrazovky | Issue | Akceptace |
|---|---|---|---|---|---|---|---|
| AI-01 | Robots: Allow access, indexing, sitemap and IndexNow | be | F0-04 | E | — | — | Vývojář eSoul: `ai-readiness.mjs` ověří `robots`, `bot-access`, `indexable`, `sitemap` → `robots.txt` povoluje všechny boty a odkazuje na sitemap s `lastmod`, bot UA dostanou 200 (ověřeno i v access logu), produkce je indexovatelná, preview má `noindex`, klíč IndexNow a ping fungují. |
| AI-02 | HTML: Server-rendered content and semantics | fe | — | E | — | — | Vývojář eSoul: `ai-readiness.mjs` ověří `ssr-content`, `html-basics`, `semantics` → klíčový obsah a odkazy jsou v HTML bez JavaScriptu, stránky mají `lang`, title, description, canonical, jedno h1, `main` a popsané formuláře. |
| AI-03 | Structured data: JSON-LD from site data | fe | AI-02 | E | — | — | Vývojář eSoul: `ai-readiness.mjs` ověří `jsonld` → home má Organization nebo LocalBusiness a WebSite, články autora s daty, u e-shopu produkt s cenou v CZK, dostupností, dopravou a vrácením. |
| AI-04 | Facts: Company data, policies and authors as text | fe | AI-02 | E | — | — | Vývojář eSoul: `ai-readiness.mjs` ověří `facts`, `policies`, `article-meta` → kontakt, adresa a IČO jsou text v HTML, politiky jsou odkazované z patičky, články mají autora a datum, údaje odpovídají Firmy.cz. |
| AI-05 | llms.txt: File and Markdown versions of prose pages | be | AI-02 | E | — | — | Vývojář eSoul: `ai-readiness.mjs` ověří `llms-txt` (varování) a `markdown` (informace) → `/llms.txt` je generovaný z obsahu a stránky s převážně textovým obsahem mají Markdown verzi (`Accept: text/markdown` nebo `<url>.md`) oznámenou přes `<link rel="alternate">`. |
| AI-06 | Feeds: Google Merchant, Zboží.cz and Heureka | be+int | AI-03 | E | — | — | Vývojář eSoul: `ai-readiness.mjs` ověří `feeds`, `product-data` → tři feedy generované z dat shopu mají povinná pole a ceny i dostupnost jako stránka produktu. Jen e-shop. |

## 3. Zrušené a přesunuté slices

Zrušený slice zůstává ve své tabulce s rozsahem `—` a buňkou Akceptace
„**Zrušeno.** D. M. RRRR — důvod“. Přesunutý slice si ID ponechává; tady je jen přehled.

| ID | Co se stalo | Kdy | Proč |
|---|---|---|---|

## 4. Počty slices

| Fáze | fe | be | data | pm | Celkem | Hotovo |
|---|---|---|---|---|---|---|
| F0 | 0 | 2 | 0 | 3 | 5 | 0 |
| AI | 3 | 3 | 0 | 0 | 6 | 0 |
| **Celkem** | 3 | 5 | 0 | 3 | 11 | 0 |

## 5. Změny

Každá změna seznamu (nový, rozdělený, zrušený nebo přesunutý slice, změna rozsahu) je jeden
řádek. Nejnovější nahoře.

| Datum | Změna | Důvod | PR |
|---|---|---|---|
| {{DATE}} | Seznam založen se slices F0-01 až F0-05 a AI-01 až AI-06. | Bootstrap projektu. | — |
