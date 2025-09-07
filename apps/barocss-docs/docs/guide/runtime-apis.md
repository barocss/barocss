---
title: Runtime APIs
description: Understanding BaroCSS Browser and Server runtime APIs
---

# Runtime APIs

BaroCSS provides specialized runtime APIs for different environments, each optimized for their specific use cases and constraints.

## Why Different Runtimes?

Different environments have different capabilities and requirements:

- **Browser**: DOM manipulation, real-time updates, user interactions
- **Server**: Static generation, SSR, build-time processing
- **Node.js**: File system access, build tools, testing

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
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          brand: '#3b82f6'
        }
      }
    }
  }
});

// Start monitoring DOM changes
runtime.observe(document.body, { scan: true });

// Classes are automatically processed as they're added
document.body.innerHTML = `
  <div class="bg-brand text-white p-4 rounded-lg">
    <h1 class="text-2xl font-bold">Hello BaroCSS!</h1>
  </div>
`;
```

### Advanced Configuration

```typescript
const runtime = new BrowserRuntime({
  config: {
    prefix: 'tw-',
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          primary: '#3b82f6',
          secondary: '#64748b'
        }
      }
    }
  },
  styleId: 'my-@barocss/kit-styles',
  insertionPoint: 'head',
  maxRulesPerPartition: 100
});
```

### DOM Monitoring Options

```typescript
// Monitor entire document
runtime.observe(document.body, { scan: true });

// Monitor specific container
const container = document.querySelector('#dynamic-content');
runtime.observe(container, { 
  scan: true,
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['class']
});

// Selective class processing
runtime.observe(document.body, {
  scan: true,
  classFilter: (className) => {
    // Only process utility classes
    return /^(bg-|text-|p-|m-|w-|h-)/.test(className);
  }
});
```

### Performance Monitoring

```typescript
// Get runtime statistics
const stats = runtime.getStats();
console.log(stats);
// {
//   totalClasses: 150,
//   generatedCSS: '2.3KB',
//   cacheHitRate: 0.85,
//   averageGenerationTime: '0.8ms',
//   domMutations: 45,
//   memoryUsage: '1.2MB'
// }

// Monitor performance
runtime.onPerformanceUpdate((stats) => {
  if (stats.averageGenerationTime > '5ms') {
    console.warn('Slow CSS generation detected');
  }
});
```

### Manual CSS Injection

```typescript
// Manually add classes and inject CSS
runtime.addClass('bg-blue-500 text-white p-4');

// Get generated CSS without injecting
const css = runtime.generateCss('bg-red-500 hover:bg-red-600');

// Inject CSS manually
runtime.insertRule(css);
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
import { ServerRuntime } from '@barocss/kit/runtime/server';

const runtime = new ServerRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          brand: '#3b82f6'
        }
      }
    }
  }
});

// Generate CSS for specific classes
const css = runtime.generateCssForClasses([
  'bg-brand',
  'text-white', 
  'p-4',
  'rounded-lg'
]);

console.log(css);
// .bg-brand { background-color: #3b82f6; }
// .text-white { color: #ffffff; }
// .p-4 { padding: 1rem; }
// .rounded-lg { border-radius: 0.5rem; }
```

### SSR Integration

```typescript
// Next.js API route example
export default function handler(req, res) {
  const runtime = new ServerRuntime();
  
  // Extract classes from request
  const classes = req.body.classes;
  
  // Generate CSS
  const css = runtime.generateCssForClasses(classes);
  
  res.setHeader('Content-Type', 'text/css');
  res.send(css);
}
```

### Static Site Generation

```typescript
// Gatsby/Next.js build-time generation
import { ServerRuntime } from '@barocss/kit/runtime/server';

const runtime = new ServerRuntime();

// Scan all pages for classes
const allClasses = await scanPagesForClasses();

// Generate complete CSS
const css = runtime.generateCssForClasses(allClasses);

// Write to file
await fs.writeFile('dist/styles.css', css);
```

### Batch Processing

```typescript
const runtime = new ServerRuntime();

// Process large batches efficiently
const largeClassList = Array.from({length: 1000}, (_, i) => `class-${i}`);
const results = runtime.processClasses(largeClassList);

