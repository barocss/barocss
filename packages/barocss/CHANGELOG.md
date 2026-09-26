# @barocss/kit

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
