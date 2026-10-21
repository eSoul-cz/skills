# Plan and slices (P6, `plan`)

The plan is a living Czech document that the client reads. It turns the contract scope into
phases with gates and into slices, where each slice becomes exactly one issue + Freelo pair.

## Files (full tier, `docs/plan/`)

| File | Contents |
|---|---|
| `README.md` | Goals, file map, phases in brief, plan status as of a date, „Potvrzená rozhodnutí“ (pointers to ADRs only), identifier rules, legend, „Co plán neobsahuje“, „Jak plán aktualizovat“ |
| `faze-a-milniky.md` | Deadline; phase table (goal, outputs, ADRs, blockers, screens, gate); Mermaid dependency diagram with `<!-- diagram-alt -->`; gates `G0…` with criteria; critical path; handover |
| `rozsah.md` | Scope classification: `S` contract, `P` increment, `N` new item, `E` eSoul decision, `—` not built |
| `seznam-slices.md` | The slice table (below) and its change log |
| `podklady-a-otazky.md` | What blocks which slice, ranked; what applies until answered; what the client still owes (`K-nn`) |
| `rizika.md` | `R-nn` with impact, mitigation, slices, owner |

The light tier uses one `docs/plan.md`: per phase a table `ID | Stránka / sekce | Co | Velikost |
Úkol | Stav`, where Velikost is a relative S/M/L size, not a contract scope mark.

## Slice table

```md
| ID | Titulek | Kat. | Závislosti | Rozsah | Obrazovky | Issue | Akceptace |
|---|---|---|---|---|---|---|---|
| F1-17 | Peníze: Zavést Money a směnné kurzy | be | F1-03, Q-12 | S | — | #92 | Obsluha@admin: zadá kurz → ceny v EUR se přepočtou |
```

- **ID** `<phase code>-<nn>` (`F1-17` by default; VONO uses its phase codes `M1-05`, `NT-02`),
  never renumbered or reused. Cancelled slices stay with the reason.
- **Titulek** follows the company title rule and becomes the issue and Freelo title verbatim.
- **Kat.** exactly one of `fe`, `be`, `data`, optionally `+int`; or `pm` for Freelo-only work
  (contracts, workshops, client coordination).
- **Závislosti** slice IDs, questions `Q-nn`, client inputs `K-nn`, or gates.
- **Rozsah** from `rozsah.md`.
- **Akceptace** one-line scenario `Role@kontext: akce → výsledek`. Money states amount,
  currency and VAT mode.
- **Granularity**: a slice is one vertical, independently shippable result: one issue, one PR,
  one UAT scenario. Split when the estimate exceeds 4 h of human time or when it spans frontend and backend in a way that
  can ship separately (two dependent pairs).
- An ADR that still has to be written or accepted is a slice too (`ADR: Přijmout …`).

## Phases and gates

- Phases map 1:1 to GitHub milestones.
- Each gate has explicit criteria; client gates (acceptance on staging) are named as such.
- A slice whose dependency is a `proposed` ADR or open question is planned but stays
  `needs-info` after tasking.

## Keeping the plan true

- No effort estimates and no person names in the plan; estimates live in Freelo.
- Once an issue exists, the issue owns the scope. The slice row keeps only ID → `#issue` and
  state. A finished slice gets „Hotovo.“ at the start of Akceptace in the next docs PR.
- When the plan and an ADR disagree, fix the plan.
- Every decision change updates all affected plan files in one PR (`client-update`).
- `audit` compares the slice table with GitHub and flags drift.
