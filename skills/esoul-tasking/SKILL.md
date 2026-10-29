---
name: esoul-tasking
description: Prepare, preview, and create eSoul work as a self-contained Freelo task or a linked GitHub issue and Freelo task. Use when the user invokes esoul-tasking, asks to pair GitHub issues with Freelo tasks, or authors work under a repository tasking convention. Depends directly on esoul-freelo-task-authoring. Resolve and record the split/no-split convention in root CONTEXT.md (falling back to GLOSSARY.md), inspect real code and existing work, and require explicit approval before remote writes. Does not implement work or manage its later lifecycle.
---

# eSoul tasking

Author work in one of two modes:

- `freelo-only`: one self-contained Freelo task per independently deliverable result.
- `github-freelo`: one GitHub issue with the full specification and one Freelo task with the
  management summary per result, with reciprocal links.

This file is the core; read a reference only when the step needs it. Skills already loaded
in this session are not loaded again.

## Companion and access

Follow `esoul-freelo-task-authoring` (its core) for evidence, interview, task shape, labels,
estimates, relations, duplicates, privacy, preview and approval; it uses the `freelo` skill
core for commands. If a companion is missing, stop and give the install command:

```bash
npx skills add eSoul-cz/skills --skill freelo esoul-freelo-task-authoring esoul-tasking --agent codex --global --yes
```

In `github-freelo` mode also require authenticated GitHub access (`gh auth status`,
`gh repo view <repository>`). Never assume a tool name or flag: check CLI help. If a required
capability is missing, stop before writes; never silently switch modes. Never ask for
credentials in chat.

## 1. Resolve the convention

Use applicable `AGENTS.md` content already in context; do not read it again. Read only the
`## Tasking convention` section of root `CONTEXT.md`, falling back to `GLOSSARY.md`
(
`awk '/^## Tasking convention/{f=1;print;next} /^## /{f=0} f' CONTEXT.md`, the whole section up to the next `##`
heading; run it on `GLOSSARY.md` only when `CONTEXT.md` lacks the section). Order:

1. A tasking convention in `AGENTS.md` is authoritative; synchronize it into `CONTEXT.md`.
2. Otherwise respect the convention in `CONTEXT.md` or its `GLOSSARY.md` fallback.
3. Otherwise ask the user to choose `freelo-only` or `github-freelo` and record it.

Recording the convention, one-off overrides and policy changes:
[references/convention.md](references/convention.md).

## 2. Targets and existing work

Resolve exactly one Freelo project through the companion. In `freelo-only` mode an existing
issue may be cited as background, but the Freelo task stays self-contained. In
`github-freelo` mode resolve one GitHub repository (explicit target, repository
configuration, or unambiguous remote), search open and closed issues and active and finished
tasks, and classify each result as a new pair, an existing pair to refine, or a missing
counterpart: [references/github-freelo.md](references/github-freelo.md). Never create labels,
projects, repositories or tasklists as a shortcut.

Search once per batch, not once per preview: keep the results and reuse them when the user
asks for wording changes, and search again only for a task whose scope, outcome or domain
changed. Tasklist IDs and label UUIDs come from the `## Freelo` cache in `CONTEXT.md`
(companion's [project mapping](../esoul-freelo-task-authoring/references/project-mapping.md));
GitHub label names come from one `gh label list` per session.

## 3. Titles, labels, specifications

- Same title for both entities: `Context: Actionable result`. Categories are existing labels
  in each system, not `[FE]`/`[BE]`/`[DATA]` prefixes, unless the repository's tasking
  convention defines prefixes. At least one existing label on each entity; real Freelo UUIDs
  and exact GitHub label names. The convention's category table (GitHub label ↔ Freelo label)
  decides the pair.
- `freelo-only`: the companion's full self-contained description, including verification.
- `github-freelo`: the issue is the source of truth (outcome, verified areas, scope,
  acceptance criteria, verification, dependencies as native `blocked_by`, link to Freelo);
  the Freelo description is a short summary with the issue link in the first paragraph.
  Estimates live only in Freelo.
- Verification is a `## UAT` section, the one format every eSoul skill uses (lifecycle,
  UAT bugs, freelo-only descriptions):

  ```md
  ## UAT

  **Role:** chovatel (Breeder)
  **Předpoklad:** existuje zvíře bez skutečné ušní známky
  <one line per UAT dimension from `CONTEXT.md › ## Project profile`, e.g. kanál / jazyk / měna>

  1. [ ] Otevři detail takového zvířete.
     → V poli ušní známky je „známka neuvedena“.
  ```

  One empty checkbox per step; the expected result on the indented `→` line, not its own
  checkbox; concrete values; a negative scenario when another role, channel or currency must
  not see the result; amounts with currency and VAT mode for anything touching money. No SQL,
  shell or logs in the steps; those belong to the acceptance criteria. For purely technical
  work with no visible effect say so explicitly and give a concrete technical check.

## 4. Preview and approve

Use the companion's preview and exact-approval rules, plus: stored and effective mode; in
`github-freelo` the repository, exact issue title and body, issue labels, the Freelo summary
and metadata, both duplicate searches, and every remote operation (reciprocal links,
`blocked_by`, Freelo relations, edits to existing entities). Approval covers the exact
preview and the mechanical link substitutions only.

## 5. Write and read back

`freelo-only`: run the companion's write and verify steps. `github-freelo`: issue first
(`gh issue create --body-file`), then the Freelo task with the real issue URL, then
`blocked_by` (uses the blocking issue's database `id`) mirrored as Freelo relations, then the
Freelo link in the issue; read back both sides. Full order and failure handling:
[references/github-freelo.md](references/github-freelo.md).

Writes are not atomic: on failure stop, read the actual state in both systems, report, and
ask before changed operations. Do not implement the work, move lifecycle states, track time,
close or reopen issues, or assign people without explicit scope.
