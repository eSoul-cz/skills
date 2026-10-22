# Responsive and design checks

Design is tested in two layers. Layer 1 runs on every project. Layer 2 runs when a design
source exists.

## Device matrix

Default, overridable in `uat.config.json`:

| ID | Viewport | Emulation | Driver |
|---|---|---|---|
| `desktop` | 1440×900 | — | Chrome extension |
| `laptop` | 1280×800 | — | Chrome extension |
| `tablet` | 768×1024 | touch, DPR 2 | Playwright (or extension when the screen allows) |
| `mobile` | 390×844 | touch, DPR 3, iPhone UA | Playwright |
| `mobile-s` | 360×800 | touch, DPR 3, Android UA | Playwright |

Which scenarios run where:

- `Zařízení: all` scenarios (main flows) run on every device.
- Every route reachable by each role gets the **responsive sweep** on every device: load,
  screenshot, layout audit. No scenario needed per page.
- Everything else runs on `desktop` only unless the scenario says otherwise.
- Applications used in the field (for example an evaluation form on a tablet) get the
  field device as a full device for their chapters; record that in `uat.config.json`.

## Layer 1: layout audit

`scripts/layout-audit.js` is a read-only script evaluated in the page (through
`sweep.mjs`, or pasted into the extension's JavaScript tool). It returns JSON findings:

| Check | Finding |
|---|---|
| Page overflow | document wider than the viewport (horizontal scroll) |
| Element overflow | content wider or taller than its box where overflow is visible, i.e. it spills out |
| Clipped text | text cut by `overflow: hidden` or `text-overflow: ellipsis` with no tooltip or title |
| Overlap | the centre point of a visible button, link, or input is covered by another element |
| Off-screen | an interactive element positioned outside the viewport horizontally |
| Tap target | interactive element smaller than 44×44 px on touch devices (24×24 px elsewhere) |
| Broken image | `img` completed with zero natural width |
| Font fallback | a declared web font that did not load |
| Fixed overlays | fixed or sticky elements covering more than 30 % of a mobile viewport |

The audit reports candidates. Before turning a finding into a bug, look at the screenshot and
confirm it is visible to a user. Intended overflow (scroll containers, carousels) is not a bug.

Also check by looking, on every screenshot: text over images with poor contrast, misaligned
grids, inconsistent spacing between sibling cards, cut-off modals, sticky headers covering
anchors, dropdowns rendered under other elements.

Accessibility depth (axe-core) runs when the project or user asks for it, or for `website`
and `eshop` product types; use the accessibility skill when installed.

## Layer 2: comparison with the design

Sources, in order of preference:

1. `.pen` file in the repository: read frames and screenshots through the Pencil MCP tools.
2. Figma: link in `CONTEXT.md › ## Project profile` (`- Design: <url>`) or `design-map.md`;
   read frames with the Figma MCP (`get_screenshot`, `get_variable_defs`,
   `get_design_context`) after its session setup.
3. eSoul mockup bundle (`esoul-mockup-authoring`): pages and states by address.
4. Exported PNGs in the repository: visual reference only, no tokens.

### `design-map.md`

```md
| Obrazovka | Stav | Zařízení | URL | Rámec návrhu |
|---|---|---|---|---|
| Seznam zvířat | výchozí | desktop | /animals/sheep | SCHOK.pen › Zvířata / Seznam |
| Detail zvířete | záložka Užitkovost | mobile | /animals/sheep/{id}?tab=utility | Figma 12:345 |
```

Build it in `plan` mode by listing design frames and matching them to routes; ask the user to
confirm the mapping once. Frames without a route are reported (not built yet); routes
without a frame are compared against the design system only.

### Comparison

For each mapped row, reach the state in the app at the frame's viewport, take a screenshot,
and compare it side by side with the frame:

- layout and hierarchy: order of sections, alignment, columns, what is above the fold;
- components: the right component and variant, states (hover, active, disabled, error);
- content rules: truncation, empty states, labels;
- tokens: read computed styles of key elements (text colours, backgrounds, font family,
  size and weight, radius, spacing of main containers) and compare with design variables.

Data differs between design and app; compare structure and styling, not content. Do not
pixel-diff. Report a finding only when a user or the designer would see it as different, and
give each a severity: `blocker` (unusable, overlapping controls, hidden actions), `major`
(wrong component, broken layout on a device), `minor` (spacing, colour off the token).

Without a design source, compare against the project's design-system rules when they exist
(component contracts, tokens) and report only clear inconsistencies.

## Evidence

Store screenshots as `screenshots/<scenario-or-route>-<device>-<n>.png`. For design findings
also store the frame image and a side-by-side image when possible; mark the problem area in
the bug text with coordinates or the element's visible label.
