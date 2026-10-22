# Questions for the client and client sessions (P2, `client-update`)

## Question register

`docs/podklady/otevrene-otazky.md` (template in `assets/templates/docs/podklady/`). The light tier
has no register: what the client owes is a checklist in „Co dodá klient“ and undecided points
are listed in „Otevřené body“, both in `docs/sitemap-a-meta.md`; a decision with alternatives
goes to `docs/rozhodnuti.md`.

- One item per decision that belongs to the client and blocks something. Do not ask what the
  code, the podklady or eSoul can decide; eSoul decisions go to ADRs with deciders `eSoul`.
- Fields: **Otázka**, **Proč na tom záleží**, **Možnosti**, **Doporučení**, **Blokuje** (slices,
  ADRs, screens), **Co platí do odpovědi** (the default eSoul implements while waiting).
- IDs `Q-nn` are never renumbered or reused.
- When answered, move the item to „Uzavřeno rozhodnutím klienta“ with the date and the ADR that
  records the answer. The answer itself lives in the ADR, not in the register.
- An issue that depends on an open question is labelled `needs-info` and says which `Q-nn` in
  `Závislosti`.

## Questionnaire and workshop

- Batch open questions into a questionnaire (`.docx` or PDF) in plain Czech with the
  recommendation pre-filled. Store what was sent and what came back in `assets/`, with a
  transcript note in `docs/podklady/`.
- Before a workshop, prepare an agenda from the blocking questions, ordered by what they block.
- Write the workshop or call down the same day as `odpovedi-klienta-YYYY-MM-DD.md`: who, what
  was decided (by `Q-nn`), what is new, what stays open.

## The `client-update` PR

After every client session, written answers or design review round, open **one PR** that
propagates the change everywhere, in this order:

1. Transcript note in `docs/podklady/` (and raw files in `assets/`).
2. Register: close answered questions, add new ones.
3. ADRs: accept or amend. A never-accepted ADR is amended in place with a dated revision note;
   an accepted ADR gets a dated `> Note of YYYY-MM-DD` or is superseded when its substance flips.
4. `GLOSSARY.md` for new or renamed terms.
5. Guidelines, `docs/data-model.md`, calculation docs and parity tests that the answer changes.
6. Design brief and `.pen` when the answer changes screens (see [design.md](design.md)).
7. Plan: plan status date, `podklady-a-otazky.md`, affected slices, gates, risks.
8. Existing issues: a dated section `## Rozhodnutí YYYY-MM-DD` that „platí přednostně před
   textem výše“, via `esoul-tasking` (preview, approval, read-back). Issues the client cancelled
   are closed as „not planned“ with a comment citing the ADR, after a previewed and approved
   `gh issue close` (see SKILL.md, Guardrails).
9. New slices become new pairs through `tasking`.

Run `audit` afterwards. The PR description lists every question closed and opened, every ADR
touched, and every issue updated, so the client-facing summary can be written from it.
