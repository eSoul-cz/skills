<!-- Adapted from mattpocock/skills v1.3.2, `skills/engineering/code-review/SKILL.md` (MIT License, (c) 2026 Matt Pocock;
     see LICENSE-mattpocock-skills.md). eSoul changes: the fixed point and diff come from the scope script; the Standards
     axis reads the project's guidelines (`docs/project_guidelines/`, flat), AGENTS.md and CONTEXT.md plus the smell
     baseline and the eSoul checklists in review-passes.md; the Spec axis reads the issue or task acceptance criteria
     and `## UAT`; sub-agents run on explicit models; the tracker-setup line is dropped. -->

# Two-axis review

The reference flow of `esoul-review` Path A. Review the diff along two axes:

- **Standards**: does the code conform to this project's documented standards (guidelines, `AGENTS.md`, `CONTEXT.md`, accepted ADRs)?
- **Spec**: does the code faithfully implement the originating issue or task, acceptance criteria and `## UAT` included?

Both axes run as **parallel sub-agents** so they do not pollute each other's context, then the findings are aggregated. Start every sub-agent with a fresh context window, never a fork.

## Process

### 1. Take the fixed point from the scope

`esoul-review` step A1 already fixed the base and produced the diff. Use its `diffCommand` (three-dot against the merge base, plus staged, unstaged and untracked changes for the default scope) and `git log <base>..HEAD --oneline` for the commits. A bad ref or an empty diff stops the review here, before two sub-agents start.

### 2. Identify the spec source

In this order:

1. The issue or task linked from the branch name, PR body or commit messages (`#123`, `Closes #45`, a Freelo task id), fetched with `gh` or the `freelo` skill: acceptance criteria and its `## UAT` section.
2. A path or link the user passed.
3. A plan slice or spec under `docs/` that matches the branch name (internal-profile projects work from a plan slice or the owner's request, guidelines `profile/internal/workflow.md`).
4. Otherwise ask where the spec is. When there is none, the Spec sub-agent is skipped and the report says "no spec available".

### 3. Identify the standards sources

List every file that documents how code is written here: `AGENTS.md`, `CONTEXT.md`, every file in `docs/project_guidelines/` (flat, not only `code-review.md`), `accepted` ADRs of the touched areas, `GLOSSARY.md`, and `CODING_STANDARDS.md` or `CONTRIBUTING.md` when present. The guidelines' `code-review.md` ("What a reviewer checks against") is the checklist order.

On top of what the repository documents, the Standards axis always carries the **smell baseline** below, a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a project documents nothing. Two rules bind it:

- **The repo overrides.** A documented project standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation. Skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Spawn both sub-agents in parallel

Issue both calls together, in the foreground, and aggregate the reports they return. Give each sub-agent an explicit model (`esoul-model-routing`; the choice is in `esoul-review` step A4): the plugin agents `esoul-skills:reviewer` or `esoul-skills:critical-reviewer`, or a fresh subagent with the model named. A sub-agent never inherits the caller's model.

**Standards sub-agent prompt** includes:

- The diff command and commit list.
- The standards-source files from step 3 (it reads them itself), the **smell baseline** pasted in full, and the eSoul checklists for the touched stacks from [review-passes.md](review-passes.md) (tests lens, stack notes).
- The brief: "Report, per file or hunk where relevant, (a) every place the diff violates a documented standard: cite the standard (file and rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, baseline smells are always judgement calls, and a documented project standard overrides the baseline. Skip anything tooling enforces. Under 400 words."

**Spec sub-agent prompt** includes:

- The diff command and commit list.
- The path or fetched contents of the spec (acceptance criteria and `## UAT`).
- The defect probes from [review-passes.md](review-passes.md#defect-probes), which sharpen "looks wrong".
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

Both briefs also carry the scope header of `esoul-review` (base and head SHA, files to review, path instructions) and the findings already decided on this change (they are not raised again). Without a spec, skip the Spec sub-agent and say so in the report.

### 5. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings across the axes, because they are deliberately separate (see _Why two axes_). End with a one-line summary: total findings per axis, and the worst issue _within each axis_. Never pick a single winner across axes.

Verification, deduplication and the guideline severities (`esoul-review` step A5) apply to each finding inside its own axis, after this aggregation.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.
