# Case-study snapshots

eSoul writes case studies about client projects. For every project with a public website
(website, website-admin, eshop, or an application with a public part) capture the ORIGINAL site
("před") at project start and store it in the project's git, so before/after pairs and
"performance from 34 to 98" claims are possible later. Owner: this skill; details only here.

## When

| Moment | Action |
|---|---|
| Bootstrap (P0 / L0), right after Git LFS | Record `Original site` in the profile; capture "před" and the AI-readiness report |
| Retrofit | Same, if the original site is still unchanged; else Wayback fallback |
| Launch, before the DNS switch | Last chance for "před"; then capture "po" with the same urls file and devices, Lighthouse included, plus the AI-readiness report |

No original site: profile `Original site: —` and nothing to capture.

## Page selection

Max ~20 URLs, representative, not the whole site. Run `discover`, propose the list (one URL per
template) and put it in the PR description. Keep it in `assets/case-study/urls.txt` so "po"
reuses it; new URLs map through the redirect plan (`docs/sitemap-a-meta.md`).

| Product type | Pages |
|---|---|
| `website` | Home, every main-navigation page (cap ~15), contact, one article / reference / blog detail when present, a listing page if present |
| `website-admin` | As `website`, plus one listing and one detail per content type the admin manages (news, events, references…) |
| `eshop` | Home, top-level category, a subcategory or filtered listing, 2 product details (simple + with variants), search results, empty cart, first checkout step if reachable without login, terms / shipping page, contact, blog article if present |
| `application` | Public part only: landing and marketing pages, login, registration, public catalogue or search |

## Commands

`<skill>/scripts/snapshot.mjs` (Node ≥ 18, Playwright and Lighthouse from `~/.cache/esoul-uat`):

```bash
snapshot.mjs --check                          # playwright, lighthouse, Google Chrome
snapshot.mjs discover --base https://old.cz [--max 200] [--json]
snapshot.mjs capture --base https://old.cz --urls assets/case-study/urls.txt \
  --out assets/case-study/pred [--date YYYY-MM-DD] [--label pred|po] \
  [--devices desktop,mobile] [--lighthouse [N]] [--wayback <timestamp>]
```

`urls.txt`: one URL or path per line, optional `| slug`, `#` comments; the order gives the `NN-`
prefix. `--lighthouse` runs mobile Lighthouse on the first N URLs (default 3; list the
URLs to measure first) and exits non-zero when `lighthouse` is missing:
`npm install --prefix ~/.cache/esoul-uat lighthouse@12`.

Running the capture is mechanical: give it to a cheap subagent (`esoul-skills:test-runner`) and
have it return only the summary line, the failed pages and the manifest `notes`.

## AI-readiness report

Next to the screenshots, run `ai-readiness.mjs` on the original site (report only, it never
blocks) into `assets/case-study/pred/<YYYY-MM-DD>/ai-readiness`, and for "po" into
`assets/case-study/po/<YYYY-MM-DD>/ai-readiness`; the `must x/y` score is the before/after pair.
Commands and the `--type` choice: [ai-readiness.md](ai-readiness.md#case-study).

## Storage

```text
assets/case-study/pred/<YYYY-MM-DD>/     # po/ has the same structure
  manifest.json
  desktop/01-home.png  01-home-fold.png  # full page 1440 px, DPR 1; first viewport 1440x900
  mobile/01-home.png   01-home-fold.png  # full page 390 px, DPR 2
  lighthouse/01-home.json                # full report, with --lighthouse
```

`manifest.json`: `label`, `date`, `base`, `source` (`live` | `wayback`), `waybackTimestamp`,
`capturedAt`, `tool`, `toolVersion`, `devices`, `pages[]` (`n`, `slug`, `url`, `finalUrl`,
`status`, `title`, `shots`, `error`), `lighthouse[]` (categories 0–100, LCP, CLS, TBT, FCP,
Speed Index) or `null`, `notes`. Pages that fail are recorded and do not stop the run.

## Checks after a run

- Open one desktop and one mobile shot per template: cookie banner gone, lazy images loaded,
  full height. The script clicks common consent buttons and hides known consent containers
  (manifest `cookies`: the selector clicked, `hidden:<selector>`, or `none`); a banner or
  interstitial left in a shot means a retake after fixing it by hand, or a note in the PR.
- Re-run failed pages; an `HTTP 4xx` page is not a snapshot.

## Personal data

Public pages only. Logged-in screens of an old application only on explicit request, with
anonymized or demo data, never real personal data (SKILL.md §5,
[podklady-and-legacy](podklady-and-legacy.md)). Screens with personal data (reviews with full
names, staff portraits without consent): note it in the manifest and the PR and follow the
consent note in `docs/obsah-stary-web.md`; retake or crop before the push when consent is missing.

## Wayback fallback

When the old site is gone or already changed, use `--wayback <timestamp>` (the
`web.archive.org/web/<timestamp>if_/<url>` mode hides the toolbar). The manifest records
`source: wayback`, the timestamp and each page's actual snapshot (`waybackActual`); Lighthouse is
skipped. When nothing usable exists, do not fail: write
`assets/case-study/pred/<date>/manifest.json` by hand with `source: "unavailable"`, `pages: []`
and the reason in `notes` (conformance then stops warning), and say „nelze“ with the reason in
the PR or bootstrap description.

## Commit and size

The snapshot goes in its own commit: `:camera_flash: [case-study] snímky původního webu` (add
the scope to the project's commit scopes). `assets/**` is Git LFS already. Tell the user the
size (`du -sh assets/case-study`) before the push, as `esoul-project-data` requires; the script
prints it too.
