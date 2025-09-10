---
title: Runtime APIs
description: Understanding BaroCSS Browser and Server runtime APIs
---

# Runtime APIs

BaroCSS provides specialized runtime APIs for different environments, each optimized for their specific use cases.

## Why Different Runtimes?

Different environments have different capabilities and requirements:

- **Browser**: DOM manipulation, real-time updates, user interactions
- **Server**: Static generation, SSR, build-time processing

BaroCSS provides tailored APIs for each environment.

## Browser Runtime

The Browser Runtime is designed for client-side applications with real-time DOM interaction.

### Key Features

- **Real-time DOM monitoring** with MutationObserver
- **Automatic CSS injection** into the page
- **Interactive state handling** (hover, focus, etc.)
- **Performance optimization** for user interactions

### Basic Usage

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();

// Start monitoring DOM changes
runtime.observe(document.body, { scan: true });

// Classes are automatically processed as they're added
document.body.innerHTML = `
  <div class="bg-blue-500 text-white p-4 rounded-lg">
    <h1 class="text-2xl font-bold">Hello BaroCSS!</h1>
  </div>
`;
```

### Configuration Options

```typescript
const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          brand: '#3b82f6'
        }
      }
    }
  },
  styleId: 'my-barocss-styles',
  insertionPoint: 'head'
});
```

## Server Runtime

The Server Runtime is designed for server-side rendering and static generation.

### Key Features

- **Static CSS generation** for SSR
- **Batch processing** of multiple classes
- **No DOM dependencies** - works in Node.js
- **Optimized for build tools** and static sites

### Basic Usage

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Generate CSS for specific classes
const css = runtime.generateCssForClasses([
  'bg-blue-500',
  'text-white', 
  'p-4',
  'rounded-lg'
]);
```

### SSR Integration

```typescript
// Next.js API route example
export default function handler(req, res) {
  const runtime = new ServerRuntime();
  const css = runtime.generateCssForClasses(req.body.classes);
  
  res.setHeader('Content-Type', 'text/css');
  res.send(css);
}
```