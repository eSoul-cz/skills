# {{PROJECT_NAME}} – vývojový plán

Tento adresář obsahuje plán dodávky rozepsaný tak, aby se podle něj dalo stavět: fáze a brány,
kritické cesty, zařazení každého požadavku do rozsahu díla, co blokuje klient, rizika a úplný
seznam vertikálních slices.

**Publikum:** eSoul a klient. Plán je česky jako podklady klienta, technické identifikátory jsou
anglicky a pojmy odpovídají glosáři [GLOSSARY.md](../../GLOSSARY.md).

**Stav: plán, nic z popsaného není implementováno.** <!-- Jednou větou, co v repozitáři
skutečně je (skeleton, tooling, dokumentace) a co ne. Aktualizuje se se stavem plánu. -->

**Živý dokument.** Mění se po každém sezení s klientem. Plán není smlouva ani harmonogram s daty:
smlouva určuje rozsah, plán říká, co je rozhodnuté, co chybí, co je nad rámec a v jakém pořadí
se to staví.

**Termín dokončení:** TBD.

## Cíle plánu

<!-- Tři až šest odrážek: co musí dodávka splnit, aby byla úspěšná (pořadí modulů ze smlouvy,
     parita výpočtů s podklady, kritické integrace, SEO bez ztráty pozic …). Poslední odrážka
     zůstává: -->

- Každý kus práce je slice s jasným zařazením rozsahu, takže je vidět, co je nad smlouvu.
- Kolega může vzít slice, založit z něj issue a Freelo task a postavit ho bez dalšího výkladu.

## Rozcestník

| Soubor | Obsah |
|---|---|
| [Fáze a milníky](faze-a-milniky.md) | Termín, fáze s cíli a ADR, diagram závislostí, brány, kritické cesty, pořadí prací, předání a provozní dopad. |
| [Seznam slices](seznam-slices.md) | Úplný seznam slices po fázích s kategorií, závislostmi, rozsahem, obrazovkami, odkazem na issue a akceptací; zrušené slices, počty a změny. |
| [Rozsah díla a navýšení](rozsah.md) | Co je uvnitř díla, co je navýšení, co je nová položka a co se nestaví, s odůvodněním. |
| [Podklady a otázky](podklady-a-otazky.md) | Co blokuje každá otevřená otázka registru a co platí do odpovědi, co dluží klient, rozhodnutí na straně eSoul. |
| [Rizika](rizika.md) | Rizika dodávky s dopadem, tím, co s nimi plán dělá, a dotčenými slices. |

## Fáze v kostce

Pořadí fází vyjadřuje závislosti, ne kalendář. Fáze se částečně překrývají; o pořadí práce
rozhodují závislosti slices. **Každá fáze je v GitHubu milník** a issue každého slice v něm
sedí; závislosti mezi slices jsou v GitHubu nativní vazby „blocked by“, které Freelo zrcadlí
jako vazby mezi tasky.

| Fáze | Obsah | Brána |
|---|---|---|
| **F0 Příprava** | Rozhodnutí a ADR, podklady od klienta, Freelo, CI, staging, průřezové základy. | G0 |

## Stav plánu

Stav k {{DATE}}.

<!-- Krátký datovaný odstavec za každé sezení s klientem nebo audit: co se rozhodlo, co
     přibylo, co se uzavřelo. Starší odstavce se zkracují, ne mažou. -->

