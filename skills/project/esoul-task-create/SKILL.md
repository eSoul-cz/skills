---
name: esoul-task-create
description: Use when asked to add, specify, split, revise or pair an issue or Freelo task, or to turn a request, feature, bug, spike, data change or open question into tracked work, in the mode the repository's tasking convention names (`freelo-only` or `github-freelo`). Covers evidence, interview, task shape, labels, estimate, duplicate search and an approved preview before every write; S work has a minimal path. Builds on the official `freelo` skill; moving and closing tasks is esoul-task-work.
---

# eSoul task creation

Author work in one of two modes, the repository's `## Tasking convention` decides:

- `freelo-only`: one self-contained Freelo task per independently deliverable result.
- `github-freelo`: one GitHub issue with the full specification and one Freelo task with the
  management summary per result, with reciprocal links.

Every change has an issue and/or task (`docs/project_guidelines/workflow.md` › Tasking), so
this skill also serves S work through the minimal path below. The small-administrative-work
exception (dependency updates, `Jenkinsfile` changes and similar) is the user's decision: a
standing decision recorded in `## Tasking convention` applies as written
([references/convention.md](references/convention.md) › Standing decisions); otherwise you ask
and never assume.

Work over exactly one confirmed Freelo project (and one GitHub repository) per run. Read a
reference only when its step needs it.

## Minimal path (S work)

S work is one obvious change: a few files, no design choice, no new dependency. It needs only:

1. The outcome as the title, one observable acceptance criterion and one existing category label.
   No interview, no subtasks, no `## UAT` section: the criterion carries the verification.
2. One duplicate search by the words of the title, once per system.
3. One preview line to approve: `<tasklist> · <title> · <label> · <criterion> · duplicates: none|<link>`
   (a `github-freelo` pair shows issue and task in that one line).
4. The write and read-back of step 6.

The tasklist is `Backlog` unless the user gives an approved estimate (then `To Do`). Anything
that grows beyond this (a design choice, several results, a user-visible flow that needs
scenarios) leaves the minimal path and takes the full flow below.

## 0. Tools and context

- Freelo: the official `freelo` skill (layer `upstream-core`) for command syntax; the Freelo MCP
  tools when mounted, otherwise the `freelo` CLI with `--agent`. eSoul's working rules (states,
  estimate unit, label gotchas) are `esoul-task-work` › `references/freelo.md`. The command
  sequence of the write step, with the CLI and MCP name of each operation:
  [references/cli-recipe.md](references/cli-recipe.md). When the official skill is missing, ask
  the user to run `npx @esoul-cz/skills install upstream-core` or read `freelo <group> --help`.
- `github-freelo`: authenticated GitHub access (`gh auth status`, `gh repo view <repository>`);
  look up flags with `gh <command> --help`. A missing capability stops the run before writes; it
  never switches the mode. Credentials are never asked for in chat.
- Use `AGENTS.md` content already in context. Read only the `## Tasking convention`, `## Freelo`
  and `## Tracker` sections of root `CONTEXT.md` (fallback `GLOSSARY.md`), once per session, and
  `GLOSSARY.md` entries for the domain terms the task uses. Repository instructions are
  authoritative.
- Delegation: searches and, after approval, the approved writes and read-back go to a cheap
  subagent when the harness offers one (exact commands, compact fields back: IDs, titles, states,
  URLs); otherwise run them yourself. The preview and the task wording stay with you.

## 1. Resolve the convention and targets

1. Convention: a convention in `AGENTS.md` is authoritative (synchronise it into `CONTEXT.md`);
   else the one in `CONTEXT.md` or its `GLOSSARY.md` fallback; else ask the user to choose
   `freelo-only` or `github-freelo` and record it. Recording, one-off overrides and policy
   changes: [references/convention.md](references/convention.md).
2. Freelo project: an explicitly named one, else the `## Freelo` mapping, else infer a candidate
   and ask the user to confirm it; after an inferred confirmation record the mapping
   ([references/project-mapping.md](references/project-mapping.md)). The same section caches
   tasklist IDs and task-label UUIDs; load them from Freelo only when the cache is missing or a
   cached value is rejected. Projects, repositories, tasklists and labels are never created as a
   setup shortcut; a missing one is raised with the user.
3. `github-freelo`: one GitHub repository (explicit target, repository configuration, or an
   unambiguous remote), and each result classified as a new pair, an existing pair to refine or a
   missing counterpart: [references/github-freelo.md](references/github-freelo.md).

Done when the mode, the project (and repository) are confirmed and the cache is loaded.

## 2. Evidence before questions

- Inspect the codebase for real modules, domain terms, files, routes and patterns before asking
  anything answerable locally.
- Search for duplicates and related work once per batch, before the first preview: by outcome,
  domain terms, module and file names, in Czech and English, active and finished tasks (and, in
  `github-freelo`, open and closed issues). Reuse the results for revised previews; search again
  only for a task whose scope or outcome changed. Handling of hits:
  [references/duplicates.md](references/duplicates.md).
- Language per place follows `CONTEXT.md › ## Language per place` (default: Czech descriptions
  with established programming terms kept; domain concepts as `chovatel (Breeder)` when code uses
  an English name; title language in Title below).
