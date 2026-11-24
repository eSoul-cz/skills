## Kontext

Nalezeno při UAT běhu `{{RUN_ID}}` ({{ENVIRONMENT}}, verze `{{COMMIT}}`, {{DATE}}), scénář
**{{SCENARIO_ID}} {{SCENARIO_TITLE}}**. Report: {{REPORT_LINK}}

| | |
|---|---|
| Role | {{ROLE}} ({{ACCOUNT_EMAIL}}) |
| Zařízení | {{DEVICE}} ({{VIEWPORT}}), {{BROWSER}} |
| URL | {{URL}} |
| Závažnost | {{SEVERITY}} |

## Problém

**Jak navodit:**

1. {{STEP}}

**Očekáváno:** {{EXPECTED}}

**Skutečnost:** {{ACTUAL}}

![{{SCREENSHOT_ALT}}]({{SCREENSHOT_URL}})

<details><summary>Konzole a síť</summary>

```text
{{CONSOLE_AND_NETWORK}}
```

</details>

## Pravděpodobná příčina

{{CAUSE}} (`{{FILE_LINE}}`)

## Návrh opravy

{{FIX}}

## Akceptační kritéria

- [ ] {{CRITERION}}
- [ ] scénář {{SCENARIO_ID}} projde na zařízení {{DEVICE}}

## UAT

**Role:** {{ROLE}}
**Předpoklad:** {{PRECONDITION}}

1. [ ] {{ACTION}}
   → {{EXPECTED}}

## Odkazy

- Scénář: `docs/testing/uat/scenarios/{{CHAPTER_FILE}}` › {{SCENARIO_ID}}
- Běh: `docs/testing/uat/runs/{{RUN_ID}}/`
