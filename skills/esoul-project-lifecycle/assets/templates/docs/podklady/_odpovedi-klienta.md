---
status: podklady-as-is
source: assets/klient/nazev-dotazniku-s-odpovedmi.pdf
snapshot: YYYY-MM-DD
---

<!-- Šablona přepisu odpovědí klienta. Kopie se jmenuje odpovedi-klienta-YYYY-MM-DD.md podle
     dne, kdy odpovědi přišly; tento soubor zůstává beze změny. Jeden soubor na jedno sezení
     nebo jeden vrácený dotazník. Před uložením smažte komentáře.
     Pořadí v jednom PR (client-update): tento přepis → registr otázek → ADR (poznámka nebo
     revize) → GLOSSARY.md → plán a slices → sekce „Rozhodnutí YYYY-MM-DD“ v dotčených issues. -->

# Odpovědi klienta z D. M. RRRR

> **Důkaz, ne zadání.** Poznámka zaznamenává, **co klient odpověděl**. Co se podle odpovědí
> staví, žije v ADR v [`docs/adr/`](../adr/index.md) a v issues. Odpovědi jsou přepsané
> doslova, včetně překlepů.

## Co v podkladu je

<!-- Forma (vrácený dotazník, e-mail, hovor, workshop, export připomínek k mockupu), kdo ji
     připravil a kdy, kdy se vrátila, kolik otázek obsahuje a s jakými čísly registru, co
     v ní chybí. U hovoru nebo workshopu: kdo odpovědi předal a z jakého zápisu je přepis.
     Jména jen jako role (klient, správce projektu eSoul). -->

## Odpovědi

<!-- Jeden oddíl na otázku, v pořadí dokumentu. Nadpis nese číslo a znění z registru,
     tělo je doslovná citace. Nic se nedoplňuje ani nevykládá. -->

### Q-nn · Znění otázky z registru

> Doslovná odpověď klienta.

## Co odpovědi nevyřešily

<!-- Body, na které odpověď nedopověděla nebo které vyvolala: nová otázka v registru (Q-nn),
     návrh správce projektu zapsaný jako datovaná poznámka v ADR, stažený požadavek. -->

- **Q-nn:** co zůstalo otevřené — zapsáno jako otázka Q-nn / cílové řešení: ADR-NNNN.

## Kam se odpovědi promítly

| Q | Cílové řešení |
|---|---|
| Q-nn | [ADR-NNNN](../adr/NNNN-english-slug.md) |

## Ověřeno

- Text odpovědí — způsob převodu (např. `pandoc` z vráceného `.docx`, přepis zápisu z hovoru)
  a datum.
- Čísla otázek — porovnání s registrem [otevrene-otazky.md](otevrene-otazky.md) k datu
  odeslání dotazníku.
