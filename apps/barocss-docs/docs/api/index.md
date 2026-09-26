---
title: API Reference
description: Index of the BaroCSS browser, server and core APIs
---

# API Reference

One line per page. New here? Start with the [Quick Start](/guide/quick-start); check the [compatibility scope](/guide/compatibility) before reusing Tailwind classes from an existing project.

## Browser (`@barocss/browser`)

| page | what it covers |
|---|---|
| [Browser Runtime](/api/browser-runtime) | `BrowserRuntime`, `getRuntime`, `baroBoot`/`baroStart`: generate CSS for classes in the DOM and watch changes (`observe`, `addClass`, `getCss`, `updateConfig`, `destroy`). Which one to use: [BrowserRuntime or getRuntime](/guide/integration/vite-tailwind#runtime-choice) |

## Server (`@barocss/server`, Node)

| page | what it covers |
|---|---|
| [Server Runtime](/api/server-runtime) | `ServerRuntime`: `generateCssForHtml(html, { skip })` returns the CSS for one HTML response's classes; `generateCss('a b c')` returns one complete sheet for class names; `ssrStyleTag(css, { nonce })` wraps it in `<style data-barocss-ssr>` for `<head>` so the browser runtime adopts it |

## Configuration and core (`@barocss/kit`)

| page | what it covers |
|---|---|
| [Configuration](/api/configuration) | the `config` object: theme, `darkMode`, `prefix`, `cssVarPrefix`, `utilities`, preflight |
| [Context API](/api/context) | `createContext(config)`: resolved theme and config lookups shared by parser and engine |
| [Parser API](/api/parser) | `parseClassToAst`: split a class name into variants and utility |
| [Engine API](/api/engine) | `generateCss` / `generateCssRules`: turn classes into CSS text |
| [AST Processing API](/api/ast-processing) | low-level AST transforms behind the engine |

## Extending

| page | what it covers |
|---|---|
| [Static Utility API](/api/static-utility) | `staticUtility`: a fixed class to declarations (`flex`, `hidden`) |
| [Functional Utility API](/api/functional-utility) | `functionalUtility`: value-taking utilities (`p-4`, `bg-red-500`, arbitrary values) |
| [Static Modifier API](/api/static-modifier) | `staticModifier`: fixed variants (`hover:`, `focus:`) |
| [Functional Modifier API](/api/functional-modifier) | `functionalModifier`: parameterized variants (`group-*`, `data-*`, breakpoints) |

Guides: [Vite + Tailwind 4](/guide/integration/vite-tailwind), [Next to a Tailwind build](/guide/integration/tailwind-companion), [Astro (SSR and static)](/guide/integration/astro), [Security](/guide/security).

## 📖 Quick Reference

### By Use Case

::: details Browser Development
- [Browser Runtime](/api/browser-runtime) - DOM integration
- [Context API](/api/context) - Configuration
- [Static Utility API](/api/static-utility) - Custom utilities
:::

::: details Server-Side Rendering
- [Server Runtime](/api/server-runtime) - CSS generation
- [Engine API](/api/engine) - Core processing
- [Configuration](/api/configuration) - Theme setup
:::

::: details Custom Development
- [Static Utility API](/api/static-utility) - Fixed utilities
- [Functional Utility API](/api/functional-utility) - Dynamic utilities
- [Static Modifier API](/api/static-modifier) - Fixed modifiers
- [Functional Modifier API](/api/functional-modifier) - Dynamic modifiers
:::

::: details Advanced Usage
- [Parser API](/api/parser) - Class parsing details
- [AST Processing API](/api/ast-processing) - AST manipulation
- [Engine API](/api/engine) - Core functions
:::

## 🎯 Main Entry Points

### Browser Usage

```typescript
// CDN
import { BrowserRuntime } from 'https://unpkg.com/@barocss/browser@0.10.1/dist/cdn/barocss.js';

// NPM
import { BrowserRuntime } from '@barocss/browser';
```

### Server Usage

```typescript
import { ServerRuntime } from '@barocss/server';
import { createContext, generateCss } from '@barocss/kit';
```

### Core Usage

```typescript
import { 
  createContext, 
  parseClassToAst, 
  generateCss,
  IncrementalParser 
} from '@barocss/kit';
```

## 🔧 Key Concepts

### Context
The central configuration and theme management system that provides access to theme values and configuration options.

### Engine
The core CSS generation system that parses class names, builds ASTs, and converts them to CSS rules.

### Runtime
Environment-specific implementations that handle CSS injection (browser) or generation (server).

### Custom Utilities
Context registries for adding custom utilities and variants.

## 📖 API Categories

### Core Functions
- `createContext(config)` - Create a BaroCSS context
- `parseClassToAst(className, ctx)` - Parse class to AST
- `generateCss(classList, ctx)` - Generate CSS from classes
- `IncrementalParser` - Efficient class processing

### Runtime Classes
- `BrowserRuntime` - Browser DOM integration
- `ServerRuntime` - Server-side processing
- `ChangeDetector` - DOM change monitoring

### Custom Utilities
- `staticUtility()` - Register static utilities with fixed CSS
- `functionalUtility()` - Register dynamic utilities with value processing

### Custom Modifiers
- `staticModifier()` - Register static modifiers with fixed selectors
- `functionalModifier()` - Register dynamic modifiers with pattern matching

### Configuration
- `Config` interface - Configuration options
- `Theme` interface - Theme structure
- Theme extension and customization

## 🎨 Usage Patterns

### Basic Styling
```typescript
const runtime = new BrowserRuntime();
runtime.addClass('bg-blue-500 text-white p-4');
```

### Custom Theme
```typescript
const ctx = createContext({
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a'
        }
      }
    }
  }
});
```

### Custom Utilities
```typescript
import { staticUtility, functionalUtility } from '@barocss/kit';
import { decl } from '@barocss/kit';

// Register static utility
staticUtility('custom-bg', [
  decl('background-color', 'var(--custom-color)'),
  decl('border-radius', '8px')
]);

// Register functional utility
functionalUtility({
  name: 'custom-text',
  prop: 'color',
  handle: (value) => [decl('color', value)]
});
```


---

Ready to dive deeper? Start with the [Context API](/api/context) to understand how BaroCSS manages themes and configuration.
