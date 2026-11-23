<!-- esoul-guidelines:begin documentation -->
# Project guidelines - Documentation

Documentation is a maintained project artifact. Each document has one audience and one job. For current behaviour, code, tests, configuration and the observed interface outrank prose; `accepted` ADRs and approved specifications describe the intended contract. When intent and implementation differ, document the gap; do not rewrite the contract to make the mismatch disappear.

## Where a piece of knowledge belongs

Putting knowledge in the wrong place is how a project ends up with three answers to one question.

| Place | Holds | Does not hold |
|---|---|---|
| [CONTEXT.md](../../CONTEXT.md) | Project conventions only: profile, tracker, tasking, commits, business time zone, locales, language per place, sources of truth | Domain terms, decisions, rules for code |
| [GLOSSARY.md](../../GLOSSARY.md) | The domain language: term, definition, `_Avoid_` synonyms | Decisions, formulas, process |
| `docs/adr/` | A decision with real alternatives and consequences, its status, why the alternatives lost, its implementation gaps | Vocabulary, day-to-day conventions |
| `docs/plan/` | Work plans (slices, order, status) and a decision register for choices that are not ADR-worthy (a project MAY name another file as its decision register in `CONTEXT.md`, sources of truth) | Decisions with real alternatives and consequences (promoted to an ADR) |
| `docs/project_guidelines/` | The code and work rules: layers, naming, validation, testing, review, workflow | Project-domain rules, decisions still open, schedules |
| The project's tracker | Open questions: one issue or task labelled `question` per question | Answers (they go to an ADR, the glossary or a guideline), a question kept in a file |
| `AGENTS.md` | Short engineering rules every agent loads, and a pointer to these guidelines | Detail that belongs in a guideline |
| `README.md` | Applications: operations only (requirements, setup, ports, commands, troubleshooting). Packages and tools: the user documentation (install, usage, configuration, contract) | Rules, decisions, contributor rules (they go to `CONTRIBUTING` or the guidelines) |

Guidelines are code and work rules, not project-domain rules. A project MAY add its own guidelines within the same categories (for example its own default Critical findings or architecture rules) as project files next to the managed block, never by editing the managed block.

A rule an agent must follow is stated in these guidelines, with a link to its source where there is one and no more than the rule copied. Client source material and notes on the previous system are evidence of how things are or were, kept where the project stores them and never edited.

### ADR or guideline

- A rule that could reasonably have gone the other way, with consequences someone may later question, is an **ADR**. Record at least one considered alternative when there is one (it is RECOMMENDED; thinking through alternatives is encouraged), but an ADR without a real alternative is allowed.
- A rule that is simply how this project is written (a tool choice such as a formatter, a naming scheme, a directory layout) is a **guideline**.
- A formula lives in a guideline with its source reference; the ADR next to it explains the choice and does not restate the arithmetic.
- A question nobody has answered yet belongs in the project's question register (an issue or task labelled `question`, never a file), never in a guideline as an assumption phrased confidently.

### Evidence is not a specification

Client material and legacy-system notes describe how things are or were. A behaviour documented there becomes a target only when an `accepted` ADR, a guideline or the issue says so. Notes describe the material; they MUST NOT quietly repair, complete or reconcile it. The supplied files are never edited: a correction is a decision, and a decision lives in an ADR.

## The `TBD` rule

Do not invent identifiers, links, people, prices, figures, legal or tax rules. Write `TBD`, add the question to the register and say what fills it in and when. A `TBD` is honest; a plausible guess is a defect that review cannot see.

## Authoring rules

