# Project guidelines - Frontend

The Pencil design in `docs/design_pencil/` is the source of truth for how the site looks. It is
read only through the Pencil MCP tools, never as a file. Code follows the design; a deliberate
deviation is recorded with its reason in `README.md`, *Odchylky od návrhu*, and approved by the
client. Colours, fonts and spacing are never changed "to make it nicer".

## Design tokens

- Tokens are defined once, in `src/styles/global.css`, in a single `@theme inline` block that
  mirrors the Pencil foundations under **the same names as the Pencil variables**. Raw values sit
  on `:root`; `@theme inline` maps them to Tailwind. When a Pencil variable changes, the token
  changes in the same pull request.
- Tailwind 4 runs through the `@tailwindcss/vite` plugin; there is no `tailwind.config.js` and no
  legacy `@astrojs/tailwind` integration.
- Tailwind's defaults that the design replaces are removed (`--color-*: initial`,
  `--text-*: initial`, `--radius-*: initial`, and so on), so `bg-white`, `text-gray-500`,
  `text-xl` or a bare `rounded` do not exist. Use the design's tokens.
- **No arbitrary values** for anything a token expresses (`text-[15px]`, `bg-[#1E5B48]`,
  `rounded-[12px]`). Tailwind cannot block them, so review does. If the design needs a value
  without a token, add the token.
- Sizes are in **rem**, never px. Type sizes MAY be fluid (`clamp()`) between the design's mobile
  (390 px) and desktop (1440 px) values, so they need no breakpoint variants.
- Markup repeated many times per page (rows, list items, icons) uses component classes in
  `@layer components` instead of long utility strings, to keep the HTML small.

## Pencil to component map

Every reusable design-system component in Pencil has one component in `src/components/ui/`. The
map is kept here and updated with every new or renamed component:

| Pencil node | Component | Variants |
|---|---|---|
| `{{PEN_NODE_ID}}` ({{PEN_NODE_NAME}}) | `{{COMPONENT_PATH}}` | {{COMPONENT_VARIANTS}} |

- Frames used only as design aids (brand manual, export templates) are not built.
- A dev-only preview page renders every UI component at both widths; it returns 404 in
  production.
- Checking against the design is done with screenshots next to the frame at 1440 and 390 px, not
  by eye.

## Fonts

- Fonts load through the **Astro Fonts API** (`fonts` in `astro.config.mjs`), self-hosted at
  build. Only the weights and styles the design uses are loaded.
- Subsets include **`latin-ext`** for Czech. Fonts needed above the fold are preloaded, the
  `latin-ext` subset included; preloading only `latin` makes letters with diacritics flash in the
  fallback font.
- The font component is rendered in the head of every page. Licences of non-Google fonts are
  recorded in a decision.

## Images

- Images go through `astro:assets` (`<Image>` or `<Picture>`) with **AVIF and WebP**, explicit
  `width` and `height`, a meaningful `alt` (empty for decoration) and `loading="lazy"` below the
  fold. The hero image gets `fetchpriority="high"` and is never lazy.
- `srcset` widths come from one shared helper that covers common mobile widths times device
  pixel ratio, so the browser never jumps to a much larger file.
- Encoder quality stays at the default unless a measured reason says otherwise.
- Source photos live in `assets/` (Git LFS) or `src/assets/`; the build output contains only the
  files the pages reference.
- The logo is an image (SVG or PNG), never typeset.

## Motion

- One animation library per project ({{MOTION_LIBRARY}}); no hand-rolled keyframes and no second
  library for carousels, drag and drop or gestures.
- Animations are subtle: short fades and slides, gentle easing, nothing bounce-heavy.
- **Every animation respects `prefers-reduced-motion`**: with reduced motion, elements appear in
  their final state without movement.
- Animations never block LCP: hero text renders immediately, animations start after load, and
  content that is on screen at load stays put.
- Drag-to-reorder is always paired with keyboard-accessible move controls.

## Accessibility

- Semantic HTML first: one `h1` per page, headings in order, landmarks, buttons for actions and
  links for navigation.
- Every form control has a bound label and a `name`; errors are attached to their control and
  announced.
- Visible focus on every interactive element; colour is never the only carrier of a state;
  contrast meets WCAG AA in every theme the design defines.
- Icon-only controls have an accessible name; decorative icons are hidden from assistive
  technology.
- axe reports no violations on any route before launch ([tools.md](tools.md)).

## Responsive layout

- Build mobile-first. The design's two frames (390 and 1440 px) are the reference widths, and the
  layout holds between them and beyond 1440 px.
- Breakpoints come from tokens that match the design's frames, not from Tailwind's defaults.

## Third-party scripts

- Analytics, tag managers and marketing pixels load only after the cookie consent allows them,
  from one place in the base layout, and only when their public id is configured
  ([deployment.md](deployment.md#build-arguments)).
- Embeds (maps, video) load on interaction or below the fold, with a static placeholder.
