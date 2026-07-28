# Theme showcase visual baselines

These PNGs are reviewed 96 DPI renders of the complete theme showcase:

- `default/` covers the neutral built-in theme.
- `esoul/` covers the branded theme with client identity and metadata.

The Docker smoke gate renders the current showcase with fixed build metadata and
compares every page through `assert-visual-regression`. A comparison fails when
the page count or dimensions change, or when more than 0.5% of a page's pixels
differ after a 3% color fuzz allowance. The small allowance accommodates
platform-level antialiasing differences without accepting meaningful movement,
reflow, clipping, or color changes.

Baseline changes are release-review artifacts. Regenerate them only for an
intentional design change, inspect every resulting page, and commit the source,
baseline, and rationale together. Do not replace baselines merely to make a
failed comparison pass.
