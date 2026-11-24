# Rozhodnutí — {{PROJECT_NAME}}

Log rozhodnutí webu (ADR-lite). Rozhodnutí se zapisuje, když měla skutečné alternativy a za
rok se někdo zeptá, proč se neudělalo jinak. Volba nástroje bez důsledků (formátovač, linter)
sem nepatří.

## Pravidla

- Každé rozhodnutí má číslo `D-nn`, které se **nikdy nepřečísluje ani nepoužije znovu**.
- Záznam má datum, stav, rozhodnutí, důvod a **aspoň dvě zamítnuté varianty** s důvodem.
- Stav: `navrženo` (čeká na schválení; není zadání), `platí`, `nahrazeno D-nn`.
- Platné rozhodnutí se nepřepisuje. Doplnění je datovaná poznámka pod záznamem; když se
  rozhodnutí obrací, vznikne nový záznam a starý dostane stav `nahrazeno D-nn`.
- „Rozhodl“ jmenuje stranu (klient, eSoul), ne osobu.
- Rozhodnutí se zapisuje ve stejném PR, který ho zavádí do kódu nebo do plánu.

## Přehled

| D | Rozhodnutí | Stav |
|---|---|---|
| [D-01](#d-01-archetyp-a-render-mód) | Archetyp a render mód | `navrženo` |
| [D-02](#d-02-model-editace-obsahu) | Model editace obsahu | `navrženo` |
| [D-03](#d-03-formuláře-a-antispam) | Formuláře a antispam | `navrženo` |
| [D-04](#d-04-motion) | Motion | `navrženo` |
| [D-05](#d-05-fonty-a-licence) | Fonty a licence | `navrženo` |
| [D-06](#d-06-hosting-preview-a-noindex) | Hosting, preview a noindex | `navrženo` |

---

## D-01 Archetyp a render mód

- **Datum:** TBD
- **Stav:** `navrženo`
- **Rozhodl:** TBD
- **Rozhodnutí:** TBD
- **Proč:** TBD
- **Zamítnuté varianty:** TBD

<!-- Astro: A statický web (obsah v repozitáři), B malý web s klientským adminem (SSR),
     C headless (statický web plněný při buildu z externího CMS). U jiného stacku: platforma
     a způsob vykreslení. Kritéria: kdo a jak často mění obsah, formuláře, výkon, provoz. -->

## D-02 Model editace obsahu

- **Datum:** TBD
- **Stav:** `navrženo`
- **Rozhodl:** TBD
- **Rozhodnutí:** TBD
- **Proč:** TBD
- **Zamítnuté varianty:** TBD

<!-- Obsahové soubory v repozitáři (mění eSoul), vlastní admin s registrem editovatelných
     sekcí, externí CMS. Co klient smí měnit sám a co ne. -->

## D-03 Formuláře a antispam

- **Datum:** TBD
- **Stav:** `navrženo`
- **Rozhodl:** TBD
- **Rozhodnutí:** TBD
- **Proč:** TBD
- **Zamítnuté varianty:** TBD

<!-- Kam formulář odesílá (e-mail přes SMTP, záloha do databáze nebo souboru), honeypot,
     rate limit, CAPTCHA a její souhlas, uchovávání osobních údajů a jak dlouho. -->

## D-04 Motion

- **Datum:** TBD
- **Stav:** `navrženo`
- **Rozhodl:** TBD
- **Rozhodnutí:** TBD
- **Proč:** TBD
- **Zamítnuté varianty:** TBD

<!-- Přechody stránek, scroll animace, knihovny (jen když je motion spec vyžaduje),
     prefers-reduced-motion, rozpočet JS a vliv na LCP. -->

## D-05 Fonty a licence

- **Datum:** TBD
- **Stav:** `navrženo`
- **Rozhodl:** TBD
- **Rozhodnutí:** TBD
- **Proč:** TBD
- **Zamítnuté varianty:** TBD

<!-- Písma, licence pro web, self-hosting místo externího CDN, podmnožina latin-ext kvůli
     češtině, načítání (preload, font-display). -->

## D-06 Hosting, preview a noindex

- **Datum:** TBD
- **Stav:** `navrženo`
- **Rozhodl:** TBD
- **Rozhodnutí:** TBD
- **Proč:** TBD
- **Zamítnuté varianty:** TBD

<!-- Kde web běží, kde zůstává doména a DNS, preview prostředí s noindex a basic auth,
     větev redesignu a přepnutí, zálohy. Podrobnosti provozu jsou v nasazeni.md. -->
