# Global Illumination

The single, shared "active / hover / focus" glow used across the app. Every
illuminated icon + text (bottom octagon bar, drop-up menu items, and anything
added later) must use **this exact colour and bloom** so the whole UI lights up
consistently.

## Colour

| Token   | Value     |
| ------- | --------- |
| ORANGE  | `#F5852A` |

Set the element's `color` (or SVG `fill` / `stroke`) to `#F5852A` in the lit
state. The bloom filter reads that colour as its source, so the glow is orange.

## Bloom effect

A real multi-scale bloom (4-level Gaussian pyramid screened together + an
overexposed "hot" core), **not** a flat `text-shadow`. It is defined once as two
SVG filters in `components/octagon-toolbar.tsx` (`<defs>`):

- **`#illuminate`** — used by the bottom octagon bar. Blur radii `4 / 9 / 18 / 30`
  are in the octagon's SVG user space (the whole SVG is displayed at ~0.22×, so
  the on-screen blur is ~1–7px).
- **`#illuminate-ui`** — the **same** filter with radii pre-scaled to
  `1 / 2.2 / 4 / 6.6` so it produces an identical on-screen glow when applied to
  normal-DPI **HTML** (which is not scaled down). Use this one for HTML.

Both share the identical hot-core colour matrix:

```
1.4 0.3  0.15 0 0.10
0.9 1.25 0.2  0 0.07
0.4 0.4  1.15 0 0.03
0   0    0    1 0
```

## How to apply

**HTML element (icon + text):**

```css
.thing:hover,
.thing:focus,
.thing.is-active {
  color: #F5852A;              /* source colour for the bloom */
  filter: url(#illuminate-ui); /* the shared bloom */
}
```

Icons should use `stroke="currentColor"` / `fill="currentColor"` so they inherit
the lit colour. Add `transition: color .2s ease, filter .25s ease;`.

**SVG inside the octagon bar:** set `fill`/`stroke` to `#F5852A` and apply
`style={{ filter: "url(#illuminate)" }}` on the `<g>`.

## Rules

- Do **not** invent new glow colours or `text-shadow`/`drop-shadow` blooms —
  reuse `#F5852A` + the filter above.
- HTML → `#illuminate-ui`. In-bar SVG → `#illuminate`. Keep the two filters in
  sync (same structure/hot-core; only the blur radii differ by the ~0.22× scale).
- The `#illuminate-ui` filter node must exist in the DOM for `filter: url(...)`
  to resolve — it lives in the octagon toolbar's `<defs>`, which is always
  rendered.

## Bottom-bar active behaviour

While the drop-up menu is open, **only** the MENU slot stays illuminated; the
other bar slots (Home / Rewards / Scan / Messages) drop their active glow so the
open menu reads as the single active control.
