# #375 O6: inferring the BaroCSS config from the page's built CSS (research spike)

Research only: `infer.js` is a throwaway browser script, not product code. Rerun command at the top of `run.mjs`;
numbers below are from `result.json` (tailwindcss 4.3.3, Chromium 1223, 2026-09-26).

## Aspect map (what the built CSS exposes via CSSOM)

| aspect | inferable? | how | limit |
|---|---|---|---|
| Tailwind 4 / `cssVarPrefix:'tw'` | yes | `@property --tw-*`, `@layer utilities` | none seen |
| `prefix(tw)` | yes | theme vars become `--tw-color-*` and utility classes start `tw:` | none seen |
| `@theme` tokens | partial | `:root` vars in `@layer theme` | only vars the build used are emitted: unused shades are tree-shaken (#255: 4 of 10 brand shades) |
| `@theme inline` tokens | partial | read back from compiled bare utilities (`.bg-brand-600{background-color:…}`), plus a guess from raw colour `:root` vars (`--primary` becomes `colors.primary = var(--primary)`) | only tokens used by a compiled utility, or raw vars that are colours. Overrides of default names (shadcn `rounded-lg = var(--radius)`) can't be seen (#219: 4 misses) |
| dark variant selector | partial | suffix of any compiled `dark:` rule gives `darkModeSelector:'&'+suffix`, or `@media (prefers-color-scheme)` | invisible when the build compiled no `dark:` class (the fallback guess from `.dark{--x}` override blocks is weak) |
| static `@utility` | partial | a bare utility class a scratch BrowserRuntime can't generate is copied as `config.utilities` | only utilities the build used. Functional `tab-*` can't be done. Variants of a used utility (`md:content-auto`) then work |
| custom variants | no | selector shape is visible if used | BaroCSS has no public variant registration (#283) |
| breakpoints / containers | partial | `@media (width >= X)` around `.name\:` rules | only the breakpoints that were used |
| `@property` | yes (informational) | CSSPropertyRule | – |
| preflight | yes (informational) | `@layer base` `*{box-sizing:border-box}` | skipExisting already avoids duplicates |
| `important` | no | – | not needed for runtime-only classes (#283) |

Other limits: cross-origin sheets throw on `cssRules` (counted in `report.crossOrigin`). A CSP doesn't block CSSOM reads,
but a sheet served from a CDN domain without CORS does. Cost: 7 to 52 ms per page (AstroPaper, about 2.5k rules).
Values come from `:root` at infer time, so a literal resolved from `var(--color-*)` is the light value.

## Parity (classes, or block elements for AstroPaper, equal to the reference build)

| app | n | none | recipe | inferred |
|---|---|---|---|---|
| #182 json-render | 70 | 70 | 70 | 70 |
| #219 shadcn tokens (@theme inline) | 29 | 4 | 29 | 25 |
| #255 site theme @theme | 22 | 4 | 22 | 14 |
| #255 site theme @theme inline | 22 | 4 | 22 | 14 |
| #283 dark, build has no dark: (html.dark / OS dark) | 2+2 | 0+0 | 2+2 | 0+0 |
| #283 dark, build uses dark: once | 2 | 0 | 2 | 2 |
| #283 @utility unused by build | 2 | 1 | 2 | 1 |
| #283 @utility used by build | 3 | 2 | 3 | 3 |
| #283 custom variant | 1 | 0 | 0 | 0 |
| #283 prefix(tw) | 3 | 0 | 3 | 3 |
| #283 important | 2 | 2 | 2 | 2 |
| #289 AstroPaper (block els) | 120 | 114 | 120 | 120 |
| **total** | **282** | **203** | **281** | **256** |

Inference closes 53 of the 78 misses between no config and the recipe (68%). Every remaining miss is something the build
never compiled: tree-shaken tokens, default-name overrides under `@theme inline`, a dark variant or `@utility` the build
never used, or a custom variant.

## Verdict

A zero-config companion works for `cssVarPrefix`, `prefix`, used theme tokens, the dark selector when used, and used static
`@utility`s. Unused tokens, unused dark/utilities, custom variants and default-name overrides still need config or a
build-time plugin (the source `@theme` block is the only complete source).
