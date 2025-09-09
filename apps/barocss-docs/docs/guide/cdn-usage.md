# CDN Usage Guide

::: tip Zero Build Setup
BaroCSS can be used directly from a CDN without any build process or package installation. This is perfect for rapid prototyping, educational projects, or when you want to test BaroCSS quickly.
:::

## Quick Start

::: details Purpose
Get started with BaroCSS in under 30 seconds using CDN.
:::

Get started with BaroCSS in under 30 seconds:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaroCSS Quick Start</title>
  <script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
</head>
<body>
  <div class="bg-blue-500 text-white p-8 rounded-xl text-center">
    <h1 class="text-3xl font-bold mb-4">Hello BaroCSS!</h1>
    <p class="text-lg opacity-90">Real-time CSS generation with zero build setup</p>
  </div>

  <script>
    const runtime = new BaroCSS.BrowserRuntime();
    runtime.observe(document.body, { scan: true });
  </script>
</body>
</html>
```

## CDN Build Options

::: details Purpose
Choose the right CDN build for your project needs.
:::

BaroCSS provides two main CDN builds:

### 1. UMD Build (Universal Module Definition)

::: details Purpose
Universal build that works in all browsers without module system requirements.
:::

**Best for**: Simple HTML pages, legacy browsers, quick prototypes

```html
<script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
<script>
  // Global BaroCSS object is available
  const runtime = new BaroCSS.BrowserRuntime();
  runtime.observe();
</script>
```

**Features:**
- Works in all browsers (IE11+)
- No module system required
- Global `BaroCSS` object
- Larger file size (~45KB gzipped)

### 2. ES Module Build

::: details Purpose
Modern ES6+ build with better performance and tree-shaking support.
:::

**Best for**: Modern browsers, module-based development

```html
<script type="module">
  import { BrowserRuntime } from 'https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js';
  
  const runtime = new BrowserRuntime();
  runtime.observe(document.body, { scan: true });
</script>
```

**Features:**
- Modern ES6+ syntax
- Tree-shaking friendly
- Smaller bundle size
- Better performance
- Requires modern browser

## CDN Providers

::: details Purpose
Choose your preferred CDN provider for optimal performance and reliability.
:::

Choose your preferred CDN provider:

| Provider | UMD Build | ES Module Build |
|----------|-----------|-----------------|
| **unpkg** | `https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs` | `https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js` |
| **jsDelivr** | `https://cdn.jsdelivr.net/npm/@barocss/browser@latest/dist/cdn/barocss.umd.cjs` | `https://cdn.jsdelivr.net/npm/@barocss/browser@latest/dist/cdn/barocss.js` |
| **esm.sh** | N/A | `https://esm.sh/@barocss/browser` |

## Complete Examples

### Basic Styling Example

::: details Purpose
Complete example showing basic BaroCSS styling with interactive demo.
:::

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaroCSS Styling Demo</title>
  <script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
