# Go-live procedure

The procedure for taking a public website, or the public part of an application, live. The boxes
are in one place only: the project's `docs/nasazeni.md` (launch checklist). This file says in what
order to work through them and what counts as evidence; it does not repeat them. The rules the
checklist verifies belong to the guidelines (`docs/project_guidelines/public-website.md`, the
stack's `deployment.md` and `tools.md`).

## Evidence

Every box needs evidence next to it: a command output, a report path, a screenshot or a link.
Measurements go into the `Naměřeno` table of the checklist with the date. A box that cannot be met
is not ticked and not deleted: the project lead approves a deviation and the reason is written under
the checklist (AI readiness: the Exceptions table of `docs/ai-readiness.md`).

## Steps

1. **Prepare the checklist.** `docs/nasazeni.md` exists (copy `assets/templates/docs/nasazeni.md` when it
   is missing; a full-tier project points its links at ADRs and the plan instead of the light-tier
   documents). Fill the environment, deployment, DNS and backup sections; the hosting and preview
   decision is recorded in the decision register.
2. **Hand over the redirects.** The redirect list of the sitemap and meta document goes into the
   pull request's deploy notes so devops can apply it (`public-website.md`, Redirects).
3. **Run the gates on staging.** Skill `esoul-quality-gates`: Lighthouse with `--staging`, axe,
   security headers, and the AI-readiness checker with `--staging`; the stack's Playwright smoke
   covers console errors. Tick the boxes with the evidence and fix failures before going on.
4. **Get acceptance.** The client accepts the site on the preview; the date is recorded.
5. **Take the last "před" snapshot.** While the old site still answers, per
   [case-study.md](case-study.md). With no original site there is nothing to capture.
6. **Switch**, in the order of `public-website.md` › Preview gate: remove basic auth, turn the
   preview switch off, deploy, then verify the response headers, `robots.txt`, the sitemap and
   indexability. Nothing else changes in that deploy. DNS, TLS and the rollback follow the
   hosting plan of the project (checklist section Přepnutí).
7. **Run the gates on production right away.** The same gates without `--staging` (SEO counts now),
   plus the 301 and 410 checks against production. A failing `must` of the AI-readiness checker or a
   missed budget is a launch defect: fix it or record the approved deviation.
8. **Capture "po".** The same URL list and devices as "před", Lighthouse included, plus the
   AI-readiness report ([case-study.md](case-study.md)).
9. **After launch.** Search Console and Bing Webmaster with the sitemap, Google Business Profile and
   Firmy.cz updated, analytics receiving data; after one to two weeks index coverage and 404s are
   reviewed and missing 301s added.

## Done when

Every box of the checklist is ticked with evidence or carries an approved deviation, the client's
acceptance date is recorded, the production gate run passed, and the "po" snapshot is committed.
