# @barocss/server

[![npm version](https://img.shields.io/npm/v/@barocss/server.svg)](https://www.npmjs.com/package/@barocss/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Server Runtime** - Server-side CSS generation and processing

@barocss/server provides server-side utilities for parsing Tailwind classes and generating CSS without browser-specific features. Perfect for SSR, static site generation, and server-side CSS processing.

## Recipe: SSR with a Tailwind build (Next.js App Router, Astro)

> `generateCssForHtml` and `ssrStyleTag` are **available from 0.7.0**.
>
> BaroCSS is JS-only: there is no CSS entry, so never `@import "@barocss/kit"` in CSS.

Use this when pages link a build stylesheet (a Tailwind or BaroCSS build) but render classes the build never saw, such as CMS blocks or model output. At request time, generate only the missing CSS and inline it, so the first paint is already styled:

```ts
import fs from 'node:fs';
import { ServerRuntime, ssrStyleTag } from '@barocss/server';

// Once per server process: the runtime caches per-class results; read the shipped build CSS once.
const runtime = new ServerRuntime({ cssVarPrefix: 'tw', theme: { extend: siteTheme } });
const BUILD_CSS = fs.readFileSync('dist/app.css', 'utf8');

// Per request: this response's delta only (never cumulative across requests).
const css = runtime.generateCssForHtml(html, { skip: BUILD_CSS });
const tag = ssrStyleTag(css); // '<style data-barocss-ssr>…</style>': put it in <head>, after the build <link>
```

- `generateCssForHtml(htmlOrClasses, { skip })` takes HTML or a class list. From HTML it reads the `class` attributes (any quoting, entities decoded) and ignores comments and `<script>`/`<style>` contents.
- `skip` is either the build CSS text or a set of class names. With CSS text it:
  - skips the classes that lead its selectors (`.p-4`, `.md\:p-4` inside `@media`, `:where(.divide-y > …)`)
  - doesn't re-emit the theme vars its `:root`/`:host` blocks declare
  - doesn't re-emit its `@property` or `@keyframes` names

  The output never contains `@layer` statements.
- The result is one ordered sheet (#267): each referenced theme var once, each `@property` block once, rules in Tailwind variant order.
- Also exported: `ssrStyleTag(css, { nonce })`, `SSR_STYLE_ATTRIBUTE`.
- **Inlining CSS into HTML: use the helper.** Wrap server output with `ssrStyleTag(css)` (or, where a framework takes a string, apply the same end-tag escaping as the Next.js example below). Never interpolate raw CSS into `<style>${css}</style>`.

**Next.js App Router** (a server component; `html` is the CMS or model markup you render):

```tsx
export default async function Page() {
  const html = await getBlocksHtml();
  const css = runtime.generateCssForHtml(html, { skip: BUILD_CSS });
  return (
    <>
      <style data-barocss-ssr="" dangerouslySetInnerHTML={{ __html: css.replace(/<\/style/gi, '<\\/style') }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
```

The `.replace(/<\/style/gi, '<\\/style')` is what `ssrStyleTag` does for you: raw CSS inlined into HTML must never contain a markup end-tag sequence, or it could close the `<style>` element early. Don't give this `<style>` a `precedence` or `href`, so React leaves it where it is. It only has to come before the content it styles. When you render components rather than an HTML string, pass the class list instead: `runtime.generateCssForHtml(['p-4 sm:p-6', …], { skip: BUILD_CSS })`.

**Astro, SSR** (`src/middleware.ts`; read the emitted build CSS once at startup):

```ts
import { defineMiddleware } from 'astro:middleware';
import { ServerRuntime, ssrStyleTag } from '@barocss/server';
const runtime = new ServerRuntime({
  cssVarPrefix: 'tw',                      // always, next to a Tailwind build
  // from the build's `@custom-variant dark (...)`: shadcn -> '.dark &',
  // `[data-theme=dark]` variant -> '[data-theme=dark] &', none -> omit (default 'media')
  darkMode: 'class',
  darkModeSelector: '.dark &',
});
const dir = path.resolve('dist/client/_astro');
const BUILD_CSS = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') : '';

export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  if (!res.headers.get('content-type')?.includes('text/html')) return res;
  const html = await res.text();
  const css = runtime.generateCssForHtml(html, { skip: BUILD_CSS });
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(css ? html.replace('</head>', `${ssrStyleTag(css)}</head>`) : html, { status: res.status, headers });
});
```

**Astro, static output:** do the same once in an integration's `astro:build:done` hook: read every `.css` under `dir` as the skip CSS, then rewrite every `.html`, with the same `cssVarPrefix: 'tw'` and `darkModeSelector` on the `ServerRuntime`. The full recipe (shared config, static hook, client companion) is in the docs: `guide/integration/astro`.

**Config to copy from the build CSS** (use the same object on server and client):

```ts
const config = {
  cssVarPrefix: 'tw',                       // prefix(tw) build: also set prefix: 'tw' (BOTH are needed)
  darkMode: 'class',
  darkModeSelector: '[data-theme=dark] &',  // the selector inside `@custom-variant dark (...)`; shadcn v4: '.dark &'
  theme: { extend: {                        // your own theme: literal values, not var(--build-vars)
    colors: { brand: '#2563eb' },
    spacing: { gutter: '1.5rem' },          // named spacing: p-gutter
    borderRadius: { lg: '0.75rem', card: '1.25rem' }, // override rounded-lg; new keys work too: rounded-card
    fontFamily: { sans: ['Inter', 'sans-serif'], display: ['Fraunces', 'serif'] }, // font-display
  } },
  utilities: { 'max-w-app': { 'max-width': '48rem', 'margin-inline': 'auto' } }, // static @utility rules; `@utility name-*` unsupported
};
```

**Client companion** (only needed when the page adds classes after load). Load `@barocss/browser` as usual; it adopts the `<style data-barocss-ssr>` sheet:

```js
import { getRuntime } from '@barocss/browser';
const rt = getRuntime({ skipExisting: true, config: { cssVarPrefix: 'tw', theme: { extend: siteTheme } } });
rt.observe(document.body, { scan: true });
```

Only a marked sheet that is in `<head>` when the runtime starts (at construction or the first `observe()`) is adopted. Put the tag in `<head>`, which streaming SSR sends first. A `<style data-barocss-ssr>` injected later, or placed in `<body>` (for example inside model or user HTML), is treated as an ordinary sheet. The client never regenerates the server's classes, and GC never reclaims them. Later client rules keep Tailwind's combined order with the server's rules: a client `sm:` rule never lands after a server `lg:` rule.

Measured with `scripts/ssr-probe` (#266/#268):
- first paint matched a full Tailwind build (1.0)
- still 1.0 after a later client addition
- 0 duplicate rules and 0 re-emitted build definitions
- about 0.2 ms per request on a warm runtime

## ✨ Key Features

- **🚀 Server-Side CSS Generation** - Generate CSS on the server without browser APIs
- **⚡ Batch Processing** - Process multiple classes efficiently
- **📱 SSR Support** - Perfect for server-side rendering scenarios
- **🎯 Static Generation** - Generate CSS for static sites and build processes
- **🌐 Node.js Optimized** - Designed specifically for Node.js environments

## 🚀 Quick Start

### NPM Installation

```bash
# npm
npm install @barocss/server

# pnpm
pnpm add @barocss/server

# yarn
yarn add @barocss/server
```

### Basic Usage

```typescript
import { ServerRuntime } from '@barocss/server';

// Initialize server runtime
const runtime = new ServerRuntime();

// Generate CSS for a single class
const css = runtime.generateCss('bg-blue-500 text-white p-4');
console.log(css);
// Output: .bg-blue-500 { background-color: #3b82f6; }
//         .text-white { color: #ffffff; }
//         .p-4 { padding: 1rem; }
```

### Batch Processing

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Process multiple classes at once
const classes = [
  'bg-blue-500',
  'text-white',
  'p-4',
  'rounded-lg',
  'shadow-md'
];

const results = runtime.generateCssForClasses(classes);
results.forEach(({ className, css }) => {
  console.log(`${className}: ${css}`);
});
```

## 🎯 How It Works

The server runtime provides server-side CSS generation:

1. **Class Parsing** - Parses Tailwind classes using @barocss/kit
2. **CSS Generation** - Generates CSS rules without browser dependencies
3. **Batch Processing** - Efficiently processes multiple classes
4. **Static Output** - Returns CSS strings ready for server use

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Parse and generate CSS
const css = runtime.generateCss('bg-red-500 hover:bg-red-600 text-white p-4');

// Result:
// .bg-red-500 { background-color: #ef4444; }
// .hover\:bg-red-600:hover { background-color: #dc2626; }
// .text-white { color: #ffffff; }
// .p-4 { padding: 1rem; }
```

## 🛠️ Usage Examples

### Basic Server Usage

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime({
  theme: {
    extend: {
      colors: {
        'brand': {
          500: '#0ea5e9',
          600: '#0284c7'
        }
      }
    }
  }
});

// Generate CSS for specific classes
const css = runtime.generateCss('bg-brand-500 text-white p-4');
console.log(css);
```

### Processing Multiple Classes

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Process a list of classes
const classes = [
  'bg-blue-500',
  'text-white',
  'p-4',
  'rounded-lg',
  'shadow-md'
];

const results = runtime.generateCssForClasses(classes);
results.forEach(({ className, css }) => {
  console.log(`${className}: ${css}`);
});
```

## 🔧 Configuration

### Server Runtime Options

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime({
  theme: {
    extend: {
      colors: {
        'brand': {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e',
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      }
    }
  },
  darkMode: 'class',
  cssVarPrefix: '--baro-'
});
```

### Custom Theme Functions

```typescript
const runtime = new ServerRuntime({
  theme: {
    spacing: (theme) => ({
      ...theme('spacing'),
      '18': '4.5rem',
      '88': '22rem',
    }),
    colors: (theme) => ({
      ...theme('colors'),
      'brand': {
        500: '#0ea5e9',
        600: '#0284c7'
      }
    })
  }
});
```

## 🌐 API Reference

### ServerRuntime

```typescript
class ServerRuntime {
  constructor(config?: Config)
  
  // Parse a class name and return its AST
  parseClass(className: string): AstNode[]
  
  // Generate CSS for a single class
  generateCss(className: string): string
  
  // Generate CSS for multiple classes
  generateCssForClasses(classes: string[]): Array<{
    className: string;
    css: string;
  }>
}
```

### Usage Examples

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Parse class to AST
const ast = runtime.parseClass('bg-blue-500 hover:bg-blue-600');
console.log(ast);

// Generate CSS for single class
const css = runtime.generateCss('bg-blue-500 text-white p-4');
console.log(css);

// Generate CSS for multiple classes
const results = runtime.generateCssForClasses([
  'bg-blue-500',
  'text-white',
  'p-4'
]);
console.log(results);
```

## 🚀 Performance Features

- **Batch Processing** - Efficiently processes multiple classes
- **Memory Optimization** - Optimized for server environments
- **Static Generation** - Perfect for build-time CSS generation
- **No Browser Dependencies** - Runs entirely in Node.js

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

**@barocss/server** - Server-side CSS generation and processing.
