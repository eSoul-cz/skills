<!-- esoul-guidelines:begin workflow -->
# Project guidelines - Workflow

How a change travels from a prepared issue to a merged pull request. The tasking and commit conventions chosen for this project are recorded in [CONTEXT.md](../../CONTEXT.md).

## Tasking

<!-- from: profile/internal -->
- Every change starts from a request with a clear outcome and **acceptance criteria**. No issue is
  required: a plan slice (`docs/plan`) or the owner's request is enough, and the pull request
  description links it. A prepared issue (or task) is still welcome. An agent does not start from
  a vague request.
- One request is one independently deliverable result. When separate work emerges during a task,
  record it separately instead of widening the current one.
- The title names the result: a context followed by an action. When an issue or task exists, it
  and the pull request carry the same English title; the pull request title wraps it in the
  commit format ([Pull requests](#pull-requests)). In a project whose tracker titles are Czech,
  the tracker keeps its Czech titles and the pull request title is an English commit-style title
  of the same result that links them.
- Titles carry **no prefix** such as `[BE]` or `[FE]`, and never a slice or phase identifier. The
  work category is a label on the issue (GitHub) and on the task (Freelo).
- Work blocked by an open dependency, an open question or a `proposed` ADR is not ready to start
  ([domain.md](domain.md#open-points-and-conflicts)).
- Use the `esoul-tasking` skill when an issue or task is created; it previews the result and asks
  for approval before writing.

## Branches

<!-- from: profile/internal -->
- Direct pushes to the default branch are allowed in infrastructure and documentation
  repositories, for the owner and for an agent that has the owner's explicit approval. Every other
  change goes through a pull request.
- Name a branch `<prefix>/<issue-number>-<english-kebab-case>` without diacritics, derived from the
  title, for example `feature/142-cart-shipping-recalculation`. When no issue exists, name it
  `<prefix>/<english-kebab-case>`.
- Prefix by work type: `feature/`, `fix/`, `chore/`, `data/`, `docs/`, `design/`, `ci/`,
  `release/`, `refactor/` or `test/`.
- One branch equals one request.
- **Branch lifecycle.** A project starts with only `main`, which is deployed to staging during development. After the release `main` is production, and a `staging` branch (deployed to the staging stack) MAY be added afterwards; it depends on the client's requirements. Which branch deploys where is the pipeline's deploy rule ([deployment.md](deployment.md#environments-and-releases)).

## Commits

- Format: `:emoji: [optional-context] imperative message`, optionally followed by a blank line and a body that explains reasoning or trade-offs, not the subject again.

  ```text
  :sparkles: [checkout] Add delivery selection
  :bug: Prevent duplicate payment callbacks
  :white_check_mark: [checkout] Cover delivery selection
  ```

- Exactly **one Gitmoji shortcode** per commit (`:sparkles:`, never the Unicode glyph). If one commit needs two, it is two commits.
- The optional `[context]` is a lowercase kebab-case subsystem, package or application name. Use it only when it narrows the change.
- The message is imperative and starts with an uppercase letter (`Add`, `Fix`, `Remove`; not `Added` or `Adding`); no trailing period. Keep the subject to **72 characters or fewer** when practical.
- **Split commits by intention**: implementation, tests, refactoring, documentation, configuration or tooling and dependency changes are separate commits, even when they belong to one feature. A commit is a coherent change, not necessarily one file.
- Run the stack's **formatter before every commit** (the stack's tools guideline, `tools.md`); it is cheap. Tests and static analysis run once on the code that will be pushed ([testing.md](testing.md#testing-workflow)).
- Use the `gitmoji-commit` skill to split, stage and write commits. It inspects the diff, stages only the work that belongs to the task and respects hooks; never bypass hooks with `--no-verify`.
- Never rewrite published history (no force push to a shared branch) and never amend, squash or reformat commits you did not create.
- Every push starts a CI build, so do not push each commit separately. Push after a coherent unit is complete, and at least once per day so progress is visible.

## Repository rules

- **Language.** Anything code- or programming-related MUST be English: code, commits, developer documentation, pull request templates and `CONTRIBUTING`. Pull requests SHOULD be English. GitHub issues MAY be Czech or English, Freelo tasks are mostly Czech and discussions MAY be either (usually Czech). Text the user of the application reads is in the project's language ([documentation.md](documentation.md#authoring-rules), [domain.md](domain.md#languages-and-locales)).
- **No secrets or personal data.** Never commit credentials, `.env` files, personal data of the client's customers, non-anonymised database exports or generated PDFs (build artifacts, reproducible from their sources, never committed, not even to Git LFS; one that is already committed is removed with `git rm --cached`, see [documentation.md](documentation.md#generated-documentation)). Client **source** material that is not personal data (documents, exports without personal data) MAY live in the repository's Git LFS. The exceptions for public data and recorded approvals are in [security-and-data.md](security-and-data.md#personal-and-client-data).
- **No passing edits to shared sources.** `CONTEXT.md`, ADRs and guidelines are not changed in passing inside a feature pull request; a guideline change is its own pull request. The one exception is recording a missing convention or cache in `CONTEXT.md` (commit convention, tasking convention, Freelo cache): it is allowed in any pull request as its own commit and is mentioned in the pull request description ([documentation.md](documentation.md#documentation-rides-with-the-change)).
- **New dependencies need maintainer approval.** The pull request that adds a package links the approval: a maintainer's approval or a recorded decision (an ADR, a plan decision, an issue comment). Tool-only development dependencies follow the same rule; without the approval the dependency is not added.
- **No report files.** An agent does not write summary, report or analysis Markdown files unless asked to.

## Pull requests

<!-- from: profile/internal -->
- Open the pull request when the work meets the Definition of Done; keep work in progress as a
  draft.
- Keep pull requests **small and focused**: one request, no unrelated refactoring mixed with
  a feature. A pull request changing more than roughly 30 files is split (mechanical changes in
  their own commit, such as formatter output, generated files and lock files, do not count);
  when that is impossible, its description says how to review it in parts. Review findings are
  never tracked in a repository file instead
  ([code-review.md](code-review.md#findings-stay-in-the-pull-request)).
- The pull request title follows the commit format (`:emoji: [optional-context] Message`) because
  it becomes the squash commit; the message part is the title shared with the issue and the task,
  when they exist (see [Tasking](#tasking) for projects with Czech tracker titles).
- Set a reviewer when one is available; otherwise the owner's explicit go-ahead is enough. Set
  every contributor as **Assignee**.
- Fill in the repository's pull request template. It links the issue (`Closes #<issue>`) when
  there is one, otherwise the plan slice or the owner's request. It lists every check you ran with
  its result ([testing.md](testing.md#testing-workflow)) and the `No test:` line where it
  applies, lists decisions you made on your own so the reviewer can
  confirm them, and carries a **Deploy notes** line naming what devops must do before the deploy:
  new or changed configuration variables, secrets, buckets, a migration that needs a backup first,
  or `none` ([deployment.md](deployment.md#configuration-and-secrets)).
- A pull request SHOULD include the documentation, changelog and glossary updates its change
  requires; a separate pull request, preferably stacked on the change, is allowed. A change to
  the architecture or to an external contract comes with its ADR in the same pull request
  ([documentation.md](documentation.md#documentation-rides-with-the-change)).
- Reviews follow [code-review.md](code-review.md): CodeRabbit and the owner's go-ahead, every
  finding answered, and the `esoul-review` skill to finish the pull request.
- A green `Jenkins` check is required before merge.
- **The author merges**, as a human, after the owner's go-ahead (or a reviewer's approval) and a
  green build, with a **squash merge** whose message is the pull request title. Agents MUST NOT
  merge, approve or use a ruleset bypass unless the human owner explicitly authorises it for that
  pull request or batch; the authorisation is recorded in the pull request description
  ([code-review.md](code-review.md#who-reviews)).

## From issue to merge

<!-- from: profile/internal -->
1. Read the issue, plan slice or owner's request, its acceptance criteria and the guidelines of the area you touch.
2. Create the branch from an up-to-date default branch; a stacked pull request branches from its parent pull request's branch instead.
3. Implement in small steps with behavioural tests ([testing.md](testing.md)).
4. Format before each commit; run tests and static analysis once on the code that will be pushed (the stack's tools guideline, `tools.md`).
5. Commit by intention with the `gitmoji-commit` skill and push.
6. Open the pull request from the template and work through CI and review until it is approved or the owner gives the go-ahead.
7. The author merges (an agent only with the owner's explicit authorisation recorded in the pull request). The task, when one exists, is then moved to its finished state and the work is reported.

> Local additions go below this managed block. Content outside the block is preserved when the guidelines are synced.
<!-- esoul-guidelines:end workflow -->
