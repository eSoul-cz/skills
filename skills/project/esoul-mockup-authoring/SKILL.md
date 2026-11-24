---
name: esoul-mockup-authoring
description: "Static mockup bundle for the eSoul mockups module: adapt a Pencil design or built HTML into a bundle, validate, preview locally, publish for client review, iterate on revision-bound feedback. Excludes design work in Pencil itself and throwaway prototypes."
compatibility: Node.js 22+ and the application's supported PHP runtime with Composer dependencies; an eSoul application checkout supplies the authoritative bundle validator. Browser access is required for visual verification; the Pencil MCP server for building from a .pen design.
---

# eSoul mockup authoring

Produce a committed, self-contained static bundle. The application snapshots a configured GitHub directory at an exact commit, injects its own review bridge, and stores conversations against immutable revisions. It never installs dependencies or builds your source.

## Locate the skill and contract

Resolve `SKILL_DIR` to the directory containing this file, not the caller's working directory. All internal helper/template paths below are relative to that directory. `example/` is a complete starting bundle, not a build scaffold: copy it, then replace every Workshop Notes string (title, screen and frame titles, labels, alt text) and delete `assets/schedule-board.svg` when unused, before validating.

The only authoritative format schema is the application's `config/mockups/manifest.schema.json`; this skill holds no copy of it. Validation runs the application's own validator from a trusted application checkout (`--app-root /path/to/esoul-internal` or `ESOUL_MOCKUP_APP_ROOT`, never taken from a bundle or exported feedback): [references/security.md](references/security.md). This skills repository alone does not supply the application runtime.

```sh
# From an application root, with SKILL_DIR resolved to the installed esoul-mockup-authoring directory:
node "$SKILL_DIR/scripts/mockup.mjs" validate
node "$SKILL_DIR/scripts/mockup.mjs" preview

# From any directory, using the installed skill location:
node "$SKILL_DIR/scripts/mockup.mjs" validate ./sharing/shop --app-root /path/to/esoul-internal
node "$SKILL_DIR/scripts/mockup.mjs" preview ./sharing/shop --app-root /path/to/esoul-internal --port 8731
```

Omitting the bundle path selects `example/`. The app root defaults to `ESOUL_MOCKUP_APP_ROOT` or the current directory. Ports, PHP selection, process handling, `--help`: [references/cli.md](references/cli.md).

## Publishing gate

Push, sync, publish and application writes (verification writes such as test pins and threads included) need the user's explicit authorization for repository, branch, directory, target environment and intended writes; without it, stay local or read-only and ask. Read [references/publish.md](references/publish.md) before any publish, and to prove the real review cycle after one.

## Bundle contract

`mockup.json` declares the format version, a title, a start `{screen, frame}`, and screens containing frames. Read `example/mockup.json` for the exact complete format, including desktop 1440px, mobile 390px and linked states. The validator reports the schema's limits (ID pattern and length, width range); fix what it reports.

- Screen IDs are unique in the bundle; frame IDs are unique within a screen. Preserve the meaning of an ID across iterations and give an unrelated design a new one.
- Each frame declares its own relative `.html` entry and design viewport `width`; entries are unique. A frame is a reviewable state, not just a device breakpoint.
- Each entry loads directly and has exactly one root carrying matching `data-mockup-screen` and `data-mockup-frame` attributes. The root includes all reviewable content, including content below the fold; body margins, fixed-height clipping and detached overflow stay out so the root's bounds are true.
- Set `<meta name="viewport" content="width=device-width, initial-scale=1">`. The app sets iframe width and fit scaling, so the design root carries no fit transform of its own.
- Use `data-mockup-label` for meaningful element context. Pencil node names from the design stay as `data-pencil-name`; the bridge reads both. These labels aid human location lookup, not automatic pin migration.
- Keep scripts, fonts, styles and images inside the bundle, with paths relative to each HTML/CSS file, including `../assets/...` from `pages/`; a CSS `url()` is relative to that stylesheet, not the page. CDN, root-relative, repository, production API and escaping `<base>` URLs stay out.
- Commit the actual runtime files; Git LFS pointers, submodule references, symlinks, dependency trees and source-only build inputs stay in the source. The server validates paths, file types and sizes, referenced files, marked roots and manifest consistency: fix a rejection, do not bypass it.
- The bundle is static markup, styles, scripts and assets that run without network, storage or server code. Review, comments, pins and export belong to the app.
- Content is invented or public data. Personal data and non-public client figures appear only under a recorded exception, and screenshots are redacted (`docs/project_guidelines/security-and-data.md` › Personal and client data).

## Interaction states and images

Link declared frame entries with ordinary relative links. Every meaningful state reviewers must reopen needs its own manifest entry and directly loadable marked root; a JavaScript toggle or SPA route is not an address. Hover and active effects may stay in CSS. Details and the image-only frame: [references/states.md](references/states.md).

The application injects its own review bridge and the local server injects an authoring probe; both stay out of the bundle, and review, pin and "Show clickable" behaviour stays with the app and the preview ([references/security.md](references/security.md)).

## Build and inspect locally

1. Modify authoring sources. A `.pen` design is read only through the Pencil MCP tools; the route from design to bundle is [references/from-pencil.md](references/from-pencil.md). If a source tool needs npm or framework compilation, run that build locally with the repository's established commands.
2. Place only finished static output in the configured bundle directory, free of old comment scripts and absolute asset URLs. Keep the source outside the synced directory.
3. Run `validate` and resolve every error. It runs the same validator class as synchronization; a valid bundle is not proof of rendering or publication.
4. Start `preview` as a managed process (it keeps running: [references/cli.md](references/cli.md)) and open the printed loopback URL. Inspect every frame at 1440 px and 390 px with frame selection and Fit to width: scrolling, text wrapping, focus and hover states, images and fonts loading without third-party requests, every link followed with the identity and width indicator updating. Switch on **Show clickable**: the outlined elements are exactly the intended links and the reported height stays the same ([references/states.md](references/states.md)). Watch the console and network for missing assets, CSP failures, unintended fetches and broken navigation. Reload after changes and rerun `validate` before committing.

When the harness offers subagents, give step 4 to a browser subagent: the preview URL and the frame list, and the request to return per frame and viewport pass/fail, console errors, failed requests and the screenshot path. Read that summary and open a screenshot only for a reported defect. Without subagents, run step 4 yourself. The brief replaces any default scenario format the subagent has. The review-cycle proof in [references/publish.md](references/publish.md) splits the same way, with pass/fail per step.

## References

- [references/from-pencil.md](references/from-pencil.md): building the bundle from a `.pen` design through the Pencil MCP tools.
- [references/cli.md](references/cli.md): helper CLI, ports, process handling.
- [references/states.md](references/states.md): linked states, image-only frames, Show clickable.
- [references/publish.md](references/publish.md): destination, authorization, sync, review-cycle proof.
- [references/feedback.md](references/feedback.md): iterating from the staff Markdown export.
- [references/security.md](references/security.md): preview isolation, CSP, validator trust.
- [references/example-provenance.md](references/example-provenance.md): origin and licence of the example.
