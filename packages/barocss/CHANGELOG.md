# @barocss/kit

## 0.10.0

### Minor Changes

- 0.10.0: strict Content-Security-Policy support, and negated variants.

  **New:**

  - `@barocss/browser` runs on strict-CSP pages that don't allow `style-src 'unsafe-inline'`: pass a `nonce` (applied to every style element the runtime creates, preflight included), or use `constructable: true` (constructable stylesheets). Pass these on the **first** `getRuntime` / `baroStart` call; a later mismatched call logs one warning. `ssrStyleTag` accepts a nonce too.
  - Negated variants as in Tailwind 4: `not-data-[…]`, `not-aria-*`, `not-has-[…]`, `not-supports-[…]`, `not-<breakpoint>`; plus `group-aria-*`.

  **Fixes:** `peer-aria-*` selectors; invalid variant forms now emit nothing instead of invalid CSS.

  **Docs:** the security guide covers limiting external `url()` loads (CSP and a host pre-filter), and the Shadow DOM limits (document CSS doesn't cross shadow roots).

### Patch Changes

- 1d9dc53: Tidy low-severity fuzz findings (#335), matching Tailwind 4.3.3: `not-`/`group-`/`peer-`/`peer-has-` with an unknown inner variant emit nothing (known ones compound through the variant's own selector, e.g. `not-first` → `:not(:first-child)`); `placeholder:`, `selection:`, `file:` and `marker:` emit Tailwind's selectors without legacy vendor splits, and merged `@property` blocks carry each descriptor once; a selector or at-rule prelude containing `url(` is dropped; class lists split on ASCII whitespace only (a non-ASCII space is part of the class token).
- 2b437e6: Negated and group-aria variants match Tailwind 4.3.3 (#352): `not-data-*`/`not-aria-*` (`:not([aria-checked="true"])`), `not-has-*` (`:not(:has(…))`), `not-supports-[…]` (`@supports not (…)`), `not-<breakpoint>`/`not-max-*`/`not-min-[…]` and `not-dark`/`not-print`/`not-motion-*`/`not-portrait` and similar (`@media not (…)`), and bare `group-aria-<state>`/`peer-aria-<state>` (including `/name`) as `[aria-<state>="true"]`. Negated media sorts with base rules in the runtime rule order, as Tailwind orders `not-*`.

## 0.9.0

### Minor Changes

- 0b4acbf: The `full` preflight (the default, `preflight: true`) is now a rule-for-rule port of Tailwind CSS 4.3.3's preflight, and `rounded-full` emits Tailwind 4.3.3's value.

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

- 0.9.0: embedding AI widgets in Shadow DOM, new theme keys, and preflight parity with Tailwind 4.3.

  **New:**

  - `@barocss/browser`: a `root` option for Shadow DOM. The runtime's preflight and utilities live in the shadow root (using `:host`), never in `document.head`; roots with the same config share one constructable stylesheet; rule GC works per root. The host page is untouched, and host fonts and colours don't leak in.
  - New theme keys create utilities (e.g. `theme.extend.borderRadius.card` → `rounded-card`, `fontFamily.display` → `font-display`).
  - Custom theme keys follow Tailwind's per-utility precedence on shared roots (e.g. a custom `borderWidth` key gives `border-thick` a width, not a colour); functional `ring-offset-<colour|width>`.

  **Behaviour changes (please check when upgrading):**

  - Preflight matches Tailwind 4.3.3 rule by rule (e.g. `svg` is `display: block`; table border colours are inherited; focus-ring and reduced-motion rules as in Tailwind). `rounded-full` is `calc(infinity * 1px)`.
  - `content-["x"]` keeps its quotes correctly; `content-[url(x)]` emits `url()` as in Tailwind. See the new security guide for untrusted class input and CSP.

  **Docs:** a security guide for untrusted class input (what classes can and can't do, CSP, `ssrStyleTag`, the Shadow `root` option).

- f25fa7f: New theme keys create utilities, as in Tailwind 4 (#300): `theme.extend.borderRadius.card` gives `rounded-card` (and `rounded-t-card` …), `fontFamily.display` gives `font-display`, `fontWeight.heavy` gives `font-heavy`, `boxShadow.card`/`insetShadow.card` give `shadow-card`/`inset-shadow-card` (with shadow colours and `/alpha`), `fontSize.hero` (including `['4rem', { lineHeight }]`) gives `text-hero`, and `blur`, `transitionTimingFunction`, `aspect`, `container` (`max-w-*`, `columns-*`, `max-inline-*`), `lineHeight` and `letterSpacing` keys resolve the same way. Built-in keys are unchanged; a key that isn't in the theme still emits nothing. Collisions follow Tailwind 4.3.3: a `fontFamily` key named like a weight (`bold`) makes `font-bold` that family, and a `borderRadius.full` other than `9999px` makes `rounded-full` (and `rounded-t-full` ...) read `var(--radius-full)`.

### Patch Changes

- 1d017f0: `content-[…]` passes the arbitrary value through like Tailwind 4.3 (`content-["x"]` → `"x"`, `content-['x']` → `'x'`, `content-[a_b]` → `a b`), and `before:`/`after:` put their default `content` first so a `content-*` utility wins.
- 0b60476: Custom theme keys resolve to their own namespace on utility roots shared with colours (#338): `border-*`, `outline-*`, `ring-*`, `ring-offset-*`, `divide-x/y-*`, `decoration-*` and `stroke-*` use `borderWidth`, `outlineWidth`, `ringWidth`, `ringOffsetWidth`, `divideWidth`, `textDecorationThickness` and `strokeWidth` keys instead of emitting a colour var. A key in both follows Tailwind 4.3.3: the colour wins on border/outline/ring/text/stroke; the shadow, inset/text/drop shadow, ring-offset width and decoration thickness win on their roots. Adds functional `ring-offset-<colour|width>`.

## 0.8.2

### Patch Changes

- f9cc4bf: Reject unbalanced selectors and fix nested arbitrary-variant parsing: the serializer drops any rule whose final selector or at-rule prelude has unbalanced brackets, parens or braces, and malformed or empty variant bracket groups now generate nothing.
- 66b7b18: CommonJS consumers can now `require()` every documented entry point: `@barocss/kit/theme/default` and `@barocss/browser` gain `require` export conditions (browser ships a new `dist/index.cjs`), and every entry has matching `.d.cts` declarations. The `@barocss/server` ESM declarations now resolve under `moduleResolution: node16`.
- 6baa6f4: Escape class names starting with a digit, fixing `2xl:` variants: `2xl:p-4` now emits `.\32 xl\:p-4` (as Tailwind 4.3.3 does) instead of the invalid `.2xl\:p-4` that browsers dropped.
- a5b2c21: Generation never throws on unusual class input: a theme lookup that resolves to a non-scalar value (such as a colour palette with no shade) counts as no value, and a class whose generation fails contributes nothing while the other classes still generate.
- 0.8.2: security and availability fixes. Upgrading is recommended for all 0.x users.

  - Security: no class input can produce a generated selector or at-rule prelude with unbalanced structure. Previously, some inputs could disable the rules that followed them in concatenated CSS output (kit, server sheets, the browser text fallback). The browser runtime's `insertRule` path was not affected.
  - Availability: CSS generation never throws. An invalid class produces no rule, and the rest of the request is still generated; previously one such class could fail a whole server-side sheet.
  - Class names starting with a digit (including every `2xl:` class) are now CSS-escaped, so their rules apply.
  - The browser runtime no longer logs to the console unless debug is on.

- 8631a64: Add logical border-radius utilities `rounded-s/e/ss/se/es/ee-*` matching Tailwind 4.3.
- 7b7d7a3: Build with Vite 8 (Rolldown). Package exports and runtime behaviour are unchanged. The ESM CDN bundle
  (`dist/cdn/barocss.js`) is now minified like the UMD one (356 KB → 229 KB raw, 64 KB → 48 KB gzip). In
  `@barocss/kit` the default theme now lives in a shared chunk that both `dist/index.*` and
  `dist/theme/default.*` import. The unminified kit ESM/CJS output a consumer loads (index plus the theme
  chunk) grows from about 52 KB to 62 KB gzip because of extra formatting and region comments; bundlers
  minify it away, and the theme data itself is unchanged.

## 0.8.1

### Patch Changes

- 0.8.1: security fixes. Upgrading is recommended for all 0.x users.

  - Generated CSS can no longer end an enclosing HTML `<style>` element, whatever the input (class strings or theme configuration). Apps that inline BaroCSS's CSS into HTML themselves were affected; the browser runtime's `insertRule` path and `ssrStyleTag` users were not.
  - Theme configuration keys and values can no longer change the structure of the emitted `:root` variable block. This matters when theme data comes from an untrusted source, such as a CMS.
  - Docs: server examples inline CSS through `ssrStyleTag`.

- c3ddc18: Validate theme variable names and values before emitting them in the `:root` theme block, and reject markup end-tag sequences in generated CSS.

## 0.8.0

### Minor Changes

- 0.8.0: Tailwind 4.3 support. The parity reference is now Tailwind 4.3.3, since BaroCSS runs next to your build and real projects use Tailwind 4.3.

  **New utilities (Tailwind 4.3):** logical properties (`inset-s/e/bs/be`, `inline-*` / `block-*` sizing, `pbs/pbe/mbs/mbe`, `border-bs/be`, `border-s/e`), `scrollbar-thin` / `scrollbar-none` / scrollbar colours / `scrollbar-gutter`, `font-features-*`, `zoom-*`, `tab-*`, `@container-size`, `not-@container`, `scroll-pbs/mbe`, `text-shadow-*`, and the mauve / olive / mist / taupe palettes.

  **Behaviour changes (please check when upgrading):**

  - Theme data follows Tailwind 4.3: the default `font-sans` stack, and the `neutral` / `zinc` palettes.
  - `drop-shadow-*` sizes and shadow size + colour composition (`shadow-md shadow-red-500/20`) match Tailwind 4.3; `shadow-inner` now emits a rule.
  - Negative scroll padding (`-scroll-p*`) emits nothing, as in Tailwind; `scroll-*-px` is `1px`; `border-spacing-x/y` compose.
  - Side-specific border opacity and `border-s-(--c)` no longer affect all sides.

  **Docs:** the Astro recipe sets `cssVarPrefix` and the dark-mode mapping; the CDN global is documented as the browser runtime only (use `@barocss/server` for server CSS); first-paint styling points to the server recipe.

- 5619b55: Default theme data now matches Tailwind CSS 4.3 (`tailwindcss/theme.css` 4.3.3) (#307).

  Default values that change for existing users:

  - `font-sans` (and the preflight `html` font fallback) is now `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'` (was `ui-sans-serif, system-ui, sans-serif, …`). `font-serif` and `font-mono` are unchanged.
  - `neutral-50…950` and `zinc-50` use hue `none` (`oklch(55.6% 0 none)` instead of `oklch(55.6% 0 0)`). Rendered colours are the same.

  Added:

  - The `mauve`, `olive`, `mist` and `taupe` palettes (50–950) for every colour utility.
  - `placeholder-<color>` utilities (`.placeholder-red-500::placeholder { color: var(--color-red-500) }`, with `/alpha`, arbitrary colours, custom properties, `inherit`/`current`/`transparent`), as in Tailwind 4.3.

  No other theme keys (spacing, radius, shadows, etc.) differ between Tailwind 4.1.13 and 4.3.3.

### Patch Changes

- 6648b39: Tailwind 4.3 parity: `@container-size` (and `@container-size/<name>`, `@container-normal/<name>`), negated container variants `not-@<size>` / `not-@max-<size>` / `not-@[…]` (with `/<name>`), `scroll-pbs/pbe/mbs/mbe-*`, and `border-s-*` / `border-e-*` (inline-start/end width and colour).
- e96524a: Add Tailwind 4.3 logical-property utilities: `inset-s/e/bs/be-*`, `inline-*`/`block-*` sizing with `min-`/`max-` forms, `pbs/pbe-*`, `mbs/mbe-*`, and `border-bs`/`border-be` width and colour. Side border colours (`border-t-red-500/50` etc.) now honour the opacity modifier.
- 18ebf77: Match Tailwind 4.3.3: `scroll-m*-px` / `scroll-p*-px` emit 1px, negative scroll-padding emits nothing, and `border-spacing-*` sets `--baro-border-spacing-x/y` (with `@property`) and composes `border-spacing` from both.
- 85ea0b3: Add Tailwind 4.3 `scrollbar-auto|thin|none`, `scrollbar-gutter-auto|stable|both`, `scrollbar-thumb-*` / `scrollbar-track-*` (composed `scrollbar-color` with `@property` defaults) and `font-features-[…]` / `font-features-(--x)` utilities (#309).
- c64d140: Match Tailwind 4.3.3 shadows: add `text-shadow-*` (2xs–lg sizes, colours, `/N`, `/[x%]`, `/(--o)`, `none`, arbitrary and custom-property values) with the `--text-shadow-*` theme scale; `drop-shadow-*` sizes now use Tailwind's theme values with colour and opacity modifiers; named `shadow-*`/`inset-shadow-*` wrap their colour in `--baro-shadow-color` so `shadow-md shadow-red-500/20` composes; `shadow-inner` and bare `shadow/N` work; `/[x%]` and `/(--o)` opacity on named shadows.
- 723974d: Tailwind 4.3 parity (#310): `zoom-*` (integer percent, arbitrary, custom property), `tab-*` (tab-size), bare `auto-rows-<n>` / `auto-cols-<n>` on the spacing scale, and named `shadow-*/<n>` / `inset-shadow-*/<n>` opacity including decimals (`shadow-lg/12.5`).

## 0.7.0

### Minor Changes

- 7d9edf0: New config option `utilities` (#287): static custom utilities, the runtime mirror of a stylesheet's static `@utility name { ... }`. Pass name → declarations (`{ 'max-w-app': { 'max-width': '72rem', 'margin-inline': 'auto' } }`, custom properties allowed). Each is registered on its own context ahead of the built-ins, so variants and `!` apply; a same-named built-in is extended like Tailwind 4 (built-in declarations first, then the custom ones). Names must be plain class idents and declarations pass the usual value guards; invalid entries are skipped. The browser and server runtimes pass it through unchanged. New exported types: `CustomUtilities`, `CustomUtilityDeclarations`.
- 0.7.0: a server companion API for SSR, and companion mode that follows a Tailwind 4 build's CSS-side configuration.

  **New:**

  - `@barocss/server`: `generateCssForHtml(htmlOrClasses, { skip })` returns one ordered, deduplicated sheet for the classes in the rendered HTML, minus those the build already has. It emits no theme variable, `@property` or `@layer` the build already defines. The browser runtime adopts the server sheet (only from `<head>` at startup) and keeps the combined order. See the Astro / SSR recipe.
  - Static custom utilities via config (the equivalent of a project's `@utility` rules). A same-named built-in is extended, as in Tailwind 4.
  - `config.prefix` is honoured when parsing: under `prefix: 'tw'`, `tw:flex` is styled and bare `flex` isn't, matching a `prefix(tw)` build. Set `cssVarPrefix` to match.
  - `animate-*` utilities emit their `@keyframes` in every output path.

  **Behaviour changes (please check when upgrading):**

  - `animate-*` now emits `@keyframes` in kit, server and browser output. If you defined those keyframes yourself, they're now emitted once by BaroCSS unless the build already has them.
  - Server HTML extraction ignores `<script>` / comment content, and runs in linear time on malformed input.

  **Docs:** the companion recipe maps the build's `@custom-variant dark` to `darkModeSelector` (shadcn `.dark &`, `[data-theme=dark] &`, or `media`). New: an Astro / SSR recipe, an own-theme example, and a note that BaroCSS has no CSS entry to `@import`.

  **Known limitation:** new theme keys (e.g. `borderRadius.card`) don't create new utilities yet (only existing keys can be overridden); use custom utilities for now.

### Patch Changes

- 520ddef: Honour `config.prefix` in class parsing, matching Tailwind 4 `prefix(tw)`: with `prefix: 'tw'`, `tw:flex`, `tw:hover:bg-red-500`, `tw:!flex`, `tw:-mt-2` are styled and unprefixed classes generate nothing. The unused `prefix: 'barocss-'` entry is removed from `defaultConfig`.
- 6fd7577: #274: `animate-spin/ping/pulse/bounce` and custom theme animations (`theme.extend.animation` + `keyframes`) now emit the `@keyframes` they reference, once per sheet, in kit `generateCss`/`generateCssRules`, server `generateCss`/`generateCssForHtml` (skipped when the `skip` build CSS defines it) and the browser runtime (inserted once, never reclaimed by GC, skipped under `skipExisting` when a page sheet defines it). `themeToCssVars()` no longer appends every theme `@keyframes`; the `bounce`/`ping` frames now match Tailwind 4.1.13.

  If your own CSS or inline styles use a theme animation name (e.g. `animation: spin 1s`) without an `animate-*` class, its `@keyframes` is no longer injected automatically; use the `animate-*` class or define the `@keyframes` yourself.

## 0.6.0

### Minor Changes

- 0.6.0: a security fix for 0.5.0, production SSR support in `@barocss/server`, and rule garbage collection in the browser runtime.

  **Security:** combined variant tokens could put a CSS comment delimiter into a generated selector. In concatenated CSS output (kit, server sheets, the browser text fallback) that could disable the rules that followed it, so one untrusted class could remove other classes' styles. A serializer-level guard now drops any such rule on every output path. Upgrading from 0.5.0 is recommended.

  **Behaviour changes (please check when upgrading):**

  - `@barocss/browser` reclaims rules for classes no element uses any more (after a grace period, with a cap). This is on by default; `gc: false` restores the old behaviour. Classes from the page's existing stylesheets (`skipExisting`) are never reclaimed.
  - `@barocss/server` output now defines every theme variable its rules reference (not only colours), emits `:root` and `@property` blocks once, and keeps Tailwind's variant order. Server-rendered pages style correctly at first paint.
  - A theme value of the form `var(--same-name)` no longer emits a self-referencing root variable, so it doesn't override the build's value.

  **New options:** `ServerRuntime(config, { cacheSize })` and `setConfig(config)` (per-class caching: warm generation about 0.1 ms per request); browser `gc`, `gcGraceMs`, `maxRules`; kit `unmarkProcessed`.

  **Also:** named `theme.spacing` keys work in spacing utilities (`p-gutter`, `gap-gutter`, …).

### Patch Changes

- faa3ad8: Harden selector serialization against comment delimiters: a rule whose final selector or at-rule prelude contains a comment opener or closer (outside CSS escapes) is no longer emitted.
- 79d32b6: Named `theme.spacing` keys (e.g. `theme.extend.spacing.gutter`) now work in spacing-scale utilities, as in Tailwind 4: `p-gutter` → `padding: var(--spacing-gutter)`, `-mt-gutter` → `calc(var(--spacing-gutter) * -1)`. Covers padding, margin, gap, inset/top/start/…, space-x/y, size/w/h/min-_/max-_, and scroll-m/scroll-p. Built-in keywords (`w-full`, `m-auto`, `*-px`) keep precedence; numeric spacing is unchanged.
- 1888cf2: Browser runtime reclaims rules for classes no element uses any more (#269). `observe()` keeps a per-class
  refcount of the elements inside the root; a class whose count stays 0 for `gcGraceMs` (default 3000 ms) and that a
  live-DOM re-check no longer finds has its rules deleted (the #254 order keys stay in sync). Classes passed to
  `addClass()`, classes a pre-existing stylesheet defines, and root/@property/preflight rules are never reclaimed.
  Optional `maxRules` evicts unused classes early; `gc: false` restores the old keep-everything behaviour. Kit adds
  `IncrementalParser.unmarkProcessed()`.
- 858f8ed: `@barocss/server` (#267): `generateCss` now returns one complete, ordered sheet:

  - its `:root,:host` block defines every theme variable the rules reference (radius, text, spacing, shadow, font, container, ease, aspect and so on, not only `--color-*`)
  - each root block and `@property` block appears once
  - rules follow Tailwind variant order (base < sm < md < lg)

  To get one sheet for a list of classes, use `generateCss(classes.join(' '))`.

  `generateCssForClasses` still returns entries in input order, and each entry is self-contained. Entries now also define non-colour theme variables and sort their own rules by variant.

  `@barocss/kit` exports the shared `ruleSortKey` / `compareKeys` / `upperBound`, and `@barocss/browser` now imports them from kit. Browser behaviour is unchanged.

- f542794: Skip self-referencing theme root vars: a theme value of `var(<same name>)` (with or without a fallback) no longer emits a cyclic `:root` declaration that overrides the site's own variable. Utilities still reference the var.

## 0.5.0

### Minor Changes

- 0.5.0: Tailwind 4.1.13 parity on AI-generated UI (100% on a tuned and a held-out corpus), security hardening for untrusted class strings, and a production runtime companion mode for Tailwind-built apps.

  **Behaviour changes (please check when upgrading):**

  - `outline-none` now sets `outline-style: none`. The old transparent-outline behaviour (visible focus under forced colours) is `outline-hidden`.
  - `space-x-*` / `space-y-*` use Tailwind 4's margins on non-last children, instead of v3's margins on later siblings.
  - `@barocss/browser` applies the default preflight unless `preflight: false`, and injects it first, in `@layer base`, so page and app styles win over it.
  - Theme colours are emitted as `var(--color-*)` (Tailwind's structure). `@barocss/server` ships the `--color-*` definitions it references.
  - Bare `rounded` is `0.25rem` and no longer reads the app-owned `--radius`.
  - `leading-*` sets `--baro-leading` (`--tw-leading` with `cssVarPrefix: 'tw'`), which `text-<size>` reads, as in Tailwind.
  - Unknown or invalid values emit no rule, and `has()` reports them as unresolved.
  - Malformed arbitrary-variant and arbitrary-value inputs are rejected.
  - Kit logs are off by default; `setDebug(true)` turns them on.

  **Companion mode** (next to a Tailwind build): `cssVarPrefix: 'tw'`, `skipExisting`, `shadcnTheme`, `preloadJsonRenderClasses`. See the README recipe.

  **Known limitations:** named custom spacing tokens (`p-gutter`) aren't read from `theme.spacing` yet. In companion mode, don't point `theme.extend` at the build's own variable names (e.g. `brand: 'var(--color-brand-600)'`): it creates a self-referencing variable. Use literal values or the app's raw `:root` variables.

  **Browser support:** Chrome 85+, Safari/iOS 16.4+, Firefox 128+.

### Patch Changes

- a31d9cf: Fix theme colours with a bracketed or decimal opacity (`bg-red-500/[37%]`, `from-red-500/[0.5]`, `text-primary/[.8]`, `/[var(--a)]`), which emitted invalid CSS since the theme-colour-var change. The opacity now normalises as in Tailwind 4.
- 1ba615d: Bare `rounded` / `rounded-{t,r,b,l,tl,tr,br,bl}` now emit `0.25rem` like Tailwind 4.1.13 instead of `var(--radius)`, which collided with shadcn apps' own `--radius`. Add `divide-<color>` (theme, `/alpha`, arbitrary, custom property, `inherit`/`current`/`transparent`) setting `border-color` on `:where(& > :not(:last-child))`.
- f3a452a: Bare `shadow` now emits the Tailwind 4 default box-shadow instead of an undefined `--shadow-default` variable.
- 98bd2b4: Match Tailwind 4.1.13: `blur-*`/`backdrop-blur-*` and `rounded-*` scales use Tailwind 4 values (adds bare `blur`, `backdrop-blur`, `rounded-xs`, `rounded-4xl`), and `divide-x`/`divide-y` apply to `:where(& > :not(:last-child))` with the registered border-style var.
- 007ad78: Border width utilities (`border`, `border-t`, `border-2`, `border-[3px]` …) now set `border-style` through a registered `--baro-border-style` (initial `solid`), like Tailwind 4, so bare borders render without a preflight reset. `border-dashed`/`dotted`/`none` still override it.
- e8d4121: A configured `cssVarPrefix` now renames the presets' internal `--baro-*` composite variables (shadow/ring, transform axes, filters, border/outline style, ...), so a runtime next to a Tailwind build can set `cssVarPrefix: 'tw'` and compose with the build's `--tw-*` classes. The default stays `--baro-*`. `skew-x-*`/`skew-y-*`/`skew-*` now set `--baro-skew-*` and the shared transform composite, like Tailwind 4, so skews combine with each other and with `rotate-x/y/z-*`.
- d6f7174: `group-has-<v>:` and `peer-has-<v>:` (including `[…]` and `/name` forms) now emit Tailwind 4.1.13's selectors: `:has(*:checked)` instead of a mangled argument, `*` before the pseudo, `[sel]` as `*:is(sel)`, and hover's `@media (hover: hover)` wrap.
- 2f3a3dc: Add the `in-*` variants (`in-focus:`, `in-[.x]:`, `in-data-[side=left]:` → `:where(*…) &`) and `has-<variant>` for simple variants (`has-hover:`, `has-checked:`, `has-open:` → `&:has(*…)`), matching Tailwind 4.1.13. Bracketed `in-[…]`/`has-[…]` selectors that open with an at-rule no longer match.
- 18c1d42: Unknown bare values (`text-balanc`, `bg-notacolor`, `border-foo`, `p-foo`, ...) no longer emit an invalid declaration; like Tailwind 4 they produce no rule. A class matched by several registrations now falls through to the next one when the first rejects the value, so `text-balance` resolves to `text-wrap: balance` instead of a colour.
- 117c5a5: Match Tailwind for `bg-(--x)` (background-color), operator/comma spacing inside arbitrary calc()/min()/max()/clamp(), and `gap-px`/`gap-x-px`/`gap-y-px`.
- 7bc4859: Publish a real CommonJS entry for kit so Node 18 consumers can require kit and server. Keep the ESM entries unchanged.
- 3accbb0: Kit console diagnostics are off by default; enable them with `debug: true` in the config or `setDebug(true)` (#230).
- 86866ae: Fix `leading-none|tight|snug|normal|relaxed|loose` referencing an undefined `--line-height-*` variable. They now emit the Tailwind `--leading-*` theme var with a value fallback (1, 1.25, 1.375, 1.5, 1.625, 2), so they render a real line-height. Numeric/arbitrary/custom-property `leading-*` are unchanged.
- f78a71f: Register the mask gradient `@property` vars (`--baro-mask-linear/radial/conic`, positions and colours) like Tailwind 4.1.13, so `mask-linear-from-*` composes a valid `mask-image` without inline fallbacks. The internal mask variables are renamed from `--tw-mask-*` to `--baro-mask-*`; use `cssVarPrefix: 'tw'` next to a Tailwind build.
- 06cb816: `generateCss(..., { minify: true })` now minifies root at-rules (`@property`) and the `:root,:host` variable block, so minified output contains no newlines or tabs. Non-minified output is unchanged.
- 34a0f7e: Outline utilities follow Tailwind 4. Width utilities (`outline`, `outline-2`, `outline-[3px]` …) set `outline-style` through a registered `--baro-outline-style` (initial `solid`). `outline-none` is `outline-style: none`. New `outline-hidden` keeps a transparent outline in forced-colors mode (the old `outline-none` behaviour). `outline-solid` is added, and `outline-<color>/<alpha>` is now supported.
- d062ea8: Reach Tailwind v4 parity for two class families that silently dropped because BaroCSS omitted a
  composition default:

  - **ring**: register the box-shadow composition layers (`--baro-shadow`, `--baro-inset-shadow`,
    `--baro-inset-ring-shadow`) via `@property` with an `0 0 #0000` initial value, drop the hardcoded
    blue ring color so a lone `ring`/`focus:ring-*` defaults to `currentColor`, and add the missing
    `ring-offset-*` utilities — so `ring-*`/`focus:ring-*` compose a valid box-shadow like Tailwind v4.
  - **preflight border**: add `border: 0 solid` to the full preflight's universal reset (matching
    Tailwind v4), so a bare `border`/`border-t` (width set, style otherwise `none`) renders instead of
    being invisible page-wide.

- 33499bf: Tailwind 4.1.13 parity for the last corpus misses: `@container`, `@container/<name>` and `@container-normal` utilities; `@<size>`, `@min-<size>`, `@max-<size>` container variants for every `--container-*` size (3xs…7xl) and arbitrary `@[500px]`, each with an optional `/<name>`; `sr-only`/`not-sr-only` use `clip-path`; `select-*` add `-webkit-user-select`; `justify-self-start`/`end`/`end-safe` emit `flex-start`/`flex-end`.
- c10e7d8: Preflight ('standard' and 'full') adds Tailwind 4.1.13's form-control reset (inherited font, letter-spacing and colour; no native radius or background), placeholder and textarea rules (#228).
- 6ab68a2: `before:` and `after:` now create the pseudo-element, as Tailwind does: each rule gets `content: var(--baro-content)` with a registered `@property --baro-content` (initial `""`). `content-none` and `content-[…]` also set `--baro-content`, so they still win.
- a7c1d4f: Fix browser DOM updates and browser/server CSS output. Keep the linked package versions aligned for the next release.
- 4f38ffc: Refresh global parser caches after utility registration so later class parsing recognizes the new utility without clearing existing Context caches.
- e3755ce: ring-[<length>] is a ring width; ring-_ no longer sets the ring-offset vars (order-independent with ring-offset-_); inset-shadow-2xs/xs/sm and inset-ring-\* match Tailwind 4.1.13 (#225).
- d08651d: Preflight ('standard' and 'full') now sets the root font family, feature and variation settings, and gives code/kbd/samp/pre the monospace stack, matching Tailwind 4.1.13. The app's `--default-font-family` / `--font-sans` still take precedence. `font-sans`, `font-serif` and `font-mono` now reference the theme vars that are actually defined (`--font-sans|serif|mono`).
- e2c828e: Runtime keeps Tailwind variant order (#254): each injected rule is inserted at its sorted position (base/state < max-_ desc < min-_ asc < @max-_ desc < @min-_ asc < dark/print/orientation/forced-colors, nested at-rules compared level by level) with one `insertRule` at a binary-searched index, so `lg:px-8` seen before `sm:px-6` no longer wins below its breakpoint's successors. Kit: `leading-*` now also sets a registered, non-inheriting `--baro-leading` and `text-<size>` line-height reads `var(--baro-leading, …)` (Tailwind's `--tw-leading`), so `leading-*` beats responsive `text-*` regardless of rule order.
- 2cc50bb: Arbitrary and data variants used by shadcn/ui now emit Tailwind 4.1.13's selectors: `_` in `[&_…]` is a descendant space, `[&>*]` no longer nests an unscoped rule, `group-data-[…]`/`peer-data-[…]` (including named `/group`) target the ancestor's attribute, `has-data-[…]` is supported, and `has-[a,b]`/`not-[a,b]` accept a selector list inside the pseudo-class while the generated selector stays a single member.
- 55c61ac: `shadow-*` now composes with `ring-*` on the same element, as in Tailwind 4: shadow utilities set `--baro-shadow` and emit the shared composite `box-shadow` (with registered `@property` defaults for every layer), so `shadow-sm ring-1` renders both. `shadow-[#color]` now sets the shadow color instead of writing it as a box-shadow.
- 797e602: `shadow-2xs` through `shadow-2xl` now use Tailwind 4 values; `shadow-2xs` and `shadow-xs` no longer reference undefined variables.
- 6c40b1f: `space-x-*` / `space-y-*` (including `-space-*`, `space-*-px`, arbitrary, `(--var)` and `space-*-reverse`) now emit Tailwind 4's form: `:where(& > :not(:last-child))` with the margin on the **end** of every non-last child, plus a registered `@property --baro-space-{x,y}-reverse` (initial 0). Behaviour change from the v3 form (`> :not([hidden]) ~ :not([hidden])`, margin on the **start** of later siblings): hidden children are no longer skipped, and the gap now sits at the end of preceding children rather than the top/start of following ones.
- c10e7d8: Theme colour utilities (`bg-*`, `text-*`, `border-*`, `outline-*`, `decoration-*`) now reference `var(--color-<name>)` like Tailwind 4.1.13, so runtime theme overrides apply; opacity modifiers emit an srgb color-mix fallback plus an oklab color-mix of the var (#228).

  Note: generateCss output now references var(--color-\*); include themeToCssVars() output.

- 16eb8de: Tailwind 4 parity (#246): trailing `!` important modifier (`p-4!`, `hover:size-5!`); `aspect-video` now uses `var(--aspect-video)` (was `--aspect-ratio-video`) and the theme emits `--aspect-video: 16 / 9`; new `container` utility (width 100% + ascending breakpoint max-widths); legacy `flex-grow*` / `flex-shrink*` aliases.
- 6ed4a50: Per-axis `translate-*`, `scale-*` and `rotate-{x,y,z}-*` utilities now use Tailwind 4's composition. Each sets only its own `--baro-*` var, and a shared declaration reads all axes: registered defaults for translate/scale, empty fallbacks for rotate/skew. A lone axis no longer references an undefined variable, and axes combine. Integer `translate-*-N` now uses the spacing scale (previously `N * 100%`). `@property` rules are also hoisted out of media/container variants (`hover:`, `md:` …).
- c6b293b: `transition` and `transition-colors` now include `outline-color` (and `transition` also `display`, `content-visibility`, `overlay`, `pointer-events`) in `transition-property`, matching Tailwind 4.
- f025a16: Tailwind 4.1.13 parity (#247): `text-[<length>]` / `text-[length:…]` give font-size and `text-(--x)` is a colour; `--ease-in/out/in-out` theme vars; `max-w-min/max/fit`; arbitrary properties (`[prop:value]`) and `--spacing(n)` → `calc(var(--spacing) * n)` in arbitrary values.
- f777778: Gradients match Tailwind 4: stop colours use var(--color-_) with the color-mix alpha form, stop positions and via-stops composition, and legacy bg-gradient-to-_ directions.
- 75cefe7: Reject arbitrary and custom-property values that would change the structure of the generated CSS.
- 7361ede: Variant parity with Tailwind 4.1.13: `max-*` breakpoints emit a valid `(width < …)` query, `group-hover:`/`peer-hover:` are wrapped in `@media (hover: hover)`, `group-not-[…]:`/`peer-not-[…]:` emit valid selectors, `*:`/`**:` target children/descendants (`:is(.cls > *)`), and arbitrary variants without `&` match the element (`[:root]:x` → `&:is(:root)`).
- e55252a: Reject malformed arbitrary variant values that could produce selectors outside the element.

## 0.0.4

### Patch Changes

- Isolate utility, modifier, cache, and CSS variable state between Context instances.
- Preserve `!important` separately for each class returned by `generateCssRules`.
- Emit shared `@property` rules once at the document level, outside `:root,:host`.
- Add pinned Tailwind CSS 4.1.13 comparisons and improve selected effects and variants.
- Correct the published `theme/default` export and verify package imports and types.

## 0.0.3

### Patch Changes

- c709bc2: support json format
