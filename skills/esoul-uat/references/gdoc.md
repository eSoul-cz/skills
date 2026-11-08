# Google Doc bridge

Optional. It keeps the UAT scenarios and their results in one living Google Doc that clients and
testers fill in, while the Markdown catalogue (`docs/testing/uat/scenarios/*.md`, see
[scenario-format.md](scenario-format.md)) stays the single source. A project without the bridge
works exactly as before; nothing here is required.

- `assets/gdoc/Code.gs` + `appsscript.json`: Apps Script Web App, one per Doc.
- `scripts/gdoc.mjs`: local client, no dependencies, Node 22+. It parses the Markdown with the
  same code as `uat.mjs` and sends it to the Web App.

`<skill>` below is the directory of this skill's `SKILL.md` (in the installed plugin, for example
`~/.claude/plugins/…/skills/esoul-uat`). Run every command from the project repository root.

## What is written where

The Doc has an `Úvod` tab and one tab per chapter (`ABC · Název`). Each scenario is a table with the
columns `Krok | Akce testera | Očekávaný výsledek | Skutečný výsledek / chyba | Oprava`, plus the
optional `Automatický test`.

| Cell | Owner | `sync` |
|---|---|---|
| Table header, step number, Akce, Očekávaný výsledek | script (from the Markdown) | overwrites |
| Skutečný výsledek / chyba, Oprava, checkbox | testers (and `result`) | never overwrites |
| Automatický test (first step row of the scenario) | `e2e` command | never touches |

A step that disappears from the Markdown is never deleted: it stays as `[zrušený krok]`. The
checkbox state cannot be read by any Google API, so testers tick it and also write `OK` into the
result column. Do not rename tabs, move or delete rows, or add columns by hand.

## Setup, step by step (once per project)

1. Create the Google Doc natively (a `.docx` upload must first be converted: File → Save as Google Docs).
   Try everything on a **copy** first; `init` erases the Doc content.
2. In the Doc open **Extensions → Apps Script**. Delete the sample `Code.gs` content and paste the whole
   `<skill>/assets/gdoc/Code.gs`.
3. Left side **Project Settings** → tick **Show "appsscript.json" manifest file in editor**. Back in the
   editor open `appsscript.json` and replace its content with `<skill>/assets/gdoc/appsscript.json`. Save.
4. **Project Settings → Script Properties → Add script property**:

   | Property | Value |
   |---|---|
   | `DOC_ID` | the Doc ID from its address: `https://docs.google.com/document/d/`**`THIS_IS_THE_ID`**`/edit` |
   | `TOKEN` | a random string: `openssl rand -hex 32` |

   Keep the token for step 6.
5. **Deploy → New deployment** → gear → **Web app**. **Execute as: Me**, **Who has access: Anyone**.
   Deploy and go through the authorization (Google warns "app not verified": **Advanced → Go to … (unsafe)**;
   it is your own script). Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
6. On your machine create `~/.config/esoul/<projectKey>-uat-gdoc.env` (outside the repository, never commit it):

   ```
   UAT_GDOC_URL=https://script.google.com/macros/s/…/exec
   UAT_GDOC_TOKEN=<the token from step 4>
   ```

   `<projectKey>` is `projectKey` in `docs/testing/uat/uat.config.json` (for example `indcom`, `vono`,
   `doglead`). Instead of the file you can export `UAT_GDOC_URL` and `UAT_GDOC_TOKEN`; the environment wins.
   The URL together with the token gives write access to the Doc: do not share it, do not paste it into chat,
   issues, or Freelo. The client never prints the token or the URL.
7. Decide about the automated-test column now, before the first `init`: set `"automatedColumn": true` in
   `uat.config.json` (default `false`). Turning it on later needs the tables rebuilt (`init`, which refuses
   chapters with tester entries unless `--including-tester-data`), because existing tables keep their five columns;
   `e2e` then reports such scenarios as missing.
8. First run:

   ```bash
   node <skill>/scripts/gdoc.mjs ping                # URL, token and access to the Doc
   node <skill>/scripts/gdoc.mjs sync --dry-run      # request sizes only
   node <skill>/scripts/gdoc.mjs init --confirm      # ONCE: builds Úvod and the chapter tabs
   ```

   `init` takes minutes (one call and one tab per chapter; Apps Script has a 6 minute limit per call). After
   the first `init` never run `init` on a Doc testers work in; use `sync`.

