# From findings to bugs

## Triage every failure first

| Finding | Action |
|---|---|
| Product bug: the product does not do what the accepted scenario says | bug pair |
| Design bug: confirmed layout or design finding | bug pair (frontend) |
| Stale scenario: the product changed intentionally | fix the catalogue, no bug |
| Documented deviation, behaviour unchanged | no new bug; reference the existing one if it exists |
| Environment problem: missing access, data, mail, deploy | `blocked`; propose an environment or access issue |
| Unclear: the specification does not decide | question for the project lead, not a bug |

Look for the cause in code before writing the bug: find the route, controller or handler,
policy, request, or component involved, and cite `file:line`. Propose a concrete fix. When
the cause is not found within reasonable effort, say so and describe where to look.

Group failures with one cause into one bug. Search existing issues and Freelo tasks (open and
closed, Czech and English keywords) for duplicates; extend an existing open item instead of
creating a second one.

Security findings (authorization, privilege escalation, data leaks) are always their own
bug, marked important, and are reported to the user immediately, not only at the end.

## Bug content

Use `assets/templates/bug-issue.md`. Title per the repository's tasking convention (the
repository skill decides prefixes such as `[FE]`, `[BE]`). The prefix follows where the fix
belongs, not the fact that testing found it.

The issue contains:

- scenario ID and link to the run report; environment, build, date;
- role, device and viewport, browser;
- **URL** where it happens;
- steps to reproduce (from the scenario, with concrete data);
- expected result (scenario) and actual result (observed);
- **screenshot** (and the design frame for design bugs);
- console errors and failed requests, trimmed to what matters;
- likely cause with `file:line`;
- proposed fix;
- severity: `kritická` (data loss, security, blocks a main flow), `vysoká` (main flow
  wrong, no workaround), `střední` (workaround exists), `nízká` (cosmetic);
- `## UAT`: the failing scenario's steps as the acceptance check.

## Screenshots in issues and tasks

GitHub cannot attach images to an issue through `gh`. Use the run branch:

1. Push the run folder on a branch `uat/<run-id>` before creating bugs.
2. Embed `![popis](https://github.com/<owner>/<repo>/blob/uat/<run-id>/docs/testing/uat/runs/<run-id>/screenshots/<file>.png?raw=true)`.
   It renders for people with access to the repository. Verify one image renders before
   creating the batch. Prefer plain Git objects for screenshots: LFS-tracked images often do
   not render in issues. Follow the repository's `.gitattributes` convention for images.
3. In Freelo, upload the screenshot (`freelo files upload`) and attach it to the task
   description (`freelo tasks description <id> --file <uuid>`), or link the GitHub image.

When the run folder must stay local (real client data), redact the screenshot first
(blur personal data) or describe the state in text and say that the screenshot is local.

## Writing

The repository's `Tasking convention` (root `CONTEXT.md`, falling back to `GLOSSARY.md`)
decides the form. In `github-freelo` projects each bug is an issue + Freelo task pair; in
`freelo-only` projects each bug is one self-contained Freelo task with the same content and
the screenshot attached to the task.

Hand the approved list to the tasking skill. Show **one preview for the whole run**,
numbered, so the user can approve all or some. After writing, add the issue and task links
to `results.json` (`uat.mjs record … --bug <issue>#<freelo-id>`) and regenerate the report.

The bug's fix later goes through `esoul-workflow`. When it is merged and deployed, re-run the
failing scenario and record the new result in a new run or a re-test section of the report.
