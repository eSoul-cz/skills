---
status: podklady-as-is
snapshot: {{DATE}}
---

# Podklady od klienta — {{PROJECT_NAME}}

> **Důkaz, ne zadání.** Soubory a poznámky v tomto adresáři popisují materiály, které klient
> předal, ve stavu uvedeném ve frontmatteru každé poznámky. Jsou to podklady, ne specifikace.
> Cílový stav definují ADR v [`docs/adr/`](../adr/index.md) a pravidla v
> [`docs/project_guidelines/`](../project_guidelines/index.md).

> **Pozor: podklady obsahují reálná data klienta.** Verzují se vědomě, protože jsou nutným
> vstupem pro návrh, plán i parity testy. **Repozitář musí zůstat privátní.**

## Pravidla tohoto adresáře

- **Žádná věta v `docs/podklady/` nezakládá požadavek na aplikaci.** Požadavek vzniká zápisem
  do GitHub issue a — pokud mění cílový kontrakt — přijatým ADR v `docs/adr/`.
- **Poznámka k podkladu nepoužívá budoucí čas.** Popisuje, co v předaném souboru je. Cokoli
  o budoucím řešení patří do ADR nebo do issue.
- Každá poznámka má ve frontmatteru `status: podklady-as-is`, `source:` s cestou k souboru,
  ze kterého je vytěžena, a `snapshot:` s datem stavu, který popisuje. Nová poznámka vzniká
  z [`_poznamka.md`](_poznamka.md), přepis odpovědí klienta z
  [`_odpovedi-klienta.md`](_odpovedi-klienta.md).
- Každá poznámka začíná oddílem „Co v podkladu je“ a končí „Otevřenými otázkami“ a „Ověřeno“
  (čím je každé tvrzení podložené); mezi tím jsou oddíly po listech nebo kapitolách podkladu.
  Návrh cílového řešení se sem **nepíše**; místo něj je řádek „Cílové řešení: ADR-NNNN“.
  Odkaz na `proposed` ADR říká, kde se rozhodnutí povede, ne že už padlo — stav vede jen
  [tabulka Records](../adr/index.md#records).
- **Binární soubory leží v `assets/klient/` a jdou přes Git LFS** (pravidlo `assets/**`
  v `.gitattributes`). **Nikdy se neupravují** — jsou důkazem o tom, co bylo předáno. Opravená
  nebo novější verze je nový soubor s datem v názvu, ne přepis starého. Poznámky jsou výtah
  z nich, ne jejich náhrada.
- Data projektu se nikdy neukládají do gitignorovaných složek (`storage/`, `tmp/`, stažené
  soubory); patří sem a do `assets/`. Jedinou výjimkou jsou neanonymizované důkazy o starém
  systému v gitignorované `_reference/`.
- Otázky, které z podkladů nejde vyčíst, vede jen registr
  [otevrene-otazky.md](otevrene-otazky.md). Poznámka na ně odkazuje číslem `Q-nn`.

## Reálná data

Podklady jsou ostrá provozní data, ne anonymizovaná ukázka. Z toho plyne:

- zůstávají v privátním repozitáři a necitují se do issues, pull requestů, komentářů ani
  screenshotů;
- **nepoužívají se jako zdroj dat pro seedy, fixtury, factory ani demo prostředí** — testovací
  data se vymýšlejí, nekopírují;
- jedinou výjimkou jsou parity fixtury, pokud je předepisuje ADR: nesou jen **čísla** z podkladů
  (částky, hodiny, data, vzorce a odkazy na buňky ve tvaru `soubor › list › buňka`), nikdy jména
  lidí, klientů ani zakázek, popisy činností ani poznámky;
- agent nikdy nepracuje s neanonymizovaným dumpem ani exportem osobních údajů; pro vývoj
  slouží jen anonymizovaná data.

<!-- Doplňte, jaké druhy reálných údajů podklady obsahují (jména, sazby, ceny, kontakty …),
     bez citace samotných hodnot. -->

## Co je čím

<!-- Jeden řádek na každý předaný soubor v assets/klient/. „Pro co je závazný“ říká, co z něj
     smí plán, ADR a implementace převzít; „nic“ je platná odpověď (např. odeslaná verze
     dotazníku). -->

| Soubor | Co obsahuje | Pro co je závazný |
|---|---|---|

### Pro co podklady závazné nejsou

- **Nejsou závazné pro chyby, které obsahují.** Ručně udržované sešity a dokumenty mohou mít
  vadné vzorce nebo rozpory. Shoda se drží tam, kde je podklad správný; vada se přebírá ani
  neopravuje potichu — jde do registru otázek a platí až po potvrzení klientem.
- **Nejsou závazné pro rozložení.** Rozdělení do listů, sloupců nebo kapitol je omezení
  nástroje, ve kterém podklad vznikl, ne požadavek na aplikaci.
- **Nejsou závazné pro rozsah díla.** Rozsah určuje smlouva; co se staví a co ne, říká
  [rozsah v plánu](../plan/rozsah.md).
- **Nejsou závazné pro data.** Řádky v podkladech jsou provozní stav k datu předání, ne cílový
  obsah databáze. Rozsah importu určuje ADR.

## Pořadí čtení

<!-- Číslovaný seznam poznámek v pořadí, ve kterém dávají smysl novému člověku na projektu:
     nejdřív zadání a rozsah, pak kotva domény, pak výpočty, nakonec odpovědi klienta a registr
     otázek. Registr otevrene-otazky.md je vždy poslední. -->

1. [`otevrene-otazky.md`](otevrene-otazky.md) — co se bez klienta rozhodnout pořád nedá.

## Dokumenty

| Dokument | O čem je | Cílové řešení |
|---|---|---|
| [otevrene-otazky.md](otevrene-otazky.md) | registr otázek na klienta a doporučení | — |

## Odkud jsou soubory

Soubory předal klient ({{CLIENT_NAME}}) jako podklad k zadání.

<!-- Kdy a jak který soubor přišel (e-mail, sdílený disk, workshop), kdy byl vložen do
     repozitáře. Co není v souborech zaznamenáno (např. přesné datum předání), se nedomýšlí:
     napište, že zaznamenané není. -->

## Ověřeno

<!-- Čím byl výtah z každého druhu podkladu pořízen: strojový výtah (openpyxl, pandoc, textová
     vrstva PDF), porovnání s vykresleným dokumentem, čtení vzorců bez vyhodnocení … -->
