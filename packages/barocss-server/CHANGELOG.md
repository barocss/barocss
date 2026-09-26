# @barocss/server

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