</head>
<body class="bg-gray-100 min-h-screen p-8">
  
  <!-- Hero Section -->
  <header class="text-center mb-12">
    <h1 class="text-5xl font-bold text-gray-800 mb-4">
      Welcome to BaroCSS
    </h1>
    <p class="text-xl text-gray-600 max-w-2xl mx-auto">
      Experience real-time CSS generation without any build process
    </p>
  </header>

  <!-- Feature Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
    
    <!-- Card 1 -->
    <div class="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div class="w-12 h-12 bg-blue-500 rounded-lg mb-4 flex items-center justify-center">
        <span class="text-white text-xl font-bold">⚡</span>
      </div>
      <h3 class="text-xl font-semibold text-gray-800 mb-2">Real-time</h3>
      <p class="text-gray-600">
        CSS is generated instantly as you add classes to your HTML
      </p>
    </div>

    <!-- Card 2 -->
    <div class="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div class="w-12 h-12 bg-green-500 rounded-lg mb-4 flex items-center justify-center">
        <span class="text-white text-xl font-bold">🚀</span>
      </div>
      <h3 class="text-xl font-semibold text-gray-800 mb-2">Zero Build</h3>
      <p class="text-gray-600">
        No compilation step required. Works directly in the browser
      </p>
    </div>

    <!-- Card 3 -->
    <div class="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div class="w-12 h-12 bg-purple-500 rounded-lg mb-4 flex items-center justify-center">
        <span class="text-white text-xl font-bold">🎨</span>
      </div>
      <h3 class="text-xl font-semibold text-gray-800 mb-2">Full Syntax</h3>
      <p class="text-gray-600">
        Complete utility-first syntax support with arbitrary values
      </p>
    </div>
    
  </div>

  <!-- Interactive Demo -->
  <div class="max-w-4xl mx-auto mt-12">
    <h2 class="text-3xl font-bold text-center text-gray-800 mb-8">
      Try It Live
    </h2>
    
    <div class="bg-white rounded-xl p-6 shadow-lg">
      <div id="demo-area" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p class="text-gray-500 mb-4">Click the buttons below to see real-time styling:</p>
        <div id="demo-element" class="inline-block p-4 bg-gray-200 rounded-lg transition-all duration-300">
          Demo Element
        </div>
      </div>
      
      <div class="flex gap-4 mt-6 justify-center flex-wrap">
        <button onclick="updateDemo('bg-red-500 text-white')" 
                class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
          Red Background
        </button>
        <button onclick="updateDemo('bg-blue-500 text-white transform scale-110')" 
                class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Blue + Scale
        </button>
        <button onclick="updateDemo('bg-gradient-to-r from-purple-500 to-pink-500 text-white transform rotate-3')" 
                class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
          Gradient + Rotate
        </button>
        <button onclick="updateDemo('bg-gray-200 text-gray-800')" 
                class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
          Reset
        </button>
      </div>
    </div>
  </div>

  <script>
    // Initialize BaroCSS
    const runtime = new BaroCSS.BrowserRuntime({
      config: {
        preflight: 'minimal'
      }
    });
    
    runtime.observe(document.body, { 
      scan: true,
      onReady: () => console.log('BaroCSS is ready!')
    });

    // Demo functionality
    function updateDemo(classes) {
      const element = document.getElementById('demo-element');
      element.className = `inline-block p-4 rounded-lg transition-all duration-300 ${classes}`;
    }
  </script>
</body>
</html>
```

### Advanced Configuration Example

::: details Purpose
Advanced example with custom theme configuration and ES modules.
:::

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaroCSS Advanced Configuration</title>
</head>
<body>
  
  <div class="container mx-auto p-8">
    <h1 class="text-4xl font-bold text-brand-primary mb-6">
      Custom Theme Example
    </h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      
      <!-- Custom Colors -->
      <div class="space-y-4">
        <h2 class="text-2xl font-semibold text-gray-800">Custom Colors</h2>
        <div class="space-y-2">
          <div class="w-full h-16 bg-brand-primary rounded-lg flex items-center justify-center text-white font-semibold">
            Brand Primary
          </div>
          <div class="w-full h-16 bg-brand-secondary rounded-lg flex items-center justify-center text-white font-semibold">
            Brand Secondary
          </div>
          <div class="w-full h-16 bg-brand-accent rounded-lg flex items-center justify-center text-white font-semibold">
            Brand Accent
          </div>
        </div>
      </div>

      <!-- Arbitrary Values -->
      <div class="space-y-4">
        <h2 class="text-2xl font-semibold text-gray-800">Arbitrary Values</h2>
        <div class="space-y-4">
          <div class="w-[200px] h-[80px] bg-[#ff6b6b] rounded-[20px] flex items-center justify-center text-white font-semibold">
            Arbitrary Size & Color
          </div>
          <div class="p-[12px] bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-[16px] text-white font-semibold text-center">
            Custom Gradient
          </div>
          <div class="w-full h-[60px] bg-white border-[3px] border-[#4ecdc4] rounded-[12px] flex items-center justify-center text-[#4ecdc4] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
            Complex Border & Shadow
          </div>
        </div>
      </div>
      
    </div>
  </div>

  <script type="module">
    import { BrowserRuntime } from 'https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js';
    
    // Advanced configuration with custom theme
    const runtime = new BrowserRuntime({
      config: {
        preflight: 'standard',
        theme: {
          colors: {
            'brand-primary': '#667eea',
            'brand-secondary': '#764ba2', 
            'brand-accent': '#f093fb'
          },
          fontFamily: {
            'brand': ['Inter', 'system-ui', 'sans-serif']
          },
          spacing: {
            '18': '4.5rem',
            '88': '22rem'
          }
        }
      },
      enableDev: true, // Enable development logging
      maxRulesPerPartition: 100 // Increase rules per partition
    });
    
    runtime.observe(document.body, { 
      scan: true,
      onReady: () => {
        console.log('✅ BaroCSS initialized with custom theme');
        console.log('📊 Stats:', runtime.getStats());
      }
    });
  </script>
</body>
</html>
```

