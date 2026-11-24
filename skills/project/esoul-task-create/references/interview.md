# Adaptive interview

Ask in rounds, as the `grilling` skill (layer `upstream-core`) does: ask together every question whose prerequisites are settled, each numbered with a recommended answer worded so that "yes" accepts it, wait for the answers, then ask the questions that depended on them. Without that skill, follow the same round shape. Skip questions answerable from the codebase, repository instructions, `CONTEXT.md`, `GLOSSARY.md`, or Freelo.

The interview ends when every item below is answered for the task type, or listed as an unverified assumption in the preview:

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
- **Data/import:** capture source, expected shape, transformations, validation, failure handling, repeatability, and safe verification. Label it `data-migration`. A code or data-model change that the data work needs is a separate issue, created with the `esoul-data` skill's proposal when that skill is installed.
- **Question:** capture the decision being asked, who answers it, the options with a recommendation, and what is blocked by it. It is not a task (`SKILL.md` › Shape the task › Question): label `question`, no category label, no UAT, no estimate.
- **Spike:** define the question, boundaries, timebox, and output: findings, compared options, recommendation, and risks. Production implementation is out of scope unless explicitly requested.
- **Documentation:** define audience, scope, source of truth, and required verification.
- **LTT / Project Management:** recognize recurring or continuous work that has no single deliverable result; classify it as LTT only after explicit user confirmation.

Ask about an optional module when code or existing tasks suggest one but the user did not identify it.
