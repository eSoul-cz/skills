---
status: legacy-as-is
source:
  - _reference/cesta-ke-zdroji
snapshot: YYYY-MM-DD
---

<!-- Šablona legacy dokumentu. Kopie se jmenuje podle tématu v kebab-case
     (docs/legacy/order-lifecycle.md); tento soubor zůstává beze změny a nový dokument se
     zapíše do tabulky Dokumenty v index.md. Před uložením smažte komentáře.
     Jen tři nadpisy druhé úrovně: Jak to bylo, Ověřeno, Otevřené otázky. Žádný budoucí čas,
     žádný návrh řešení, jen agregáty, žádné osobní údaje. -->

# Téma — jak to bylo

> **Jak to bylo.** Popis toho, jak původní systém řešil téma, ne požadavek na novou aplikaci.
> Cílový stav definují [GLOSSARY.md](../../GLOSSARY.md) a [docs/adr/](../adr/index.md).

> Cílové řešení: [ADR-NNNN](../adr/NNNN-english-slug.md).

## Jak to bylo

<!-- Podnadpisy třetí úrovně podle tématu (### Stavy, ### Identita a klíče, ### Volání API …).
     Tabulky s agregáty: počty, podíly, typy. Kde zdroj ukazuje jen možnosti (kód pluginu),
     ne skutečné nastavení, napište to. Co zdroje neukazují: „nelze určit“. -->

## Ověřeno

<!-- Ke každému tvrzení zdroj: cesta v _reference/, soubor a řádek kódu, dotaz nad
     anonymizovaným dumpem, sloupec exportu. Dotazy uvádějte tak, aby šly zopakovat. -->

- Tvrzení — zdroj a způsob ověření.

## Otevřené otázky

<!-- Co ze zdrojů nejde určit a na čem záleží. Otázka, kterou musí rozhodnout klient, je
     položka registru docs/podklady/otevrene-otazky.md; sem patří jen odkaz Q-nn. -->

- Co nelze určit a proč na tom záleží — [Q-nn](../podklady/otevrene-otazky.md#q-nn).
