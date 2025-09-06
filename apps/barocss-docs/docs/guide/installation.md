# Installation

::: tip Get Started Quickly
BaroCSS can be installed via package manager or CDN. Choose the method that best fits your project setup.
:::

## Prerequisites

::: details System Requirements
- **Node.js**: 18+ or 20+ (for package manager installation)
- **Package Manager**: npm, yarn, or pnpm
- **Project Type**: Any modern web project (React, Vue, Svelte, vanilla JS, etc.)
- **Browser Support**: Modern browsers with ES6+ support
:::

## Package Manager Installation

::: details Recommended for Production
Use a package manager for production applications with build tools.
:::

### Using pnpm (Recommended)
```bash
pnpm add @barocss/kit
```

### Using npm
```bash
npm install @barocss/kit
```

### Using yarn
```bash
yarn add @barocss/kit
```

::: tip Why pnpm?
- Faster installation
- Better disk space efficiency
- More reliable dependency resolution
- Works great with monorepos
:::

## CDN Installation

::: details Perfect for Prototyping
Use CDN for quick prototypes, demos, or when you don't want to use a package manager. BaroCSS provides both UMD and ES module builds for maximum compatibility.
:::

### Option 1: UMD Build (Recommended for Simple HTML)

::: details Best for Simple HTML Pages
UMD builds work in any environment and don't require module support.
:::

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaroCSS Demo</title>
  
  <!-- BaroCSS UMD Build -->
  <script src="https://unpkg.com/@barocss/kit@latest/dist/cdn/barocss.umd.cjs"></script>
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

::: details Best for Modern Development
ES modules provide better tree-shaking and modern JavaScript features.
:::

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
    import { BrowserRuntime } from 'https://unpkg.com/@barocss/kit@latest/dist/cdn/barocss.js';
    
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

::: details Best for Conditional Loading
Load BaroCSS only when needed, perfect for progressive enhancement.
:::

```html
<script>
async function initBaroCSS() {
  // Dynamically import BaroCSS
  const { BrowserRuntime } = await import('https://unpkg.com/@barocss/kit@latest/dist/cdn/barocss.js');
  
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

::: details Available CDN Options
BaroCSS is available on multiple CDN providers for maximum compatibility and performance.
:::

- **unpkg**: `https://unpkg.com/@barocss/kit@latest/dist/cdn/`
- **jsDelivr**: `https://cdn.jsdelivr.net/npm/@barocss/kit@latest/dist/cdn/`
- **esm.sh**: `https://esm.sh/@barocss/kit/runtime/browser` (ES modules only)

### Version Pinning

::: warning Production Best Practice
For production use, always pin to a specific version to ensure stability and avoid breaking changes.
:::

```html
<!-- Pin to specific version -->
<script src="https://unpkg.com/@barocss/kit@0.1.0/dist/cdn/barocss.umd.cjs"></script>

<!-- Or use version range -->
<script src="https://unpkg.com/@barocss/kit@^0.1.0/dist/cdn/barocss.umd.cjs"></script>
```

## Framework Integration

::: details Framework-Specific Setup
BaroCSS works with any JavaScript framework. Here are examples for popular frameworks.
:::

### React

::: details React Integration
```tsx
import React from 'react';
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

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
:::

### Vue

::: details Vue Integration
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
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

onMounted(() => {
  // Initialize BaroCSS
  const runtime = new BrowserRuntime();
  runtime.observe(document.body, { scan: true });
});
</script>
```
:::

### Vanilla JavaScript

::: details Vanilla JS Integration
```javascript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

// Initialize BaroCSS
const runtime = new BrowserRuntime();

// Your existing code...
document.addEventListener('DOMContentLoaded', () => {
  console.log('BaroCSS initialized!');
  runtime.observe(document.body, { scan: true });
});
```
:::

## Configuration

::: details Runtime Configuration
Configure BaroCSS behavior, theme, and runtime options to match your project needs.
:::

### Basic Configuration

::: details Essential Settings
```javascript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

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
:::

### Advanced Configuration

::: details Complete Runtime Options
```javascript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';
import { createTheme } from '@barocss/kit/theme';

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
  // Runtime options
  styleId: '@barocss/kit-runtime', // id of the style element
  insertionPoint: 'head', // insertion point for the style element
  maxRulesPerPartition: 50, // maximum number of rules per partition
});

// observe options
runtime.observe(document.body, {
  // Whether to perform an initial DOM scan (process existing class attributes immediately)
  scan: true,
  // Callback invoked after the scan completes
  onReady: () => {},
});
```
:::

## Next Steps

::: tip Ready to Build?
Now that you have BaroCSS installed, continue with these guides:
:::

- **[Quick Start](/guide/quick-start)** - Create your first styled component
- **[JIT Mode](/guide/jit-mode)** - Understand how JIT compilation works
- **[Theme Configuration](/guide/theme-variables)** - Customize your design system
- **[Examples](/examples/)** - See BaroCSS in action

## Troubleshooting

::: details Common Issues and Solutions
If you encounter issues during installation or setup, check these common problems and solutions.
:::

### Module not found error

::: warning Package Installation Issue
```bash
Error: Cannot find module '@barocss/kit'
```

**Solutions:**
- Verify the package is installed: `pnpm list @barocss/kit`
- Check your Node.js version: `node --version` (should be 18+)
- Clear package manager cache and reinstall
- Ensure you're in the correct project directory
:::

### Runtime not working

::: warning Runtime Initialization Issue
If styles aren't being generated, ensure you've initialized the BrowserRuntime before using BaroCSS classes.

**Checklist:**
- ✅ BrowserRuntime is imported correctly
- ✅ Runtime is initialized before DOM manipulation
- ✅ `runtime.observe()` is called with correct element
- ✅ Classes are added after runtime initialization
:::

### Build errors

::: warning Build Tool Configuration
For build tool issues, check that your bundler is configured to handle ES modules correctly.

**Common fixes:**
- Update your bundler to latest version
- Check ES module configuration
- Verify import/export syntax
- Clear build cache and rebuild
:::

### Getting Help

::: tip Community Support
Need help? Check these resources:
:::

- **[GitHub Issues](https://github.com/your-org/@barocss/kit/issues)** - Report bugs and request features
- **[Discord Community](https://discord.gg/@barocss/kit)** - Get help from the community
- **[Documentation](/guide/)** - Comprehensive guides and API reference
