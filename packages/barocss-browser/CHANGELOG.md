# @barocss/browser

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

- 9900eab: Browser preflight no longer overrides the page's own CSS (#208): the first `<style>` in `<head>` declares `@layer theme, base, components, utilities;` and holds preflight in `@layer base`. Unlayered author CSS (e.g. `header { display: flex }`) now beats preflight, and a built app's own `@layer base` rules win over the injected preflight. Utilities stay unlayered, so they still override preflight.
- 3accbb0: Kit diagnostics stay silent in the browser runtime unless `config.debug` is set, which the runtime passes through to the kit (#230).
- 6067c3e: `BrowserRuntime` now applies kit's default preflight (`preflight: true`, full) when the config doesn't set `preflight`, matching kit's documented default. Previously a default start injected no preflight. If you relied on having no preflight, pass `preflight: false` in the runtime config.
- bfc5021: `getRuntime`/`baroStart` now apply a passed `config` to an already-created runtime via `updateConfig`, so an early `getRuntime()` no longer drops a later `baroStart({ config })`.
- 6deba26: Add opt-in `skipExisting` runtime option: classes already defined by the page's own same-origin stylesheets (e.g. a Tailwind build) are not regenerated, so the runtime injects only what the build is missing.
- e8d4121: A configured `cssVarPrefix` now renames the presets' internal `--baro-*` composite variables (shadow/ring, transform axes, filters, border/outline style, ...), so a runtime next to a Tailwind build can set `cssVarPrefix: 'tw'` and compose with the build's `--tw-*` classes. The default stays `--baro-*`. `skew-x-*`/`skew-y-*`/`skew-*` now set `--baro-skew-*` and the shared transform composite, like Tailwind 4, so skews combine with each other and with `rotate-x/y/z-*`.
- 3e6b681: Add `collectJsonRenderClassNames(spec)` and `preloadJsonRenderClasses(spec, runtime)`. They preload literal `props.className` values from a json-render Spec synchronously, so CSS can be generated before the UI mounts. The host still validates the spec and class support.
- 7bc4859: Publish a real CommonJS entry for kit so Node 18 consumers can require kit and server. Keep the ESM entries unchanged.
- a7c1d4f: Fix browser DOM updates and browser/server CSS output. Keep the linked package versions aligned for the next release.
- d08651d: Preflight ('standard' and 'full') now sets the root font family, feature and variation settings, and gives code/kbd/samp/pre the monospace stack, matching Tailwind 4.1.13. The app's `--default-font-family` / `--font-sans` still take precedence. `font-sans`, `font-serif` and `font-mono` now reference the theme vars that are actually defined (`--font-sans|serif|mono`).
- e2c828e: Runtime keeps Tailwind variant order (#254): each injected rule is inserted at its sorted position (base/state < max-_ desc < min-_ asc < @max-_ desc < @min-_ asc < dark/print/orientation/forced-colors, nested at-rules compared level by level) with one `insertRule` at a binary-searched index, so `lg:px-8` seen before `sm:px-6` no longer wins below its breakpoint's successors. Kit: `leading-*` now also sets a registered, non-inheriting `--baro-leading` and `text-<size>` line-height reads `var(--baro-leading, …)` (Tailwind's `--tw-leading`), so `leading-*` beats responsive `text-*` regardless of rule order.
- 592a368: Add `shadcnTheme`, a theme preset that maps shadcn/ui colours and radii to the app's raw `:root` variables. Use it with `baroStart({ config: { theme: { extend: shadcnTheme } } })`.
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

- Fix style updates after DOM changes, configuration updates, cache clearing, and runtime cleanup.
- Make `BrowserRuntime.removeClass()` remove injected CSS for the target class while preserving rules still used by other classes.
- Publish a working ESM entry and CDN bundles. Remove the CommonJS `require` entry advertised by 0.0.3; that entry failed in a standalone Node consumer.
- Update dependency on `@barocss/kit` to 0.0.4.

## 0.0.3

### Patch Changes

- Updated dependencies [c709bc2]
  - @barocss/kit@0.0.3
