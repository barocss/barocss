---
layout: home
hero:
  name: "BaroCSS"
  text: CSS Runtime Engine
  tagline: A CSS parsing and generation engine that brings Tailwind's utility-first approach to runtime environments
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View Examples
      link: /examples/
    - theme: alt
      text: View on GitHub
      link: https://github.com/your-org/barocss
      external: true

features:
  - icon: ⚡
    title: Runtime-First
    details: Parse and generate CSS at runtime without build processes. Perfect for dynamic content and real-time styling.
  - icon: 🎯
    title: Tailwind Compatible
    details: Full support for Tailwind CSS syntax including utilities, variants, and arbitrary values.
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

BaroCSS is a **CSS parsing and generation engine** that brings Tailwind's utility-first approach to runtime environments. Built from the ground up to support Tailwind CSS syntax, it enables dynamic CSS generation without build processes.

### Core Architecture

BaroCSS consists of three main packages:

- **`@barocss/kit`** - Core parsing and generation engine
- **`@barocss/browser`** - Browser runtime with DOM change detection  
- **`@barocss/server`** - Server runtime for static CSS generation

### Runtime-First Approach

**Traditional Build Process:**
```bash
# Write classes → Build → Wait → Deploy
<div class="bg-blue-500 hover:bg-blue-700">Button</div>
# Requires build step and deployment
```

**BaroCSS Runtime:**
```bash
# Write classes → Generate CSS instantly
<div class="bg-blue-500 hover:bg-blue-700">Button</div>
# CSS generated at runtime, no build needed
```

### Key Capabilities

**Core Engine (`@barocss/kit`):**
```typescript
import { parseClassToAst, generateCss, createContext } from '@barocss/kit';

const context = createContext();
const ast = parseClassToAst('bg-blue-500 text-white p-4', context);
const css = generateCss('bg-blue-500 text-white p-4', context);
```

**Browser Runtime (`@barocss/browser`):**
```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();
runtime.observe(document.body, { scan: true });
// Automatically detects and styles new classes
```

**Server Runtime (`@barocss/server`):**
```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();
const css = runtime.generateCss('bg-blue-500 text-white p-4');
// Generate CSS for server-side rendering
```

### Perfect for Dynamic Content

BaroCSS excels when you need to generate CSS for dynamic content:

```typescript
// User-generated content with arbitrary values
const userContent = `
<div class="w-[${width}px] h-[${height}px] bg-[${color}] rounded-[${radius}px]">
  Dynamic content styled instantly
</div>
`;

// BaroCSS parses arbitrary values like w-[400px], bg-[#ff0000] at runtime
```

### Get Started

```bash
# Install the core engine
npm install @barocss/kit

# Or install specific runtimes
npm install @barocss/browser  # For browser usage
npm install @barocss/server   # For server usage
```

Ready to get started? Check out our [installation guide](/guide/installation) or explore [examples](/examples/).
