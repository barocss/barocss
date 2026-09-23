---
title: Quick Start
description: Start the BaroCSS browser runtime with a package manager or a CDN
---

# Quick Start

These examples use the public browser API. The npm and CDN examples pin the published `0.0.3` release. The `0.0.4` candidate is under review and is not yet a published installation target.

## Install with a package manager

```bash
pnpm add @barocss/browser@0.0.3
```

`@barocss/browser` installs `@barocss/kit` as a dependency. Install `@barocss/kit` directly when you use its core API. Install `@barocss/server` separately for server-side CSS generation.

```ts
import { BrowserRuntime } from '@barocss/browser'

const runtime = new BrowserRuntime()
runtime.observe(document.body, { scan: true })
```

Call `observe` after `document.body` exists. It scans existing classes and watches later DOM changes. Call `runtime.destroy()` when the runtime is no longer needed.

## Use the CDN without a build step

The `dist/cdn/barocss.js` and `dist/cdn/barocss.umd.cjs` files are part of the browser package. The paths below refer to the published `0.0.3` files. The `0.0.4` candidate's pack check also verifies these paths, but its CDN URL will work only after publication.

### ESM

Place this script near the end of the page body:

```html
<script type="module">
  import { baroStart } from 'https://unpkg.com/@barocss/browser@0.0.3/dist/cdn/barocss.js'
  baroStart()
</script>
```

### UMD

Place these scripts near the end of the page body:

```html
<script src="https://unpkg.com/@barocss/browser@0.0.3/dist/cdn/barocss.umd.cjs"></script>
<script>
  BaroCSS.baroStart()
</script>
```

`baroStart` is an alias of `baroBoot`. It creates a browser runtime, scans the body, and starts observing changes. The package does not export `bootStart`.

For manual control, use `BrowserRuntime` as shown in the package manager example. See [Browser Runtime](/api/browser-runtime) for its methods and [Compatibility](/guide/compatibility) for the measured Tailwind scope.
