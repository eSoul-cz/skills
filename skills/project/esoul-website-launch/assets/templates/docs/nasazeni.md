# Nasazení — {{PROJECT_NAME}}

Jak web běží, jak se nasazuje, co potřebuje za konfiguraci a co musí platit, než se spustí.
Rozhodnutí o hostingu a preview je [D-06](rozhodnuti.md#d-06-hosting-preview-and-noindex).

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

<!-- optional: Astro. Stage Checks je povinná a její kroky jsou v guidelinu `framework/astro`
     `tools.md`. Lighthouse rozpočty a axe jsou doporučené v CI a povinné před spuštěním
     (skill `esoul-quality-gates`). -->

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
nebo meta `noindex` a `robots.txt` s `Disallow: /`. `robots.txt` je z basic auth vyjmutý. Pořadí
vypnutí určuje guideline [public-website.md](project_guidelines/public-website.md) (oddíl Preview
gate); oddíl Přepnutí níže ho kopíruje.

## Spouštěcí checklist

Web se spouští, až jsou odškrtnuté všechny body; každý bod má důkaz (výstup příkazu, report,
snímek nebo odkaz). Postup spuštění je ve skillu `esoul-website-launch`, kontroly kvality ve skillu
`esoul-quality-gates`. Výsledky měření se zapíší pod checklist s datem. Bod, který nejde splnit,
schvaluje vedoucí projektu a zapíše výjimku s důvodem.

### Obsah a akceptace

- [ ] Klient akceptoval web na preview ([design-log.md](design-log.md)), s datem.
- [ ] Žádný text neobsahuje zástupnou značku, TBD ani smyšlený údaj z návrhu.
- [ ] Kontaktní a fakturační údaje jsou ověřené a shodné s Google Business Profile a Firmy.cz.
- [ ] Zásady ochrany osobních údajů odpovídají tomu, co web skutečně sbírá.
- [ ] Stránky se vykreslí i bez JavaScriptu; formulář s reCAPTCHA potřebuje JavaScript k odeslání,
  proto je vedle něj kontaktní alternativa (e-mail nebo telefon).

### SEO a GEO

- [ ] Každá indexovaná stránka má unikátní title (do 60 znaků), description (110–155 znaků),
  jedno H1 a canonical ([sitemap-a-meta.md](sitemap-a-meta.md#meta-title-a-description)).
- [ ] Tvar URL s lomítkem na konci nebo bez něj je jeden a shoduje se v canonical, `og:url`,
  sitemapě, odkazech a cílech přesměrování.
- [ ] OG obrázky 1200 × 630 a Twitter card na každé indexované stránce.
- [ ] JSON-LD prošel validátorem Schema.org a Rich Results Test bez chyb.
- [ ] **Brána AI readiness (blokuje spuštění):** `ai-readiness.mjs` na stagingu s `--staging`
  před přepnutím a na produkci hned po něm; každá kontrola `must` prochází, nebo má výjimku
  potvrzenou vedoucím projektu v [ai-readiness.md](ai-readiness.md#exceptions). Reporty v
  `assets/ai-readiness/<datum>/`, výsledek v záznamu spuštění.
- [ ] Všechna 301 z [plánu přesměrování](sitemap-a-meta.md#301-přesměrování-ze-starého-webu)
  vyzkoušená proti produkci, žádný řetěz ani smyčka; odstraněná média vracejí 410.

### Přístupnost

- [ ] axe na všech routách bez nálezů závažnosti serious a critical.
- [ ] Ovládání klávesnicí, viditelný focus, kontrast WCAG 2.2 AA, `prefers-reduced-motion`.
- [ ] Obrázky mají smysluplný `alt`, formuláře popisky a chybové hlášky.

### Výkon (Lighthouse, mobil, každá routa)

`lighthouse-gate.mjs` (skill `esoul-quality-gates`), reporty v `assets/lighthouse/<datum>/`.

- [ ] Performance ≥ 90.
- [ ] Accessibility, SEO a Best Practices 100 (SEO se měří až po vypnutí `noindex`).
- [ ] LCP < 2,5 s, CLS < 0,05.
- [ ] Interní odkazy se přednačítají při najetí myší nebo dotyku; odkazy měnící stav, stahování
      a admin jsou vyloučené.
- [ ] Na konzoli prohlížeče žádná chyba (Playwright smoke v 1440 a 390).

### Bezpečnost

- [ ] HTTPS s platným certifikátem a přesměrováním z HTTP.
- [ ] Bezpečnostní hlavičky podle deployment guidelinu stacku (CSP, HSTS, `nosniff`,
  `Referrer-Policy`, `frame-ancestors` nebo `X-Frame-Options`) na stránce, na statickém souboru
  i na chybové stránce, také v blocích serveru s vlastními hlavičkami; `Permissions-Policy`.
- [ ] Formulář má antispam podle [D-03](rozhodnuti.md#d-03-forms-and-anti-spam), produkční
  klíče CAPTCHA a doručení vyzkoušené testovací poptávkou.
- [ ] Žádné tajemství v repozitáři ani ve veřejném buildu; výchozí hesla změněná.

### Analytika a souhlas

- [ ] Měření a cookie lišta jen v produkci, měřicí skripty až po souhlasu.

### Provoz

- [ ] Zálohy nastavené a jedna obnova vyzkoušená (tabulka Zálohy výše).
- [ ] Monitoring chyb a dostupnosti nastavený.

### Přepnutí

Pořadí podle guidelinu `public-website.md`; v témže nasazení se nemění nic jiného.

- [ ] Snímek původního webu „před“ existuje v `assets/case-study/pred/` (poslední možnost před
  přepnutím); soubor URL se použije znovu pro „po“. Bez původního webu bod škrtni.
- [ ] DNS a TLS připravené, rollback popsaný a vyzkoušený.
- [ ] Vypnutý basic auth.
- [ ] Vypnutý přepínač preview (`noindex` v hlavičce, meta i build proměnná; `robots.txt` s
  `Allow: /` a odkazem na sitemap).
- [ ] Nasazeno; po nasazení ověřené hlavičky odpovědí, `robots.txt`, sitemap a indexovatelnost.
- [ ] DNS přepnuté na produkci, TLS ověřené na všech variantách domény (s `www` i bez).

### Po spuštění

- [ ] Brány kvality na produkci hned po přepnutí: `ai-readiness.mjs` bez `--staging` a
  `lighthouse-gate.mjs` včetně SEO prošly, výsledky jsou níže.
- [ ] Snímek „po“ s týmž souborem URL a zařízeními, včetně Lighthouse
  (`esoul-website-launch`, `references/case-study.md`).
- [ ] Google Search Console: ověřená doména, odeslaná sitemap.
- [ ] Bing Webmaster Tools: přidaný web a sitemap.
- [ ] Google Business Profile: web, služby, fotky, oblast působnosti.
- [ ] Firmy.cz: založený nebo aktualizovaný profil se stejnými údaji.
- [ ] Po 1–2 týdnech: pokrytí indexu a chyby 404 v Search Console, oprava chybějících 301.

### Naměřeno

| Datum | Routa | Performance | Accessibility | Best Practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|---|
