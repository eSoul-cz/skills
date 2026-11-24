# Root files (bootstrap and retrofit)

The root files that are not specific to the lifecycle come from the `common` layer of the
published template repositories `eSoul-cz/template-<variant>` (built from `eSoul-cz/app-templates`,
`layers/common/files`). Read them at run time; never vendor a copy in a project or in this skill.
The `common` layer is identical in every variant, so any variant yields the same files.

## 1. What comes from the template

| File | Note |
|---|---|
| `.coderabbit.yaml` | English; narrows only generated input |
| `.editorconfig` | |
| `.gitattributes` | Git LFS and diff drivers; extend it for `assets/**`, `*.pen`, design images, office files and dumps |
| `.github/PULL_REQUEST_TEMPLATE.md` | One template for both tiers |
| `AGENTS.md` | Intro only; the managed guideline block and [the project part](#3-what-this-skill-adds) are added to it |
| `CLAUDE.md` | `@AGENTS.md` |
| `CONTEXT.md` | `## Getting started` (clone, skills, local environment, access), the commit convention and the guideline headings with `TBD`; [filled by bootstrap](#3-what-this-skill-adds), which keeps the first two as they are |
| `GLOSSARY.md` | Header only, in both tiers: the managed guidelines link to it |
| `LICENSE` | Only where the project is open source or internal and public; a client project is proprietary, so leave it out |
| `renovate.json5` | Renovate replaces Dependabot |

Not copied: `esoul-guidelines.json` and its lock (created by `esoul-guidelines init`, see
skill `esoul-guidelines`), `.esoul/template.json` (belongs to the template update flow of the
skill `esoul-project-update`) and any skeleton code.

## 2. Fetch and copy

Choose the variant closest to the stack (`laravel-inertia`, `laravel-lunar`, `lsr-inertia`,
`astro-static`, `astro-ssr`, and so on; the list is `variants/*.json` in `app-templates` or
`gh repo list eSoul-cz --limit 100 --json name --jq '.[].name' | grep '^template-'`). When none fits,
take any variant.

```bash
tmp=$(mktemp -d)
gh repo clone eSoul-cz/template-<variant> "$tmp" -- --depth 1 --quiet
# or one file: gh api repos/eSoul-cz/template-<variant>/contents/<path> --jq .content | base64 -d
for f in .coderabbit.yaml .editorconfig .gitattributes .github/PULL_REQUEST_TEMPLATE.md \
         AGENTS.md CLAUDE.md CONTEXT.md GLOSSARY.md renovate.json5; do
  [ -e "$f" ] || { mkdir -p "$(dirname "$f")"; cp "$tmp/$f" "$f"; }
done
rm -rf "$tmp"
```

Add `LICENSE` to the loop only where the table above allows it.

Rules:

- **Never overwrite an existing file.** A retrofit gets only the missing files. For an existing
  file that differs from the template, show the user the diff and propose the change in the
  retrofit PR ([retrofit.md](retrofit.md)); apply it only when approved.
- An existing `.github/dependabot.yml` is replaced by `renovate.json5` in the same PR. Confirm with
  the user that Renovate runs for the repository before removing the Dependabot file.
- Existing Czech issue and PR templates are replaced by the English ones (the PR template from
  the template, the issue templates from this skill, below).
- Commit the copied files in one commit with the skeleton or retrofit step they belong to.

## 3. What this skill adds

| Asset | Used for |
|---|---|
| `assets/templates/root/.github/ISSUE_TEMPLATE/{task,bug,question,config}.yml` | Issue forms, English form text (UAT fields in `task` and `bug`); copy when missing |
| `assets/templates/root/CONTEXT-sections.md` | The text bootstrap writes into the template's `CONTEXT.md`: `## Project profile`, `## Tracker`, `## Tasking convention`, `## Freelo`, the commit scope line, `## Business time zone`, `## Locales`, `## Language per place`, `## Sources of truth` |
| `assets/templates/root/AGENTS.md` | The project part of `AGENTS.md`, appended **below** the managed guideline block |
| `assets/templates/docs/` and `assets/templates/light/docs/` | The documentation tree ([bootstrap.md](bootstrap.md)) |

`CONTEXT.md` keeps the guideline's headings (conformance requires `Project profile`, `Tracker`,
`Tasking convention` and `Commit convention`). `## Freelo` stays the machine-read cache of
tasklist IDs and label UUIDs owned by `esoul-task-create`; `## Tracker` names the
tracker in prose and points to it. `GLOSSARY.md` holds domain language only.

The template's `## Getting started` section (in `CONTEXT.md` and in the stack's `README.md`) stays in the
project: bootstrap and retrofit keep it, fill in the project's own repository name and local setup, and
never delete it as boilerplate. A retrofitted project that lacks it takes it from the template
(`esoul-project-update` lists it as a template change).

Replace every `{{PLACEHOLDER}}` of the copied assets; `audit` fails on leftovers.
