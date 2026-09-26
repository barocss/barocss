---
title: Examples
description: Small browser and server examples using the public BaroCSS API
---

# Examples

These examples use public package exports and a small set of classes from the [compatibility fixtures](/guide/compatibility). Check your own classes and browser targets before using BaroCSS in production.

## Watch changes in the browser

Install the published browser package:

```bash
pnpm add @barocss/browser@0.5.0
```

Start observation after the body exists:

```ts
import { BrowserRuntime } from '@barocss/browser'

const runtime = new BrowserRuntime()
runtime.observe(document.body, { scan: true })

const message = document.createElement('p')
message.className = 'block text-center bg-red-500'
message.textContent = 'BaroCSS watches new classes'
document.body.appendChild(message)

// Call runtime.destroy() when this page or component is removed.
```

`block`, `text-center`, and `bg-red-500` are in the selected Tailwind comparison fixtures. The example shows the browser runtime API; it does not demonstrate that other Tailwind classes work.

## Generate one rule on the server

Install the published server package:

```bash
pnpm add @barocss/server@0.5.0
```

```ts
import { ServerRuntime } from '@barocss/server'

const runtime = new ServerRuntime()
const css = runtime.generateCss('block')
console.log(css)
```

Use the generated CSS in a server-rendered page according to your application's style-loading rules. See the [Server Runtime API](/api/server-runtime) for more methods.
