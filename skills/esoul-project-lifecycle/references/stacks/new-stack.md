# Stack profile: new stack (no profile yet)

Use this checklist when the project's stack has no profile in `references/stacks/` (for example
WordPress, Symfony, Django, a mobile app, or a Laravel variant different enough to need its own
rules). The project defines the profile items itself, in its own repository, and the profile
graduates to `eSoul-cz/skills` once it has proven itself.

Record the stack in `CONTEXT.md › ## Project profile` as `Stack: \`other:<name>\`` and point
`Stack profile:` at `docs/project_guidelines/tools.md`.

## When this profile applies

- No existing profile matches the repository signals (`composer.json`, `package.json`,
  `pyproject.toml`, `wp-config.php`, `pubspec.yaml`, …), or
- an existing profile matches the language but its architecture, gates or deployment do not fit
  (write down which items differ and why).

Before choosing, check whether a close profile can be used with a documented deviation; a
deviation in `tools.md` is cheaper than a new stack.

## Checklist

Each item must end in a concrete section of the project's own documentation. Do not leave
`TBD` in items 2–5 at gate B4; items 6–7 may grow over time.

### 1. Signals (in `docs/project_guidelines/architecture.md › Stack`)

- [ ] Languages, frameworks and major versions; where versions are authoritative (lockfiles).
- [ ] Runtime services (database engine, queue, cache, search) and whether tests use the same
      engines as production.
- [ ] Process tier (`full` / `light`) with the reason, per [tiers.md](../tiers.md).

### 2. Bootstrap specifics (in `tools.md › Tools` and `AGENTS.md`)

- [ ] Skeleton command and the packages added on top of it, with versions.
- [ ] Package manager pinned (`packageManager`, `composer.lock`, `uv.lock`, …).
- [ ] Docker setup for local development and production.
- [ ] Vendored agent skills: `.agents/skills/` with committed `.claude/skills/<name>` symlinks,
      pinned in `skills-lock.json`, added only with
      `LC_ALL=en_US.UTF-8 npx skills@1.7.2 add <owner/repo> --skill <name> --agent claude-code codex -y`;
      a CI check that recomputes the lock when the stack has Node available.
- [ ] MCP servers the agents need (framework docs server, Pencil, `codegraph`, database tools)
      and whether `.mcp.json` is committed.
- [ ] `AGENTS.md` section stating where project rules override vendored skills.

### 3. Guidelines (in `docs/project_guidelines/`)

- [ ] Copy `assets/templates/docs/project_guidelines/common/` (`index.md`, `code-review.md`,
      `testing.md`, `documentation.md`, `domain.md`, `security-and-data.md`).
- [ ] Write stack files modelled on the closest profile: `architecture.md` (layers and the
      dependency direction), `frontend.md` if there is UI, `tools.md`, `deployment.md`, plus
      framework-specific files (as `laravel/cqrs.md` or `medusa-nuxt/workflows.md` do).
- [ ] RFC 2119 wording; every rule the code does not follow yet is marked **Target** with an
      issue link or "No issue".

### 4. Quality gates (in `tools.md › Read-only verification` and the `Jenkinsfile`)

- [ ] One local command (or a short ordered list) that runs every read-only check.
- [ ] Static analysis at the strictest practical level, formatter check, linter, type check,
      unit tests, build. Each listed with its exact command.
- [ ] Jenkins stages on the shared libraries (`dockerHelpers`, `testing`, `deploy`) running the
      same commands; image tags pinned, not `lts`; `GIT_LFS_SKIP_SMUDGE=1`.
- [ ] Which gates are CI-required and which are local soft gates (mutation testing on changed
      lines, Lighthouse before launch, …).
- [ ] Ruleset on `main`: required check `Jenkins`, one human approval, squash merge only.

### 5. Development handover (in `docs/plan/` or the handover PR)

- [ ] CI green on the empty scaffold, with guards for tools that fail on empty input.
- [ ] Architecture or structure checks that fire from the first commit, each with a test that
      proves it detects a violation.
- [ ] A reference module implemented end to end for agents to copy.
- [ ] Parity fixtures and pending parity tests when the client calculates in spreadsheets.
- [ ] Anonymized data for local work; no real dump reaches an agent.

### 6. Typical ADR topics (in `docs/adr/` or `docs/rozhodnuti.md`)

- [ ] Why this stack (with at least two rejected alternatives, including the closest eSoul
      profile).
- [ ] Data store and precision, authentication and roles, integrations, deployment topology.
- [ ] Stack-specific: plugin or extension policy, upgrade cadence, hosting constraints.

### 7. Pitfalls (in `tools.md › Known pitfalls`)

- [ ] Keep a dated list of what broke CI, review or deployment and how it was fixed. This list
      is the main input for a future company profile.

## Graduating to a company profile

When the project has passed B4 and shipped at least one phase with the gates unchanged for a
month, propose a profile to `eSoul-cz/skills`:

1. Draft `skills/esoul-project-lifecycle/references/stacks/<stack>.md` with the same seven
   headings as `laravel.md`, generalized (no client names, IDs, or domain terms).
2. Extract reusable guideline files into
   `assets/templates/docs/project_guidelines/<stack>/` with `{{UPPER_SNAKE_CASE}}` placeholders.
3. Add the stack to the `Stack:` options in `tiers.md`, to the profile list in `SKILL.md`, and to
   the `STACKS` pattern in `scripts/conformance.mjs`.
4. Open the PR with the project as evidence (links to its `tools.md`, `Jenkinsfile`, and green
   builds); a second project on the same stack should review the draft before merge.
