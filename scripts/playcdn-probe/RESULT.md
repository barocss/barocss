# #249 Play CDN default + BaroCSS drop-in probe

Rerun: `bash scripts/playcdn-probe/generate.sh && node scripts/playcdn-probe/extract.mjs`
(raw/ is gitignored; outputs/*.html and classify.json are committed.)

Prompt: "Make <request> as one HTML file. Reply with only the HTML." No styling library named, no tools,
run outside the repo (no CLAUDE.md). 8 requests x {opus, haiku} = 16 outputs, 2026-09-26.

## Approach counts
| model | Play CDN (+config) | TW v4 browser | plain `<style>` | other |
|-------|-------------------|---------------|-----------------|-------|
| opus  | 0 (0) | 0 | 8 | 0 |
| haiku | 0 (0) | 0 | 8 | 0 |

External assets: one Chart.js (haiku-3). No Google Fonts, no CSS framework.

## Render arms
Not run: zero Play CDN outputs, so there is nothing to render under reference / blocked / BaroCSS+shim.
Inline-config loss is undefined (0 usages). BaroCSS core already merges `theme.extend`
(packages/barocss/src/core/context.ts), so a `tailwind.config` shim would be ~5 lines if ever needed.

## Existing capability (desk)
- twind (v0.16 / v1 `@twind/preset-tailwind`): Play-CDN-style runtime; takes a v3-shaped config via
  `install({...})`/`setup`, not the global `tailwind.config` assignment; project unmaintained since 2023.
- @tailwindcss/browser (v4): CSS-first `@theme` in `<style type="text/tailwindcss">`; ignores a JS
  `tailwind.config`; a shim would need to translate to `@theme`.
- UnoCSS runtime (`@unocss/runtime`, preset-wind): config via `window.__unocss`, not `tailwind.config`.
- Play CDN itself (cdn.tailwindcss.com, v3) is the only one that honours `tailwind.config = {...}` natively.

## Cost
$1.04 generation (opus-dominated).

## Verdict
A Play CDN drop-in is a real BaroCSS use case: **no** (on this evidence) -- unprompted, both models
wrote plain `<style>` 16/16; Play CDN appears only when the user asks for Tailwind.
