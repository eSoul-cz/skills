# Project guidelines (P4, `guidelines`)

`docs/project_guidelines/` tells agents and developers how code in this repository is written.
It specializes the company standards at https://dev.docs.esoul.cz; link them, never copy them.

## Set

Copy `assets/templates/docs/project_guidelines/common/*` and the files of the recorded stack
(`laravel/`, `medusa-nuxt/`, `astro/`). For another stack, create at least `index.md`,
`architecture.md`, `tools.md` and `testing.md` per [stacks/new-stack.md](stacks/new-stack.md).
Add project files when the domain needs them, for example `money-and-localization.md`,
`calculations.md`, `integrations.md`, `security-and-roles.md`.

## Writing rules

- English, H1 `# Project guidelines - <Topic>`, RFC 2119 keywords (MUST, SHOULD, MAY).
- Every rule is checkable. Prefer a lint rule, structure script or test over prose; name the
  check that enforces it.
- When the code does not follow a rule yet, write it as the target and name the gap:
  `**Target.** … The code does not do this yet: <where> (#123 or ADR-0007).`
  Agents must not copy the gap into new code and must not fix it outside its issue.
- Rules that came from a decision link the ADR. Rules that are pure convention need no ADR.
- Calculations: every formula with its source (`file › sheet › cell`) and the list of known
  defects in the source. Changing a formula needs a recorded client decision, an updated
  guideline and an updated parity test.
- Keep `AGENTS.md` short: it points to `docs/project_guidelines/index.md` and lists only rules an
  agent must apply on every task.
- A guideline change is its own PR, owned by `CODEOWNERS`. Do not edit guidelines incidentally
  inside a feature PR.
