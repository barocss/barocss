# @barocss/browser

[![npm version](https://img.shields.io/npm/v/@barocss/browser.svg)](https://www.npmjs.com/package/@barocss/browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Browser Runtime** - Real-time CSS generation for browsers

@barocss/browser provides a browser-specific runtime that automatically detects DOM changes and generates CSS in real-time. It includes DOM change detection, style injection, and performance optimizations for browser environments.

## ✨ Key Features

- **🚀 Real-time DOM Detection** - Automatically detects and processes class changes
- **⚡ Instant Style Injection** - Injects generated CSS into the page immediately
- **🧠 Smart Caching** - Caches generated styles for optimal performance
- **📱 Style Partitioning** - Organizes CSS into efficient partitions
- **🎯 MutationObserver Integration** - Uses native browser APIs for change detection

## 🚀 Quick Start

### NPM Installation

```bash
# npm
npm install @barocss/browser

# pnpm
pnpm add @barocss/browser

# yarn
yarn add @barocss/browser
```

### Basic Usage

```typescript
import { BrowserRuntime } from '@barocss/browser';

// Initialize runtime
const runtime = new BrowserRuntime();

// Watch DOM changes and auto-style
runtime.observe(document.body, { scan: true });

// Add classes dynamically
document.body.innerHTML = `
  <div class="bg-blue-500 text-white p-4 rounded-lg">
    <h1 class="text-2xl font-bold">Hello BaroCSS!</h1>
    <p class="text-lg opacity-90">This gets styled instantly!</p>
  </div>
`;
```

### Preload classes from json-render

Call the preloader after validating the response and before mounting the renderer:

```typescript
import { BrowserRuntime, preloadJsonRenderClasses } from '@barocss/browser';

const runtime = new BrowserRuntime();
const spec = validateResponse(response); // Your catalog and class allowlist checks
preloadJsonRenderClasses(spec, runtime);
renderJsonUi(spec); // Mount your json-render Renderer here
```

The helper reads literal `props.className` strings in the flat `spec.elements` map. It splits class lists, removes duplicates, and calls `runtime.addClass` synchronously. It does not return a CSS readiness result. The application must validate the spec, response size, class allowlist, class support, and runtime state before this call. The helper reads every entry, including nodes that the renderer may not mount. State-derived classes and classes added inside registered components need a separate source of classes.

### CDN Usage

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BaroCSS App</title>
</head>
<body>
  <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-xl">
    <h1 class="text-4xl font-bold mb-6">Hello BaroCSS!</h1>
    <p class="text-xl opacity-90">Instant styling without build</p>
  </div>
  
  <script type="module">
    import { BrowserRuntime } from 'https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js';
    
    const runtime = new BrowserRuntime();
    runtime.observe(document.body, { scan: true });
  </script>
</body>
</html>
```

## 🎯 How It Works

The browser runtime provides real-time CSS generation:

1. **DOM Monitoring** - Uses MutationObserver to watch for class changes
2. **Class Detection** - Automatically detects new Tailwind classes
3. **CSS Generation** - Generates CSS using @barocss/kit engine
4. **Style Injection** - Injects CSS into the page in real-time
5. **Performance Optimization** - Caches and partitions styles efficiently

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();

// Automatically detects and processes these changes:
document.body.innerHTML = `
  <div class="bg-red-500 text-white p-4 rounded-lg shadow-md">
    <h2 class="text-xl font-semibold">Dynamic Content</h2>
    <p class="text-sm opacity-80">Generated instantly!</p>
  </div>
`;

// BaroCSS automatically:
// ✅ Detects new classes
// ✅ Generates CSS
// ✅ Applies styles
// ✅ Caches results
```

## 🛠️ Usage Examples

### Basic DOM Observation

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();

// Watch entire document
runtime.observe(document.body, { scan: true });

// Watch specific container
const container = document.querySelector('#app');
runtime.observe(container, { scan: true });
```

### Advanced Configuration

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          'brand': {
            50: '#f0f9ff',
            500: '#0ea5e9',
            900: '#0c4a6e',
          }
        }
      }
    },
    darkMode: 'class'
  },
  maxRulesPerPartition: 50,
  debounceTime: 16
});
```

### Performance Monitoring

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();

// Get runtime statistics
const stats = runtime.getStats();
console.log('Generated classes:', stats.totalClasses);
console.log('Cache hit rate:', stats.cacheHitRate);

// Clear caches when needed
runtime.clearCaches();
```

## 🔧 Configuration

`getRuntime()` / `baroStart()` share one runtime. Passing a `config` when that runtime
already exists applies it with `updateConfig` (replacing the whole config), so calling
`getRuntime()` before `baroStart({ config })` does not lose the config.

### Runtime Options

```typescript
interface BrowserRuntimeOptions {
  config?: Config;
  styleId?: string;
  insertionPoint?: 'head' | 'body' | HTMLElement;
  maxRulesPerPartition?: number;
}
```

## 🌐 API Reference

### BrowserRuntime

```typescript
class BrowserRuntime {
  constructor(options?: BrowserRuntimeOptions)
  
  // Watch DOM changes
  observe(root: HTMLElement, options?: { scan?: boolean }): MutationObserver
  
  // Stop watching
  disconnect(): void
  
  // Get runtime statistics
  getStats(): RuntimeStats
  
  // Clear caches
  clearCaches(): void
  
  // Destroy runtime
  destroy(): void
}
```

### ChangeDetector

```typescript
class ChangeDetector {
  constructor(parser: IncrementalParser, runtime: BrowserRuntime)
  
  // Process mutations
  processMutations(mutations: MutationRecord[]): void
}
```

### StylePartitionManager

```typescript
class StylePartitionManager {
  constructor(insertionPoint: HTMLElement, maxRulesPerPartition: number, styleId: string)
  
  // Add CSS to partition
  addCSS(css: string): void
  
  // Clear partitions
  clear(): void
}
```

## 🚀 Performance Features

- **JIT Generation** - Only generates CSS you actually use
- **Smart Caching** - Avoids regenerating existing styles
- **Style Partitioning** - Organizes CSS for optimal performance
- **Memory Management** - Efficient memory usage with cleanup

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development

```bash
# Clone repository
git clone https://github.com/easylogic/barocss.git
cd barocss

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build packages
pnpm build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🙏 Acknowledgments

- **Tailwind CSS** - For the amazing utility-first approach and JIT inspiration
- **UnoCSS** - For ideas around on-demand, utility-first generation at runtime

---

**@barocss/browser** - Real-time CSS generation for browsers.

## BaroCSS next to a shadcn build

A shadcn app built with Tailwind 4 can make the runtime use its theme without a duplicate JS config:

```js
import { baroStart, shadcnTheme } from '@barocss/browser';

baroStart({ config: { theme: { extend: shadcnTheme } } });
```

`shadcnTheme` maps the shadcn colours (`background`, `primary`, `muted-foreground`, `border`, `ring`, `chart-1..5`, `sidebar-*`, ...) and `rounded-sm/md/lg/xl` to the raw `:root` variables (`var(--primary)`, `calc(var(--radius) - 2px)`). It does not use `--color-*`, because `@theme inline` doesn't emit those to the page. Opacity modifiers such as `bg-primary/90` work. It expects full colour values in `:root`, as shadcn v4 ships them (e.g. `--primary: oklch(0.205 0 0)`). Older shadcn v3 themes that store bare HSL channels (`--primary: 222 47% 11%`) won't resolve through `var(--primary)`; map those tokens to `hsl(var(--primary))` in your own `theme.extend` instead.

Custom tokens (for example `--brand`) are not included. Add them yourself: `theme: { extend: { ...shadcnTheme, colors: { ...shadcnTheme.colors, brand: 'var(--brand)' } } }`.

## BaroCSS next to a Tailwind build (companion mode)

When the page already links a Tailwind 4 build and the runtime only fills in classes the build did not see, set `cssVarPrefix: 'tw'` so the runtime writes its composite variables with the build's names (`--tw-shadow`, `--tw-ring-shadow`, `--tw-translate-x`, `--tw-skew-x`, `--tw-blur`, `--tw-border-style`, ...):

```js
baroStart({ skipExisting: true, config: { cssVarPrefix: 'tw' } });
```

The rename applies to every `--baro-` name in the generated CSS, including `--baro-*` names you write in your own arbitrary or custom-property values.

A build class and a runtime class on one element then compose: build `ring-2` + runtime `shadow-md` gives both layers, build `translate-x-2` + runtime `translate-y-4` gives `8px 16px`, build `border-dashed` + runtime `border-2` stays dashed. Without it the runtime uses `--baro-*` names, and the two halves overwrite each other. Leave it unset when there is no Tailwind build. Gradient stops (`from-*`/`via-*`/`to-*` with `bg-linear-*`) do not yet follow Tailwind's variable protocol, so mixing them between build and runtime is not supported.
