# Browser setup

Two drivers, each used for what it does well:

| Driver | Used for | Why |
|---|---|---|
| **Claude in Chrome** (extension in a dedicated Chrome profile) | functional scenarios as an end user, desktop and tablet widths | real Chrome with real rendering, cookies, extensions, and the user able to watch |
| **Playwright** (`scripts/sweep.mjs`) | device emulation (mobile widths, touch, DPR), screenshots saved as files, the layout audit across many routes | the extension cannot emulate devices or narrow the window below Chrome's minimum width, and its screenshots are not files |

## One-time setup per machine

1. In Chrome, create a profile named **eSoul UAT**. Do not sign in to a personal Google
   account, do not import passwords, do not install personal extensions.
2. Install **Claude in Chrome** in that profile and sign in with the eSoul Claude account.
3. Start Claude Code with `claude --chrome` (or run `/chrome` in a session) while the
   eSoul UAT profile window is open.
4. In `setup` mode, verify the connection: list open tabs and confirm they belong to the
   eSoul UAT profile (open a tab with `about:blank#esoul-uat` in that profile and look for
   it). If tabs of a personal profile appear, stop: the extension is connected to the wrong
   profile.
5. Playwright: `node <skill>/scripts/sweep.mjs --check` installs nothing by itself; it reports
   whether `playwright` is resolvable and whether Google Chrome is installed. Install with
   `npm install --prefix ~/.cache/esoul-uat playwright@1` when missing. The sweep uses the
   installed Google Chrome (`channel: 'chrome'`), so no browser download is needed.

## Working in the extension

- Navigate, read the page structure before clicking, click and type like a user. Use the
  page's visible labels to find controls; do not drive the app through JavaScript except for
  the read-only layout audit and reading state the user could see.
- After each navigation, read console messages and failed network requests and keep them
  for the result.
- Resize the window for desktop (1440×900, 1280×800) and tablet (1024×768, 768×1024 when the
  screen allows). Narrower devices go to the Playwright sweep.
- Log out between roles. Use a fresh tab per chapter. If the app stores filters or column
  settings per user, reset them or note it.
- Native browser dialogs (`confirm`, `alert`) block the extension; when a scenario triggers
  one, note it and ask the user to confirm the dialog if needed.
- Never type a password where it would be visible in a screenshot or GIF that is saved.
- Screenshots for evidence: capture in the extension to judge the state, and capture the
  file version with the sweep (`--url … --device … --shot`) or with a macOS window capture
  (`screencapture -l <windowid> file.png`) of the UAT profile window. Pilot runs decide which
  one is the default for a project; record it in the project `README.md`.

## Sessions in Playwright

`sweep.mjs` logs in through the login form with credentials from the secrets file and stores
the session in `~/.cache/esoul-uat/<repository>/<role>.json` (never in the repository). The
login path, form selectors, and the routes to sweep per role are in
`docs/testing/uat/uat.config.json` (template in `assets/templates/uat.config.json`).
