# Podklady a otázky

**Stav: plán, nic z popsaného není implementováno.** Dokument říká, co ze strany klienta a ze
strany eSoul ještě chybí a co to blokuje. **Otázky na klienta vede jen registr**
[otevrene-otazky.md](../podklady/otevrene-otazky.md) — jejich znění, možnosti a doporučení jsou
tam a tady se neopakují. Plán k nim přidává jen to, které slices a brány blokují a co platí do
odpovědi. Odpověď klienta se zapisuje do ADR, ne sem.

## 1. Blokátory k {{DATE}}, seřazené podle závažnosti

| # | Blokátor | Blokuje | Poznámka |
|---|---|---|---|

## 2. Otevřené otázky registru

| Q | Téma | Blokuje | Co platí do odpovědi | Brána |
|---|---|---|---|---|

## 3. Co dluží klient mimo registr

Podklady, přístupy a schválení, které nejsou otázkou, ale bez kterých se nedá stavět.

| K | Podklad nebo přístup | Potřeba před | Co blokuje | Do té doby |
|---|---|---|---|---|

## 4. Nerozhodnuté body mimo registr

**Nový nerozhodnutý bod se zapisuje do registru (patří-li klientovi), nebo do tabulky v oddílu
5 (patří-li eSoul) — nikdy jen do issue.** Nic z nich se nedomýšlí; slice, kterého se bod
týká, ho staví jako výslovně neurčený a nese štítek `needs-info`.

<!-- Body, které issues nebo audit nahlásily jako „k potvrzení“ a ještě nejsou roztříděné. -->

## 5. Rozhodnutí na straně eSoul

Rozhodnutí, která patří dodavateli, ne klientovi. Rozhodnutí s alternativami a důsledky je
ADR; ostatní mají řádek tady a odkaz na místo, kde platí.

| Rozhodnutí | Kde | Stav |
|---|---|---|

## 6. Uzavřeno od minulého stavu

<!-- Datovaný odstavec: které blokátory, otázky a podklady se od minulé aktualizace uzavřely
     a čím (ADR, odpovedi-klienta-YYYY-MM-DD.md, slice pm). -->
