# Installation

Get BaroCSS up and running in your project with these simple steps.

## Prerequisites

- Node.js 18+ or 20+
- npm, yarn, or pnpm package manager
- A modern web project (React, Vue, vanilla JS, etc.)

## Quick Install

### Using npm
```bash
npm install barocss
```

### Using yarn
```bash
yarn add barocss
```

### Using pnpm
```bash
pnpm add barocss
```

## CDN Installation

For quick prototyping or when you don't want to use a package manager, you can include BaroCSS directly via CDN. BaroCSS provides both UMD and ES module builds for maximum compatibility.

### Option 1: UMD Build (Recommended for Simple HTML)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaroCSS Demo</title>
  
  <!-- BaroCSS UMD Build -->
  <script src="https://unpkg.com/barocss@latest/dist/cdn/barocss.umd.cjs"></script>
</head>
<body>
  <div class="bg-blue-500 text-white p-4 rounded-lg">
    Hello BaroCSS!
  </div>

  <script>
    // Initialize BaroCSS Runtime
    const runtime = new BaroCSS.BrowserRuntime();
    runtime.observe(document.body, { scan: true });
  </script>
</body>
</html>
```

### Option 2: ES Module Build

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaroCSS Demo</title>
</head>
<body>
  <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-xl">
    <h1 class="text-3xl font-bold mb-4">BaroCSS ES Module</h1>
    <p class="text-lg opacity-90">Modern ES modules with dynamic imports</p>
  </div>

  <script type="module">
    // Import BaroCSS as ES module
    import { BrowserRuntime } from 'https://unpkg.com/barocss@latest/dist/cdn/barocss.js';
    
    // Initialize with configuration
    const runtime = new BrowserRuntime({
      config: {
        preflight: 'minimal',
        theme: {
          colors: {
            brand: '#8b5cf6'
          }
        }
      }
    });
    
    runtime.observe(document.body, { 
      scan: true,
      onReady: () => console.log('BaroCSS initialized!')
    });
  </script>
</body>
</html>
```

### Option 3: Dynamic Import (Advanced)

```html
<script>
async function initBaroCSS() {
  // Dynamically import BaroCSS
  const { BrowserRuntime } = await import('https://unpkg.com/barocss@latest/dist/cdn/barocss.js');
  
  const runtime = new BrowserRuntime();
  runtime.observe(document.body, { scan: true });
  
  // Add some dynamic content
  document.body.innerHTML += `
    <div class="mt-4 p-4 bg-green-500 text-white rounded-lg">
      Dynamically loaded BaroCSS!
    </div>
  `;
}

// Load when needed
initBaroCSS();
</script>
```

### CDN Providers

BaroCSS is available on multiple CDN providers:

- **unpkg**: `https://unpkg.com/barocss@latest/dist/cdn/`
- **jsDelivr**: `https://cdn.jsdelivr.net/npm/barocss@latest/dist/cdn/`
- **esm.sh**: `https://esm.sh/barocss/runtime/browser` (ES modules only)

### Version Pinning

For production use, always pin to a specific version:

```html
<!-- Pin to specific version -->
<script src="https://unpkg.com/barocss@0.1.0/dist/cdn/barocss.umd.cjs"></script>

<!-- Or use version range -->
<script src="https://unpkg.com/barocss@^0.1.0/dist/cdn/barocss.umd.cjs"></script>
```

## Framework Integration

### React
```tsx
import React from 'react';
import { BrowserRuntime } from 'barocss/runtime/browser';

// Initialize BaroCSS
const runtime = new BrowserRuntime();

function App() {
  useEffect(() => {
    runtime.observe(document.body, { scan: true });
  }, []);
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl">
      <h1 className="text-3xl font-bold mb-4">Welcome to BaroCSS</h1>
      <p className="text-lg opacity-90">
        Start building beautiful interfaces with real-time CSS generation.
      </p>
    </div>
  );
}

export default App;
```

### Vue
```vue
<template>
  <div class="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6 rounded-xl">
    <h1 class="text-3xl font-bold mb-4">Welcome to BaroCSS</h1>
    <p class="text-lg opacity-90">
      Start building beautiful interfaces with real-time CSS generation.
    </p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { BrowserRuntime } from 'barocss/runtime/browser';

onMounted(() => {
  // Initialize BaroCSS
  const runtime = new BrowserRuntime();
  runtime.observe(document.body, { scan: true });
});
</script>
```

### Vanilla JavaScript
```javascript
import { BrowserRuntime } from 'barocss/runtime/browser';

// Initialize BaroCSS
const runtime = new BrowserRuntime();

// Your existing code...
document.addEventListener('DOMContentLoaded', () => {
  console.log('BaroCSS initialized!');
  runtime.observe(document.body, { scan: true });
});
```

## Configuration

### Basic Configuration
```javascript
import { BrowserRuntime } from 'barocss/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    // Preflight level: true | false | 'minimal' | 'standard' | 'full'
    // true inserts full preflight CSS; false disables preflight
    preflight: 'minimal',
    theme: {
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
      },
    },
  },
});
```

```javascript
{
  // Runtime options
  config: {
    // Preflight level: true | false | 'minimal' | 'standard' | 'full'
    preflight: true,
    theme: {
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
      },
    },
  },
  styleId: 'barocss-runtime', // id of the style element
  insertionPoint: 'head', // insertion point for the style element
  maxRulesPerPartition: 50, // maximum number of rules per partition
}
```


### Advanced Configuration
```javascript
import { BrowserRuntime } from 'barocss/runtime/browser';
import { createTheme } from 'barocss/theme';

const customTheme = createTheme({
  colors: {
    brand: {
      50: '#f0f9ff',
      500: '#0ea5e9',
      900: '#0c4a6e',
    }
  },
  extend: {
    animation: {
      'bounce-slow': 'bounce 2s infinite',
    }
  }
});

const runtime = new BrowserRuntime({
  config: {
    theme: customTheme,
    // Preflight level: true | false | 'minimal' | 'standard' | 'full'
    preflight: true,
  },
});

// observe options
runtime.observe(document.body, {
  // Whether to perform an initial DOM scan (process existing class attributes immediately)
  scan: true,
  // Callback invoked after the scan completes
  onReady: () => {},
});
```

## Next Steps

Now that you have BaroCSS installed, continue with:

- [Quick Start](/guide/quick-start) - Create your first styled component
- [JIT Mode](/guide/jit-mode) - Understand how JIT compilation works
- [Theme Configuration](/guide/theme-variables) - Customize your design system
- [Examples](/examples/) - See BaroCSS in action

## Troubleshooting

### Common Issues

**Module not found error**
```bash
Error: Cannot find module 'barocss'
```
Make sure you've installed the package correctly and your Node.js version is compatible.

**Runtime not working**
If styles aren't being generated, ensure you've initialized the BrowserRuntime before using BaroCSS classes.

**Build errors**
For build tool issues, check that your bundler is configured to handle ES modules correctly.

Need help? Check our [GitHub issues](https://github.com/your-org/barocss/issues) or [Discord community](https://discord.gg/barocss).
