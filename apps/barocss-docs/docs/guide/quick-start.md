---
title: Quick Start
description: Start the BaroCSS browser runtime with a package manager or a CDN
---

# Quick Start

These examples use the public browser API. The npm and CDN examples pin the current release, `__BAROCSS_VERSION__`; the docs build fills in the version from `@barocss/browser`'s `package.json`.

## Install with a package manager

```bash
pnpm add @barocss/browser@__BAROCSS_VERSION__
```

`@barocss/browser` installs `@barocss/kit` as a dependency. Install `@barocss/kit` directly when you use its core API. Install `@barocss/server` separately for server-side CSS generation.

```ts
import { BrowserRuntime } from '@barocss/browser'

const runtime = new BrowserRuntime()
runtime.observe(document.body, { scan: true })
```

Call `observe` after `document.body` exists. It scans existing classes and watches later DOM changes. Call `runtime.destroy()` when the runtime is no longer needed.

If the page already links a Tailwind or shadcn build, use the [Next to a Tailwind build](./integration/tailwind-companion) recipe instead of the defaults.

**Browser support:** Chrome/Edge 85+, Safari/iOS 16.4+, Firefox 128+ (the runtime needs CSS `@property`).

## Use the CDN without a build step

The `dist/cdn/barocss.js` and `dist/cdn/barocss.umd.cjs` files are part of the published browser package. The examples use jsDelivr, the same CDN form as the README. Drop the `@__BAROCSS_VERSION__` pin to follow the latest release.

::: warning CDN global is browser-only
The UMD script's `window.BaroCSS` (and the ESM CDN module) exposes only `@barocss/browser`: `BrowserRuntime`, `getRuntime`, `baroBoot`/`baroStart`, `ChangeDetector`, `StylePartitionManager`, `shadcnTheme`, `preloadJsonRenderClasses`, `collectJsonRenderClassNames`, `normalizeClassName(List)`, `SSR_STYLE_SELECTOR`, `LAYER_ORDER`. There is no `generateCss`/`generateCssForHtml`/`ServerRuntime`: server-side generation needs `@barocss/server` in Node ([Server Runtime](/api/server-runtime)).
:::

### ESM

Place this script near the end of the page body:

```html
<script type="module">
  import { baroStart } from 'https://cdn.jsdelivr.net/npm/@barocss/browser@__BAROCSS_VERSION__/dist/cdn/barocss.js'
  baroStart()
</script>
```

### UMD

Place these scripts near the end of the page body:

```html
<script src="https://cdn.jsdelivr.net/npm/@barocss/browser@__BAROCSS_VERSION__/dist/cdn/barocss.umd.cjs"></script>
<script>
  BaroCSS.baroStart()
</script>
```

`baroStart` is an alias of `baroBoot`. It creates a browser runtime, scans the body, and starts observing changes. The package does not export `bootStart`.

For manual control, use `BrowserRuntime` as shown in the package manager example. See [Browser Runtime](/api/browser-runtime) for its methods and [Compatibility](/guide/compatibility) for the measured Tailwind scope.
