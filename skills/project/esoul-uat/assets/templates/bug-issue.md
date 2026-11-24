<!--
Český překlad formuláře `.github/ISSUE_TEMPLATE/bug.yml` (stejná pole ve stejném pořadí).
Název issue: `Kontext: Akce výsledek`, bez prefixu kategorie; kategorie je štítek.
-->

## Pozorované chování

Nalezeno při UAT běhu `{{RUN_ID}}` ({{ENVIRONMENT}}, verze `{{COMMIT}}`, {{DATE}}), scénář
**{{SCENARIO_ID}} {{SCENARIO_TITLE}}**. Report: {{REPORT_LINK}}

| | |
|---|---|
| URL | {{URL}} |
| Zařízení | {{DEVICE}} ({{VIEWPORT}}), {{BROWSER}} |

{{ACTUAL}}

![{{SCREENSHOT_ALT}}]({{SCREENSHOT_URL}})

<details><summary>Konzole a síť</summary>

```text
{{CONSOLE_AND_NETWORK}}
```

</details>

## Očekávané chování

{{EXPECTED}}

## Kroky k reprodukci

1. {{STEP}}

## Dopad

{{IMPACT}}

<!-- Jedna z možností formuláře: Blokuje klíčový tok (uživatel nedokončí hlavní akci) · Zkreslená data, částky nebo dokumenty · Odhaluje osobní nebo cizí data · Funkční omezení (existuje obejití) · Kosmetická vada -->

## Prostředí

{{ENVIRONMENT_OPTION}}

<!-- local · staging / preview · production -->

## Role

{{ROLE}}

<!-- Role z `GLOSSARY.md`, nebo „nepřihlášený“, nebo „napříč rolemi“. -->

## Dotčené oblasti

Pravděpodobná příčina: {{CAUSE}} (`{{FILE_LINE}}`)

Návrh opravy: {{FIX}}

- Scénář: `docs/testing/uat/scenarios/{{CHAPTER_FILE}}` › {{SCENARIO_ID}}
- Běh: `docs/testing/uat/runs/{{RUN_ID}}/`

## UAT

**Role:** {{ROLE}}
**Předpoklad:** {{PRECONDITION}}

1. [ ] {{ACTION}}
   → {{EXPECTED}}

## Freelo

{{FREELO_URL}}
