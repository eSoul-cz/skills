# Nasazení — {{PROJECT_NAME}}

Jak web běží, jak se nasazuje, co potřebuje za konfiguraci a co musí platit, než se spustí.
Rozhodnutí o hostingu a preview je [D-06](rozhodnuti.md#d-06-hosting-preview-a-noindex).

## Prostředí

| Prostředí | Adresa | Větev nebo tag | Indexace | Přístup |
|---|---|---|---|---|
| Preview | {{STAGING_URL}} | TBD | `noindex` | basic auth |
| Produkce | {{PRODUCTION_URL}} | TBD | po spuštění ano | veřejný |

## Nasazení

<!-- Pipeline krok za krokem: co ji spouští (push do větve, tag), kontroly (stage Checks),
     build image, registry, nasazení (Komodo stack), kde je vidět výsledek. Rollback:
     nasazení předchozího tagu image. -->

```
push do TBD
   └─ Jenkins (Jenkinsfile)
        ├─ Checks   → kontroly z profilu stacku, červená blokuje merge
        ├─ Build    → image
        └─ Deploy   → TBD
```

<!-- optional: Astro. Stage Checks je povinná: astro check + tsc, lint a format, build,
     Playwright smoke všech rout v 1440 a 390 s pádem na chybu v konzoli a SEO spec
     (title, description, canonical, OG, sitemap, robots). Lighthouse rozpočty a axe jsou
     doporučené v CI a povinné před spuštěním. -->

## Konfigurace a proměnné prostředí

Tajné hodnoty se nezapékají do image ani necommitují; kontejner je dostává za běhu. Veřejné
hodnoty, které statický build zapéká, jsou build argumenty.

| Proměnná | Build / běh | Tajná | Kde se bere | Poznámka |
|---|---|---|---|---|

## DNS a doména

<!-- Kde je doména registrovaná, kdo spravuje DNS, záznamy pro web a poštu (A/AAAA, CNAME,
     MX, SPF, DKIM, DMARC), TTL před přepnutím, kdo přepíná. -->

| Záznam | Typ | Hodnota | Poznámka |
|---|---|---|---|

## Zálohy

| Co | Jak často | Kam | Obnova vyzkoušena |
|---|---|---|---|

<!-- Databáze a nahrané soubory u webu s administrací, záloha poptávek z formuláře,
     perzistentní volume. Uchovávání osobních údajů z formuláře podle D-03. -->

## Basic auth a noindex na preview

Dokud web neběží naostro, je zaheslovaný a neindexovaný třemi zámky zároveň: basic auth, hlavička
nebo meta `noindex` a `robots.txt` s `Disallow: /`. `robots.txt` je z basic auth vyjmutý.
Postup vypnutí je poslední oddíl spouštěcího checklistu.

## Spouštěcí checklist

Web se spouští, až jsou odškrtnuté všechny body. Výsledky měření se zapíší pod checklist s
datem. Body, které nejdou splnit, schvaluje vedoucí projektu a zapíše výjimku s důvodem.

### Obsah a akceptace

- [ ] Klient akceptoval web na preview ([design-log.md](design-log.md)).
- [ ] Žádný text neobsahuje zástupnou značku, TBD ani smyšlený údaj z návrhu.
- [ ] Kontaktní a fakturační údaje jsou ověřené a shodné s Google Business Profile a Firmy.cz.
- [ ] Zásady ochrany osobních údajů odpovídají tomu, co web skutečně sbírá.

### SEO a GEO

- [ ] Každá indexovaná stránka má unikátní title (do 60 znaků), description (110–155 znaků),
  jedno H1 a canonical ([sitemap-a-meta.md](sitemap-a-meta.md#meta-title-a-description)).
- [ ] OG obrázky a Twitter card na každé indexované stránce.
- [ ] JSON-LD prošel validátorem Schema.org a Rich Results Test bez chyb.
- [ ] `sitemap.xml` obsahuje jen indexované stránky; `robots.txt` na ni odkazuje.
- [ ] `robots.txt` povoluje vyhledávací a AI crawlery; hosting ani CDN je neblokují.
- [ ] `llms.txt` v kořeni odpovídá aktuálnímu obsahu.
- [ ] Všechna 301 z [plánu přesměrování](sitemap-a-meta.md#301-přesměrování-ze-starého-webu)
  vyzkoušená proti produkci; žádný řetěz ani smyčka přesměrování.

### Přístupnost

- [ ] axe na všech routách bez nálezů závažnosti serious a critical.
- [ ] Ovládání klávesnicí, viditelný focus, kontrast WCAG 2.2 AA, `prefers-reduced-motion`.
- [ ] Obrázky mají smysluplný `alt`, formuláře popisky a chybové hlášky.

### Výkon (Lighthouse, mobil, každá routa)

- [ ] Performance ≥ 90.
- [ ] Accessibility, SEO a Best Practices 100 (SEO se měří až po vypnutí `noindex`).
- [ ] LCP < 2,5 s, CLS < 0,05.
- [ ] Na konzoli prohlížeče žádná chyba (Playwright smoke v 1440 a 390).

### Bezpečnost

- [ ] HTTPS s platným certifikátem a přesměrováním z HTTP; HSTS.
- [ ] Hlavičky `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` a `frame-ancestors` (nebo `X-Frame-Options`), i v
  blocích serveru s vlastními hlavičkami.
- [ ] Formulář má antispam podle [D-03](rozhodnuti.md#d-03-formuláře-a-antispam), produkční
  klíče CAPTCHA a doručení vyzkoušené testovací poptávkou.
- [ ] Žádné tajemství v repozitáři ani ve veřejném buildu; výchozí hesla změněná.

### Analytika a souhlas

- [ ] Měření a cookie lišta jen v produkci, měřicí skripty až po souhlasu.

### Přepnutí

- [ ] Vypnutý basic auth.
- [ ] Vypnutý `noindex` (hlavička, meta i build proměnná).
- [ ] `robots.txt` s `Allow: /` a odkazem na sitemap.
- [ ] DNS přepnuté na produkci, TLS ověřené na všech variantách domény (s `www` i bez).
- [ ] Rollback popsaný a vyzkoušený.

### Po spuštění

- [ ] Google Search Console: ověřená doména, odeslaná sitemap.
- [ ] Bing Webmaster Tools: přidaný web a sitemap.
- [ ] Google Business Profile: web, služby, fotky, oblast působnosti.
- [ ] Firmy.cz: založený nebo aktualizovaný profil se stejnými údaji.
- [ ] Po 1–2 týdnech: pokrytí indexu a chyby 404 v Search Console, oprava chybějících 301.

### Naměřeno

| Datum | Routa | Performance | Accessibility | Best Practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|---|
