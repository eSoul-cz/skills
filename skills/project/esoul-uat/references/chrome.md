# Browser setup

A UAT run needs two things: **a browser tool that can use a dedicated profile** for clicking
through scenarios, and **Playwright** for what that tool cannot do. Never use the user's
personal browser profile with personal sessions.

| Driver | Used for | Why |
|---|---|---|
| **Claude in Chrome** (extension in a dedicated Chrome profile), the default | functional scenarios as an end user, desktop and tablet widths | real Chrome with real rendering, cookies, extensions, and the user able to watch |
| **A CDP session of a dedicated Chrome** (any browser tool that attaches to a Chrome started with `--user-data-dir=<dedicated dir>` and `--remote-debugging-port=<port>`, bound to localhost) | the same, when the extension is not available | the dedicated profile is dedicated by construction |
| **Playwright** (`scripts/sweep.mjs`) | device emulation (mobile widths, touch, DPR), screenshots saved as files, the layout audit across many routes | the extension cannot emulate devices or narrow the window below Chrome's minimum width, and its screenshots are not files |

With none of the first two available, run only the sweep and report the functional scenarios
as `blocked` ("no browser tool with a dedicated profile").

## Human setup (once per machine)

A person does this; the agent only verifies the result (next section).

1. In Chrome, create a profile named **eSoul UAT**. Do not sign in to a personal Google
   account, do not import passwords, do not install personal extensions.
2. Extension route: install **Claude in Chrome** in that profile, sign in with the eSoul
   Claude account, and start Claude Code with `claude --chrome` (or run `/chrome` in a session)
   while the eSoul UAT profile window is open.
   CDP route: start a Chrome with its own `--user-data-dir` and `--remote-debugging-port`, and
   connect the browser tool to that port.
3. Playwright: `node <skill>/scripts/sweep.mjs --check` installs nothing by itself; it reports
   whether `playwright` is resolvable and whether Google Chrome is installed. Install with
   `npm install --prefix ~/.cache/esoul-uat playwright@1` when missing. The sweep uses the
   installed Google Chrome (`channel: 'chrome'`), so no browser download is needed.

## Agent checks (in `setup` mode)

- Extension route: list the open tabs and confirm they belong to the eSoul UAT profile (open a
  tab with `about:blank#esoul-uat` in that profile and look for it). If tabs of a personal
  profile appear, stop: the extension is connected to the wrong profile.
- CDP route: confirm the tool is attached to the dedicated Chrome (its `--user-data-dir` is the
  dedicated one, no personal sessions in its tabs).
- Run `sweep.mjs --check`; it must exit 0.

## Working in the browser tool

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
- Passwords: [access.md](access.md) › Who reads the passwords. Never type a password where it
  would be visible in a screenshot or GIF that is saved.
- Screenshots for evidence: capture in the browser tool to judge the state, then save a file:
  - a state reached by clicking (validation error, open dialog, half-filled form, toast)
    exists only in that window: save the capture with a tool that writes files (a CDP-attached
    tool, Playwright). When the tool shows the capture only in the conversation, describe the
    state in the result note and list the scenario under `## K ručnímu ověření` so a person
    attaches the screenshot;
  - a state that a URL reopens (a list, a detail, a filtered view) can be captured with the
    sweep (see below), which uses its own session.
  Pilot runs decide the defaults for a project; record them in the project `README.md`.

## Sessions in Playwright

`sweep.mjs` logs in through the login form with credentials from the secrets file and stores
the session in `~/.cache/esoul-uat/<repository>/<role>.json` (never in the repository). The
login path, form selectors, and the routes to sweep per role are in
`docs/testing/uat/uat.config.json` (template in `assets/templates/uat.config.json`).

Sweep of a whole route list, and a single page with a named screenshot:

```bash
node <skill>/scripts/sweep.mjs --config docs/testing/uat/uat.config.json \
  --secrets ~/.config/esoul-uat/<repo>.<env>.env --run <run-dir> --devices tablet,mobile
node <skill>/scripts/sweep.mjs --config docs/testing/uat/uat.config.json \
  --secrets ~/.config/esoul-uat/<repo>.<env>.env --run <run-dir> \
  --role B --device mobile --url /path --shot name
```
