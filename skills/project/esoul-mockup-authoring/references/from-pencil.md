# Build a bundle from a Pencil design

Read when the bundle is built from a Pencil (`.pen`) design: the first bundle of a project, or a bundle that follows a design change.

The route: the design is first created and kept in the repository (`docs/design_pencil/<project>.pen`, Git LFS, with its brief and derived README; the design step of `esoul-project-lifecycle` owns that). An agent with access to the Pencil MCP server then creates the mockup from it. The MCP is the primary way: a `.pen` file is read only through the Pencil MCP tools (the Astro `frontend.md` guideline, opening paragraph), never as a plain file and never with `Read` or `grep`, and this route never changes the design. Designing in Pencil is outside this skill.

## Read the design

1. Call `get_app_state` for the open document, the selection and the documentation of `execute`; call `read_skill` when you need Pencil's own design reference. The calls available for reading nodes are described there; use them as documented, with `execute` on the project's `.pen` file and read operations only.
2. Pencil must be running with the file open. When the MCP server cannot connect, say so and stop; exported images under `docs/design_pencil/` help to compare but cannot replace the read, and the project's `scripts/pen.sh` is the other reader the design step names.
3. List the design's screens and frames: screen codes (`B1`, ...), desktop 1440 px and mobile 390 px frames, and the states the design shows as separate frames. Notes named "Poznámka — ..." are binding specification: apply them, do not publish them as text.

## Write the bundle

1. Map the design onto the manifest: one screen per design screen, one frame per viewport and per meaningful state, IDs derived from the screen code and frame name in lowercase. IDs stay stable between iterations.
2. Write one static HTML file per frame with the marked root of the bundle contract. Keep the Pencil node name of every element that maps to a named node as `data-pencil-name`, and add `data-mockup-label` where a reviewer needs context.
3. Put the design tokens (colours, type, spacing) once in a stylesheet under `assets/`, as `example/assets/design.css` does. Export the design's images through the MCP into `assets/`; fonts are system fonts or bundle-local files.
4. Link the frames of one flow with relative links, one frame per state ([states.md](states.md)).
5. Validate, preview and compare every frame with the design (the exported images, or a frame image through the MCP when its documentation offers one); record each place where HTML cannot express the design in the pull request.

## Iterate

A change request goes into the design first (the `client-update` pull request of the design step: brief, `.pen`, then the bundle), and the bundle is regenerated from it; the design stays the source of truth ([feedback.md](feedback.md) for reading the export). Node names that stay stable keep `data-pencil-name` meaningful across revisions.

No Pencil MCP and a finished HTML design in hand: start at step 2 of "Build and inspect locally" in `SKILL.md`.
