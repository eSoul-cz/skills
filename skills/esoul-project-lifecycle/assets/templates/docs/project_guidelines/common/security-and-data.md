# Project guidelines - Security and data

Every eSoul project handles somebody else's data. This file states the rules that hold in every
project: secrets, personal data, what agents may see, production access and authorization.

<!-- optional: application with roles or accounts -->
The roles and permissions of this application are decided in {{AUTHORIZATION_ADR}}.

## Secrets

- Credentials, tokens, API keys, private keys and production environment files MUST NOT be
  committed. `.env` is not a template; `.env.example` holds placeholders and local defaults only.
- Production and staging secrets live in Komodo and 1Password. Jenkins reads secrets only through
  `withCredentials`; a pipeline change MUST NOT print a credential or pass it on a logged command
  line.
- A new environment variable is added to `.env.example` with a placeholder or an empty value and
  a comment when its effect is not obvious. Test environment files hold test-only values and leave
  integration keys empty, so development values never leak into tests.
- A secret is never logged, never exported, never returned unmasked by an API, never included in
  an error report and never sent by e-mail.
- A secret that was committed or pasted anywhere public is rotated, not just deleted.

## Personal and client data

- Real names, contacts, addresses, amounts, rates and documents of the client and its customers
  live only in `docs/podklady/` and `assets/` (Git LFS), as evidence. They MUST NOT be copied into
  code, seeders, factories, fixtures, tests, issues, pull requests, commit messages or published
  documents. Use invented data and reserved example domains.
- Screenshots and pasted spreadsheet fragments in issues and pull requests are exports too.
  Redact them.
- A log line names records by id. It carries no personal data, no amounts and no file content.
- Data that stays in the application has an owner, a purpose and a retention period. Personal
  data from forms is deleted when its purpose ends or when the person asks.

<!-- optional: parity fixtures carry client figures -->
The one exception is the parity fixtures required by {{PARITY_ADR}}: they carry the client's
figures and cell references and nothing else — no names of people, clients or projects
([testing.md](testing.md)).

## Anonymized dumps for agents

- Agents and developers work with **anonymized** data only. An agent MUST NOT receive, read or
  query a non-anonymized production or legacy database, dump or export.
- An anonymized dump is produced by a reviewed, repeatable script that replaces personal fields
  (names, e-mails, phones, addresses, identifiers, free-text notes) and keeps the shape and
  volume needed for development. The script and its field list are versioned; the raw dump is
  not.
- Anonymized dumps live in `assets/` (Git LFS) or are produced locally from a documented command.
  They are never stored in gitignored folders and handed around by hand.

<!-- optional: legacy database for imports -->
The legacy database is available locally only as the anonymized development dump described in
{{LEGACY_DUMP_DOC}}, through a read-only account.

## Production access

- Production systems are **read-only by default**. No command, script, test, seed or agent writes
  to a production database or to an external system's production environment (payments, banks,
  accounting, shipping, ERP, e-mail providers). Use test-mode keys, or no key at all so the
  integration stays switched off.
- Tests are guarded: a network guard blocks connections outside localhost, and integration keys
  are empty in the test environment.
- Agents never run a deployment, never push images and never change CI credentials. Deployments
  run only from Jenkins after a merged pull request.
- A data correction in a real environment ships as a reviewed migration or as a command that goes
  through the application's normal write path, never as manual SQL. Only what goes through that
  path reaches the change history.
- Data tasks (`data-migration` label) propose code or data-model changes as an issue; they do not
  change application code or the data model directly.

## Authorization

- **Default deny.** A route, page, export, command or query without an authorization decision is
  forbidden. A new surface starts closed and is opened deliberately.
- **Every decision is made on the server**, in one place per question (a policy, a gate, a
  middleware with a permission map). A role check scattered through controllers, components or
  templates is a review finding.
- **The frontend only hides what the server already refuses.** A hidden button is a courtesy, not
  a control.
- A response carries only what the acting user may see. A figure or record the user may not see
  is **absent from the payload**, not hidden in the page.
- An export, a notification and a background job apply the same rules as the screen they serve.
- The acting user is taken from the authenticated session or token, never from the request body
  or query.

### Authorization tests

- Every protected surface has a test for the role that is **allowed** and for at least one role
  that is **refused**. A test that only proves access is granted is not sufficient.
- The refused case asserts an explicit status (`403`, `404` or a redirect), never merely
  "not 200".
- Ownership and scope (tenant, customer, sales channel, legal entity) are tested with two users:
  each sees their own records and not the other's.
- Payload restrictions are asserted on the payload (page props, JSON, export rows), not on
  rendered markup.

## Sessions and accounts

- Applications are served over HTTPS only. Session cookies are `Secure`, `HttpOnly` and
  `SameSite=Lax` or stricter.
- The session identifier is regenerated on login; logout invalidates it; a password change ends
  the user's other sessions; deactivating a user ends their sessions.
- Login and password reset are rate limited per account and per client address. A reset or
  login response does not reveal whether an account exists.
- No seeder creates an account with credentials outside local development. The first account of
  an environment is created interactively in its container and its password is kept in
  1Password.