## Everyday use

```bash
node <skill>/scripts/gdoc.mjs sync                       # all chapters; tester entries stay
node <skill>/scripts/gdoc.mjs sync --chapter B2B,AUT     # chosen chapters
node <skill>/scripts/gdoc.mjs sync --from AUT --keep-going
node <skill>/scripts/gdoc.mjs sync --force               # rewrite unchanged texts too (restores formatting)
node <skill>/scripts/gdoc.mjs read --out results.json    # all entries as JSON (--chapter ABC for one tab)
node <skill>/scripts/gdoc.mjs intro --confirm            # rebuild only the Úvod tab
node <skill>/scripts/gdoc.mjs result --id ABC-01 --step 2 --result "✅ OK" [--fix "…"] [--append]
node <skill>/scripts/gdoc.mjs result --id ABC-01 --step 2 --result="--- OK ---"   # a value starting with -- needs =
```

`result` replaces the cell content, with `--append` it adds a paragraph; it never touches the checkbox.
`--scenarios DIR` and `--repo DIR` override the catalogue location and the repository root; `--dry-run`
calls nothing. `gdoc.mjs configured` exits 0 when the bridge is configured and 1 otherwise, silently.

After a change of `Code.gs`: paste the new content into Apps Script, then **Deploy → Manage deployments →
pencil → Version: New version → Deploy**. Saving the code alone is not enough; the URL stays the same.

If a call ends with a warning such as "finalizace záložky přeskočena", the text is written and only the
checkboxes or the merged headers are missing: repeat `sync --chapter …`. A call over about 5 minutes can
time out in the client; repeating it is safe.

## UAT agent writes results

When the project has the bridge configured, `uat-runner` writes every recorded step result into the Doc
(see [execution.md](execution.md)): `gdoc.mjs result … --if-configured`. Without a configuration that flag
makes the call a silent no-op, so the same command works in every project.

## Playwright results into the Doc

Name the end-to-end tests after the scenario they cover, with the ID at the very start of the title:

```ts
test('[B2B-03] Firemní zákazník vidí cenu bez DPH', async ({ page }) => { … });
```

The ID is a scenario prefix of 2–4 capital letters or digits, a dash and a number (`[ABC-03]`, `[B2B-03]`).
Tests without an ID are ignored; an ID that is not in the catalogue is printed as a warning and skipped.

Enable the JSON reporter in `playwright.config.ts` and run the tests:

```ts
reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
```

```bash
node <skill>/scripts/gdoc.mjs e2e --report test-results/e2e.json            # needs "automatedColumn": true
node <skill>/scripts/gdoc.mjs e2e --report test-results/e2e.json --dry-run  # show what would be written
```

Several tests may share one ID. They are aggregated per scenario: all passed = `✅ Prošlo`, any failed or
timed out = `❌ Selhalo` with a short reason (the first error line) and the date, anything else = `⏭ Přeskočeno`.
A test that passed on a retry counts as passed. The result lands in the `Automatický test` cell of the
scenario's first step row and replaces the previous run; nothing else in the table changes. In CI run the
command after the tests with `UAT_GDOC_URL` and `UAT_GDOC_TOKEN` from the CI secrets and `--repo` pointing at
the checkout.

## Security

- The Web App runs as the deploying account and can edit only the Doc named by `DOC_ID`.
- Rotate the token by changing the script property `TOKEN` and your local file; the old token stops working
  immediately and no new deployment is needed.
- `init` needs `--confirm`; erasing tester entries needs `--confirm --including-tester-data` as well.

## Known limits

The Apps Script was proven against a live Doc for `ping` and `read`. On the first run on a copy check page size
and margins per tab (`setPageSetup_`), the tab title limit (50 characters, `TAB_TITLE_MAX`), and that the DOCX/PDF
export contains all tabs. Details of the Docs API shapes are isolated in the small functions of `Code.gs`
(`createChapterTab_`, `deleteTabs_`, `renameTab_`, `clearTabBodyViaDocs_`). Moved steps (a real reorder) copy the
row and warn per row: check the checkbox state, because it cannot be read.
