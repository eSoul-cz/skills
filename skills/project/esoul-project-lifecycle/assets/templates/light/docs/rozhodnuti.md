# Decisions — {{PROJECT_NAME}}

The decision register of the website (ADR-lite): it ranks with ADRs in the sources of truth
(`docs/project_guidelines/domain.md`, Reading order and authority). Write a decision down when it
had real alternatives and someone may ask a year from now why it was not done differently
(`docs/project_guidelines/documentation.md`, ADR or guideline). A tool choice without
consequences (formatter, linter) is a guideline, not an entry. English, like ADRs.

## Rules

- Every decision has a number `D-nn` that is **never renumbered or reused**.
- An entry has a date, a status, the decision, the reason and, when there is one, **at least one
  rejected alternative** with its reason.
- Status uses the ADR vocabulary: `proposed` (awaiting approval; not a specification),
  `accepted`, `superseded by D-nn`.
- An accepted decision is not rewritten. A supplement is a dated note under the entry; when the
  decision flips, a new entry supersedes the old one, which gets `superseded by D-nn`.
- "Decided by" names a party (client, eSoul), not a person.
- A decision is written in the same PR that introduces it into code or the plan.

## Overview

| D | Decision | Status |
|---|---|---|
| [D-01](#d-01-archetype-and-render-mode) | Archetype and render mode | `proposed` |
| [D-02](#d-02-content-editing-model) | Content editing model | `proposed` |
| [D-03](#d-03-forms-and-anti-spam) | Forms and anti-spam | `proposed` |
| [D-04](#d-04-motion) | Motion | `proposed` |
| [D-05](#d-05-fonts-and-licences) | Fonts and licences | `proposed` |
| [D-06](#d-06-hosting-preview-and-noindex) | Hosting, preview and noindex | `proposed` |

---

## D-01 Archetype and render mode

- **Date:** TBD
- **Status:** `proposed`
- **Decided by:** TBD
- **Decision:** TBD
- **Reason:** TBD
- **Rejected alternatives:** TBD

<!-- Astro: A static site (content in the repository), B small site with a client admin (SSR),
     C headless (static site filled at build time from an external CMS). For another stack: the
     platform and the rendering mode. Criteria: who changes content and how often, forms,
     performance, operations. -->

## D-02 Content editing model

- **Date:** TBD
- **Status:** `proposed`
- **Decided by:** TBD
- **Decision:** TBD
- **Reason:** TBD
- **Rejected alternatives:** TBD

<!-- Content files in the repository (eSoul edits), a custom admin with a registry of editable
     sections, an external CMS. What the client may change alone and what not. -->

## D-03 Forms and anti-spam

- **Date:** TBD
- **Status:** `proposed`
- **Decided by:** TBD
- **Decision:** TBD
- **Reason:** TBD
- **Rejected alternatives:** TBD

<!-- Where the form posts to (e-mail over SMTP, a fallback to a database or file), honeypot, rate
     limit, CAPTCHA and its consent, personal data retention and for how long. -->

## D-04 Motion

- **Date:** TBD
- **Status:** `proposed`
- **Decided by:** TBD
- **Decision:** TBD
- **Reason:** TBD
- **Rejected alternatives:** TBD

<!-- Page transitions, scroll animations, libraries (only where the motion spec needs them),
     prefers-reduced-motion, JS budget and the effect on LCP. -->

## D-05 Fonts and licences

- **Date:** TBD
- **Status:** `proposed`
- **Decided by:** TBD
- **Decision:** TBD
- **Reason:** TBD
- **Rejected alternatives:** TBD

<!-- Typefaces, web licences, self-hosting instead of an external CDN, the latin-ext subset for
     Czech, loading (preload, font-display). -->

## D-06 Hosting, preview and noindex

- **Date:** TBD
- **Status:** `proposed`
- **Decided by:** TBD
- **Decision:** TBD
- **Reason:** TBD
- **Rejected alternatives:** TBD

<!-- Where the site runs, where the domain and DNS stay, the preview environment with noindex and
     basic auth, the redesign branch and the switch, backups. Operations details are in
     nasazeni.md. -->
