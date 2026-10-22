# Access and environment

## What to ask the user for

Ask once, as a checklist, only for what the repository cannot answer. Mark each item
as required or optional for the selected chapters.

| Item | Needed for | Where it goes |
|---|---|---|
| Environment URL and kind (test, staging, preview, UAT instance) | every run | `environment.md` |
| Permission to create, change, and delete data; how data is reset (reseed, snapshot) | writing scenarios | `environment.md` |
| One account per role code, or permission to create them as admin | every run | e-mails in `environment.md`, passwords in the secrets file |
| HTTP basic auth, VPN, or IP allowlist | protected environments | secrets file / user's machine |
| Outgoing mail access (Mailpit URL, mail log access) | password reset, notifications, order e-mails, forms | `environment.md` (how), secrets file (credentials) |
| Payment sandbox and test cards | e-shops | secrets file |
| 2FA: test accounts without it, or the TOTP secret | apps with 2FA | secrets file |
| CAPTCHA disabled or a test key | forms | environment configuration |
| Environment with full or migrated data | volume and migration chapters | `environment.md` |
| Design source and access (`.pen` path, Figma link) | design checks | `design-map.md`, profile |
| Version endpoint or footer with the deployed commit | the report header | `environment.md` |

When something is missing, mark the dependent scenarios `blocked` instead of guessing, and
propose an issue for the missing access (through the tasking skill).

## Secrets file

One file per repository and environment, outside every repository:

```text
~/.config/esoul-uat/<repository>.<environment>.env      # chmod 600
```

```dotenv
UAT_BASE_URL=https://uat.example.cz
UAT_BASIC_AUTH_USER=
UAT_BASIC_AUTH_PASSWORD=
UAT_ROLE_A_EMAIL=admin@example.cz
UAT_ROLE_A_PASSWORD=
UAT_ROLE_B_EMAIL=breeder@example.cz
UAT_ROLE_B_PASSWORD=
UAT_MAIL_URL=
UAT_MAIL_USER=
UAT_MAIL_PASSWORD=
UAT_TOTP_A=
```

Role codes are the ones defined in `environment.md`. In `setup` mode, create the file from
`assets/templates/secrets.env` with `chmod 600` and empty values, then ask the user to fill
it in themselves. Never ask for the values in chat. Check that the file exists, has mode
600, and contains every key the selected chapters need, without printing the values.

Seed accounts whose passwords are already public in the repository (for example a
development seeder) may stay in the secrets file too; it keeps one mechanism.

## `environment.md`

Use `assets/templates/environment.md`. It lists environments, role codes with account
e-mails, data reset procedure, mail access procedure, design source, and known limitations
(for example "no environment with migrated data"). It never contains passwords, tokens, or
TOTP secrets.

## Creating accounts during a run

Accounts the catalogue needs but the seed does not create (a second breeder, a customer
without orders) are created in chapter 0 through the application UI as admin, with e-mails
from `environment.md`. Write their passwords into the secrets file locally; tell the user
that you did.
