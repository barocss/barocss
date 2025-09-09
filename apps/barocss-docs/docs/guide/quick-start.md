---
title: Quick Start
description: Fastest ways to start using BaroCSS in the browser
---

# Quick Start

Get up and running quickly using the zero‑config boot helper or the manual runtime.

## Installation

### Package Manager

#### pnpm (recommended)
```bash
pnpm add @barocss/kit @barocss/browser
```

#### npm
```bash
npm install @barocss/kit @barocss/browser
```

#### yarn
```bash
yarn add @barocss/kit @barocss/browser
```

### CDN (Browser Runtime only)

#### UMD
```html
<script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
```

#### ESM
```html
<script type="module" src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js"></script>
```

::: tip Server Runtime
Server runtime (`@barocss/server`) is only available via package manager, not CDN.
:::

## Usage

### Option 1 — bootStart (ESM)

```html
<script type="module">
  import { bootStart } from 'https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js'

  // Starts the runtime, scans existing DOM once, and observes further changes
  bootStart({
    config: {
      preflight: true
    }
  })
</script>
```

### Option 2 — bootStart (UMD)

```html
<script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
<script>
  // window.BaroCSS.bootStart
  BaroCSS.bootStart({
    config: {
      preflight: true
    }
  })
</script>
```

### Option 3 — Manual runtime

```html
<script type="module">
  import { BrowserRuntime } from 'https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js'

  const runtime = new BrowserRuntime({
    config: {
      preflight: true
    }
  })

  // Scan current DOM and observe further changes
  runtime.observe(document.body, { scan: true })
</script>
```

## Notes

- bootStart is the simplest way to initialize the browser runtime. It creates an internal `BrowserRuntime` instance and calls `observe(document.body, { scan: true })` for you.
- To customize behavior further, use the manual runtime approach.
- For deeper concepts and patterns, see Integration → Overview.


