---
status: podklady-as-is
source: assets/klient/nazev-souboru.xlsx
snapshot: YYYY-MM-DD
---

<!-- Šablona poznámky k podkladu. Kopie se jmenuje podle podkladu v kebab-case
     (docs/podklady/nazev-podkladu.md); tento soubor zůstává beze změny. Před uložením smažte
     všechny komentáře a nahraďte YYYY-MM-DD, ADR-NNNN a Q-nn skutečnými hodnotami.
     Žádný budoucí čas: poznámka popisuje, co v podkladu je, ne co se postaví. -->

# Název podkladu

> **Důkaz, ne zadání.** Popis souboru `nazev-souboru.xlsx` tak, jak byl předán. Cílový stav
> definují ADR v [`docs/adr/`](../adr/index.md).
>
> Cílové řešení: [ADR-NNNN](../adr/NNNN-english-slug.md).

## Co v podkladu je

<!-- Dva až pět odstavců: jaký je to soubor, kolik má listů nebo kapitol, jestli je vyplněný
     daty, nebo je to prázdná šablona, a jak souvisí s ostatními podklady. -->

## List `Název listu`

<!-- Jeden oddíl na list sešitu nebo kapitolu dokumentu. Citujte doslova: vzorce v podobě,
     v jaké je autor napsal (A1 = …), sloupce, hodnoty číselníků. Odkazy na buňky ve tvaru
     `soubor › list › buňka`. Rozpor nebo vadu popište a odkažte na otázku v registru;
     neopravujte ji. Jména lidí, klientů a částky z reálných dat sem nepatří, pokud nejsou
     nutná k pochopení struktury. -->

## Souhrn: co je závazné

<!-- optional: jen u podkladů s výpočtem nebo procesem. Co z podkladu je závazné (pořadí
     výpočtu, veličiny) a co ne (rozložení buněk, počet řádků, rozdělení do listů). -->

## Otevřené otázky

<!-- Každý bod, který z podkladu nejde vyčíst a blokuje stavbu, je položka registru;
     sem patří jen odkaz. Body, které nic neblokují, se nezapisují nikam. Zodpovězená otázka
     zůstane jako jedna věta s odkazem na ADR, které ji uzavírá. -->

- [Q-nn](otevrene-otazky.md#q-nn) — krátké znění otázky.

## Ověřeno

<!-- Čím je každé tvrzení výše podložené: strojový výtah (nástroj, verze, způsob čtení),
     porovnání s jiným podkladem, konkrétní strana, list nebo buňka. -->

- Tvrzení — zdroj a způsob ověření.
