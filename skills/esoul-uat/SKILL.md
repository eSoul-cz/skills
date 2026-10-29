---
name: esoul-uat
description: Plan, verify, run, and report user acceptance testing (UAT) of eSoul applications, e-shops, and websites as an end user in an isolated Chrome, covering functionality and design (overflow, overlaps, responsiveness, match with a .pen or Figma design). Keeps the scenario catalogue current, runs it across roles and devices with evidence, renders reports, and files found bugs through esoul-tasking. Use for UAT, test scenarios, acceptance runs, "click through the app", responsive or design QA, or turning test findings into bugs.
---

# eSoul UAT

Test the product the way its users will use it, record what happened with evidence, and
turn failures into well-specified work. Functionality and design are tested in the same run.
The scenario catalogue lives in the project repository; credentials never do.

## 1. Load context

1. Use repository instructions already in context (`CLAUDE.md`, `AGENTS.md`, earlier reads);
   do not read them again. Read by section: `## Project profile` and `## Tasking convention`
   from root `CONTEXT.md`, falling back to `GLOSSARY.md`
   (`for f in CONTEXT.md GLOSSARY.md; do awk -v h='## Project profile' '$0==h{p=1;print;next} /^## /{p=0} p' "$f" 2>/dev/null | grep . && break; done`), plus
   `docs/testing/uat/README.md` and `environment.md`. ADRs, the plan, and glossary terms are
   read only in `plan` and `verify` modes, and only for the area in scope. Repository rules
   override this skill.
2. Resolve the **product type** from `CONTEXT.md › ## Project profile`
   ([project-types.md](references/project-types.md)). When the profile is missing, stop and
   route to `esoul-project-lifecycle` (`retrofit`) to write it. Do not classify the project
   from scratch here.
3. Resolve the **design source**: a `.pen` file in the repository, a Figma link in the profile
   or docs, an eSoul mockup bundle, or none ([design.md](references/design.md)).
4. Bugs are written through `esoul-tasking`, which applies the repository's
   `## Tasking convention` (mode, category labels, prefixes if the project defines any).
5. Find facts yourself. Ask the user only for access, decisions, and approvals.

## 2. Pick the mode

Say which mode in one line and read only the references it names.

| Mode | When | References |
|---|---|---|
| `plan` | No catalogue yet, a new module, or a new product type | [project-types](references/project-types.md), [scenario-format](references/scenario-format.md), [design](references/design.md) |
| `verify` | Read-only: is the catalogue current against code, docs, and design? | [scenario-format](references/scenario-format.md), [verify](references/verify.md) |
| `setup` | First run on an environment, new accounts, new machine | [access](references/access.md), [chrome](references/chrome.md) |
| `run` | Execute scenarios in the browser and record results | [execution](references/execution.md), [chrome](references/chrome.md), [design](references/design.md) |
| `report` | Results to Markdown and PDF | [execution](references/execution.md) § Report |
| `bugs` | Turn failed results into work per the repository's tasking convention (issue + Freelo task pairs, or Freelo tasks only in `freelo-only` projects) | [bugs](references/bugs.md) |

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

A project may generate `scenarios/*.md` from another source (SCHOK generates them from
`content/*.mjs`). The Markdown is then a build output that is committed, and the generator
remains the place to edit.

Templates are in `assets/templates/`, resolved relative to this `SKILL.md`. Copy them only
into missing files; never overwrite project files.

## 4. Rules

- **Environments.** Writing or deleting scenarios run only on a test, staging, preview, or
  dedicated UAT instance. Production is read-only and needs explicit approval for each run.
  When the target URL is not in `environment.md`, stop and ask.
- **Credentials.** Read them only from the local secrets file described in
  [access](references/access.md). Never write them into the repository, chat, results,
  issues, Freelo, or screenshots. Never ask for them in chat; tell the user which file and
  keys to fill in.
- **Browser.** Use only the dedicated UAT Chrome profile ([chrome](references/chrome.md)),
  never the user's personal profile with personal sessions.
- **Client data.** On environments with real client data, screenshots and results stay local
  (`runs/` is ignored) unless redacted; seed data may be committed.
- **Honesty.** A scenario passes only when every expected result was observed. Anything not
  executed is `blocked` or `skipped` with a reason, never `pass`. Report the counts as they are.
- **Approval.** Every GitHub, Freelo, or label write goes through the tasking skill with an
  approved preview. Batch all bugs from one run into one preview. The repository's
  `Tasking convention` decides the form: `github-freelo` pairs, or self-contained Freelo
  tasks in `freelo-only` projects (then attach screenshots to the task).
- **Stable IDs.** Scenario IDs (`ZV-11`) are never renumbered or reused.

## 5. Companion skills

| Need | Skill |
|---|---|
| Project profile, product type, UAT dimensions | `esoul-project-lifecycle` |
| Bug issues and Freelo tasks | `esoul-tasking` (repository `## Tasking convention`) |
| PDF rendering | `esoul-maintain-application-documentation` (`docs/documentation build`) |
| Fix of a found bug | `esoul-workflow` (Bug flow) |
| Mockup bundles as design source | `esoul-mockup-authoring` |
| Accessibility depth, Lighthouse, SEO | `accessibility-compliance-accessibility-audit`, `frontend-lighthouse`, `seo-audit` when installed |

If a required companion is missing, stop and give the install command for the whole chain.

## 6. Finish every run

Report in this order: mode; environment and the commit or build under test; scenarios
passed / failed / blocked / skipped per chapter and device; design findings; bugs proposed,
approved, and created with links; scenarios found stale; what is blocked and on whom.
