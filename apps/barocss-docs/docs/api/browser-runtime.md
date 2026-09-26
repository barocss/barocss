---
title: Browser Runtime API
description: Browser-specific DOM integration and CSS injection in BaroCSS
---

# Browser Runtime API

The Browser Runtime API provides browser-specific functionality for DOM integration, CSS injection, and automatic class detection. It's the primary way to use BaroCSS in web applications.

## BrowserRuntime Class

The main class for browser-based BaroCSS functionality.

```typescript
import { BrowserRuntime } from '@barocss/browser';

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
```

### Constructor Options

```typescript
import type { Config } from '@barocss/kit';

interface BrowserRuntimeOptions {
  config?: Config;                    // BaroCSS configuration
  styleId?: string;                   // Custom style element ID
  insertionPoint?: 'head' | 'body' | HTMLElement; // CSS insertion point
  maxRulesPerPartition?: number;      // Max rules per style partition
}
```

### Basic Usage

```typescript
// Initialize runtime
const runtime = new BrowserRuntime({
  config: {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          brand: '#3b82f6'
        }
      }
    }
  }
});

// Start watching DOM changes
runtime.observe(document.body, { scan: true });
```

## Core Methods

### addClass()

Add CSS classes to the runtime and generate styles.

```typescript
// Add single class
runtime.addClass('bg-blue-500');

// Add multiple classes
runtime.addClass(['bg-blue-500', 'text-white', 'p-4']);

// Add space-separated classes
runtime.addClass('bg-blue-500 text-white p-4');
```

### observe()

Start watching DOM changes and automatically process new classes.

```typescript
// Watch entire document
runtime.observe(document.body, { scan: true });

// Watch specific element
const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing #app element');
}

runtime.observe(app, {
  scan: true,
  onReady: () => console.log('Ready!')
});

// Watch with custom options
runtime.observe(document.body, {
  scan: true,
  onReady: () => {
    console.log('DOM scanning complete');
  }
});
```

**Options:**
```typescript
interface ObserveOptions {
  scan?: boolean;        // Scan existing elements
  onReady?: () => void;  // Callback when ready
}
```

### removeClass()

In the published `0.0.3` package, `removeClass()` deletes class entries from the runtime cache but leaves previously inserted CSS in the page.

In the published `0.5.0` package, it also removes the runtime-injected CSS for those classes. CSS needed by remaining classes, shared root rules, base styles, and DOM observation remain active. Neither version changes an element's `class` attribute; remove class names from the DOM separately when needed.

```typescript
// Remove single class
runtime.removeClass('bg-blue-500');

// Remove multiple classes
runtime.removeClass(['bg-blue-500', 'text-white']);
```

## DOM Integration

### ChangeDetector

`ChangeDetector` is exported from `@barocss/browser`, not `@barocss/kit`. `BrowserRuntime` already uses it internally. In the published `0.5.0` package, `observe()` returns a `MutationObserver`:

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();
const observer = runtime.observe(document.body, { scan: true });

// When observation is no longer needed:
observer.disconnect();
runtime.destroy();
```

### Automatic Class Detection

The runtime automatically detects and processes classes when:

- New elements are added to the DOM
- Existing elements have their `class` attribute modified
- Classes are added via JavaScript

```typescript
// These will be automatically detected and processed
document.body.innerHTML = `
  <div class="bg-blue-500 text-white p-4">
    <button class="hover:bg-blue-600 focus:ring-2">Click me</button>
  </div>
`;

// Dynamic class addition
const button = document.querySelector('button');
if (button) {
  button.classList.add('active:scale-95');
}
```

## Style Management

### Style Partitions

BaroCSS uses style partitions for efficient CSS management:

```typescript
// Set the maximum number of rules per partition
const runtime = new BrowserRuntime({
  maxRulesPerPartition: 100  // More rules per partition
});
```

`getCacheStats()` does not return a partition count.

### CSS Access

```typescript
// Check if class is processed
const hasClass = runtime.has('bg-blue-500');

// Get CSS for specific class
const css = runtime.getCss('bg-blue-500');

// Get all generated CSS
const allCss = runtime.getAllCss();

