# Project guidelines - Documentation

Documentation is a maintained project artifact. Each document has one audience and one job.
For current behaviour, code, tests, configuration and the observed interface outrank prose;
`accepted` ADRs and approved specifications describe the intended contract. When intent and
implementation differ, document the gap; do not rewrite the contract to make the mismatch
disappear.

## Where a piece of knowledge belongs

Putting knowledge in the wrong place is how a project ends up with three answers to one question.

| Place | Holds | Does not hold | Language |
|---|---|---|---|
| [CONTEXT.md](../../CONTEXT.md) | Project conventions: profile, Freelo, tasking, commits, languages, UAT dimensions, sources of truth | Domain terms, decisions, rules for code | English |
| [GLOSSARY.md](../../GLOSSARY.md) | The domain language: English term, Czech original, definition, `_Avoid_` synonyms | Decisions, formulas, process | English + Czech terms |
| [docs/adr/](../adr/index.md) | A decision with real alternatives and consequences, its status, why the alternatives lost, its implementation gaps | Vocabulary, day-to-day conventions | English |
| `docs/project_guidelines/` | The rules the code follows: layers, naming, validation, testing, review | Decisions still open, schedules | English |
| [docs/plan/](../plan/README.md) | Phases, gates, scope, slices, risks: what is built next and what blocks it | How code is written | Czech |
| `docs/podklady/` | The client's own material, unedited, plus notes on what it contains; the question register | Anything we decided ourselves | Czech |
| `docs/legacy/` | How the previous system behaved (`legacy-as-is`) | Requirements | Czech or English |
| [AGENTS.md](../../AGENTS.md) | Short engineering rules every agent loads | Detail that belongs in a guideline | English |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | Process specialising https://dev.docs.esoul.cz | Engineering detail | Czech and English |
| `README.md` | Operations only: requirements, setup, ports, commands, troubleshooting | Rules, decisions | English |

<!-- optional: project keeps a data model document -->
A pull request that changes a model, a migration, a relation or a stored key MUST update the
matching section of [docs/data-model.md](../data-model.md) in the same pull request.

### ADR or guideline

- A rule that could reasonably have gone the other way, with consequences someone may later
  question, is an **ADR**. Write it only when there are genuine alternatives (at least two
  rejected ones).
- A rule that is simply how this project is written (a tool choice such as a formatter, a naming
  scheme, a directory layout) is a **guideline**.
- A formula lives in a guideline with its source reference; the ADR next to it explains the
  choice and does not restate the arithmetic.
- A question nobody has answered yet belongs in
  [docs/podklady/otevrene-otazky.md](../podklady/otevrene-otazky.md), never in a guideline as an
  assumption phrased confidently.

### Evidence is not a specification

`docs/podklady/` and `docs/legacy/` describe how things are or were. A behaviour documented
there becomes a target only when an `accepted` ADR, a guideline or the issue says so. Notes
describe the material; they MUST NOT quietly repair, complete or reconcile it. The supplied
files are never edited: a correction is a decision, and a decision lives in an ADR.

## The `TBD` rule

Do not invent identifiers, links, people, prices, figures, legal or tax rules. Write `TBD`, add
the question to the register and say what fills it in and when. A `TBD` is honest; a plausible
guess is a defect that review cannot see.

## Authoring rules

- One H1 per file. Guidelines use `# Project guidelines - <Topic>`; ADRs start from
  [the template](../adr/0000-template.md) and are named `NNNN-english-slug.md`.
- Hand-wrap Markdown at **100 characters**. Tables, long URLs and generated lines MAY be longer.
  Formatters do not wrap Markdown, so the reviewer checks it.
- Use relative repository links, fenced code blocks and simple tables.
- Use RFC 2119 keywords in guidelines. State a rule only when it is true of the code today;
  otherwise mark it `**Target.** … The code does not do this yet: <where> (#issue or ADR-NNNN).`
  Never phrase planned behaviour as current practice, and never describe an empty directory as a
  feature.
- Verify every path, command, script name and version you write against the repository. Leave
  out numbers that drift (test counts, module counts).
- Link to the authoritative source instead of repeating a rule. Company standards are linked,
  never copied.
- Keep file names stable. A rename updates every inbound link in the same pull request.
- Never include credentials, `.env` values, personal data, production exports or internal
  hostnames. Use reserved example domains (`example.com`) in examples.
- Use the glossary's terms. Keep Czech labels where they document the client's vocabulary,
  interface copy or a prohibited synonym, and explain them in English prose.

## Documentation rides with the change

Documentation changes go in the **same pull request** as the code change that makes them
necessary. Changing `CONTEXT.md`, `GLOSSARY.md`, an ADR or `AGENTS.md` *incidentally* is
forbidden; the cases below are part of the task, not incidental:

- **A new domain term** — add it to `GLOSSARY.md` and mention it in the pull request.
- **A target-contract change** — add or change an ADR, or link an existing `accepted` one. A
  status change updates both the ADR frontmatter and the index table, which is the source of
  truth for statuses.
- **Closing a gap** — update the ADR's *Implementation status* and remove or rewrite every other
  sentence that names the gap: the `AGENTS.md` rule, a **Target** block here, a suppression
  entry.
- **A changed command, script or check** — update [tools.md](tools.md), and the checks table in
  `CONTRIBUTING.md` and the pull request template when the binding list changes.
- **A new rule or boundary** — state it in `AGENTS.md` when every agent needs it, with the detail
  here.

A finding about stale documentation is a normal review finding: it names the stale sentence and
the source that contradicts it.

## ADRs

Use an ADR only for a decision with genuine alternatives. Write it in English from the template;
an `accepted` ADR keeps *Implementation status as of YYYY-MM-DD* with its files, tests and gaps
(each gap linked to an issue or marked "No issue"). Never reuse a number and never delete a
superseded record: change its status and link forward. Status authority is in
[domain.md](domain.md#adr-status-authority).

<!-- optional: application documentation rendered to PDF -->
## Generated documentation

User and developer guides are rendered into reproducible PDFs with the
`esoul-maintain-application-documentation` skill. `docs/documentation.toml` lists each PDF's
sources; generated PDFs are build artifacts and are not committed. A successful build is a
mechanical check, not proof of correctness: review the rendered PDF and resolve or explicitly
accept every privacy and content finding before publication.
