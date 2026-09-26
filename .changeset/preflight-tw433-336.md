---
"@barocss/kit": minor
---

The `full` preflight (the default, `preflight: true`) is now a rule-for-rule port of Tailwind CSS 4.3.3's preflight, and `rounded-full` emits Tailwind 4.3.3's value.

BEHAVIOUR CHANGE (every page using the default preflight):

- `img, svg, video, canvas, audio, iframe, embed, object` are now `display: block; vertical-align: middle`, as in Tailwind (before: only `img, picture` were block, `svg` was `vertical-align: middle`, `audio, video` were `inline-block`). `img, video` get `max-width: 100%; height: auto`.
- `table` now has `text-indent: 0; border-color: inherit; border-collapse: collapse` (before: `border-collapse: collapse; border-spacing: 0`).
- `*, ::after, ::before, ::backdrop, ::file-selector-button` carry the box-sizing / margin / padding / `border: 0 solid` reset (before: `*, *::before, *::after`).
- `html, :host`: `line-height: 1.5; tab-size: 4; -webkit-tap-highlight-color: transparent` (before: `line-height: 1.15` on html and `line-height: 1.5` plus smoothing/`text-rendering`/`min-height: 100vh`/`scroll-behavior: smooth` on `body`). The `body` rule is removed.
- New Tailwind rules: `hr` (height 0, colour inherit, 1px top border), `h1`–`h6` (font size/weight inherit), `a` (colour and text-decoration inherit, before `text-decoration: none`), `abbr:where([title])`, `menu` list reset, `summary { display: list-item }`, `:-moz-focusring`, `:-moz-ui-invalid`, date/time and search input fixes, `button, input:where([type=button|reset|submit]), ::file-selector-button { appearance: button }`, spin-button height, and `[hidden]:where(:not([hidden='until-found'])) { display: none !important }`.
- Removed BaroCSS-only extras: the global `:focus` blue outline, `.skip-link`, `@media print` styles, the `prefers-reduced-motion` override, `picture`/sectioning-element `display: block`, `template`/`[hidden]` plain `display: none`, `iframe { border: 0 }`, `fieldset`/`legend` and the normalize.css form-control rules (`font-size: 100%`, `line-height: 1.15`, `text-transform: none`, `-webkit-appearance`, `textarea { overflow: auto }`).
- `rounded-full` and every `rounded-*-full` corner utility now emit `calc(infinity * 1px)` (before: `9999px`). A theme that sets `borderRadius.full` to a non-default value still gets `var(--radius-full)` (#300).

The `standard` and `minimal` levels are unchanged; their deliberate differences from Tailwind are listed in `tests/compat/preflight-336.test.ts`.

Focus now uses the browser's default focus ring; if you relied on the removed `prefers-reduced-motion` override, use `motion-reduce:` / `motion-safe:` variants or your own `@media (prefers-reduced-motion: reduce)` rule.
