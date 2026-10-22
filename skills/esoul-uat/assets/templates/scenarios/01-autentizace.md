---
id: AUT
title: Přihlášení a účet
part: A
---

# Přihlášení a účet

Ukázková kapitola: přihlášení, odhlášení a úprava vlastního profilu. Nahraď ji kapitolami
projektu; formát popisuje `references/scenario-format.md` ve skillu `esoul-uat`.

**Předpoklady:**

- Účty rolí podle `environment.md`.

## AUT-01 Přihlášení platným účtem

- **Role:** A
- **Typ:** happy
- **Základ:** kod
- **Zařízení:** all
- **Priorita:** P1
- **Data:** čte
- **Předpoklad:** Odhlášený prohlížeč.

| # | Akce | Očekávaný výsledek |
|---|---|---|
| 1 | Otevři přihlašovací stránku. | Zobrazí se formulář s polem E-mail a Heslo. |
| 2 | Vyplň e-mail a heslo admina a klikni Přihlásit. | Otevře se úvodní stránka aplikace s menu. |

## AUT-02 Špatné heslo

- **Role:** N
- **Typ:** validace
- **Základ:** kod
- **Priorita:** P1
- **Data:** čte
- **Předpoklad:** Odhlášený prohlížeč.

| # | Akce | Očekávaný výsledek |
|---|---|---|
| 1 | Vyplň e-mail admina a heslo `spatne-heslo`. | Pole jsou vyplněná. |
| 2 | Klikni Přihlásit. | Aplikace přihlášení odmítne a uživatel zůstane na přihlašovací stránce. |

## AUT-03 Nepřihlášený neotevře administraci

- **Role:** N
- **Typ:** opravneni
- **Základ:** kod
- **Priorita:** P1
- **Data:** čte
- **Předpoklad:** Odhlášený prohlížeč.

| # | Akce | Očekávaný výsledek |
|---|---|---|
| 1 | Zadej do adresy URL stránky, která vyžaduje přihlášení. | Aplikace přesměruje na přihlašovací stránku. |
| 2 | Přihlas se jako admin. | Otevře se původně požadovaná stránka. |

## AUT-04 Uživatel si nezmění roli přes profil

- **Role:** B
- **Typ:** opravneni
- **Základ:** zadani
- **Priorita:** P1
- **Data:** zapisuje
- **Předpoklad:** Přihlášen jako chovatel.
- **Odchylka:** Profil dnes přijímá i roli (příklad odchylky).

| # | Akce | Očekávaný výsledek | Dle kódu dnes |
|---|---|---|---|
| 1 | Otevři Nastavení → Profil. | Role je zobrazená jen ke čtení. | |
| 2 | S vývojem odešli uložení profilu s rolí Administrátor. | Role se nezmění. | Role se změní na Administrátor. |
