---
title: Next to a Tailwind build
description: Run BaroCSS alongside an existing Tailwind 4 / shadcn build
---

# Next to a Tailwind build

::: danger BaroCSS is JavaScript only
There is no CSS entry: never write `@import "@barocss/kit";` in CSS. Keep the Tailwind CSS as it is and configure BaroCSS from JS.
:::

Use this when the page already links a Tailwind 4 / shadcn build and a model sends json-render specs whose `className` values the build never saw. Copy it as is: For a Vite project, see [Vite + Tailwind 4](./vite-tailwind) (install line, config, and [`BrowserRuntime` vs `getRuntime`](./vite-tailwind#runtime-choice)).

```js
import { getRuntime, shadcnTheme, preloadJsonRenderClasses } from '@barocss/browser';
// CDN/UMD build: const { getRuntime, shadcnTheme, preloadJsonRenderClasses } = window.BaroCSS;

const runtime = getRuntime({
  skipExisting: true,               // only generate classes the build does not already define
  config: {
    cssVarPrefix: 'tw',             // share --tw-* composite variables with the Tailwind build
    theme: { extend: shadcnTheme }, // use the shadcn :root tokens (primary, muted-foreground, ...)
    darkMode: 'class',              // dark: follows the page's dark class, not the OS setting
    darkModeSelector: '.dark &',    // mirrors shadcn v4's `@custom-variant dark (&:is(.dark *))`
    // preflight: leave unset. The layered preflight (@layer base) is the default and should stay on.
  },
});
runtime.observe(document.body, { scan: true }); // also covers classes added later

const spec = validateResponse(response);  // your catalog / class allowlist checks
preloadJsonRenderClasses(spec, runtime);  // BEFORE mounting, so there is no unstyled flash
renderJsonUi(spec);                       // mount your json-render Renderer
```

The six settings: `skipExisting: true`, `cssVarPrefix: 'tw'`, `theme: { extend: shadcnTheme }`, `darkMode: 'class'` with `darkModeSelector` copied from the build, `preloadJsonRenderClasses(spec, runtime)` before mount, and the default layered preflight (don't set `preflight: false`).

**Dark mode:** set `darkModeSelector` to the selector inside your CSS's `@custom-variant dark (...)`, so runtime `dark:` classes switch at the same moment as the build's:

| build CSS | companion config |
|---|---|
| `@custom-variant dark (&:is(.dark *));` (shadcn v4) | `darkMode: 'class', darkModeSelector: '.dark &'` |
| `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` (e.g. AstroPaper) | `darkMode: 'class', darkModeSelector: '[data-theme=dark] &'` |
| no `@custom-variant dark` (OS setting) | leave `darkMode` unset (`'media'`) |

Don't use `darkMode: 'class'` without a selector here: it matches `.dark` on the same element only, so `<html class="dark">` does not switch runtime classes.

**Your own theme** (no shadcn): give `theme.extend` literal values, not the build's variable names:

```js
theme: { extend: {
  colors: { brand: '#2563eb', surface: 'oklch(0.98 0 0)' },
  spacing: { gutter: '1.5rem' },          // named spacing: p-gutter, gap-gutter
  borderRadius: { lg: '0.75rem' },        // override existing keys
  fontFamily: { sans: ['Inter', 'sans-serif'] },
} },
```

New theme names create utilities, as in Tailwind 4: `borderRadius.card` gives `rounded-card`, `fontFamily.display` gives `font-display`, `boxShadow.card` gives `shadow-card`, `fontSize.hero` gives `text-hero`. `var(--color-brand)`-style values that point at the build's own vars are skipped safely, but only render if the build emits those vars; literal values always do.

**`@utility` rules:** mirror the build's static `@utility` rules in `config.utilities`, e.g. `@utility max-w-app { max-width: 48rem; margin-inline: auto; }` becomes `utilities: { 'max-w-app': { 'max-width': '48rem', 'margin-inline': 'auto' } }`. Functional `@utility name-*` isn't supported.

**`prefix(tw)` builds:** for `@import "tailwindcss" prefix(tw);` set both `prefix: 'tw'` and `cssVarPrefix: 'tw'`.

**Server rendering:** see [Astro (SSR and static)](./astro) for inlining the missing CSS on the server with the same config.

## Verify it rendered

In the DevTools console, after mount:

```js
runtime.getCss('bg-primary');   // a CSS string once generated (undefined if the build already had it)
getComputedStyle(document.querySelector('[class~="bg-primary"]')).backgroundColor; // not 'rgba(0, 0, 0, 0)'
document.querySelectorAll('style[id^="barocss-runtime"]').length; // > 0
```

## Browser support

Chrome/Edge 85+, Safari/iOS 16.4+, Firefox 128+. The runtime needs CSS `@property`; composite utilities (shadows, rings, transforms, filters) may not render on older engines.
