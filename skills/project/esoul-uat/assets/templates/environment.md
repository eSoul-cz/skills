# Testovací prostředí pro UAT

Hesla, tokeny ani TOTP sem nepatří. Jsou v lokálním souboru
`~/.config/esoul-uat/{{REPOSITORY}}.<prostředí>.env` (práva 600), viz skill `esoul-uat`.

## Prostředí

| Klíč | Druh | URL | Zápis a mazání dat | Obnova dat | Verze nasazení |
|---|---|---|---|---|---|
| `uat` | samostatná UAT instance | {{UAT_URL}} | povoleno | {{RESET_PROCEDURE}} | {{VERSION_SOURCE}} |
| `production` | ostrý provoz | {{PRODUCTION_URL}} | **zakázáno**, jen čtení se souhlasem | — | — |

## Role a účty

| Kód | Role | Účet (e-mail) | Poznámka |
|---|---|---|---|
| `A` | Administrátor | {{ADMIN_EMAIL}} | |
| `N` | Nepřihlášený | — | anonymní okno |

Účty, které seed nezakládá, vytváří kapitola 0 (`PRE`) přes aplikaci jako admin.

## Pošta

{{MAIL_ACCESS}}: jak se tester dostane k odchozím e-mailům (Mailpit, log, …).

## Návrh (design)

{{DESIGN_SOURCE}}: cesta k `.pen` souboru, odkaz na Figmu nebo mockup, případně „není“.

## Známá omezení

- {{LIMITATION}}
