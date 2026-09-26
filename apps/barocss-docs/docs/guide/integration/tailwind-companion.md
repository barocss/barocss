---
title: Next to a Tailwind build
description: Run BaroCSS alongside an existing Tailwind 4 / shadcn build
---

# Next to a Tailwind build

Use this when the page already links a Tailwind 4 / shadcn build and a model sends json-render specs whose `className` values the build never saw. Copy it as is:

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

## Verify it rendered

In the DevTools console, after mount:

```js
runtime.getCss('bg-primary');   // a CSS string once generated (undefined if the build already had it)
getComputedStyle(document.querySelector('[class~="bg-primary"]')).backgroundColor; // not 'rgba(0, 0, 0, 0)'
document.querySelectorAll('style[id^="barocss-runtime"]').length; // > 0
```

## Browser support

Chrome/Edge 85+, Safari/iOS 16.4+, Firefox 128+. The runtime needs CSS `@property`; composite utilities (shadows, rings, transforms, filters) may not render on older engines.
