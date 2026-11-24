# Questions for the client and client sessions (P2, `client-update`)

## Questions are issues

An open question is an issue (or a tracker task) labelled `question`, never a file (guidelines
`documentation.md`, Where a piece of knowledge belongs). The tracker is the register; this skill
keeps no copy of it.

- Open one `question` issue per decision that belongs to the client and blocks something, through
  `esoul-task-create` (preview, approval, read-back). Do not ask what the code, the podklady or eSoul
  can decide; eSoul decisions go to ADRs with deciders `eSoul`.
- The issue body has: **Otázka**, **Proč na tom záleží**, **Možnosti**, **Doporučení**,
  **Blokuje** (slices, ADRs, screens) and **Co platí do odpovědi** (the default eSoul implements
  while waiting). The title names the point as an outcome, not a question number; no `Q-nn` prefix.
- Blocked work says which question it waits for: the issue is labelled `needs-info`, names the
  `question` issue under `Závislosti`, and uses GitHub's native `blocked_by` where it applies.
- The light tier uses the same issues. „Co dodá klient“ in `docs/sitemap-a-meta.md` stays the
  checklist of material the client owes; a decision with alternatives goes to
  `docs/rozhodnuti.md`.
- When answered, record the answer where the guidelines say: an ADR (with the issue number in
  its Context), the glossary, or a guideline; then close the `question` issue with a comment
  that links the place (a previewed and approved `gh issue close`, see SKILL.md, Guardrails).
  The answer itself does not live in the issue.

## Questionnaire and workshop

The questionnaire is generated from the open `question` issues at the moment it is sent; no
committed list of questions exists.

1. List them, through an ops subagent when the harness offers one (otherwise yourself):
   `gh issue list --repo <owner/repo> --label question --state open --limit 200 --json number,title,body,labels,milestone`
   (for a Freelo-only project, the Freelo tasks with the `question` label through the official
   `freelo` skill, layer upstream-core).
2. Group the issues by topic (the `Blokuje` field and the area the question touches), order the
   groups by what they block, and keep each question's recommendation pre-filled.
3. Write the questionnaire (`.docx` or PDF) in plain Czech and send it. Store what was sent and
   what came back in `assets/`, with a transcript note in `docs/podklady/`. The questionnaire cites
   the issue number of each question so the answer maps back.
4. Before a workshop, prepare an agenda from the blocking questions, ordered by what they block.
5. Write the workshop or call down the same day as `odpovedi-klienta-YYYY-MM-DD.md`: who, what
   was decided (by question issue `#N`), what is new, what stays open.

## The `client-update` PR

After every client session, written answers or design review round, open **one PR** that
propagates the change everywhere, in this order:

1. Transcript note in `docs/podklady/` (and raw files in `assets/`).
2. Questions: close the answered `question` issues with a link to where the answer is recorded
   (previewed and approved), open new ones for what is new (via `esoul-task-create`).
3. ADRs: accept or amend. A never-accepted ADR is amended in place with a dated revision note;
   an accepted ADR gets a dated `> Note of YYYY-MM-DD` or is superseded when its substance flips.
4. `GLOSSARY.md` for new or renamed terms.
5. Project guideline files, `docs/data-model.md`, calculation docs and parity tests that the
   answer changes. A change of a managed guideline rule is a change to `esoul-cz/guidelines`,
   not part of this PR.
6. Design brief and `.pen` when the answer changes screens (see [design.md](design.md)).
7. Plan: plan status date, `podklady-a-otazky.md` (the table of open questions), affected
   slices, gates, risks.
8. Existing issues: a dated section `## Rozhodnutí YYYY-MM-DD` that „platí přednostně před
   textem výše“, via `esoul-task-create` (preview, approval, read-back). Issues the client cancelled
   are closed as „not planned“ with a comment citing the ADR, after a previewed and approved
   `gh issue close` (see SKILL.md, Guardrails).
9. New slices become new pairs through `tasking`.

Run `audit` afterwards. The PR description lists every question closed and opened, every ADR
touched, and every issue updated, so the client-facing summary can be written from it.
