# Retrofit an existing project

Use for a project that already has code but not the eSoul structure. Doglead 3.0 went through
this in one week. Plemenná kniha has most of the engineering rules but no written tasking
convention, issue templates or contributing guide. The order matters: make CI trustworthy first,
then the rules, then the decisions.

## 1. Audit (read-only)

Run `node <skill>/scripts/conformance.mjs <repo> --github <owner/repo>` and read
[audit.md](audit.md). Also inventory, with evidence:

- what the code actually does per area (modules, integrations, money, auth, data);
- existing specs, plans, client files and where they live;
- runtime bugs and risky behaviour found while reading (each becomes a bug pair);
- CI state, existing gates, and what is skipped.

Legacy files, specs and client files are summarized by `esoul-skills:scout` (Haiku) per area,
with `file:line` evidence, instead of the session reading them. The audit only produces a
report, returned to the user. Do not write it to a PR, Freelo or the repository; any such
write goes through `esoul-tasking` preview and explicit approval (for example as the PR
description of the first retrofit PR or a Freelo-only `pm` task).
Do not create report files in the repository.

## 2. Plan the retrofit as pairs

Create the retrofit work as issue + Freelo pairs up front, via `esoul-tasking`, with native
`blocked_by` so the order is visible. The default order:

1. Critical bugs found in the audit.
2. CI green and required on `main` (ruleset).
3. Agent rules: `AGENTS.md`, `CONTEXT.md`, `CONTRIBUTING.md`, `.github` templates,
   `.coderabbit.yaml`, LFS, `CODEOWNERS`.
4. Linters, strict types, formatter, one local check command. Existing violations go into a
   ratchet (baseline or suppressions file) mapped to gap issues, so the list only shrinks.
5. Glossary from the code and the client's language.
6. ADRs written retroactively. Each one states the target, then `Implementation status as of
   <date>` with the files and tests that implement it and every gap with its issue or
   "No issue". Verify every claim against the code; never describe intent as implemented.
7. Project guidelines with `**Target.** … The code does not do this yet: <where> (#issue)`.
8. `docs/data-model.md`, `docs/legacy/` when a previous system exists, frozen old specs with a
   warning header (moved under `docs/plan/` and marked as historical).
9. Plan and slices derived from three sources only: ADR gaps, open issues, and newly proposed
   feature pairs. See [plan-and-slices.md](plan-and-slices.md).
10. Vendored skills and the skills lock; mutation testing as a local soft gate.

## 3. Rules during retrofit

- One retrofit step per PR. Do not fix product code in passing; open a pair instead.
- Existing ADRs or decision documents in another format stay valid. Do not rename files that
  are linked from issues; add new ADRs in the current format.
- If the project already uses `GLOSSARY.md` for both conventions and vocabulary, move the
  convention sections (Freelo, tasking, commits) into `CONTEXT.md` and leave vocabulary in
  `GLOSSARY.md`.
- Existing issue titles stay as they are. New titles follow the company rule.
- Retire project-local tasking skills once `CONTEXT.md` records the convention.
