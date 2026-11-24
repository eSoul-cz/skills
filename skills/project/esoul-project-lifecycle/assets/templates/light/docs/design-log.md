# Design — log revizí a schválení

Datovaný záznam každé revize návrhu a každého vyjádření klienta. Návrh je v
`docs/design_pencil/` (soubor `.pen` v Git LFS, čte se jen přes Pencil MCP), klikací mockup se
publikuje klientovi přes mockup modul eSoul. Desktop 1440, mobil 390.

## Pravidla

- **Každá revize mockupu má řádek** s datem, číslem revize a tím, co se změnilo.
- **Schválení klientem se zapisuje jen s datem a zdrojem** — e-mail, export připomínek z
  mockup modulu, zápis z hovoru. Zdroj leží v `assets/klient/` (Git LFS), ne jen ve schránce.
  Bez zdroje je stav „předloženo“, ne „schváleno“.
- Připomínky klienta jsou podklad, ne pokyn: co se z nich zapracovalo a co ne (a proč), patří
  do řádku revize.
- Změna schválené šablony je nová revize a nové schválení.
- Vybraný směr designu a vizuální rozhodnutí s alternativami jdou do
  [rozhodnuti.md](rozhodnuti.md); tady je jen odkaz.

## Revize

Nejnovější nahoře.

| Datum | Revize | Co se změnilo | Připomínky klienta | Stav |
|---|---|---|---|---|

<!-- Stav: předloženo, připomínky, schváleno (datum a zdroj), nahrazeno revizí N. -->

## Schválené šablony

| Šablona | Desktop 1440 | Mobil 390 | Schváleno | Zdroj schválení |
|---|---|---|---|---|
| Homepage | čeká | čeká | — | — |
| Textová stránka | čeká | čeká | — | — |
| 404 | čeká | čeká | — | — |
| OG obrázek | čeká | — | — | — |

<!-- Doplňte šablony ze seznamu v sitemap-a-meta.md. Akceptace hotového webu na preview se
     zapisuje jako poslední řádek tabulky Revize se stavem „akceptováno“. -->
