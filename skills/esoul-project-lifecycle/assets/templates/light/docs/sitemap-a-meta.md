# Sitemap, meta a SEO plán: {{PROJECT_NAME}}

<!-- Jeden odstavec: jaký web to je (onepager, vícestránkový, s administrací), proč má takovou
     strukturu stránek a jaká klíčová slova má pokrýt. Obsah stránek je v obsah-novy-web.md. -->

Produkční adresa: {{PRODUCTION_URL}}. Preview: {{STAGING_URL}} (`noindex`, basic auth).

## Strom stránek

```
/                                   Úvod
├── /kontakt/
├── /ochrana-osobnich-udaju/        noindex
└── /404                            noindex
```

<!-- Pod stromem důvody pro neobvyklé URL (zachovaná stará URL, přejmenování, nová stránka). -->

Šablony pro návrh (desktop 1440 a mobil 390); stav schválení vede [design-log.md](design-log.md):

1. Homepage
2. Textová stránka (zásady ochrany osobních údajů)
3. 404
4. OG obrázek

## Meta title a description

Title nejvýše 60 znaků, description 110–155 znaků. Délky ověřuje SEO kontrola v CI.

| URL | Primární klíčové slovo | Meta title | Meta description | H1 |
|---|---|---|---|---|
| `/` | TBD | TBD | TBD | TBD |
| `/kontakt/` | TBD | TBD | TBD | Kontakt |
| `/ochrana-osobnich-udaju/` | (noindex) | TBD | TBD | Ochrana osobních údajů |

## OG obrázky

- 1200×630 px, jeden na každou indexovanou stránku, ze sdílené šablony v Pencilu.
- Exporty v `assets/og_images/{slug}.png` (Git LFS); slug je cesta bez lomítek, podstránky
  spojené pomlčkou, homepage `uvod.png`.
- Twitter card `summary_large_image`.

## Strukturovaná data (JSON-LD)

- **Globálně v layoutu:** <!-- typ organizace (LocalBusiness a jeho podtyp, Organization,
  Person), name, url, logo, telephone, email, address, geo, areaServed, identifier (IČ),
  sameAs, případně hasCredential a makesOffer. -->
- **Podstránky:** <!-- Service, Product, Article, CreativeWork, BreadcrumbList; FAQPage u
  stránek s FAQ. -->
- **Bez `AggregateRating` z vlastních recenzí** na vlastním webu — Google je nezobrazí a
  porušuje to jeho pravidla.
- Každý typ projde validátorem Schema.org a Rich Results Test před spuštěním
  ([nasazeni.md](nasazeni.md#spouštěcí-checklist)).

## Technické SEO

- Sitemap generovaná při buildu, bez stránek s `noindex`.
- Kanonické URL v jednotném tvaru (s lomítkem na konci, nebo bez — jedno pro celý web),
  `lang="cs"`, `og:locale=cs_CZ`.
- Obrázky v moderních formátech (AVIF/WebP) se zadaným `width` a `height`, lazy mimo první
  obrazovku, hero s `fetchpriority="high"`.
- Animace neblokují LCP a respektují `prefers-reduced-motion`.
- Obsah a odkazy jsou v HTML ze serveru; nesmí záviset na JavaScriptu.

## Dohledatelnost v AI (GEO)

Cíl: aby web citovaly a doporučovaly AI odpovědi (Google, Gemini, ChatGPT, Perplexity,
Copilot) u dotazů, na které web odpovídá.

1. **Zápisy mimo web (největší vliv):** Google Business Profile, Firmy.cz, Bing Webmaster
   Tools; stejné jméno, adresa, telefon a IČ všude, kde subjekt vystupuje.
2. **Obsah stránek:** přímá odpověď na začátku stránky, FAQ se `FAQPage`, konkrétní fakta
   (oprávnění, oblast, roky praxe, orientační ceny), viditelné datum aktualizace a
   `dateModified`.
3. **Crawlery a strojově čitelné verze:** `robots.txt` výslovně povoluje vyhledávací a AI
   crawlery (`OAI-SearchBot`, `ChatGPT-User`, `GPTBot`, `ClaudeBot`, `Claude-SearchBot`,
   `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `Bingbot`) a hosting ani CDN je
   neblokují; `llms.txt` v kořeni s popisem, službami a odkazy. Přínos `llms.txt` není prokázaný,
   stojí ale málo.
4. **Měření:** v analytice vlastní kanál pro návštěvy z AI asistentů; jednou měsíčně ručně
   vyzkoušet typické dotazy a zapsat výsledek.

## 301 přesměrování ze starého webu

Každá URL starého webu, která v novém stromu není, má trvalé přesměrování na nejbližší
odpovídající stránku. URL bez náhrady vrací 410. Seznam starých URL vychází z
[obsahu starého webu](obsah-stary-web.md), ze sitemap starého webu a z exportu Search Console.

| Stará URL | Nová URL | Kód |
|---|---|---|

## Co dodá klient

Otevřené položky a jejich rozhodnutí. Odškrtnutá položka nese datum a to, jak byla vyřízena;
údaj rozhodnutý bez klienta říká, podle čeho se rozhodl.

- [ ] Logo ve vektoru a favicon
- [ ] Fotky (portrét, zakázky nebo produkty, provozovna)
- [ ] Kontaktní a fakturační údaje k ověření
- [ ] Texty, které píše klient
- [ ] Přístup k doméně a DNS
- [ ] Přístup do Google Search Console, Google Business Profile a Firmy.cz

## Otevřené body

<!-- Body, které nejsou úkolem pro klienta, ale ještě nejsou rozhodnuté. Rozhodnutí s
     alternativami jde do rozhodnuti.md. -->