- Secrets, credentials, production personal data and raw sensitive datasets stay out of tasks
  and issues; the rule and its anonymised-sample exception are
  `docs/project_guidelines/security-and-data.md` › Personal and client data.

Skip the interview when the request is complete. Otherwise ask in rounds of independent
questions, each with a recommended answer ([references/interview.md](references/interview.md)).

Done when every task of the batch has outcome, scope, acceptance criteria, verification, labels
and estimate answered, or listed as an unverified assumption in the preview.

## 3. Shape the task

- **Title:** the shape and the rules (context, no category prefix, no slice ID, the same title on
  issue and task) are `docs/project_guidelines/workflow.md` › Tasking. Choosing the context and
  the title language: [references/task-content.md](references/task-content.md) › Title. The PR
  title is derived from it when the PR is opened (`esoul-task-work`).
- **Description:** the done state is clear and every task or issue has acceptance criteria (one
  observable line suffices for simple work). Short narrative for simple work, optional sections
  (`Cíl`, `Technický kontext`, `Rozsah`, `Mimo rozsah`, `Akceptační kritéria`, `Závislosti`,
  `Ověření`, `Podklady`) for complex work. `freelo-only`: self-contained. `github-freelo`: the
  issue is the source of truth and the Freelo description is a short summary with the issue link
  in the first paragraph; estimates live only in Freelo. Details:
  [references/task-content.md](references/task-content.md),
  [references/github-freelo.md](references/github-freelo.md).
- **Verification:** the `## UAT` format of [references/uat.md](references/uat.md).
- **Question:** a decision someone must make is not a task. It is an issue labelled `question`
  (`freelo-only`: a task with that label), titled as the decision asked, never a file. It has
  no category label, no `## UAT` and no estimate; its body follows the repository's `question`
  issue form (`.github/ISSUE_TEMPLATE/question.yml`), and in `github-freelo` it has no Freelo
  counterpart. Its answer is recorded as an ADR, a glossary entry or a guideline, and the
  question is closed with a link to that place. Work that depends on it gets `blocked_by` and is
  not ready to start.
- **Subtasks** are real implementation steps of one result, never lifecycle steps; independently
  deliverable parts are separate tasks.
- **Estimate:** the unit and the split rule are `esoul-task-work` › `references/freelo.md`
  (States and estimates); state the confidence.

## 4. Metadata

Resolve the tasklist by name from the cache. `To Do` only with a complete description, an
approved estimate and no blockers (no assignee needed: an unassigned `To Do` task is ready for
anyone); otherwise `Backlog`, which may lack an estimate (whoever picks the task up gets it
estimated first, `esoul-task-work` › Pick up the task); `LTT` (or `Project Management`) only after the user confirms
recurring work. New work starts in those lists. The estimate, due date and an assignee, if one
is wanted, come from the user. Each task and each issue gets at least one label that already
exists, by UUID in Freelo and by exact name on GitHub (a question needs none). A
`github-freelo` repository also sets the issue's milestone as its `## Tasking convention`
says. Relations, and refining existing tasks by state:
[references/duplicates.md](references/duplicates.md).

**Hotfix.** A hotfix (`docs/project_guidelines/workflow.md` › Hotfix) may be written after the
fix is pushed and may skip `Backlog` and the estimate: it goes straight to `In progress`, and
the estimate is added afterwards (the person's time, as in step 3). A workaround hotfix gets a
follow-up issue (task) for the root cause, created the normal way with a preview.

## 5. Preview and approve

Before any write show one preview, grouped by task or pair: project and tasklist with
rationale, exact title and description (Markdown), subtasks, labels, estimate and confidence,
assignee, due date, milestone, duplicate-search results and relations, unverified assumptions.
`github-freelo` adds: stored and effective mode, the repository, the exact issue title, body,
labels, milestone and assignee, the Freelo summary and metadata, and every remote operation
(reciprocal links, `blocked_by`, Freelo relations, edits to existing entities). The user may
approve all or selected results. Approval covers the exact preview and the mechanical link
substitutions only; a material change needs a new preview, and silence or approval of an earlier
draft is not approval. The minimal path previews in one line.

Done when the user has approved the exact preview.

## 6. Write and read back

1. Prerequisites first, then each task or pair: `freelo-only`: task, description, subtasks,
   labels, estimate, relations. `github-freelo`: issue first (`gh issue create --body-file`),
   then the Freelo task with the real issue URL, then `blocked_by` mirrored as Freelo relations,
   then the Freelo link in the issue. Full order and failure handling:
   [references/github-freelo.md](references/github-freelo.md).
2. Read back every created or modified entity (tasklist, content, subtasks, labels, estimate,
   assignee, due date, relations, and in `github-freelo` both sides with their links) and return
   clickable links.

Writes are not atomic. On a partial failure stop the dependent writes, read the actual state in
both systems, report what succeeded and what remains, and ask before changed operations.

Done when the read-back matches the approved preview. Moving tasks through states, tracking time,
closing issues and assigning people are `esoul-task-work`, not this skill.
