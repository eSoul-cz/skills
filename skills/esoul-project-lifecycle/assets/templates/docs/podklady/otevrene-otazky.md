---
status: podklady-as-is
source: docs/podklady/ (všechny předané soubory)
snapshot: {{DATE}}
---

# Otevřené otázky k podkladům

> **Důkaz, ne zadání.** Registr toho, co z předaných podkladů nejde vyčíst a co bez odpovědi
> klienta nelze postavit. Odpovědi se zapisují jako ADR v [`docs/adr/`](../adr/index.md), ne
> sem.

## Jak se registr používá

- Jedna položka = jedno rozhodnutí, které patří klientovi, ne dodavateli. Rozhodnutí, která
  patří eSoul, vede [plán](../plan/podklady-a-otazky.md#5-rozhodnutí-na-straně-esoul).
- U každé položky je uvedeno, **co bez odpovědi nejde postavit** a **co platí do odpovědi**.
  Položka, která nic neblokuje, do registru nepatří.
- **Doporučení je návrh, ne rozhodnutí.** Platí až tím, že ho klient potvrdí a že vznikne
  nebo se upraví ADR.
- Odpověď se nezapisuje do tohoto souboru. Doslovný přepis odpovědí jde do poznámky
  `odpovedi-klienta-YYYY-MM-DD.md`, rozhodnutí do ADR a dotčených issues. Zodpovězená položka
  se z těla vyřadí a zůstane po ní **řádek v tabulce „Uzavřeno rozhodnutím klienta“** s
  odkazem na ADR, které ji uzavírá, a nanejvýš jednořádkovým shrnutím.
- **Čísla se nepřečíslovávají ani nepoužijí znovu.** Poznámky, plán, ADR a issues na ně
  odkazují jako `Q-nn`; přečíslování by ty odkazy tiše rozbilo. Nová otázka dostane další
  volné číslo.
- Otázky na klienta nerozhoduje agent ani vývojář. Do odpovědi se staví podle „Co platí do
  odpovědi“ a slice, kterého se otázka týká, nese štítek `needs-info`.
- Úkoly jsou páry GitHub issue v repozitáři `{{GITHUB_REPO}}` a tasku ve Freelo projektu
  [{{FREELO_PROJECT_NAME}}](https://app.freelo.io/project/{{FREELO_PROJECT_ID}}); „Blokuje“
  jmenuje slices z [plánu](../plan/seznam-slices.md).

---

## Uzavřeno rozhodnutím klienta

**Odpověď zde není; je zde jen ukazatel na rozhodnutí** a nanejvýš jednořádkové shrnutí —
platí ADR.

| Q | Otázka | Uzavřeno v |
|---|---|---|

---

## Otevřené otázky

<!-- Vzor položky. Kotva <a id="q-nn"> drží stabilní odkaz otevrene-otazky.md#q-nn
     nezávisle na znění nadpisu. Otázku formulujte tak, aby jí klient rozuměl bez kontextu
     repozitáře; je to podklad pro dotazník.

<a id="q-01"></a>

### Q-01 · Znění otázky jako otázka?

**Otázka.** Co přesně se ptáme, s odkazem na podklad (`soubor › list › buňka` nebo poznámka).

**Proč na tom záleží.** Co se bez odpovědi pokazí nebo zdraží.

**Možnosti.**
- První možnost a její důsledek.
- Druhá možnost a její důsledek.
- Jiné řešení podle vašich zvyklostí.

**Doporučení.** Kterou možnost navrhuje eSoul a proč.

**Blokuje:** slices F1-03, F1-07; ADR-NNNN.

**Co platí do odpovědi:** výchozí stav, podle kterého se staví, dokud klient neodpoví.
-->

---

## Ověřeno

<!-- Čím jsou rozpory a mezery v otázkách doložené: porovnání podkladů, strojový výtah,
     audit plánu a issues proti podkladům k datu. -->