| | Počet |
|---|---|
| ADR celkem | 0 |
| z toho `accepted` | 0 |
| z toho `proposed` | 0 |
| z toho `superseded` | 0 |
| Otevřené otázky v registru | 0 — viz [otevrene-otazky.md](../podklady/otevrene-otazky.md) |
| Slices | viz [počty](seznam-slices.md#4-počty-slices) |
| Úkoly | GitHub issues v milnících fází a tasky `pm` jen ve Freelu |
| Aplikační kód | **žádný** |

Stav každého ADR vede jen [index ADR](../adr/index.md#records). **Co blokuje** a co se od
minulého stavu uzavřelo, je v [podkladech a otázkách](podklady-a-otazky.md).

## Potvrzená rozhodnutí

Rozhodnutí žijí v ADR; plán na ně jen ukazuje a jejich obsah neopakuje. Přijaté ADR je cílový
kontrakt a má přednost před textem plánu.

| Oblast | ADR |
|---|---|

Pravidla samotného plánu:

1. **Práce je rozdělená na vertikální slices.** Každý slice je pár GitHub issue + Freelo task se
   stejným titulkem podle [CONTRIBUTING.md](../../CONTRIBUTING.md); slice `pm` je jen Freelo
   task. Jakmile issue existuje, je zadáním slice ono.
2. **Odhady patří do Freela**, ne do plánu. Odhad je lidský čas (zadání agentovi, kontrola,
   review, UAT, opravy) po 15 minutách; úkol jde do `To Do` jen se schváleným odhadem.
3. **Každý slice nese zařazení rozsahu** (`S`, `P`, `N`, `E`, `—`). Značka zůstává kvůli
   dohledatelnosti, co je nad smlouvu, i když se to staví v původní ceně.
4. **Otázky na klienta vede jen registr**
   [otevrene-otazky.md](../podklady/otevrene-otazky.md). Plán říká jen, co která blokuje a co
   platí do odpovědi.

## Jednotné identifikátory

Identifikátory se nikdy nepřečíslují ani nepoužijí znovu.

- **Fáze:** `F0` příprava, `F1`, `F2` … podle [fází a milníků](faze-a-milniky.md); fáze =
  milník v GitHubu.
- **Slices:** `F<fáze>-<nn>`, například `F1-17`.
- **Brány:** `G0` připraveno k vývoji, `G1` … akceptace fází.
- **Otázky:** `Q-nn` = položka registru [otevrene-otazky.md](../podklady/otevrene-otazky.md).
- **Podklady a přístupy od klienta:** `K-nn` ([podklady a otázky](podklady-a-otazky.md)).
- **Rizika:** `R-nn` ([rizika](rizika.md)).
- **Rozhodnutí:** `ADR-NNNN` ([index ADR](../adr/index.md)).
- **Obrazovky:** kódy rámů z návrhu v `docs/design_pencil/`.
- **Zadání:** GitHub issue `#N` v repozitáři `{{GITHUB_REPO}}`; slice `pm` má jen task ve
  Freelo projektu [{{FREELO_PROJECT_NAME}}](https://app.freelo.io/project/{{FREELO_PROJECT_ID}}).
- **Doménové hodnoty** podle [data-model.md](../data-model.md) a
  [GLOSSARY.md](../../GLOSSARY.md).

## Legenda

### Rozsah

| Značka | Význam |
|---|---|
| **S** | Uvnitř díla podle smlouvy a zadání. |
| **P** | Navýšení nad smlouvu podle [rozsahu](rozsah.md); jak se platí, říká dohoda v rozsahu. |
| **N** | Nová položka rozsahu, kterou smlouva nezahrnuje ani nevylučuje. |
| **E** | Součást dodávky z rozhodnutí eSoul; smlouva ji nejmenuje. |
| **—** | Nestaví se: druhý krok, vypuštěno nebo zrušeno. |

Slice, který obsahuje obojí, nese obě značky (`S+P`) a [rozsah](rozsah.md) říká, která část je
navýšení.

### Kategorie

Kategorie je štítek na obou stranách páru; titulek ji nenese.

| Kat. | GitHub štítek | Použití |
|---|---|---|
| `fe` | `frontend` | Stránky, komponenty, design systém, návrh v Pencilu. |
| `be` | `backend` (u infrastruktury `infrastructure`, u dokumentace `documentation`) | Doména, výpočty, oprávnění, exporty, CI, nasazení, ADR a příručka. |
| `data` | `data-migration` | Datový model, migrace, import, referenční data. Štítek spouští pravidlo pro datové úkoly: žádný přímý zásah do kódu ani modelu, místo toho návrh opravy a nový pár. |
| `+int` | `integration` | Doplňkový štítek k hlavní kategorii u napojení na externí systém. |
| `pm` | — (jen Freelo) | Řízení, práce s klientem, akceptace a předání; bez GitHub issue. |

### Akceptace

Scénář má tvar `Role@kontext: kroky → očekávaný výsledek`. Role a rozměry kontextu jsou
rozměry UAT z [CONTEXT.md](../../CONTEXT.md#project-profile); projekt bez dalších rozměrů
píše `Role: kroky → výsledek`. Technické slices mají roli **Vývojář eSoul**, slices s klientem
roli **Klient**. Scénář s výpočtem jmenuje zdroj (`soubor › list › buňka`), scénář s penězi
konkrétní částku. Odmítnutá role se ověřuje explicitním stavem (`403`, `404`), nikdy jen „ne
200“. Úplný scénář UAT žije v issue; buňka v plánu je jeho jednořádkové shrnutí.

### Další značky

| Značka | Význam |
|---|---|
| **Hotovo.** | Na začátku buňky Akceptace označuje dokončený slice. |
| **Zrušeno.** | Na začátku buňky Akceptace označuje zrušený slice; následuje datum a důvod. |
| `Q-nn` | Otevřená otázka registru; do odpovědi platí výchozí stav z [podkladů a otázek](podklady-a-otazky.md). |
| (podmíněně) | Závislost platí, jen když se realizuje varianta, na kterou odkazuje. |
| TBD | Fakt, který zatím nikdo nedodal; nikdy se nedomýšlí. |

## Co plán neobsahuje

- Odhady pracnosti, jejich součty, ceny práce a jména osob. Odhady jsou ve Freelu.
- Kalendářní data kromě termínu dokončení a termínů bran; jejich stav se aktualizuje u každé
  brány.
- Přepis rozhodnutí z ADR a otázek z registru; plán na ně odkazuje.
- Nic z toho, co smlouva vylučuje — viz [rozsah](rozsah.md#1-co-je-dílo).

## Jak plán aktualizovat

- **Po každém sezení s klientem** se v jednom pull requestu upraví [stav plánu](#stav-plánu),
  [podklady a otázky](podklady-a-otazky.md), dotčené slices, brány a rizika. Odpověď klienta
  se zapisuje do ADR, ne do plánu; zodpovězená otázka se uzavře v registru a dotčená issues
  dostanou sekci „Rozhodnutí YYYY-MM-DD“.
- **ADR jako zdroj pravdy:** když se plán a přijaté ADR rozcházejí, opraví se plán. Rozpor mezi
  zdroji se hlásí, ne potichu rozhoduje.
- **Identifikátory:** ID slices, bran, otázek, podkladů a rizik se nepřečíslují ani nepoužijí
  znovu. Zrušený slice zůstane v tabulce s rozsahem `—`, značkou **Zrušeno.** a zdůvodněním;
  nový slice dostane další volné číslo své fáze.
- **Zadání:** nový slice dostane svůj pár issue + Freelo task a sloupec Issue odkaz na něj;
  issue nese ID slice v hlavičce a sedí v milníku fáze. Od té chvíle žije rozsah v issue a
  řádek slice drží jen ID, odkaz na issue a stav.
- **Hotovo.** se do buňky Akceptace dopíše, až je slice zavřený; od té chvíle je zdrojem pravdy
  o chování kód a testy.
- **Pojmy:** nový pojem patří do [GLOSSARY.md](../../GLOSSARY.md) ve stejném PR, který ho
  zavádí.
- **Diagramy** jsou bloky Mermaid přímo v textu. Každý blok má těsně před sebou popisek
  `<!-- diagram-alt: … -->`, který slovy říká, co diagram ukazuje, a musí projít parserem
  Mermaid.
