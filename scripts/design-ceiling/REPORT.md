# #438 design-expression ceiling: Chromium comparison

This is a synthetic, hand-authored comparison of BaroCSS browser runtime against a Tailwind **4.3.3 build from the exact same HTML for each scene**. It measures rendering, not AI generation quality. No package change is proposed.

## Controls and method

- Input: 42 technique tiles and three showcase scenes. Input SHA-256: `d7a24c4134d4a0c53f1794cb2588ca8abf1af6a28af6bb9ff90f5215035a7f50`.
- Browser: Chromium `148.0.7778.96`, device scale 1; tile viewport 1140×900, kiosk 620×1060, chat/dashboard 900×680. Full-page captures include overflow.
- Baro bundle SHA-256: `825a7df6e4c860d1bb3ea6e331ccc0dbad6bb6c72112f50ba2341277b2815efc`. Tailwind source: installed `theme.css` plus the fixture’s `@theme` values; both engines use the same brand color, Georgia display font and orbit keyframes. Browser/runtime preflight is off; shared reset and tile-frame CSS is identical.
- Light color scheme with an explicit `.dark` root and matched dark selector. No external fonts, URLs or model calls. Local kiosk stub markup and SVG assets are reused read-only; all images decoded before capture.
- Animations are paused through the Web Animations API at 500 ms on both pages. Static transitions are compared by computed property, since no transition is triggered.
- Pixel mismatch means a pixel has a maximum RGB-channel difference greater than 8. `pixelDiffPct` divides those pixels by the tile region or complete showcase image. Computed-style comparison covers every non-custom property on marked probes; root custom properties are omitted. A 0% pixel result means no pixel exceeded this threshold; it is not a cross-browser guarantee.

## Per-tile result

| Group | Technique | Result | Pixel diff | Cause / note |
| --- | --- | --- | ---: | --- |
| Gradient | `linear-gradient` | Match | 0.00% | — |
| Gradient | `radial-gradient` | Match | 0.00% | — |
| Gradient | `conic-gradient` | Match | 0.00% | — |
| Gradient | `gradient-angle` | Match | 0.00% | — |
| Gradient | `gradient-oklch` | Visual difference | 37.77% | Baro gap: `/oklch` interpolation modifier emits no rule |
| Gradient | `gradient-alpha` | Match | 0.00% | — |
| Shadow | `shadow-xl` | Match | 0.00% | — |
| Shadow | `shadow-color` | Match | 0.00% | — |
| Shadow | `inset-shadow` | Match | 0.00% | — |
| Shadow | `ring` | Match | 0.00% | — |
| Shadow | `inset-ring` | Match | 0.00% | — |
| Glass | `backdrop-blur` | Match | 0.00% | — |
| Filter | `blur` | Match | 0.00% | — |
| Filter | `drop-shadow` | Match | 0.00% | — |
| Filter | `contrast` | Match | 0.00% | — |
| Filter | `hue-rotate` | Match | 0.00% | — |
| Blend | `mix-blend` | Match | 0.00% | — |
| Blend | `bg-blend` | Visual difference | 23.79% | Baro gap: two-layer arbitrary background becomes invalid nested gradient |
| Mask | `mask-linear` | Visual difference | 20.99% | Baro gap: `mask-linear-to-*` emits no rule |
| Mask | `mask-radial` | Visual difference | 34.87% | Baro gap: `mask-radial-from/to-*` emit no rules |
| Clip | `clip-polygon` | Match | 0.00% | — |
| 3D | `perspective` | Match | 0.00% | — |
| 3D | `rotate-x` | Match | 0.00% | — |
| 3D | `rotate-y` | Match | 0.00% | — |
| 3D | `transform-3d` | Match | 0.00% | Computed preserve-3d parity; no nested depth behavior tested |
| Motion | `transition-colors` | Rendered match; computed diff | 0.00% | Nonvisual: engine-specific gradient variable names in transition-property |
| Motion | `animate-pulse` | Match | 0.00% | — |
| Motion | `animate-spin` | Match | 0.00% | — |
| Motion | `theme-keyframes` | Match | 0.00% | — |
| Layout | `container-query` | Match | 0.00% | — |
| Layout | `aspect-video` | Match | 0.00% | — |
| Layout | `grid-areas` | Match | 0.00% | — |
| Layout | `subgrid` | Match | 0.00% | — |
| Type | `line-clamp` | Match | 0.00% | — |
| Type | `text-gradient` | Match | 0.00% | — |
| Type | `text-shadow` | Match | 0.00% | — |
| Interaction | `scroll-snap` | Match | 0.00% | — |
| Color | `dark-mode` | Visual difference | 1.24% | Baro gap: base text rule follows equal-specificity dark text rule |
| Color | `color-opacity` | Match | 0.00% | — |
| Color | `oklch-color` | Match | 0.00% | — |
| Type | `fluid-type` | Match | 0.00% | — |
| Type | `theme-font` | Match | 0.00% | — |

