# Scenario format

Scenarios are Markdown chapters in `docs/testing/uat/scenarios/NN-slug.md`. The same file is
read by people in a pull request, rendered to PDF, and parsed by `scripts/uat.mjs`. Write it
in the project's language (Czech for Czech clients). Field names below are fixed.

## Chapter

```md
---
id: ZV
title: Registr zvířat
part: A
---

# Registr zvířat

Jeden až tři odstavce: co kapitola pokrývá a na co si dát pozor.

**Předpoklady:**

- Přihlášen jako chovatel s daty z kapitoly 0.

## ZV-01 Seznam zvířat zobrazí jen vlastní zvířata

- **Role:** B
- **Typ:** happy
- **Základ:** kod
- **Zařízení:** all
- **Priorita:** P1
- **Zdroj:** `AnimalIndexTest::breeder_sees_only_own_animals`
- **Předpoklad:** Existuje zvíře z PRE-03.
- **Data:** čte

| # | Akce | Očekávaný výsledek |
|---|---|---|
| 1 | Otevři Ovce → Seznam zvířat. | Tabulka obsahuje jen zvířata chovatele. |
| 2 | Vyhledej ušní známku cizího zvířete. | Tabulka je prázdná, zobrazí se „Žádné záznamy“. |
```

## Fields

| Field | Values | Meaning |
|---|---|---|
| front matter `id` | 2–4 capital letters | chapter prefix, stable |
| front matter `part` | `A`, `B` | A = testable today, B = specified or backend without screens |
| `Role` | role codes from `environment.md`, several with `/` | who performs the steps |
| `Typ` | `happy`, `validace`, `opravneni`, `negativni`, `okrajovy`, `vykon`, `design`, `priprava` | scenario type |
| `Základ` | `kod`, `zadani` | expected result verified in code and tests, or taken from the specification |
| `Zařízení` | `all`, `desktop`, `mobile`, `tablet`, or a list of device IDs | where it runs; default `desktop` |
| `Priorita` | `P1`, `P2`, `P3` | P1 blocks acceptance |
| `Zdroj` | free text | where the rule comes from, for developers |
| `Předpoklad` | free text, may be empty | state needed before step 1 |
| `Data` | `čte`, `zapisuje`, `maže` | drives environment safety checks |
| `Odchylka` | free text, optional | code and specification disagree |
| `UI` | `ne`, optional | no screen yet; steps describe the visible consequence |

The step table has `#`, `Akce`, `Očekávaný výsledek`. For a deviation add a fourth column
`Dle kódu dnes` and fill it only in the affected steps.

Project-specific dimensions from the profile (for example `Prodejní kanál`, `Jazyk`,
`Měna`) are added as further bullet fields with concrete values.

## Writing rules

1. Steps describe what the user does and sees. No SQL, no console commands, no log reading
   unless the scenario is about that output. URLs and exact button labels are allowed.
2. One step, one action, one observable result. Two to six steps per scenario.
3. Quote error messages exactly as the application shows them. When unknown, describe
   ("aplikace odmítne uložení a upozorní na …"); never invent wording.
4. No class, file, or column names in steps; they belong in `Zdroj`.
5. Every chapter has at least two `opravneni` scenarios and at least one `validace` or
   `negativni` scenario, when the product has roles or forms.
6. Concrete values: real account e-mails from `environment.md`, concrete ear tags, prices,
   dates.
7. New scenarios go to the end of the chapter. Removed scenarios keep their ID with
   `- **Zrušeno:** důvod` and no steps, so references in bugs stay valid.
8. Do not describe screens you have not verified. Prefer leaving a gap reported by `verify`.

## Chapter 0

Chapter `00-priprava.md` (prefix `PRE`) prepares accounts and data the other chapters rely
on. Its scenarios have type `priprava`. A run always starts with the PRE scenarios the
selected chapters depend on.

## Design scenarios

Type `design` scenarios point at a design frame from `design-map.md` and describe the state
to reach; the expected result is "odpovídá rámci `<frame>`" plus any explicit checks. The
layout audit runs on every visited page anyway; do not write a scenario per page for it.

## Validation

```bash
node <skill>/scripts/uat.mjs validate docs/testing/uat/scenarios
node <skill>/scripts/uat.mjs stats docs/testing/uat/scenarios
```

`<skill>` is the directory of this skill's `SKILL.md`.
