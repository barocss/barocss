# Quick Start

Get productive with BaroCSS in minutes.

## 1. Install

```bash
pnpm add barocss
```

Or use the CDN for prototypes:

```html
<script src="https://unpkg.com/barocss@latest/dist/runtime/browser.js"></script>
<script>
  const runtime = new BaroCSS.BrowserRuntime();
  runtime.observe(document.body, { scan: true });
</script>
```

## 2. Initialize Runtime

```ts
import { BrowserRuntime } from 'barocss/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    preflight: true,
  }
});

runtime.observe(document.body, { scan: true });
```

## 3. Use Utilities

```html
<div class="p-4 rounded-lg bg-blue-500 text-white">
  Hello BaroCSS!
</div>
```

## 4. Customize Theme

```ts
import { BrowserRuntime } from 'barocss/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    preflight: 'minimal',
    theme: {
      colors: { primary: '#3B82F6' }
    }
  }
});
```

## 5. Next Steps

- Explore the [Runtime API](/guide/runtime-api)
- Configure the [Theme](/guide/theme)
- Extend with [Plugins](/guide/plugins)
