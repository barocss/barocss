---
title: Browser Runtime API
description: Browser-specific DOM integration and CSS injection in BaroCSS
---

# Browser Runtime API

The Browser Runtime API provides browser-specific functionality for DOM integration, CSS injection, and automatic class detection. It's the primary way to use BaroCSS in web applications.

## BrowserRuntime Class

The main class for browser-based BaroCSS functionality.

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
```

### Constructor Options

```typescript
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
runtime.observe(document.getElementById('app'), { 
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

Remove CSS classes from the runtime.

```typescript
// Remove single class
runtime.removeClass('bg-blue-500');

// Remove multiple classes
runtime.removeClass(['bg-blue-500', 'text-white']);
```

## DOM Integration

### ChangeDetector

The `ChangeDetector` class monitors DOM changes and automatically processes new classes.

```typescript
import { ChangeDetector, IncrementalParser } from '@barocss/kit';

const parser = new IncrementalParser(ctx);
const detector = new ChangeDetector(parser, runtime);

// Start monitoring
const observer = detector.observe(document.body, { scan: true });

// Stop monitoring
detector.disconnect();
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
button.classList.add('active:scale-95');
```

## Style Management

### Style Partitions

BaroCSS uses style partitions for efficient CSS management:

```typescript
// Get current partition info
const stats = runtime.getCacheStats();
console.log(`Partitions: ${stats.partitions}`);

// Custom partition settings
const runtime = new BrowserRuntime({
  maxRulesPerPartition: 100  // More rules per partition
});
```

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

Get comprehensive runtime statistics.

```typescript
const stats = runtime.getStats();
console.log({
  processedClasses: stats.processedClasses,
  cacheHits: stats.cacheHits,
  partitions: stats.partitions,
  memoryUsage: stats.memoryUsage
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
// Custom insertion point
const runtime = new BrowserRuntime({
  insertionPoint: document.getElementById('custom-styles')
});

// Custom style ID
const runtime = new BrowserRuntime({
  styleId: 'my-@barocss/kit-styles'
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

```typescript
import { useEffect, useRef } from 'react';
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

function App() {
  const runtimeRef = useRef<BrowserRuntime>();

  useEffect(() => {
    runtimeRef.current = new BrowserRuntime({
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

    runtimeRef.current.observe(document.body, { scan: true });

    return () => {
      runtimeRef.current?.destroy();
    };
  }, []);

  return (
    <div className="bg-brand text-white p-4">
      <h1>Hello BaroCSS!</h1>
    </div>
  );
}
```

#### Vue Integration

```typescript
import { createApp } from 'vue';
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const app = createApp({
  mounted() {
    this.runtime = new BrowserRuntime({
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

    this.runtime.observe(document.body, { scan: true });
  },
  beforeUnmount() {
    this.runtime?.destroy();
  }
});
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

## Best Practices

1. **Initialize Once**: Create runtime once and reuse it
2. **Use observe()**: Let the runtime handle DOM changes automatically
3. **Monitor Statistics**: Use `getStats()` to monitor runtime statistics
4. **Clean Up**: Call `destroy()` when done
5. **Error Handling**: Always handle initialization errors

## Examples

### Basic Setup

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

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

## Related APIs

- [Context API](/api/context) - Configuration management
- [Engine API](/api/engine) - Core CSS generation
- [Server Runtime](/api/server-runtime) - Server-side usage
- [Static Utility API](/api/static-utility) - Creating custom utilities
