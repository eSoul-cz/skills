## Co se mění

<!-- Dvě až pět vět. Co PR dělá a proč, ne výčet souborů. Název PR = název issue a Freelo úkolu. -->

Closes #

- **Freelo:** <!-- URL párového úkolu, https://app.freelo.io/task/… -->
- **ADR:** — <!-- nebo docs/adr/NNNN-… -->

## Jak to ověřit

<!-- Kroky pro reviewera. Konkrétní URL (staging/preview), role, rozměry UAT z CONTEXT.md
     a testovací data. Žádná reálná data klienta. -->

## Lokální kontroly

<!-- Co kdy spustit: CONTRIBUTING.md, „Checks“. Vypiš všechny spuštěné kontroly s výsledkem. -->

| Kontrola | Příkaz | Výsledek |
|---|---|---|
| Všechny lokální kontroly | `{{CHECK_COMMAND}}` | |
| Mutační testy (soft gate, pokud je profil stacku má) | | |
| AI review | `coderabbit review --agent` / `code-review` | |

## Rozhodnutí v rámci issue (prosím potvrdit)

<!-- Co jsi musel rozhodnout sám, protože to issue ani dokumentace neříkaly, a proč. Reviewer
     potvrdí, nebo vrátí. Rozhodnutí, které mění cílový kontrakt, patří do ADR, ne sem.
     Žádné — napiš „žádná“. -->

## Zamítnuté nálezy review

<!-- Nálezy CodeRabbitu, lokálního AI review nebo kolegů, které jsi neopravil, každý s důvodem
     a důkazem. Přijaté uniklé mutanty s důvodem. Žádné — napiš „žádné“. -->

## Definition of Done

- [ ] Kód dodržuje `AGENTS.md` a `docs/project_guidelines/`.
- [ ] `{{CHECK_COMMAND}}` prošel lokálně a check `Jenkins` je zelený.
- [ ] Nová nebo změněná doménová logika má test; oprava chyby má regresní test, který bez opravy
      padá. Testy netestují text chybových hlášek.
- [ ] Nový nebo změněný výpočet je ověřený proti zdroji v `docs/podklady/` a test ho pojmenovává.
- [ ] V kódu, testech, fixtures ani v tomto PR nejsou reálná data klienta.
- [ ] Názvosloví odpovídá `GLOSSARY.md`; nový pojem je doplněný v tomto PR.
- [ ] Změna cílového kontraktu má ADR v tomto PR, nebo odkaz na existující `accepted` ADR.
- [ ] Lokální kontroly a AI review jsou výše vypsané s výsledky.
- [ ] UAT scénář z issue je proklikaný a v issue zaškrtnutý.
- [ ] Freelo úkol má vykázaný čas a je ve stavu odpovídajícím realitě.

## Rizika a co jsem neudělal

<!-- Známá omezení, odložené věci, migrační dopady. Pole nenechávej prázdné: „žádná“ je
     odpověď. -->