## Performance Considerations

::: details Purpose
Understand performance implications and optimization strategies for CDN usage.
:::

### File Sizes

| Build Type | Size (minified) | Size (gzipped) |
|------------|-----------------|----------------|
| UMD | ~120KB | ~45KB |
| ES Module | ~115KB | ~42KB |

### Loading Strategies

#### 1. Preload for Critical Rendering

::: details Purpose
Optimize loading performance with preloading strategies.
:::

```html
<link rel="preload" href="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs" as="script">
<script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
```

#### 2. Lazy Loading for Non-Critical

::: details Purpose
Load BaroCSS only when needed to improve initial page load performance.
:::

```html
<script>
// Load BaroCSS only when needed
function loadBaroCSS() {
  return import('https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js');
}

// Load on user interaction
document.addEventListener('click', async () => {
  const { BrowserRuntime } = await loadBaroCSS();
  const runtime = new BrowserRuntime();
  runtime.observe(document.body, { scan: true });
}, { once: true });
</script>
```

#### 3. Service Worker Caching

::: details Purpose
Cache BaroCSS files using service workers for offline support and faster subsequent loads.
:::

```javascript
// In your service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('@barocss/kit-v1').then((cache) => {
      return cache.addAll([
        'https://unpkg.com/@barocss/browser@0.1.0/dist/cdn/barocss.umd.cjs'
      ]);
    })
  );
});
```

## Version Management

::: details Purpose
Learn best practices for version management in production environments.
:::

### Production Best Practices

```html
<!-- ❌ Don't use @latest in production -->
<script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>

<!-- ✅ Pin to specific version -->
<script src="https://unpkg.com/@barocss/browser@0.1.0/dist/cdn/barocss.umd.cjs"></script>

<!-- ✅ Or use semantic version range -->
<script src="https://unpkg.com/@barocss/browser@^0.1.0/dist/cdn/barocss.umd.cjs"></script>
```

### Checking Available Versions

::: details Purpose
Learn how to check and manage available BaroCSS versions.
:::

```bash
# View all available versions
npm view @barocss/kit versions --json

# Check latest version
npm view @barocss/kit version
```

## Common Use Cases

### 1. Educational/Learning

::: details Purpose
Perfect for CodePen, JSFiddle, or learning environments.
:::

Perfect for CodePen, JSFiddle, or learning environments:

```html
<!-- Single file, no build process needed -->
<script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
```

### 2. Rapid Prototyping

::: details Purpose
Quick mockups and proof of concepts.
:::

Quick mockups and proof of concepts:

```html
<!-- Get started in seconds -->
<script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
<script>
  new BaroCSS.BrowserRuntime().observe();
</script>
```

### 3. A/B Testing

::: details Purpose
Test BaroCSS in existing applications.
:::

Test BaroCSS in existing applications:

```html
<!-- Load conditionally -->
<script>
if (window.location.search.includes('@barocss/kit=true')) {
  loadScript('https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs', () => {
    new BaroCSS.BrowserRuntime().observe(document.body, { scan: true });
  });
}
</script>
```

### 4. Migration Testing

::: details Purpose
Gradually migrate from other CSS frameworks.
:::

Gradually migrate from other CSS frameworks:

```html
<!-- Load alongside existing frameworks -->
<link rel="stylesheet" href="existing-framework.css">
<script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
<script>
  // Initialize with limited scope
  new BaroCSS.BrowserRuntime().observe(document.querySelector('.@barocss/kit-zone'));
</script>
```
