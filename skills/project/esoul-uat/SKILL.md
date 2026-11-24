---
name: esoul-uat
description: Use for UAT of eSoul apps, e-shops and websites - run the `## UAT` block of one issue without a catalogue, or plan or verify the scenario catalogue, run it as an end user in a real browser (functional, responsive, design), report the run, and turn failures into bugs via esoul-task-create. Not for automated unit or feature tests, nor for Lighthouse, accessibility or SEO gates (esoul-quality-gates).
compatibility: Node.js 22+ for the helper scripts; a browser tool that can use a dedicated profile (Claude in Chrome by default, or a CDP session of a dedicated Chrome) for runs; Playwright with Google Chrome for the device sweep.
---

# eSoul UAT

Test the product the way its users will use it, record what happened with evidence, and
turn failures into well-specified work. Functionality and design are tested in the same run.
The scenario catalogue lives in the project repository; credentials never do. Where the project
has the `package/test-evidence` layer, its PHPUnit acceptance report is the automated
counterpart of these browser scenarios. The UAT rules (scenario format, priorities, devices,
evidence) are owned by this skill; the guidelines hold no UAT section.

## 1. Load context

1. Read from root `CONTEXT.md` (falling back to `GLOSSARY.md`) the sections `## Project profile`
   and `## Tasking convention`, plus `docs/testing/uat/README.md` and `environment.md`. In `plan`
   and `verify` modes also read the ADRs, the plan and the glossary terms of the area in scope.
   Repository rules override this skill.
2. Resolve the **product type** from `CONTEXT.md › ## Project profile`
   ([project-types.md](references/project-types.md)). When the profile is missing, stop and
   route to `esoul-project-lifecycle` (`retrofit`) to write it. Do not classify the project
   from scratch here. The `issue` mode is the exception: it runs without a profile, says so in
   its report and offers the lifecycle skill ([issue](references/issue.md)).
3. Resolve the **design source**: a `.pen` file in the repository, a Figma link in the profile
   or docs, an eSoul mockup bundle, or none ([design.md](references/design.md)).
4. Bugs are written through `esoul-task-create`, which applies the repository's
   `## Tasking convention` (mode, category labels, prefixes if the project defines any).
5. Find facts yourself. Ask the user only for access, decisions, and approvals.

Done when the profile, the product type, the design source and the tasking mode are known (the `issue` mode needs only the issue and a target environment).

## 2. Pick the mode

Say which mode in one line and read only the references it names.

| Mode | When | References | Done when |
|---|---|---|---|
| `plan` | No catalogue yet, a new module, or a new product type | [project-types](references/project-types.md), [scenario-format](references/scenario-format.md), [design](references/design.md) | `uat.mjs validate` reports no errors and every surface item has a scenario or a reported gap |
| `verify` | Read-only: is the catalogue current against code, docs, and design? | [scenario-format](references/scenario-format.md), [verify](references/verify.md) | every chapter has a stale/missing/deviation verdict and the gap scan is attached |
| `setup` | First run on an environment, new accounts, new machine | [access](references/access.md), [chrome](references/chrome.md) | `sweep.mjs --check`, the browser profile check and the secrets-file key check pass |
| `run` | Execute scenarios in the browser and record results | [execution](references/execution.md), [chrome](references/chrome.md), [design](references/design.md) | `uat.mjs next` says nothing is left and `uat.mjs stats` shows no `not-run` |
| `report` | Results to Markdown and PDF | [execution](references/execution.md) § Report | `report.md` exists and links the bugs |
| `bugs` | Turn failed results into work per the repository's tasking convention (issue + Freelo task pairs, or Freelo tasks only in `freelo-only` projects) | [bugs](references/bugs.md) | the approved bugs exist, their links are in `results.json`, the report is regenerated |
| `issue` | One issue or task has a `## UAT` block to check, with or without a catalogue (a feature before merge, the `Testing` step of a task) | [issue](references/issue.md), [access](references/access.md), [chrome](references/chrome.md) | every step of the block has a status with its actual result, the build is named and the user has the verdict |

A full cycle is `verify` → `run` → `report` → `bugs`. Run `verify` before every `run` that
follows code changes: running stale scenarios produces false failures.

## 3. Project files

Everything below lives in the project repository under `docs/testing/uat/` unless the
repository already uses another location (then keep it and record it in `README.md`).

| Path | Content |
|---|---|
| `README.md` | How this project runs UAT, which skill version, where the catalogue comes from |
| `environment.md` | Environments, URLs, role → account e-mail, mail access, data reset. **No passwords.** |
| `scenarios/NN-slug.md` | One chapter per module or page group, format in [scenario-format](references/scenario-format.md) |
| `uat.config.json` | Device matrix, login form for the automated sweep, routes per role |
| `design-map.md` | Screen + state + device → design frame, when a design exists |
| `runs/<YYYY-MM-DD>-<env>[-<n>]/` | `results.json`, `report.md`, `screenshots/` (stored like the repository's other images) |

Optional: a living Google Doc for clients and testers, fed from the same Markdown, with agent and
Playwright results written back, is described in [gdoc](references/gdoc.md).

A project that generates `scenarios/*.md` from another source commits the Markdown as a build
output and edits the generator, not the output.

Templates are in `assets/templates/`, resolved relative to this `SKILL.md`. Copy them only
into missing files; never overwrite project files.

## 4. Rules

Each rule is stated once, in the reference named here.

- **Environments.** Scenarios that write or delete run only on a test, staging, preview or UAT
  instance that `environment.md` marks as writable, through the application UI. This is the one
  exception to "agents SHOULD NOT write to staging data" in
  `docs/project_guidelines/security-and-data.md` › Production access, and it holds on staging
  only. Production stays read-only, per that guideline and with approval for each run. A target
  URL that is not in `environment.md`: stop and ask.
- **Credentials.** UAT accounts are test accounts, never real users; the secrets file and what
  the model may read from it: [access](references/access.md).
- **Browser.** A dedicated profile, never the user's personal one: [chrome](references/chrome.md).
- **Client data.** Screenshots and results are exports: `docs/project_guidelines/security-and-data.md`
  › Personal and client data. Scenarios use invented or anonymised values.
- **Honesty.** A scenario passes only when every expected result was observed; statuses and the
  stop rule: [execution](references/execution.md).
- **Approval.** Every GitHub, Freelo or label write goes through `esoul-task-create` with one
  approved preview per run: [bugs](references/bugs.md).
- **Stable IDs.** Scenario IDs are never renumbered or reused:
  [scenario-format](references/scenario-format.md).

## 5. Companion skills

| Need | Skill |
|---|---|
| Project profile, product type, UAT dimensions | `esoul-project-lifecycle` |
| Bug issues and Freelo tasks | `esoul-task-create` (repository `## Tasking convention`) |
| PDF rendering | `esoul-docs` (`docs/documentation build`) |
| Fix of a found bug | `esoul-workflow` (Bug flow) |
| Mockup bundles as design source | `esoul-mockup-authoring` |
| Accessibility depth, Lighthouse, SEO, AI readiness | `esoul-quality-gates` |

If a required companion is missing, stop and give the install command for the whole chain.

## 6. Finish every run

Report in this order: mode; environment and the commit or build under test; scenarios
passed / failed / blocked / skipped per chapter and device; design findings; bugs proposed,
approved, and created with links; scenarios found stale; what is blocked and on whom. The `issue`
mode reports as [issue](references/issue.md) § 4 says.