- One H1 per file. Guidelines use `# Project guidelines - <Topic>`; ADRs are named `NNNN-english-slug.md` and start from the project's ADR template.
- Markdown is not hard-wrapped to a fixed width: one sentence or clause per line is allowed and editors soft-wrap. Reviewers do not check wrapping.
- Use relative repository links, fenced code blocks and simple tables.
- Use RFC 2119 keywords (MUST, SHOULD, MAY) in guidelines, and make every rule checkable. Prefer a lint rule, static analysis rule or test over prose, and name the check that enforces the rule.
- State a rule only when it is true of the code today; otherwise mark it as a target and name the gap: `**Target.** ... The code does not do this yet: <where> (#issue or ADR-NNNN).` Never phrase planned behaviour as current practice, and never describe an empty directory as a feature.
- Verify every path, command, script name and version you write against the repository. Leave out numbers that drift (test counts, module counts).
- Link to the authoritative source instead of repeating a rule. A rule an agent must follow is still stated here, with the link to its source and no more than the rule, because an agent cannot be expected to read a private or external source.
- Keep file names stable. A rename updates every inbound link in the same pull request.
- Never include credentials, `.env` values, personal data, production exports or internal hostnames. Use reserved example domains (`example.com`) in examples.
- Use the glossary's terms. Keep non-English labels only where they document the client's vocabulary or interface copy, and explain them in English prose.
- The language of each kind of document is set per place and audience in the project's `CONTEXT.md`. Anything code- or programming-related MUST be English (code, identifiers, code comments, commit messages, developer documentation, pull request templates, `CONTRIBUTING`); the full matrix is in [workflow.md](workflow.md#repository-rules). User guides and client-facing material are written in the project's language.

## Documentation rides with the change

Documentation that describes a change rides with that change: updating it in the **same pull request** as the code that makes it necessary is PREFERRED, because it keeps the documentation current while the work is fresh. A separate pull request, preferably stacked on the change, is allowed. Changing `CONTEXT.md`, `GLOSSARY.md`, an ADR or `AGENTS.md` *incidentally* is forbidden; the cases below are part of the task, not incidental. So is recording a missing convention or cache in `CONTEXT.md` (commit convention, tasking convention, Freelo cache): it is allowed in any pull request, as its own commit, mentioned in the pull request description.

- **A new domain term** - add it to `GLOSSARY.md` and mention it in the pull request.
- **A target-contract change** - add or change an ADR in the same pull request, or link an existing `accepted` one. A status change updates both the ADR frontmatter and the ADR index, which is the source of truth for statuses.
- **Closing a gap** - update the ADR's *Implementation status* and remove or rewrite every other sentence that names the gap: the `AGENTS.md` rule, a **Target** block in a guideline, a suppression entry.
- **A changed command, script or check** - update the stack's tools guideline (`tools.md`) and any checks table in the contributing documentation or pull request template.
- **A new rule or boundary** - state it in `AGENTS.md` when every agent needs it, with the detail in the matching guideline.
- **A changed model, migration, relation or stored key** - update the project's data model documentation when it has one.
- **A user-visible change of a released package, template or tool** - update its `CHANGELOG` (Unreleased section), in the same pull request or a stacked one; the release turns Unreleased into the version.

Changing an existing guideline rule is its own pull request; do not edit guideline rules incidentally inside a feature pull request ([workflow.md](workflow.md#repository-rules)).

A finding about stale documentation is a normal review finding: it names the stale sentence and the source that contradicts it ([code-review.md](code-review.md)).

## ADRs

Use an ADR for a decision with real alternatives and consequences (see [ADR or guideline](#adr-or-guideline)). Write it in English from the template; an `accepted` ADR keeps an *Implementation status as of YYYY-MM-DD* line with its files, tests and known gaps (each gap linked to an issue or marked "No issue"). Never reuse a number and never delete a superseded record: set its status to `superseded by ADR-NNNN` and link forward. Status authority is in [domain.md](domain.md#adr-status-authority).

## Generated documentation

User and developer guides MAY be rendered into reproducible PDFs with the `esoul-maintain-application-documentation` skill. The configuration lists each PDF's sources; generated PDFs are build artifacts, reproducible from their sources, and are never committed, not even to Git LFS. A PDF that is already committed is removed from Git with `git rm --cached` (and ignored), so it stays in the working tree. A successful build is a mechanical check, not proof of correctness: review the rendered PDF and resolve or explicitly accept every privacy and content finding before publication.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end documentation -->
