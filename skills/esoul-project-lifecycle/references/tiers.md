# Project profile and process tiers

## Project profile

Record the profile in root `CONTEXT.md` under exactly this heading. Scripts and other skills
read it.

```md
## Project profile

- Stack: `laravel`                  # laravel | medusa-nuxt | astro | other:<name>
- Archetype: `—`                    # astro: A-static | B-admin | C-headless
- Product type: `application`       # application | eshop | website-admin | website (UAT packs, esoul-uat)
- Process tier: `full`              # full | light
- Stack profile: `esoul-project-lifecycle/references/stacks/laravel.md`
- Environments: staging https://…, production https://…
- UAT dimensions: Role, Předpoklad, Prodejní kanál, Jazyk, Měna
- Design: `docs/design/projekt.pen` or Figma URL, or `—`
```

Infer the stack from the repository (`composer.json`, `package.json`, `astro.config.*`,
`medusa-config.*`). Propose a tier with the reason, wait for confirmation, then write the
section. For `other:<name>` the stack profile points to the project's own
`docs/project_guidelines/tools.md` (see `stacks/new-stack.md`).

UAT dimensions are the context a tester must set before clicking. Typical examples: role,
sales channel, language, currency, VAT mode, module, period, legal entity. Choose them from
the domain, not from the template.

## Tiers

| Area | `full` (applications) | `light` (websites, small sites with an admin) |
|---|---|---|
| Typical | Laravel, Medusa/Nuxt, integrations, custom domain logic, money | Astro A/B, WordPress, landing pages |
| Client evidence | `docs/podklady/` notes, `docs/legacy/` | `docs/obsah-stary-web.md`, `docs/obsah-novy-web.md`, files in `assets/` |
| Questions | `docs/podklady/otevrene-otazky.md` | „Co dodá klient“ section in `docs/sitemap-a-meta.md` |
| Glossary | `GLOSSARY.md` | Only once a domain appears (admin, enquiries, bookings) |
| Decisions | `docs/adr/` | `docs/rozhodnuti.md` (ADR-lite, `D-nn`) |
| Design | Brief → `.pen` → mockup → review rounds | Same, plus `docs/design-log.md` with dated client approvals |
| Plan | `docs/plan/` phases, gates, scope, slices, risks | `docs/plan.md`: one table of pages and sections |
| Tasking | `github-freelo` pairs | Pairs, or `freelo-only` for small jobs |
| Acceptance | `## UAT` in every issue | Acceptance on the preview plus the launch checklist |
| Gates | Stack profile | Stack profile; Astro needs a Jenkins `Checks` stage |
| Before go-live | Handover and application documentation | `launch` mode: launch-readiness audit in `docs/nasazeni.md` |

Templates: full tier under `assets/templates/docs/`, light tier under
`assets/templates/light/docs/`. Both tiers use the root templates under
`assets/templates/root/`.

## Light-tier phases and gates

| Phase | Output | Gate |
|---|---|---|
| L0 Bootstrap | Root rules, light docs, CONTEXT profile, Jenkins `Checks` green on the skeleton | B0 |
| L1 Content and inputs | `obsah-stary-web.md`, `obsah-novy-web.md`, `sitemap-a-meta.md`, files in `assets/` | — |
| L2 Decisions | `rozhodnuti.md` entries D-01… (archetype, editing model, forms, motion, fonts, hosting) | B1 |
| L3 Design | Brief, `.pen`, mockup bundle, review rounds, approvals in `design-log.md` | B2 (client) |
| L4 Plan and tasking | `docs/plan.md` page table; Freelo tasks or pairs via `esoul-tasking` | B3 |
| L5 Build | Pages and sections one PR each through `esoul-workflow`, accepted on the preview | — |
| L6 Launch | `launch` mode, checklist in `nasazeni.md` complete, client acceptance recorded | B4 (client) |

## Escalating light → full

Propose escalation as soon as any of these appear, and record the decision in `rozhodnuti.md`
or as an ADR:

- an admin with domain logic beyond editing content (workflows, calculations, permissions);
- an integration with an external system (ERP, payments, shipping, CRM, accounting);
- orders, payments, invoices, or personal data beyond a contact form;
- more than one delivery phase or more than one developer;
- a redesign that migrates data, not just content.

Escalation is additive: keep the light documents, add the full-tier structure, move
`rozhodnuti.md` entries that still matter into ADRs (one ADR per decision, linking the `D-nn`).
Never downgrade a `full` project to `light`.