// Get statistics
const stats = runtime.getStats();
console.log(`Processed ${stats.totalClasses} classes in ${stats.totalTime}ms`);
```

## Runtime Comparison

| Feature | Browser Runtime | Server Runtime |
|---------|----------------|----------------|
| **DOM Monitoring** | ✅ MutationObserver | ❌ Not available |
| **Real-time Updates** | ✅ Automatic | ❌ Manual only |
| **CSS Injection** | ✅ Automatic | ❌ Manual only |
| **Interactive States** | ✅ Hover, focus, etc. | ❌ Static only |
| **Performance Monitoring** | ✅ Real-time stats | ✅ Build-time stats |
| **Memory Management** | ✅ Automatic cleanup | ✅ Manual control |
| **Node.js Support** | ❌ Browser only | ✅ Full support |
| **SSR Support** | ❌ Not suitable | ✅ Optimized |
| **Build Tools** | ❌ Not suitable | ✅ Perfect fit |

## Choosing the Right Runtime

### Use Browser Runtime When:

- Building client-side applications
- Need real-time DOM updates
- Want automatic CSS injection
- Working with interactive components
- Building SPAs or dynamic websites

```typescript
// Perfect for React, Vue, Angular apps
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime();
runtime.observe(document.body, { scan: true });
```

### Use Server Runtime When:

- Building static sites
- Need SSR support
- Working with build tools
- Generating CSS at build time
- Processing large batches of classes

```typescript
// Perfect for Next.js, Gatsby, Nuxt
import { ServerRuntime } from '@barocss/kit/runtime/server';

const runtime = new ServerRuntime();
const css = runtime.generateCssForClasses(classes);
```

## Advanced Usage Patterns

### Hybrid Approach

Use both runtimes in a full-stack application:

```typescript
// Server-side: Generate initial CSS
import { ServerRuntime } from '@barocss/kit/runtime/server';

const serverRuntime = new ServerRuntime();
const initialCSS = serverRuntime.generateCssForClasses(initialClasses);

// Client-side: Handle dynamic updates
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const browserRuntime = new BrowserRuntime();
browserRuntime.observe(document.body, { scan: true });
```

### Custom Runtime

Create a custom runtime for specific needs:

```typescript
import { Context, generateCss } from '@barocss/kit';

class CustomRuntime {
  private ctx: Context;
  
  constructor(config: Config) {
    this.ctx = createContext(config);
  }
  
  processClasses(classes: string[]) {
    return classes.map(cls => ({
      className: cls,
      css: generateCss(cls, this.ctx)
    }));
  }
}
```

### Runtime Switching

Switch between runtimes based on environment:

```typescript
function createRuntime(config: Config) {
  if (typeof window !== 'undefined') {
    // Browser environment
    return new BrowserRuntime(config);
  } else {
    // Server environment
    return new ServerRuntime(config);
  }
}

const runtime = createRuntime(config);
```

## Performance Considerations

### Browser Runtime

```typescript
// Optimize for browser performance
const runtime = new BrowserRuntime({
  maxRulesPerPartition: 50,  // Smaller partitions for better performance
  debounceTime: 16,          // 60fps debouncing
  cacheSize: 1000           // Reasonable cache size
});

// Monitor performance
runtime.onPerformanceUpdate((stats) => {
  if (stats.memoryUsage > '10MB') {
    runtime.clearCaches();
  }
});
```

### Server Runtime

```typescript
// Optimize for server performance
const runtime = new ServerRuntime({
  batchSize: 1000,          // Larger batches for efficiency
  cacheSize: 10000,         // Larger cache for repeated builds
  enableMinification: true  // Minify output
});

// Process in chunks for large datasets
const chunks = chunkArray(allClasses, 1000);
for (const chunk of chunks) {
  runtime.processClasses(chunk);
}
```

## Conclusion

BaroCSS runtime APIs provide specialized solutions for different environments, each optimized for their specific use cases and constraints.

Choose the Browser Runtime for client-side applications with real-time updates, or the Server Runtime for static generation and SSR scenarios.

Ready to get started? Check out the [Quick Start Guide](/guide/installation) for your chosen runtime.
