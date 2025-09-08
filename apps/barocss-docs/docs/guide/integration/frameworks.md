---
title: AI Integration - Frameworks
description: Using BaroCSS with React, Vue, Svelte, and Solid
---

# Frameworks (React, Vue, Svelte, Solid)

This page shows how to use BaroCSS in popular frameworks. The goal is minimal setup and real-time styling without build steps.

## Common Setup

Load the browser runtime and start observing:

```html
<script type="module">
  import { baroStart } from '@barocss/browser';
  baroStart({ config: { preflight: true } });
</script>
```

## React

```tsx
import { useEffect } from 'react'
import { BrowserRuntime } from '@barocss/browser'

export default function App() {
  useEffect(() => {
    const rt = new BrowserRuntime()
    rt.observe(document.body, { scan: true })
    return () => rt.destroy?.()
  }, [])

  return (
    <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
      Hello
    </button>
  )
}
```

## Vue

```vue
<script setup>
import { onMounted } from 'vue'
import { BrowserRuntime } from '@barocss/browser'

onMounted(() => {
  const rt = new BrowserRuntime()
  rt.observe(document.body, { scan: true })
})
</script>

<template>
  <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
    Hello
  </button>
</template>
```

## Svelte

```svelte
<script>
  import { onMount } from 'svelte'
  import { BrowserRuntime } from '@barocss/browser'
  onMount(() => {
    const rt = new BrowserRuntime()
    rt.observe(document.body, { scan: true })
  })
</script>

<button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
  Hello
</button>
```

## Solid

```tsx
import { onMount } from 'solid-js'
import { BrowserRuntime } from '@barocss/browser'

export default function App() {
  onMount(() => {
    const rt = new BrowserRuntime()
    rt.observe(document.body, { scan: true })
  })
  return (
    <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">Hello</button>
  )
}
```

That's it. Use utility classes directly; BaroCSS generates CSS on demand in all frameworks above.
