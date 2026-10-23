# Adaptive interview

Skip the interview when the request is simple or already complete. Otherwise ask exactly one question at a time, wait for the answer, and include a recommended answer. Resolve decision dependencies in order. Do not ask questions answerable from the codebase, repository instructions, `CONTEXT.md`, `GLOSSARY.md`, or Freelo.

Continue until the following are clear enough for the task type:

- intended outcome and reason;
- scope and meaningful exclusions;
- completion conditions and verification;
- module, when useful;
- dependencies and related tasks;
- suitable split into tasks and checklist subtasks;
- tasklist, labels, estimate, assignee, and due date.

Infer an internal task archetype and tailor the questions:

- **Feature:** capture who benefits, why, expected behavior, roles, domain rules, boundaries, and observable completion.
- **Bug:** capture observed and expected behavior, reproduction conditions, affected role/data/environment, evidence, and regression coverage. Put an unreproduced or materially underspecified bug in `Backlog` as diagnosis rather than implementation-ready work.
- **Technical improvement/refactoring:** capture the concrete problem, intended quality outcome, compatibility constraints, and proof that behavior remains correct.
- **Testing:** name the behavior and scenarios being proven rather than merely saying "add tests".
- **Data/import:** capture source, expected shape, transformations, validation, failure handling, repeatability, and safe verification.
- **Spike:** define the question, boundaries, timebox, and output: findings, compared options, recommendation, and risks. Do not include production implementation unless explicitly requested.
- **Documentation:** define audience, scope, source of truth, and required verification.
- **LTT / Project Management:** recognize recurring or continuous work that lacks a one-sprint result, but never classify it as LTT without explicit user confirmation.

Ask about an optional module when code or existing tasks suggest one but the user did not identify it.
