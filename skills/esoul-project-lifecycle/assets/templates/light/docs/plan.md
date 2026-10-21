# Plán — {{PROJECT_NAME}}

> Stav k **{{DATE}}**. Každý řádek tabulky je jeden slice: **jeden PR a jeden pár GitHub issue
> + Freelo task**, v režimu `freelo-only` jen Freelo task — režim určuje
> [CONTEXT.md](../CONTEXT.md#tasking-convention). Velikosti jsou relativní (**S/M/L**), ne
> člověkodny, a nejsou to značky rozsahu smlouvy; odhad lidského času je ve Freelu.

## Kontext

<!-- Proč web vzniká nebo se předělává, co je na současném stavu špatně a pro koho web je. -->

**Cíl:** TBD

**Mantinely:**

<!-- Co se nemění (obsah, URL, stack, produkce do přepnutí) a co je mimo rozsah. -->

## Rozhodnutí

Rozhodnutí s alternativami vede [rozhodnuti.md](rozhodnuti.md); plán na ně jen odkazuje.
Strom stránek, meta a přesměrování jsou v [sitemap-a-meta.md](sitemap-a-meta.md), texty v
[obsah-novy-web.md](obsah-novy-web.md).

## Výchozí stav

<!-- Co v repozitáři a na produkci je dnes: routy, layouty, odkud se berou texty, tokeny,
     testy a kontroly v CI, dokumentace. U nového webu: „Prázdný repozitář.“ -->

## Strategie vývoje

- Každý slice má vlastní větev a PR; merge jen se zelenými kontrolami v Jenkinsu a lidským
  schválením.
- Preview {{STAGING_URL}} má `noindex` (hlavička i `robots.txt`), basic auth a vypnutou
  analytiku.
- Klient akceptuje na preview; akceptace a schválení návrhu se zapisují do
  [design-log.md](design-log.md). Spuštění řídí
  [spouštěcí checklist](nasazeni.md#spouštěcí-checklist).

<!-- optional: redesign běžícího webu. Integrační větev redesignu z main, preview z ní,
     main se průběžně merguje do redesignu, přepnutí jedním PR do main po otagování
     předchozí verze, rollback nasazením předchozího image. -->

## Identifikátory a stavy

- **ID** `F<fáze>-<nn>` se nikdy nepřečísluje ani nepoužije znovu; zrušený řádek zůstává se
  stavem `zrušeno` a důvodem.
- **Titulek** issue i Freelo tasku je `Kontext: Akční výsledek`, bez ID; ID je v hlavičce issue
  a na prvním řádku popisu Freelo tasku.
- **Stav:** `čeká`, `rozpracováno`, `hotovo`, `zrušeno`.
- **Úkol:** `#N` issue, nebo odkaz na Freelo task v režimu `freelo-only`; `—` dokud nevznikl.

---

## F0 — Podklady a obsah

| ID | Stránka / sekce | Co | Velikost | Úkol | Stav |
|---|---|---|---|---|---|
| F0-01 | — | Freelo: Projekt a konvence v CONTEXT.md | S | — | čeká |
| F0-02 | — | Podklady: Obsah starého webu a média v `assets/` | S | — | čeká |
| F0-03 | — | Obsah: Strom stránek, meta a plán přesměrování | M | — | čeká |
| F0-04 | — | Rozhodnutí: Archetyp, editace obsahu, formuláře a hosting | S | — | čeká |

## F1 — Design

| ID | Stránka / sekce | Co | Velikost | Úkol | Stav |
|---|---|---|---|---|---|
| F1-01 | — | Design: Směr a design systém v Pencilu | M | — | čeká |
| F1-02 | `/` | Design: Homepage desktop a mobil | L | — | čeká |

<!-- Další řádky: jedna šablona nebo stránka na řádek podle stromu v sitemap-a-meta.md,
     OG obrázky. Každá revize a schválení se zapíše do design-log.md. -->

## F2 — Technický základ

| ID | Stránka / sekce | Co | Velikost | Úkol | Stav |
|---|---|---|---|---|---|
| F2-01 | — | CI: Stage Checks v Jenkinsu blokuje merge | M | — | čeká |
| F2-02 | — | Preview: Nasazení s noindex a basic auth | S | — | čeká |
| F2-03 | — | Layout: Tokeny, fonty, hlavička, menu a patička | M | — | čeká |

## F3 — Stránky

| ID | Stránka / sekce | Co | Velikost | Úkol | Stav |
|---|---|---|---|---|---|
| F3-01 | `/` | Homepage: Sekce podle schváleného návrhu | L | — | čeká |
| F3-02 | `/kontakt/` | Kontakt: Formulář s antispamem a doručením | M | — | čeká |

<!-- Jeden řádek na stránku nebo šablonu ze stromu stránek. -->

## F4 — SEO, GEO a spuštění

| ID | Stránka / sekce | Co | Velikost | Úkol | Stav |
|---|---|---|---|---|---|
| F4-01 | — | SEO: Meta, JSON-LD, OG, sitemap, robots a llms.txt | M | — | čeká |
| F4-02 | — | Přesměrování: 301 ze starých URL | S | — | čeká |
| F4-03 | — | Spuštění: Spouštěcí checklist a přepnutí domény | S | — | čeká |
| F4-04 | — | Zápisy: Search Console, Bing, Google Business Profile a Firmy.cz | S | — | čeká |

## Ověření

- Každý PR: zelené kontroly v Jenkinsu a sekce „Ověření“ a „Neověřeno a zbývá“ v popisu PR.
- Preview: vizuální kontrola desktop 1440 a mobil 390, akceptace klientem zapsaná v
  [design-log.md](design-log.md). UAT scénáře v issues tu nahrazuje akceptace na preview.
- Před spuštěním: všechny body [spouštěcího checklistu](nasazeni.md#spouštěcí-checklist).

## Změny plánu

| Datum | Změna | PR |
|---|---|---|
| {{DATE}} | Plán založen. | — |
