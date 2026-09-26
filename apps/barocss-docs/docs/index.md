---
layout: home
hero:
  name: "BaroCSS"
  text: CSS Runtime Engine
  tagline: Generate utility CSS in the browser or on the server
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View Examples
      link: /examples/
    - theme: alt
      text: View on GitHub
      link: https://github.com/barocss/barocss
      external: true

features:
  - icon: ⚡
    title: Runtime-First
    details: Parse and generate CSS at runtime without build processes. Perfect for dynamic content and real-time styling.
  - icon: 🎯
    title: Tailwind-style syntax
    details: Use supported utilities, variants, and arbitrary values. Check the measured compatibility scope before migrating.
  - icon: 🧠
    title: Smart Parsing
    details: Advanced AST processing with incremental parsing and intelligent caching for optimal performance.
  - icon: 🚀
    title: Multiple Runtimes
    details: Browser runtime for real-time DOM detection and server runtime for static CSS generation.
  - icon: 🔧
    title: TypeScript API
    details: Comprehensive TypeScript API with full type safety and excellent developer experience.
  - icon: 🌐
    title: Universal
    details: Works in browsers, Node.js, and any JavaScript environment with consistent behavior.
---

## What is BaroCSS?

BaroCSS is a **CSS parsing and generation engine** for utility classes. Its browser runtime can generate styles when classes appear in the DOM. It is inspired by Tailwind CSS and UnoCSS. It does not yet claim full Tailwind compatibility. See the [measured compatibility scope](/guide/compatibility) before using it with existing Tailwind markup.

### Core Architecture

BaroCSS consists of three main packages:

- **`@barocss/kit`** - Core parsing and generation engine
- **`@barocss/browser`** - Browser runtime with DOM change detection  
- **`@barocss/server`** - Server runtime for static CSS generation

## Start using BaroCSS

Paste this at the end of the page body. No build step:

```html
<script type="module">
  import { baroStart } from 'https://cdn.jsdelivr.net/npm/@barocss/browser@__BAROCSS_VERSION__/dist/cdn/barocss.js'
  baroStart()
</script>
```

The [Quick Start](/guide/quick-start) shows the browser runtime with its public API. The [API reference](/api/) covers the core and server packages.
