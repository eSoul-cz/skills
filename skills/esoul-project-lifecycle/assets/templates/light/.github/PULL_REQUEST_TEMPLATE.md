## Co se mění

<!-- Dvě až pět vět. Které stránky nebo sekce a proč.
     Název PR = název Freelo úkolu (a issue, je-li). -->

Closes #

- **Freelo:** <!-- https://app.freelo.io/task/… -->
- **Rozhodnutí:** — <!-- nebo docs/rozhodnuti.md#d-nn -->

## Ověření

<!-- Preview URL, které stránky a v jakých šířkách (1440 / 390),
     co jsi porovnal s návrhem v Pencilu. -->

| Kontrola | Příkaz | Výsledek |
|---|---|---|
| Všechny lokální kontroly | `{{CHECK_COMMAND}}` | |
| Playwright smoke (1440 / 390, konzole, SEO) | | |
| Lighthouse mobil (klíčové šablony) | | |
| AI review | `coderabbit review --agent` / `code-review` | |

## Neověřeno a zbývá

<!-- Co jsi neověřil a proč, co čeká na klienta (texty, fotky, přístupy), co je odložené.
     Pole nenechávej prázdné: „nic“ je odpověď. -->

## Definition of Done

- [ ] Odpovídá schválenému návrhu (`docs/design-log.md`); odchylky jsou výše popsané.
- [ ] Jen tokeny z návrhu, žádné libovolné hodnoty; texty nejsou natvrdo v komponentách.
- [ ] `{{CHECK_COMMAND}}` prošel lokálně a check `Jenkins` je zelený.
- [ ] Meta, OG a strukturovaná data stránek odpovídají `docs/sitemap-a-meta.md`.
- [ ] V kódu ani v PR nejsou osobní údaje ani tajemství.
- [ ] Freelo úkol má vykázaný čas a je ve stavu odpovídajícím realitě.
