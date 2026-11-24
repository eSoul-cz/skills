# Interaction states and images

Read when authoring linked interaction states, adapting framework output, or adding an image-only frame.

Use ordinary relative links between declared frame entries. In the example, `home-desktop.html` links to `home-menu.html`; `home-mobile.html` links to `home-mobile-menu.html`. Menus close through links back to their original frames. The mobile drawer explicitly links to the included desktop detail instead of pretending that an unimplemented mobile second level exists.

Small hover/active effects may stay in CSS. Any meaningful state that reviewers need to open later must have a manifest entry and directly loadable marked root. An arbitrary JavaScript toggle is not a durable address for feedback. For framework-based work, prerender/export each state locally and retain relative entry links in the output. Do not use a SPA route that needs a server fallback.

`schedule-image.html` shows an image inside the same root contract with explicit intrinsic dimensions and descriptive `alt` text. It is reviewed through the normal app bridge, not a separate gallery system. The small local SVG is an independently authored fictional workshop schedule, not a client screenshot. Replace it with an authorized locally stored image when appropriate; keep the HTML wrapper.

## Show clickable check

Switch on **Show clickable** and check that the outlined elements are exactly the ones meant to act: every declared link, and nothing that only looks like a button. It outlines `a[href]`, `button`, `label[for]`, `summary`, and `[onclick]`, so a state wired through a listener added at runtime stays invisible to it — one more reason such a state does not belong in a bundle. The outline is paint only, so the reported height must not change when you toggle it; a frame that resizes means the design reserves space for something it should not.
