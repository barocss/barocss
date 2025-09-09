---
title: jQuery Integration
description: Using BaroCSS with jQuery for build-free runtime styling
---

# jQuery Integration

BaroCSS works in existing jQuery apps without any build step. This guide shows minimal setup and common patterns.

## Setup

### Option 1. CDN (UMD)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>jQuery + BaroCSS</title>
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
</head>
<body>
  <div id="app"></div>
  <script>
    const runtime = new BaroCSS.BrowserRuntime()
    runtime.observe(document.body, { scan: true })
  </script>
</body>
</html>
```

### Option 2. ESM

```html
<script type="module">
  import { BrowserRuntime } from 'https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js'
  const runtime = new BrowserRuntime()
  runtime.observe(document.body, { scan: true })
</script>
```

## Basic Usage

Add or update classes with jQuery; BaroCSS generates CSS on demand.

```html
<div id="card" class="p-4 rounded-md bg-white shadow">Hello</div>

<script>
  // Add utilities
  $('#card').addClass('bg-blue-500 text-white')

  // Update on hover
  $('#card').addClass('hover:bg-blue-600 transition')

  // Responsive
  $('#card').addClass('sm:p-6 lg:p-8')
</script>
```

## Partial UI Updates

Use delegated events and apply classes only where needed.

```html
<ul id="items"></ul>

<script>
  // Append items dynamically
  for (let i = 0; i < 5; i++) {
    $('#items').append(
      `<li class="px-4 py-2 border-b border-slate-200 hover:bg-slate-50">Item ${i+1}</li>`
    )
  }

  // Toggle selected state
  $('#items').on('click', 'li', function () {
    $(this).toggleClass('bg-emerald-50 border-emerald-300')
  })
</script>
```