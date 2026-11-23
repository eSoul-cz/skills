<!-- esoul-guidelines:begin security-and-data -->
# Project guidelines - Security and data

Every eSoul project handles somebody else's data. This file states the rules that hold in every project: secrets, personal data, what agents may see, production access and authorization. Where the application has roles or accounts, the project records its roles and permissions in an ADR.

## Secrets

- Credentials, tokens, API keys, private keys and production environment files MUST NOT be committed. `.env` is not a template; `.env.example` holds placeholders and local defaults only. Non-anonymised database exports and generated documents (PDFs are build artifacts) are not committed either; the repository-wide list is in [workflow.md](workflow.md#repository-rules).
- Production and staging secrets live in Komodo and 1Password. Jenkins reads secrets only through `withCredentials`; a pipeline change MUST NOT print a credential or pass it on a logged command line.
- A new environment variable is added to `.env.example` with a placeholder or an empty value and a comment when its effect is not obvious, and is named in the pull request's deploy notes so that devops add it to the stack before the deploy ([deployment.md](deployment.md#configuration-and-secrets)). Test environment files hold test-only values and leave integration keys empty, so development values never leak into tests.
- A secret is never logged, never exported, never returned unmasked by an API, never included in an error report and never sent by e-mail.
- A secret that was committed or pasted anywhere public is **rotated** (revoked and replaced), not just deleted, and only after that may a suppression entry for the scanner be added.
- Where a pipeline scans for secrets, a scan that scanned nothing (no commits, an empty mount, an unreadable repository) is a failure, never a pass.

## Personal and client data

- Personal data of the client's customers (real names, contacts, addresses, identifiers) and non-anonymised database exports MUST NOT be committed or copied into code, seeders, factories, fixtures, tests, issues, pull requests, commit messages or published documents. Use invented data and reserved example domains.
- Non-public client data (real amounts, rates, prices, documents and any other figure the client has not published) stays in the client's source material. It MUST NOT be copied into issues, pull requests, commit messages or published documents (an anonymised sample of faulty records, below, is the exception for issues and tasks), and it appears in code, seeders, factories, fixtures and tests only anonymised, unless the project records an exception (`CONTEXT.md` or an ADR).
- Client source material that holds no personal data (documents, exports without personal data) MAY live in the repository's Git LFS `assets/`, kept as evidence and never edited. Only source material goes there: a generated PDF is a build artifact and is never committed, not even to Git LFS. A fixture derived from source material is anonymised.
- **Public data exception.** Publicly available data (a public register such as ARES, data the client's application is meant to publish) is not covered by the personal-data ban, and neither are exports of that public data; they need no anonymisation. Whether data counts as public is a per-application decision recorded in the project (`CONTEXT.md` or an ADR). Further personal-data exceptions are allowed case by case with a recorded approval.
- **Anonymised sample of faulty records.** When it is needed to describe a problem, an issue or task MAY contain an anonymised sample of the faulty records: the fields that show the fault are kept, personal and non-public values are replaced. The original data never goes into an issue or task.
- In every case, data is **reviewed before it is committed**: the author checks that it holds nothing personal or private beyond the recorded exceptions, and a reviewer confirms it.
- Screenshots and pasted spreadsheet fragments in issues and pull requests are exports too. Redact them.
- A log line names records by id. It carries no personal data, no amounts and no file content.
- Data that stays in the application has an owner, a purpose and a retention period. Personal data from forms is deleted when its purpose ends or when the person asks.

## Anonymized dumps for agents

- **Anonymized** dumps are the default for development.
- Read-only access to real data is generally allowed, with caution for production. The agent judges from these guidelines and from what it is about to read (personal or sensitive data, production) and asks the owner for confirmation before reading production or sensitive data; dev and staging normally hold no sensitive data. An agent MAY write to data in the **local** environment with the owner's approval (for example running an approved data fix). It MUST NOT write to production data and SHOULD NOT write to staging data. Nothing it reads is exported into the repository, issues or pull requests, except what [Personal and client data](#personal-and-client-data) allows.
- An anonymized dump is produced by a reviewed, repeatable script that replaces personal fields (names, e-mails, phones, addresses, identifiers, free-text notes) and keeps the shape and volume needed for development. The script and its field list are versioned; the raw dump is not.
- Anonymized dumps are stored where the project documents (for example Git LFS) or are produced locally from a documented command. An anonymised dump is never kept in a gitignored folder and handed around by hand; the local folder in the next rule is for the project's own non-anonymised material, which is never handed around.
- A **gitignored local folder** (by convention `_reference/`) MAY hold non-anonymised client material, such as legacy evidence, for the work on the project. It is ignored by Git, never committed and never shared (not in LFS, not in issues or pull requests, not copied into code, fixtures or tests), and what is derived from it is anonymised as above. The project's `.gitignore` names the folder.
- A legacy database is available locally by default as such an anonymized dump, through a read-only account.

## Production access

- Production systems are **read-only by default**. No manual or unapproved command, script, test or seed writes to a production database or to an external system's production environment (payments, banks, accounting, shipping, ERP, e-mail providers), and an agent never does; the reviewed migrations and commands of the data-correction rule below are the approved writes and reach production through the Jenkins deployment. Use test-mode keys, or no key at all so the integration stays switched off.
- Tests never reach a real external system and hold no production keys; the guards are in [testing.md](testing.md#test-doubles).
- Agents MAY trigger Jenkins jobs (builds, image builds, Satis rebuilds) when the owner asks. Agents never deploy outside Jenkins, never push images or artifacts themselves and never change CI credentials. Production deployments run only from Jenkins after a merged pull request.
- A data correction in a real environment ships as a reviewed migration or as a command that goes through the application's normal write path, never as manual SQL. Only what goes through that path reaches the change history.
- In an issue labelled `data-migration`, code or data-model changes are proposed as a separate issue; the data task does not change application code or the data model directly.

## Authorization

- **Default deny.** A route, page, export, command or query without an authorization decision is forbidden. A new surface starts closed and is opened deliberately.
- **Every decision is made on the server**, in one place per question (a policy, a gate, a middleware with a permission map). A role check scattered through controllers, components or templates is a review finding.
- **The frontend only hides what the server already refuses.** A hidden button is a courtesy, not a control.
- A response carries only what the acting user may see. A figure or record the user may not see is **absent from the payload**, not hidden in the page.
- An export, a notification and a background job apply the same rules as the screen they serve.
- The acting user is taken from the authenticated session or token, never from the request body or query.

### Authorization tests

Every protected surface is tested for the allowed and the refused role, and a test fails when any route has no authorization decision (default deny). The rules for these tests are in [testing.md](testing.md#authorization-tests).

## Sessions and accounts

- Applications are served over HTTPS only. Session cookies are `Secure`, `HttpOnly` and `SameSite=Lax` or stricter.
- The session identifier is regenerated on login; logout invalidates it; a password change ends the user's other sessions; deactivating a user ends their sessions.
- Login and password reset are rate limited per account and per client address. A reset or login response does not reveal whether an account exists.
- No seeder creates an account with credentials outside local development. The first account of an environment is created interactively in its container and its password is kept in 1Password.
- Passwords are hashed with the framework's password hashing and are never logged, exported, put in an error report or sent by e-mail. A password reset uses a signed link that expires.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end security-and-data -->
