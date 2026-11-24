---
name: esoul-website-launch
description: Use when an eSoul public website, or an application with public pages, is about to go live, or when capturing the original-site and launched-site case-study snapshots (před and po). Gives the go-live order of the public-website guideline, the one launch checklist docs/nasazeni.md, the evidence rule and the snapshot script; it runs the gates of esoul-quality-gates and does not own them.
compatibility: Node.js 22+; Playwright, Lighthouse and Google Chrome from ~/.cache/esoul-uat for the snapshot script. Needs the esoul-quality-gates skill.
---

# eSoul website launch

Taking a public site live is a short, ordered procedure around one checklist, plus a before/after
record for the case study. This skill holds that procedure. The rules it verifies belong to the
guidelines (`docs/project_guidelines/public-website.md`, the stack's `deployment.md` and
`tools.md`); the checks belong to `esoul-quality-gates`. Process phases and gates (B0…B5) stay in
`esoul-project-lifecycle`.

Needs `esoul-quality-gates` from the same layer: the launch runs its gates and `scripts/snapshot.mjs`
imports its `scripts/web.mjs`. When it is missing, stop and name it.

## Pick the task

| Task | Read |
|---|---|
| Go live (any public website, light or full tier) | [launch.md](references/launch.md), then work through `docs/nasazeni.md` |
| Capture "před" (project start) or "po" (launch) | [case-study.md](references/case-study.md) |
| Run one gate outside a launch | `esoul-quality-gates` |

## Rules

- **One checklist.** The boxes live in the project's `docs/nasazeni.md`, copied from
  `assets/templates/docs/nasazeni.md` (the light tier gets it at bootstrap; a full-tier project at launch
  preparation, with its links pointing at ADRs and the plan). `references/launch.md` is the
  procedure; neither list is copied into the other.
- **Launch order is the guideline's.** Remove basic auth, turn the preview switch off, deploy, then
  verify headers, `robots.txt`, the sitemap and indexability; nothing else changes in that deploy.
- **Evidence for every box**, and a failing gate is fixed or approved as a deviation by the project
  lead with its reason, never quietly ticked.
- **The switch is the project lead's call.** Prepare, verify and report; remove authentication,
  deploy to production or change DNS only on the lead's explicit instruction for that launch.
- **Case-study snapshots** exist for every project with a public site: "před" at project start,
  "po" at launch, in `assets/case-study/` (Git LFS). Public pages only; personal data never.

## Done when

The checklist is complete with evidence or approved deviations, client acceptance is dated, the
production gate run passed, and the "po" snapshot is committed (or the profile records
`Original site: —` and no snapshots apply).
