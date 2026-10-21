# Issue tracker: GitHub + Freelo

Issues and specs for this repo live as GitHub issues in `{{GITHUB_REPO}}`. Every issue is paired
with a Freelo task in project {{FREELO_PROJECT_NAME}} (`{{FREELO_PROJECT_ID}}`); the pairing,
titles, labels, estimates and UAT rules are defined in the `## Tasking convention` section of
[`CONTEXT.md`](../../CONTEXT.md) and in [`CONTRIBUTING.md`](../../CONTRIBUTING.md). Author new
work with the `esoul-tasking` skill, which creates both sides and their reciprocal links after an
approved preview. Use the `gh` CLI for GitHub operations.

## Targets

- New Freelo tasks go to `Backlog`; category labels are applied by UUID as `CONTEXT.md` lists
  them, never created.
- Every slice of the delivery plan in [`docs/plan/`](../plan/README.md) gets its pair; the slice
  table then links the issue (or the Freelo task of a `pm` slice) and keeps only the ID and the
  state. Once the issue exists, the scope lives in the issue.
- Each issue sits in the GitHub milestone of its phase and names its slice in the header line.
- A new slice gets the next free ID of its phase in the plan and its pair in the same pull
  request. IDs are never renumbered or reused.

## Conventions

- **Create an issue**: use `esoul-tasking`; it creates the issue with
  `gh issue create --repo {{GITHUB_REPO}} --body-file <file>` and the paired Freelo task. Never
  create only one side.
- **Title**: `Kontext: Akční výsledek`, identical on the issue, the Freelo task and the pull
  request; no category prefix and no slice ID.
- **Language**: issues are written in Czech and follow `.github/ISSUE_TEMPLATE/task.yml` or
  `bug.yml`. A UAT scenario states the dimensions from `CONTEXT.md` with concrete values.
- **Read an issue**: `gh issue view <number> --repo {{GITHUB_REPO}} --comments`, also fetching
  labels. The Freelo backlink is in the issue's `Freelo` field. A later `Rozhodnutí <datum>`
  section of the issue takes precedence over the text above it.
- **List issues**:
  `gh issue list --repo {{GITHUB_REPO}} --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
  with appropriate `--label`, `--milestone` and `--state` filters.
Every write below (comments, labels, closing, dependencies) needs an approved preview first;
new issues and Freelo tasks are created only through `esoul-tasking`.

- **Comment on an issue**: `gh issue comment <number> --repo {{GITHUB_REPO}} --body "..."`
- **Apply / remove labels**:
  `gh issue edit <number> --repo {{GITHUB_REPO}} --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --repo {{GITHUB_REPO}} --comment "..."`. Closing the issue
  does not move the Freelo task; Freelo status changes follow `CONTRIBUTING.md`.

## Dependencies

GitHub's **native issue dependencies** are the source of truth; the Freelo relation mirrors them.
Never leave a temporary "create the relation manually" comment.

- **Add**: `gh api --method POST repos/{{GITHUB_REPO}}/issues/<blocked>/dependencies/blocked_by -F issue_id=<blocker-db-id>`,
  where `<blocker-db-id>` is the blocker's numeric **database id**
  (`gh api repos/{{GITHUB_REPO}}/issues/<n> --jq .id`), not the `#number` or the `node_id`.
- **Read**: `gh api repos/{{GITHUB_REPO}}/issues/<n>/dependencies/blocked_by`;
  `issue_dependencies_summary.blocked_by` on the issue counts the open blockers.
- An issue is unblocked when every blocker is closed. An issue with an open blocker is not
  `ready-for-agent`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature
requests; `/triage` reads this flag.)_ Dependabot pull requests are dependency updates, not
requests. GitHub shares one number space across issues and PRs, so a bare `#42` may be either:
resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue **and** its paired Freelo task through `esoul-tasking`, including the
preview and explicit approval it requires, and add or link the slice in the delivery plan.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --repo {{GITHUB_REPO}} --comments`. Read the linked Freelo task only
for estimates, status, or management context.
