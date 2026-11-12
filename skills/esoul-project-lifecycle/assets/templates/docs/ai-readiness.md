# AI readiness — {{PROJECT_NAME}}

Pravidla jsou v eSoul skillu `esoul-project-lifecycle` (`references/ai-readiness.md`); tento
dokument eviduje, jak je plní tento projekt. Web generuje všechny strojové výstupy sám z vlastních
dat, bez externích služeb. Spuštění blokuje každá neprošlá kontrola úrovně `must`, kterou
nekryje potvrzená výjimka níže. Práce je v plánu jako slices AI-01 až AI-06 (AI-06 jen e-shop).

## Politika crawlerů

Výchozí stav: **vše povoleno**, včetně trénovacích botů (GPTBot, ClaudeBot, Google-Extended,
Applebot-Extended, CCBot). Odchylka (klient nechce trénink) je potvrzená výjimka v tabulce níže.

## Jak web generuje výstupy

| Výstup | Adresa | Generuje | Poznámka |
|---|---|---|---|
| `robots.txt` | `/robots.txt` | TBD | povoluje všechny boty, odkazuje na sitemap |
| Sitemap | `/sitemap.xml` | TBD | `lastmod` u každé URL, jen indexovatelné stránky |
| `llms.txt` | `/llms.txt` | TBD | z obsahu webu, odkazy na Markdown klíčových stránek |
| Markdown verze | `Accept: text/markdown` nebo `<url>.md` | TBD | `Vary: Accept`, `<link rel="alternate" type="text/markdown">` |
| JSON-LD | v HTML každé stránky | TBD | jeden graf na stránku z dat webu |
| Feedy (e-shop) | TBD | TBD | Google Merchant, Zboží.cz, Heureka; smazat bez e-shopu |

## Feedy (jen e-shop)

| Feed | URL | Specifikace |
|---|---|---|
| Google Merchant | TBD | Google Merchant Center product data specification |
| Zboží.cz | TBD | https://napoveda.sklik.cz/en/shopping-ads/xml-feed-shopping/specifications/ |
| Heureka | TBD | https://heureka.github.io/xml-feed-specs |

## IndexNow

- Klíč: TBD (hodnota klíče není tajná; je veřejně v souboru)
- Soubor s klíčem: TBD (`/<klíč>.txt`)
- Ping při publikaci a změně: TBD (`api.indexnow.org`, `search.seznam.cz/indexnow`)

## Záznam spuštění

Každé spuštění `ai-readiness.mjs` před přepnutím domény a po něm; výstup do
`assets/ai-readiness/<RRRR-MM-DD>/`.

| Datum | Prostředí | must x/y | should x/y | Report |
|---|---|---|---|---|

## Výjimky

Neprošlou kontrolu `must` lze obejít jen výjimkou, kterou potvrdil vedoucí projektu. Řádek bez
sloupce Potvrdil nebo Datum se ignoruje. Rozsah je `*` nebo začátek cesty URL.

| Kontrola | Rozsah | Důvod | Potvrdil | Datum |
|---|---|---|---|---|
