# Case-study snapshots

eSoul writes case studies about client projects. For every project with a public website (website,
website-admin, eshop, or an application with a public part) capture the ORIGINAL site ("před") at
project start and store it in the project's git, so before/after pairs and claims such as
"performance from 34 to 98" are possible later.

## When

| Moment | Action |
|---|---|
| Bootstrap (P0 / L0), right after Git LFS | Record `Original site` in the profile; capture "před" and the AI-readiness report |
| Retrofit | The same, if the original site is still unchanged; otherwise the Wayback fallback |
| Launch, before the DNS switch | Last chance for "před"; then capture "po" with the same URL file and devices, Lighthouse included, plus the AI-readiness report |

No original site: profile `Original site: —` and nothing to capture.

## Page selection

At most ~20 URLs, representative, not the whole site. Run `discover`, propose one URL per template
and put the list in the PR description. Keep it in `assets/case-study/urls.txt` so "po" reuses it;
new URLs map through the redirect plan (`docs/sitemap-a-meta.md`).

| Product type | Pages |
|---|---|
| `website` | Home, every main-navigation page (cap ~15), contact, one article / reference / blog detail when present, a listing page if present |
| `website-admin` | As `website`, plus one listing and one detail per content type the admin manages (news, events, references…) |
| `eshop` | Home, top-level category, a subcategory or filtered listing, 2 product details (simple + with variants), search results, empty cart, first checkout step if reachable without login, terms / shipping page, contact, blog article if present |
| `application` | Public part only: landing and marketing pages, login, registration, public catalogue or search |

## Run

`scripts/snapshot.mjs` has the commands and options in its header: `--check` (what is missing),
`discover` (candidate URLs by template) and `capture` (screenshots at two devices, optional mobile
Lighthouse, optional Wayback source). The script needs the sibling skill `esoul-quality-gates`
(its `scripts/web.mjs`).

- `urls.txt` takes one URL or path per line, optional `| slug` and `#` comments; the order gives
  the `NN-` file prefix.
- `--lighthouse N` measures the first N URLs of the file, so list the URLs to measure first.
- Running the capture is mechanical: hand it to a cheap helper when the harness offers one,
  otherwise run it yourself; keep the summary line, the failed pages and the manifest `notes`.

## AI-readiness report

Next to the screenshots, run the checker of `esoul-quality-gates` on the original site. It is report
only: it never blocks and needs no exceptions, because the old site is not ours to fix. The
`must x/y` score is the before/after pair.

```bash
ai-readiness.mjs run --base https://old.cz --type <product type> --out assets/case-study/pred/<YYYY-MM-DD>/ai-readiness
```

At launch the "po" run goes to `assets/case-study/po/<YYYY-MM-DD>/ai-readiness`; the production gate
run of the launch can double as it.

## Storage

```text
assets/case-study/pred/<YYYY-MM-DD>/     # po/ has the same structure
  manifest.json                          # fields: see buildManifest in snapshot.mjs
  desktop/01-home.png  01-home-fold.png  # full page 1440 px, DPR 1; first viewport 1440x900
  mobile/01-home.png   01-home-fold.png  # full page 390 px, DPR 2
  lighthouse/01-home.json                # full report, with --lighthouse
```

Pages that fail are recorded in the manifest and do not stop the run.

## Checks after a run

- Open one desktop and one mobile shot per template: cookie banner gone, lazy images loaded, full
  height. The script clicks common consent buttons and hides known consent containers (manifest
  `cookies`: the selector clicked, `hidden:<selector>`, or `none`); a banner or interstitial left in
  a shot means a retake after fixing it by hand, or a note in the PR.
- Re-run failed pages; an `HTTP 4xx` page is not a snapshot.

## Personal data

Public pages only. Logged-in screens of an old application only on explicit request, with anonymised
or demo data, never real personal data (`docs/project_guidelines/security-and-data.md`). Screens with
personal data (reviews with full names, staff portraits without consent): note it in the manifest
and the PR, follow the consent note in `docs/obsah-stary-web.md`, and retake or crop before the push
when consent is missing.

## Wayback fallback

When the old site is gone or already changed, use `--wayback <timestamp>` (the
`web.archive.org/web/<timestamp>if_/<url>` mode hides the toolbar). The manifest records
`source: wayback`, the timestamp and each page's actual snapshot (`waybackActual`); Lighthouse is
skipped. When nothing usable exists, do not fail: write `assets/case-study/pred/<date>/manifest.json`
by hand with `source: "unavailable"`, `pages: []` and the reason in `notes` (conformance then stops
warning), and say "unavailable" with the reason in the PR or bootstrap description.

## Commit and size

The snapshot goes in its own commit, with a message in the project's commit convention (English,
imperative; for example `:camera_flash: [case-study] Capture the original site` in the recommended
Gitmoji format). `assets/**` is Git LFS already. Tell the user the size (`du -sh assets/case-study`)
before the push, as `esoul-data` requires; the script prints it too.
