# @barocss/browser

> **Rendering untrusted class strings (AI output, CMS, users)?** See the [security guide](../../apps/barocss-docs/docs/guide/security.md).

[![npm version](https://img.shields.io/npm/v/@barocss/browser.svg)](https://www.npmjs.com/package/@barocss/browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Browser Runtime** - Real-time CSS generation for browsers

@barocss/browser provides a browser-specific runtime that automatically detects DOM changes and generates CSS in real-time. It includes DOM change detection, style injection, and performance optimizations for browser environments.

> **Need styled first paint on server-rendered pages?** Use the [`@barocss/server` recipe](../barocss-server/README.md#recipe-ssr-with-a-tailwind-build-nextjs-app-router-astro) (Astro: [docs guide](../../apps/barocss-docs/docs/guide/integration/astro.md)). The recipe below is client-only.

## Recipe: BaroCSS next to a Tailwind/shadcn build (json-render)

Use this when the page already links a Tailwind 4 / shadcn build and a model sends json-render specs whose `className` values the build never saw. Copy it as is:

```js
import { getRuntime, shadcnTheme, preloadJsonRenderClasses } from '@barocss/browser';
// CDN/UMD build: const { getRuntime, shadcnTheme, preloadJsonRenderClasses } = window.BaroCSS;

const runtime = getRuntime({
  skipExisting: true,               // only generate classes the build does not already define
  config: {
    cssVarPrefix: 'tw',             // share --tw-* composite variables with the Tailwind build
    theme: { extend: shadcnTheme }, // use the shadcn :root tokens (primary, muted-foreground, ...)
    darkMode: 'class',              // dark: follows the page's dark class, not the OS setting
    darkModeSelector: '.dark &',    // mirrors shadcn v4's `@custom-variant dark (&:is(.dark *))`
    // preflight: leave unset. The layered preflight (@layer base) is the default and should stay on.
  },
});
runtime.observe(document.body, { scan: true }); // also covers classes added later

const spec = validateResponse(response);  // your catalog / class allowlist checks
preloadJsonRenderClasses(spec, runtime);  // BEFORE mounting, so there is no unstyled flash
renderJsonUi(spec);                       // mount your json-render Renderer
```

The six settings: `skipExisting: true`, `cssVarPrefix: 'tw'`, `theme: { extend: shadcnTheme }`, `darkMode: 'class'` with `darkModeSelector` copied from the build, `preloadJsonRenderClasses(spec, runtime)` before mount, and the default layered preflight (don't set `preflight: false`).

**Dark mode:** set `darkModeSelector` to the selector inside your CSS's `@custom-variant dark (...)`, so runtime `dark:` classes switch at the same moment as the build's:

| build CSS | companion config |
|---|---|
| `@custom-variant dark (&:is(.dark *));` (shadcn v4) | `darkMode: 'class', darkModeSelector: '.dark &'` |
| `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` (e.g. AstroPaper) | `darkMode: 'class', darkModeSelector: '[data-theme=dark] &'` |
| no `@custom-variant dark` (OS setting) | leave `darkMode` unset (`'media'`) |

Don't use `darkMode: 'class'` without a selector here: it matches `.dark` on the same element only, so `<html class="dark">` does not switch runtime classes.

**Non-shadcn site theme:** put the site's own tokens in `theme.extend` (e.g. `colors: { brand: { 600: '#2563eb' } }`). Literal values are safe. Pointing a token at the build's own var name (`brand: { 600: 'var(--color-brand-600)' }`) is also fine: BaroCSS skips that self-referencing `:root` var, so the build's value wins and `bg-brand-600` still uses it.

**Custom utilities:** mirror each static `@utility name { ... }` from your CSS in `utilities`, so runtime content that reuses it (with variants and `!`) matches the build: `utilities: { 'max-w-app': { 'max-width': '72rem', 'margin-inline': 'auto' } }`. A name that equals a built-in extends it as `@utility` does in Tailwind 4: the built-in declarations come first, then yours, so a repeated property takes your value. Names must be plain class idents; invalid names or unsafe declarations are skipped. Functional `@utility name-*` is not supported.

**Verify it rendered** (DevTools console, after mount):

```js
runtime.getCss('bg-primary');   // a CSS string once generated (undefined if the build already had it)
getComputedStyle(document.querySelector('[class~="bg-primary"]')).backgroundColor; // not 'rgba(0, 0, 0, 0)'
document.querySelectorAll('style[id^="barocss-runtime"]').length; // > 0
```

**Browser support:** Chrome/Edge 85+, Safari/iOS 16.4+, Firefox 128+. The runtime needs CSS `@property`; composite utilities (shadows, rings, transforms, filters) may not render on older engines.

## Recipe: Embedding AI widgets (Shadow DOM)

A widget in a shadow root is isolated from the host page's CSS, but a `<head>` stylesheet cannot reach it either. Pass the root:

```ts
import { BrowserRuntime } from '@barocss/browser';

const host = document.querySelector('ai-widget')!;
const root = host.attachShadow({ mode: 'open' }); // 'closed' works too: the embedder holds the reference
root.innerHTML = modelHtml;
const runtime = new BrowserRuntime({ root, config }); // or baroStart({ root, config })
// later: runtime.destroy() when the widget is removed
```

**Call `runtime.destroy()` when the widget unmounts** (for example in a custom element's `disconnectedCallback`). Otherwise a removed host keeps its rule references and its shared-sheet registry entry, so those rules are never reclaimed.

- The runtime observes `root` (with an initial scan) and puts all of its CSS inside it: utilities, theme variables (`:root,:host`), `@property`, `@keyframes` and preflight. Nothing goes to `document.head`, and the host page is not changed.
- **Preflight is scoped to the root.** `html`/`:root` selectors become `:host`. `body` rules are dropped and their declarations are re-emitted last on `:host`, without `min-height: 100vh` and `scroll-behavior`. So the widget gets the preflight font (it no longer inherits the host's `font-family`) and border reset, as in a Tailwind 4 build. Like Tailwind, preflight does not set `color`, so the host's text colour still inherits into the widget unless you set one (for example `text-gray-900` on the widget's wrapper).
- **Shared sheets.** Runtimes with the same config (and prefix) share one constructable stylesheet that every root adopts through `root.adoptedStyleSheets`. Each class is generated once, whichever root uses it first. Rules keep Tailwind's variant order (#254). GC (#269) counts per root and across roots: a rule is deleted only when no root still uses its class. `runtime.getStats().sharedSheet` reports roots, rules and generations of the shared sheet.
- **Fallback.** Without constructable stylesheets, each root gets two `<style data-barocss>` elements (prologue and rules) at its start, which mirror the same shared rule list.
- `insertionPoint`, `styleId` and `maxRulesPerPartition` do not apply in this mode, and a server-rendered `<style data-barocss-ssr>` sheet (#268) is adopted only in document mode.
- `root` must be a `ShadowRoot` (or `document`, which is the normal document mode). For a widget in a plain `<div>`, use the document mode (`getRuntime().observe(container)`): the host's CSS and the widget's CSS then cascade together, so use a shadow root when you need isolation.

## Server-rendered pages (SSR)

> BaroCSS is JS-only: there is no CSS entry, so never `@import "@barocss/kit"` in CSS. `generateCssForHtml`/`ssrStyleTag` are available from `@barocss/server` 0.7.0.
>
> Use the same config as the server: `darkModeSelector` from the build's `@custom-variant dark`, `utilities` mirroring static `@utility` rules (functional `@utility name-*` unsupported), both `prefix: 'tw'` and `cssVarPrefix: 'tw'` for a `prefix(tw)` build, and literal values in `theme.extend` for your own theme (next to `shadcnTheme`).

The runtime adopts a `<style data-barocss-ssr>` sheet from `@barocss/server` (`ssrStyleTag(runtime.generateCssForHtml(html, { skip: buildCss }))`), but only one that is in `<head>` when the runtime starts (at construction or the first `observe()`). A marked sheet added later or placed in `<body>` is treated as an ordinary sheet. It never regenerates those classes and GC never reclaims them. Their rules move into the runtime's ordered partitions, so later client rules keep Tailwind's variant order. For the Next.js App Router and Astro recipe, see the [`@barocss/server` README](../barocss-server/README.md#recipe-ssr-with-a-tailwind-build-nextjs-app-router-astro).

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

// Standalone page with no Tailwind build: defaults are fine. Next to a build, use the recipe above.
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
import { BrowserRuntime, preloadJsonRenderClasses, shadcnTheme } from '@barocss/browser';

// Same options as the recipe above; drop them only when there is no Tailwind/shadcn build on the page.
const runtime = new BrowserRuntime({
  skipExisting: true,
  config: { cssVarPrefix: 'tw', theme: { extend: shadcnTheme } },
});
const spec = validateResponse(response); // Your catalog and class allowlist checks
preloadJsonRenderClasses(spec, runtime);
renderJsonUi(spec); // Mount your json-render Renderer here
```

The helper reads literal `props.className` strings in the flat `spec.elements` map. It splits class lists, removes duplicates, and calls `runtime.addClass` synchronously. It does not return a CSS readiness result. The application must validate the spec, response size, class allowlist, class support, and runtime state before this call. The helper reads every entry, including nodes that the renderer may not mount. State-derived classes and classes added inside registered components need a separate source of classes.

### CDN Usage

> **CDN global is browser-only.** The CDN UMD script's `window.BaroCSS` exposes only `@barocss/browser`: `BrowserRuntime`, `getRuntime`, `baroBoot`/`baroStart`, `ChangeDetector`, `StylePartitionManager`, `shadcnTheme`, `preloadJsonRenderClasses`, `collectJsonRenderClassNames`, `normalizeClassName(List)`, `SSR_STYLE_SELECTOR`, `LAYER_ORDER`. There is no `generateCss`/`generateCssForHtml`/`ServerRuntime` in it: server-side generation needs `@barocss/server` in Node.

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
    
    const runtime = new BrowserRuntime(); // no Tailwind build here; next to one, use the recipe's options
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

const runtime = new BrowserRuntime(); // no Tailwind build here; next to one, use the recipe's options

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

const runtime = new BrowserRuntime(); // no Tailwind build here; next to one, use the recipe's options

// Watch entire document
runtime.observe(document.body, { scan: true });

// Watch specific container
const container = document.querySelector('#app');
runtime.observe(container, { scan: true });
```

### Advanced Configuration

```typescript
import { BrowserRuntime } from '@barocss/browser';

// Custom theme, no Tailwind build; next to one, add the recipe's options too
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

const runtime = new BrowserRuntime(); // no Tailwind build here; next to one, use the recipe's options

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

baroStart({ config: { theme: { extend: shadcnTheme } } }); // theme only; with a Tailwind build + json-render use the full recipe at the top
```

`shadcnTheme` maps the shadcn colours (`background`, `primary`, `muted-foreground`, `border`, `ring`, `chart-1..5`, `sidebar-*`, ...) and `rounded-sm/md/lg/xl` to the raw `:root` variables (`var(--primary)`, `calc(var(--radius) - 2px)`). It does not use `--color-*`, because `@theme inline` doesn't emit those to the page. Opacity modifiers such as `bg-primary/90` work. It expects full colour values in `:root`, as shadcn v4 ships them (e.g. `--primary: oklch(0.205 0 0)`). Older shadcn v3 themes that store bare HSL channels (`--primary: 222 47% 11%`) won't resolve through `var(--primary)`; map those tokens to `hsl(var(--primary))` in your own `theme.extend` instead.

Custom tokens (for example `--brand`) are not included. Add them yourself: `theme: { extend: { ...shadcnTheme, colors: { ...shadcnTheme.colors, brand: 'var(--brand)' } } }`.

## BaroCSS next to a Tailwind build (companion mode)

When the page already links a Tailwind 4 build and the runtime only fills in classes the build did not see, set `cssVarPrefix: 'tw'` so the runtime writes its composite variables with the build's names (`--tw-shadow`, `--tw-ring-shadow`, `--tw-translate-x`, `--tw-skew-x`, `--tw-blur`, `--tw-border-style`, ...):

```js
baroStart({ skipExisting: true, config: { cssVarPrefix: 'tw' } }); // add theme: { extend: shadcnTheme } for shadcn (recipe at the top)
```

The rename applies to every `--baro-` name in the generated CSS, including `--baro-*` names you write in your own arbitrary or custom-property values.

A build class and a runtime class on one element then compose: build `ring-2` + runtime `shadow-md` gives both layers, build `translate-x-2` + runtime `translate-y-4` gives `8px 16px`, build `border-dashed` + runtime `border-2` stays dashed. Without it the runtime uses `--baro-*` names, and the two halves overwrite each other. Leave it unset when there is no Tailwind build. Gradient stops (`from-*`/`via-*`/`to-*` with `bg-linear-*`) do not yet follow Tailwind's variable protocol, so mixing them between build and runtime is not supported.
