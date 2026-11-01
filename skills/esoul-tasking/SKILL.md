---
name: esoul-tasking
description: Prepare, preview and create eSoul work as a Freelo task or a linked GitHub issue + Freelo task, per the repository's split/no-split convention in CONTEXT.md. Use when invoked, when pairing GitHub issues with Freelo tasks, or under a tasking convention. Requires esoul-freelo-task-authoring; needs approval before writes.
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
`## Tasking convention` and `## Freelo` sections of root `CONTEXT.md`, falling back to
`GLOSSARY.md`, once per session:
`for f in CONTEXT.md GLOSSARY.md; do awk -v h='## Tasking convention' '$0==h{p=1;s=$0 ORS;next} /^## /{p=0} p{s=s $0 ORS; if(NF)n=1} END{if(n)printf "%s",s; exit !n}' "$f" 2>/dev/null && break; done`
(the same with `h='## Freelo'`). Order:

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

Duplicate-search rules (once per batch, reuse for revised previews) are owned by the
companion; here the search also covers GitHub issues. In an orchestrated session the Freelo
and `gh` searches run through `esoul-skills:ops` only, with a compact-fields
brief (`freelo` skill, Delegation); `scout` may search only the local repository. Tasklist IDs and label UUIDs come from the `## Freelo` cache in `CONTEXT.md`
(companion's [project mapping](../esoul-freelo-task-authoring/references/project-mapping.md));
GitHub label names come from one `gh label list` per session.

## 3. Titles, labels, specifications

- Title, labels and estimate follow `esoul-freelo-task-authoring` (title format, labels by
  UUID, estimates). Delta: both entities get the same title, each has at least one existing
  label in its own system (exact GitHub label names, real Freelo UUIDs), and the convention's
  category table (GitHub label ↔ Freelo label) decides the pair.
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

In an orchestrated session `esoul-skills:ops` runs the approved writes and the read-back
verbatim and returns compact fields. Writes are not atomic: on failure stop, read the actual state in both systems, report, and
ask before changed operations. Do not implement the work, move lifecycle states, track time,
close or reopen issues, or assign people without explicit scope.
