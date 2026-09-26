# @barocss/server

## 0.8.1

### Patch Changes

- 0.8.1: security fixes. Upgrading is recommended for all 0.x users.

  - Generated CSS can no longer end an enclosing HTML `<style>` element, whatever the input (class strings or theme configuration). Apps that inline BaroCSS's CSS into HTML themselves were affected; the browser runtime's `insertRule` path and `ssrStyleTag` users were not.
  - Theme configuration keys and values can no longer change the structure of the emitted `:root` variable block. This matters when theme data comes from an untrusted source, such as a CMS.
  - Docs: server examples inline CSS through `ssrStyleTag`.

- Updated dependencies
- Updated dependencies [c3ddc18]
  - @barocss/kit@0.8.1

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

### Patch Changes

- Updated dependencies [6648b39]
- Updated dependencies [e96524a]
- Updated dependencies
- Updated dependencies [18ebf77]
- Updated dependencies [85ea0b3]
- Updated dependencies [c64d140]
- Updated dependencies [5619b55]
- Updated dependencies [723974d]
  - @barocss/kit@0.8.0

## 0.7.0

### Minor Changes

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

- 95890d4: `@barocss/server` (#268): `generateCssForHtml(htmlOrClasses, { skip })` returns the complete ordered sheet for the classes of one server response, minus what the page's build CSS already provides.

  - It reads classes from HTML `class` attributes (any quoting, entities decoded; `<script>`/`<style>` contents and comments ignored), or takes a class list.
  - `skip` is build CSS text or a set of class names. With CSS it also leaves out the theme vars, `@property` and `@keyframes` the build defines.
  - Each call returns that request's delta only.
  - New exports: `ssrStyleTag(css, { nonce })` (wraps the sheet in `<style data-barocss-ssr>`) and `SSR_STYLE_ATTRIBUTE`.

  `@barocss/browser`: the runtime adopts `<style data-barocss-ssr>` sheets that are in `<head>` when it starts (at construction or the first `observe()`). Their class rules move into its ordered partitions, so later client rules keep Tailwind variant order. Those classes are never regenerated and never reclaimed by GC. `skipExisting` and the server skip now also treat `:where(.cls …)` / `:is(.cls …)` selectors (divide/space utilities) as defining `.cls`. New export: `SSR_STYLE_SELECTOR`.

### Patch Changes

- 520ddef: Honour `config.prefix` in class parsing, matching Tailwind 4 `prefix(tw)`: with `prefix: 'tw'`, `tw:flex`, `tw:hover:bg-red-500`, `tw:!flex`, `tw:-mt-2` are styled and unprefixed classes generate nothing. The unused `prefix: 'barocss-'` entry is removed from `defaultConfig`.
- 6fd7577: #274: `animate-spin/ping/pulse/bounce` and custom theme animations (`theme.extend.animation` + `keyframes`) now emit the `@keyframes` they reference, once per sheet, in kit `generateCss`/`generateCssRules`, server `generateCss`/`generateCssForHtml` (skipped when the `skip` build CSS defines it) and the browser runtime (inserted once, never reclaimed by GC, skipped under `skipExisting` when a page sheet defines it). `themeToCssVars()` no longer appends every theme `@keyframes`; the `bounce`/`ping` frames now match Tailwind 4.1.13.

  If your own CSS or inline styles use a theme animation name (e.g. `animation: spin 1s`) without an `animate-*` class, its `@keyframes` is no longer injected automatically; use the `animate-*` class or define the `@keyframes` yourself.

- Updated dependencies [520ddef]
- Updated dependencies [7d9edf0]
- Updated dependencies [6fd7577]
- Updated dependencies
  - @barocss/kit@0.7.0

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

- a24247b: Cache per-class generation in `ServerRuntime` (#272): warm `generateCss` reuses each class's rules, sort key and referenced vars plus the parsed theme var map, with byte-identical output. The cache is per runtime (so per config), LRU-bounded by the new constructor option `new ServerRuntime(config, { cacheSize })` (default 10000, `0` turns caching off, fixed at construction). The new `setConfig(config)` method rebuilds the context and clears the caches. Both are documented in the Server Runtime API page.
- 858f8ed: `@barocss/server` (#267): `generateCss` now returns one complete, ordered sheet:

  - its `:root,:host` block defines every theme variable the rules reference (radius, text, spacing, shadow, font, container, ease, aspect and so on, not only `--color-*`)
  - each root block and `@property` block appears once
  - rules follow Tailwind variant order (base < sm < md < lg)

  To get one sheet for a list of classes, use `generateCss(classes.join(' '))`.

  `generateCssForClasses` still returns entries in input order, and each entry is self-contained. Entries now also define non-colour theme variables and sort their own rules by variant.

  `@barocss/kit` exports the shared `ruleSortKey` / `compareKeys` / `upperBound`, and `@barocss/browser` now imports them from kit. Browser behaviour is unchanged.

- Updated dependencies [faa3ad8]
- Updated dependencies [79d32b6]
- Updated dependencies [1888cf2]
- Updated dependencies
- Updated dependencies [858f8ed]
- Updated dependencies [f542794]
  - @barocss/kit@0.6.0

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

- 7bc4859: Publish a real CommonJS entry for kit so Node 18 consumers can require kit and server. Keep the ESM entries unchanged.
- a7c1d4f: Fix browser DOM updates and browser/server CSS output. Keep the linked package versions aligned for the next release.
- 6a68018: `ServerRuntime.generateCss` now prepends a `:root,:host` block defining the theme `--color-*` vars its output references, so standalone renders stay coloured after theme colours became `var(--color-*)` (#228).
- Updated dependencies [a31d9cf]
- Updated dependencies [1ba615d]
- Updated dependencies [f3a452a]
- Updated dependencies [98bd2b4]
- Updated dependencies [007ad78]
- Updated dependencies [e8d4121]
- Updated dependencies [d6f7174]
- Updated dependencies [2f3a3dc]
- Updated dependencies [18c1d42]
- Updated dependencies [117c5a5]
- Updated dependencies [7bc4859]
- Updated dependencies [3accbb0]
- Updated dependencies [86866ae]
- Updated dependencies [f78a71f]
- Updated dependencies [06cb816]
- Updated dependencies [34a0f7e]
- Updated dependencies [d062ea8]
- Updated dependencies [33499bf]
- Updated dependencies [c10e7d8]
- Updated dependencies [6ab68a2]
- Updated dependencies [a7c1d4f]
- Updated dependencies [4f38ffc]
- Updated dependencies
- Updated dependencies [e3755ce]
- Updated dependencies [d08651d]
- Updated dependencies [e2c828e]
- Updated dependencies [2cc50bb]
- Updated dependencies [55c61ac]
- Updated dependencies [797e602]
- Updated dependencies [6c40b1f]
- Updated dependencies [c10e7d8]
- Updated dependencies [16eb8de]
- Updated dependencies [6ed4a50]
- Updated dependencies [c6b293b]
- Updated dependencies [f025a16]
- Updated dependencies [f777778]
- Updated dependencies [75cefe7]
- Updated dependencies [7361ede]
- Updated dependencies [e55252a]
  - @barocss/kit@0.5.0

## 0.0.4

### Patch Changes

- Return empty CSS for empty strings and whitespace, and handle empty class lists.
- Correct the CommonJS export path and verify package imports and types.
- Update dependency on `@barocss/kit` to 0.0.4.

## 0.0.3

### Patch Changes

- Updated dependencies [c709bc2]
  - @barocss/kit@0.0.3
