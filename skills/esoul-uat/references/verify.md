# Verify the catalogue

Read-only. Answers: which scenarios no longer describe the product, which behaviour has no
scenario, which deviations are resolved or new. Run it before every run that follows code
changes and whenever the user asks whether the scenarios are current.

## Steps

1. Find the catalogue baseline: the last commit that touched each chapter
   (`git log -1 --format='%h %ad' --date=short -- <chapter>`) and the changes since then
   (`git log --since=<date> --format='%h %ad %s' --date=short`). Verify against the default
   branch head (`origin/main` or the repository default), not a feature branch; use a
   detached worktree when the main checkout is on another branch.
2. Split chapters into groups of 5–8 and audit the groups in parallel with fresh read-only
   sub-agents (Explore, `model: sonnet`). Never fork the current conversation for this: a fork inherits the
   whole context and multiplies the cost. The same applies to sub-agents that update chapters. Give each the chapter files, the format rules, the code areas (routes, pages,
   navigation, policies, form requests, language files, seeders, tests), and the docs
   (GLOSSARY, ADRs, plan). Ask for evidence with `file:line` for every claim.
3. Add one global gap scan: every route group and page directory against the chapter list.
4. Re-check every security-relevant claim yourself in code before reporting it.

## Output per chapter

- **Stale**: scenario ID, what changed, evidence.
- **Missing**: behaviour implemented without a scenario, with the route, page, or rule.
- **Deviations**: resolved (remove), still valid, new.
- **Part move**: chapters in part B whose screens now exist.
- **Accounts and seed data**: still matching `environment.md`?

Then a global gap list and, separately, **findings that are product bugs** (for example
missing authorization). Product bugs go to the `bugs` mode; they are not catalogue edits.

Summarise counts first (chapters, scenarios, commits since baseline), then the findings,
most severe first. Updating the catalogue is a separate, reviewed change through a PR.
