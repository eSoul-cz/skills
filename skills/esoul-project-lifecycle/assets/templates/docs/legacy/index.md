---
status: legacy-as-is
source: _reference/ (gitignored, mimo repozitář)
snapshot: {{LEGACY_SNAPSHOT_DATE}}
---

# {{LEGACY_SYSTEM}} — jak to bylo

> **Jak to bylo.** Dokumenty v tomto adresáři popisují původní systém {{LEGACY_SYSTEM}} tak,
> jak ho ukazují zdroje ve stavu k **{{LEGACY_SNAPSHOT_DATE}}**. Jsou to podklady, ne zadání.
> Cílový stav definují [GLOSSARY.md](../../GLOSSARY.md) a [docs/adr/](../adr/index.md).

## Pravidla tohoto adresáře

- **Žádná věta v `docs/legacy/` nezakládá požadavek na novou aplikaci.** Požadavek vzniká
  výhradně zápisem do GitHub issue a — pokud mění cílový kontrakt — přijatým ADR v `docs/adr/`.
- **Legacy dokument nikdy nepoužívá budoucí čas.** Cokoli o budoucnosti patří do ADR nebo do
  issue. Věta typu „nově se bude…“ je tady chyba.
- Každý dokument má ve frontmatteru `status: legacy-as-is`, `source:` s cestou ke zdroji a
  `snapshot:` s datem stavu, který popisuje. Nový dokument vzniká z [`_template.md`](_template.md).
- Uvnitř dokumentu se používají jen nadpisy **„Jak to bylo“**, **„Ověřeno“** (čím je každé
  tvrzení podložené) a **„Otevřené otázky“**. Sekce s návrhem cílového řešení se sem
  **nepíše**; místo ní je citovaný řádek „Cílové řešení: ADR-NNNN“.
- **Co zdroje neukazují, se zapisuje jako „nelze určit“, nikdy se nedomýšlí.** Zdrojový kód
  ukazuje, co systém **uměl**; jak byl nastavený a používaný, z něj nevyplývá.
- **Jen agregáty, žádné osobní údaje.** Počty, rozložení, typy a názvy struktur ano; žádný
  řádek produktu, zákazníka, objednávky, žádné přihlašovací údaje ani hodnota nastavení se
  ze zdrojů nekopíruje.

## Zdroje

Zdroje leží ve složce `_reference/` hlavního checkoutu. Je uvedená v `.gitignore` (a
`.dockerignore`), nikdy nebyla commitnutá a nikdy být nesmí: obsahuje osobní údaje, cizí kód
nebo přístupové údaje a je jen ke čtení. Cesty začínající `_reference/` v těchto dokumentech
odkazují na ni.

Vývoj a AI agenti pracují jen s **anonymizovaným** dumpem nebo exportem. Neanonymizovaný dump
agent nikdy nevidí.

| Zdroj | Co to je |
|---|---|

<!-- Jeden řádek na zdroj: export, dump (jen jako popis, ne obsah), zdrojový kód pluginu nebo
     modulu, dokumentace původního dodavatele, specifikace. Rozsah uvádějte agregovaně
     (počet řádků a sloupců, co v exportu je a co ne). -->

## Co to bylo za systém

| Vrstva | Co zdroje ukazují |
|---|---|

<!-- Platforma, databáze, vyhledávání, integrace (platby, doprava, účetnictví, ERP …),
     frontend. U každé vrstvy odkaz na dokument v této složce; co zdroje neukazují, je
     „nelze určit“. -->

## Mapa pojmů: legacy → GLOSSARY.md

Legacy dokumenty a legacy kód mluví jiným jazykem než glosář projektu. Tahle tabulka je
překlad; nový pojem patří do [GLOSSARY.md](../../GLOSSARY.md), ne sem.

| Legacy pojem | Pojem v GLOSSARY.md | Poznámka |
|---|---|---|

## Dokumenty

| Dokument | O čem je | Cílové řešení |
|---|---|---|

Jak se legacy pole mapují na nový model, je v [docs/data-model.md](../data-model.md).