**Result:** 36 exact computed/pixel matches, one visual match with a nonvisual computed-value difference, and 5 visual differences. The aspect-ratio and line-clamp tiles now change their measured height when the target utility is removed, so their effects are active in both engines. All three showcases have 0.00% pixel difference and no marked-element computed differences.

The [five differing tiles side by side](evidence/tile-differences-side-by-side.png) show Tailwind on the left and BaroCSS on the right.

## Showcase screenshots (Tailwind left, BaroCSS right)

- [Coffee kiosk start screen](evidence/kiosk-side-by-side.png) — the existing local stub screen, with kiosk assets read-only.
- [Glassy AI chat card](evidence/chat-side-by-side.png) — authored static content.
- [Operations dashboard](evidence/dashboard-side-by-side.png) — authored static content.

Individual captures are also committed under `evidence/`; `result.json` contains the per-tile pixel percentages, computed-property differences, effect-on/effect-off measurements, stylesheet controls and rule-order evidence. With `aspect-video`, height is 108 px versus 42 px without it at 192 px width. With `line-clamp-3`, height is 78 px versus 222 px without it; clamped content has 222 px scroll height and 78 px client height in both engines.

## Minimum gaps and attribution

1. `bg-linear-to-r/oklch`: Tailwind compiles the interpolation modifier; Baro kit emits no rule. Minimum gap: compile `/oklch` for linear gradients. The browser supports this syntax in the same run.
2. `mask-linear-to-90%` and `mask-radial-from/to-*`: Tailwind compiles these tokens; Baro kit emits no rule. The linear mask therefore keeps its 100% endpoint; the radial mask has no mask image. Minimum gap: support the missing mask stop utilities and composition.
3. Two-layer arbitrary background under `bg-blend-multiply`: both engines emit a class, but Baro wraps the two gradients inside another `linear-gradient(...)`, making `background-image` invalid. Minimum gap: preserve an arbitrary background-image list without adding a gradient wrapper.
4. Dark text color: both engines compile the matched descendant dark selector. Tailwind places `.text-slate-900` before `.dark\:text-white`; Baro inserts them in reverse order at equal specificity, so base text wins. The dark background matches. Minimum gap: ensure the dark variant wins in runtime rule order.
5. `transition-colors` has no pixel difference. Its computed `transition-property` names the engines’ own gradient custom properties; this is a namespace difference, not a demonstrated rendered defect.

The minimal class-generation checks are in `evidence/isolation.json`; stylesheet order for the dark case is in `evidence/result.json`. No difference was attributed to browser support or capture timing in this Chromium run. Custom font and keyframe tiles match when their `@theme` values are supplied to both engines. The shared wrapper CSS only fixes test framing; the effect inputs use Tailwind utility classes.

## Rerun

Use installed dependencies and the built local browser bundle. Set `DEPS_ROOT` to a workspace with Tailwind 4.3.3 and built BaroCSS packages, `PW_DIR` to a local project containing `node_modules/playwright-core`, and `CHROME` to an installed Chromium executable:

```sh
export DEPS_ROOT=/path/to/existing/barocss-workspace
export PW_DIR=/path/to/existing/playwright-project
export CHROME=/path/to/existing/chrome-headless-shell
export BARO_UMD="$DEPS_ROOT/packages/barocss-browser/dist/cdn/barocss.umd.cjs"
node scripts/design-ceiling/run.mjs
node scripts/design-ceiling/isolate.mjs
node scripts/design-ceiling/verify.mjs
```

Limitations: the `transform-3d` tile compares the parent’s computed transform and rendering but has no nested depth test. One Chromium build and one fixed viewport per showcase; no Firefox/WebKit, responsive matrix, repeated-run variance, user interaction, real model output or production deployment. The 0% showcase finding applies to these authored static screens only.