// Get all processed classes
const classes = runtime.getClasses();
```

## Configuration Management

### updateConfig()

Update runtime configuration dynamically.

```typescript
// Update theme
runtime.updateConfig({
  theme: {
    extend: {
      colors: {
        brand: '#10b981'  // New brand color
      }
    }
  }
});

// Update dark mode strategy
runtime.updateConfig({
  darkMode: 'class'
});
```

### reset()

Reset the runtime to initial state.

```typescript
// Clear all caches and styles
runtime.reset();
```

## Statistics

### getStats()

Get runtime state and cache statistics. The fields below exist in the published `0.5.0` package.

```typescript
const stats = runtime.getStats();
console.log({
  cachedClasses: stats.cachedClasses,
  styleElementId: stats.styleElementId,
  isDestroyed: stats.isDestroyed,
  rootCacheSize: stats.cacheStats.runtime.rootCacheSize,
  processedClasses: stats.cacheStats.incremental.processedClasses
});
```

### Cache Management

```typescript
// Clear all caches
runtime.clearCaches();

// Get cache statistics
const cacheStats = runtime.getCacheStats();
```

## Advanced Usage

### Custom Style Injection

```typescript
import { BrowserRuntime } from '@barocss/browser';

// Custom insertion point
const customStyles = document.getElementById('custom-styles');
if (!customStyles) {
  throw new Error('Missing #custom-styles element');
}

const runtimeInContainer = new BrowserRuntime({
  insertionPoint: customStyles
});

// Custom style ID
const runtimeWithCustomId = new BrowserRuntime({
  styleId: 'my-runtime'
});
```

### Manual CSS Processing

```typescript
// Process classes without DOM integration
runtime.addClass('bg-blue-500 text-white p-4');

// Get generated CSS
const css = runtime.getAllCss();
console.log(css);
```

### Integration with Frameworks

#### React Integration

This example uses the public runtime API in the published `0.5.0` package.

```tsx
import { useEffect } from 'react';
import { BrowserRuntime } from '@barocss/browser';

function App() {
  useEffect(() => {
    const runtime = new BrowserRuntime();
    const observer = runtime.observe(document.body, { scan: true });

    return () => {
      observer.disconnect();
      runtime.destroy();
    };
  }, []);

  return (
    <div className="block text-center">
      <h1>Hello BaroCSS!</h1>
    </div>
  );
}
```

#### Vue Integration

This Vue 3 component uses the public runtime API in the published `0.5.0` package.

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import { BrowserRuntime } from '@barocss/browser';

let runtime: BrowserRuntime | undefined;
let observer: MutationObserver | undefined;

onMounted(() => {
  runtime = new BrowserRuntime();
  observer = runtime.observe(document.body, { scan: true });
});

onBeforeUnmount(() => {
  observer?.disconnect();
  runtime?.destroy();
});
</script>

<template>
  <div class="block text-center">Hello BaroCSS!</div>
</template>
```

## Error Handling

```typescript
try {
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

  runtime.observe(document.body, { scan: true });
} catch (error) {
  console.error('Runtime initialization failed:', error);
}
```

## Examples

### Basic Setup

```typescript
import { BrowserRuntime } from '@barocss/browser';

// Initialize
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

// Start watching
runtime.observe(document.body, { scan: true });

// Add classes dynamically
document.body.innerHTML = `
  <div class="bg-brand text-white p-4 rounded-lg">
    <h1 class="text-2xl font-bold">Hello BaroCSS!</h1>
    <button class="mt-4 bg-white text-brand px-4 py-2 rounded hover:bg-gray-100">
      Click me
    </button>
  </div>
`;
```

### Advanced Configuration

```typescript
const runtime = new BrowserRuntime({
  config: {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          brand: {
            50: '#eff6ff',
            500: '#3b82f6',
            900: '#1e3a8a'
          }
        },
        spacing: {
          '18': '4.5rem',
          '88': '22rem'
        }
      }
    }
  },
  maxRulesPerPartition: 100
});

// Watch with callback
runtime.observe(document.body, {
  scan: true,
  onReady: () => {
    console.log('BaroCSS is ready!');
  }
});
```
