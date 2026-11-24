# Upstream skills: what eSoul adds

eSoul builds on Matt Pocock's upstream skills (layer `upstream-core`). Use the installed skill by name and apply only the additions below. When a skill is not installed, ask the user to run `npx @esoul-cz/skills install upstream-core`, or follow the additions alone. `tdd` and `diagnosing-bugs` have their eSoul additions in `esoul-testing` (layer dev); without that skill, follow the upstream skill and `docs/project_guidelines/testing.md` › Regression tests.

Tracker and setup skills of the same plugin (`to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement-spec`, `setup-matt-pocock-skills`) stay unused unless the repository is explicitly configured for them: eSoul tracks work in Freelo, and the setup skill renames `CONTEXT.md`, which holds eSoul conventions. Likewise `pr` and `git-guardrails-claude-code` stay unused.

## `grilling`

- Ask the whole frontier of open decisions in one numbered round, each question with a recommended answer worded so that "yes" accepts it.
- Find facts in the repository, tools and logs yourself (a read-only explorer subagent when the harness offers one); ask the user only for decisions.
- Done when nothing is silently assumed and the user confirms. For an M task one round is usually enough; do not interrogate an S task.

## `prototype`

- Capture the prototype on a branch `design/<kebab-name>`, pushed only when the user asks; the implementation issue gets a pointer to it and the verdict of the question it answered. The main branch keeps only the validated decision.
- UI prototypes use invented data, never client data.
- A design the client reviews is an eSoul mockup (`esoul-mockup-authoring`), not a prototype.

## `handoff`

- Write the handoff (the upstream skill says where), name `esoul-workflow` first among the suggested skills, and include the verification receipts already recorded.
- Then tell the user to continue in a fresh session with that file.

## `codebase-design`

- Use it when the shape of an interface is in question: where a seam goes, whether a class earns its place, how an integration is faked.
- `docs/project_guidelines/architecture.md`, the stack profile and accepted ADRs come first. In a CQRS project commands, queries and handlers stay where the guidelines put them; the upstream principles decide what sits behind them. Keep the project's own terms (service, component) where the upstream term list differs.
