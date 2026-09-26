---
title: Server Runtime API
description: Server-side CSS generation and processing in BaroCSS
---

# Server Runtime API

The Server Runtime API provides server-side functionality for generating CSS without browser-specific features like DOM manipulation or MutationObserver. It's ideal for static site generation, server-side rendering, and build-time CSS processing.

## ServerRuntime Class

The main class for server-side BaroCSS functionality.

```typescript
import { ServerRuntime } from '@barocss/server';

const serverRuntime = new ServerRuntime({
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6'
      }
    }
  }
});
```

### Constructor

```typescript
constructor(config: Config = {}, options: { cacheSize?: number } = {})
```

**Parameters:**
- `config` (Config): BaroCSS configuration object
- `options.cacheSize` (number, default `10000`): how many classes the runtime keeps in its per-class generation cache (least recently used classes are evicted first). `0` turns the cache off. It is fixed at construction.

Each runtime caches the rules it generated for each class, and the parsed theme variables, so repeated `generateCss` calls (for example one per SSR request) only assemble the sheet. The output is identical to uncached generation. The cache belongs to the runtime, so runtimes with different configs never share results.

Pass `theme`, `darkMode`, and other configuration fields directly to the constructor. There is no outer `config` field.

**Example:**
```typescript
const serverRuntime = new ServerRuntime({
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
});
```

## Core Methods

### parseClass()

Parse a class name and return its AST representation.

```typescript
const ast = serverRuntime.parseClass('bg-blue-500');
```

**Parameters:**
- `className` (string): The CSS class name to parse

**Returns:**
- `AstNode[]`: Array of AST nodes

**Example:**
```typescript
const ast = serverRuntime.parseClass('sm:dark:hover:bg-red-500');
// Returns AST with media query, dark mode, and hover variants
```

### generateCss()

Generate CSS for a class name, or several whitespace-separated class names, as one complete sheet:
- one `:root,:host` block that defines every theme variable the rules reference (colours, radius, text, spacing, shadow, font and so on)
- each root block and `@property` block exactly once
- rules in Tailwind variant order (base < `sm:` < `md:` < `lg:`), whatever the input order

To get one complete sheet for a list of classes, use `generateCss(classes.join(' '))`.

```typescript
const css = serverRuntime.generateCss('bg-blue-500');
```

**Parameters:**
- `className` (string): The CSS class name

**Returns:**
- `string`: Generated CSS

**Example:**
```typescript
const css = serverRuntime.generateCss('bg-blue-500 text-white p-4');
// Returns: .bg-blue-500 { background-color: #3b82f6; }
```

### generateCssForClasses()

Generate CSS for multiple class names. Entries come back in input order.

Each entry's `css` is self-contained: it has its own `:root,:host` variables, its own `@property` blocks and its own variant-sorted rules. As a result, joining the entries repeats the shared blocks and does not order the rules across entries. Use `generateCss(classes.join(' '))` when you need a single sheet.

```typescript
const results = serverRuntime.generateCssForClasses([
  'bg-blue-500',
  'text-white',
  'p-4'
]);
```

**Parameters:**
- `classes` (string[]): Array of CSS class names

**Returns:**
- `Array<{ className: string; css: string }>`: Array of results

**Example:**
```typescript
const results = serverRuntime.generateCssForClasses([
  'bg-blue-500',
  'text-white',
  'p-4',
  'hover:bg-blue-600'
]);

// Returns:
// [
//   { className: 'bg-blue-500', css: '.bg-blue-500 { background-color: #3b82f6; }' },
//   { className: 'text-white', css: '.text-white { color: #ffffff; }' },
//   { className: 'p-4', css: '.p-4 { padding: 1rem; }' },
//   { className: 'hover:bg-blue-600', css: '.hover\\:bg-blue-600:hover { background-color: #2563eb; }' }
// ]
```

### setConfig()

Replaces the runtime's configuration (theme included). It rebuilds the context and clears the generation caches, so later calls use only the new config.

```typescript
setConfig(config: Config): void
```

**Example:**
```typescript
serverRuntime.setConfig({ theme: { extend: { colors: { brand: '#e11d48' } } } });
serverRuntime.generateCss('bg-brand'); // uses the new brand colour
```

## Direct Function Usage

You can also use the core functions directly for more control.

### parseClassToAst()

```typescript
import { parseClassToAst, createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6'
      }
    }
  }
});

const ast = parseClassToAst('bg-brand', ctx);
```

### generateCss()

```typescript
import { generateCss, createContext } from '@barocss/kit';

const ctx = createContext();
const css = generateCss('bg-blue-500 text-white p-4', ctx, {
  minify: true,
  dedup: true
});
```

### generateCssRules()

```typescript
import { generateCssRules, createContext } from '@barocss/kit';

const ctx = createContext();
const rules = generateCssRules('bg-blue-500 text-white', ctx);

rules.forEach(rule => {
  console.log(`Class: ${rule.cls}`);
  console.log(`CSS: ${rule.css}`);
  console.log(`Root CSS: ${rule.rootCss}`);
});
```

## Use Cases

### Static Site Generation

```typescript
import { ServerRuntime } from '@barocss/server';
import fs from 'fs';

// Initialize server runtime
const serverRuntime = new ServerRuntime({
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6'
      }
    }
  }
});

// Collect all classes from your HTML/templates
const classes = [
  'bg-brand',
  'text-white',
  'p-4',
  'hover:bg-blue-600',
  'sm:text-lg',
  'dark:bg-gray-900'
];

// Generate CSS for all classes
const results = serverRuntime.generateCssForClasses(classes);
const css = results.map(r => r.css).join('\n');

// Write to file
fs.writeFileSync('dist/styles.css', css);
```

### Server-Side Rendering (SSR)

```typescript
import { ServerRuntime } from '@barocss/server';

// Initialize once per request or globally
const serverRuntime = new ServerRuntime({
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6'
      }
    }
  }
});

// In your SSR function
function renderPage(componentClasses: string[]) {
  // Generate CSS for component classes
  const results = serverRuntime.generateCssForClasses(componentClasses);
  const css = results.map(r => r.css).join('\n');
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>${css}</style>
      </head>
      <body>
        ${renderComponent()}
      </body>
    </html>
  `;
```

### Build-Time CSS Generation

```typescript
import { ServerRuntime } from '@barocss/server';
import { glob } from 'glob';

// Initialize server runtime
const serverRuntime = new ServerRuntime({
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6'
      }
    }
  }
});

// Scan files for classes
async function generateCSS() {
  const files = await glob('src/**/*.{js,jsx,ts,tsx,vue}');
  const allClasses = new Set<string>();
  
  // Extract classes from files (simplified)
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const classes = extractClasses(content); // Your extraction logic
    classes.forEach(cls => allClasses.add(cls));
  }
  
  // Generate CSS
  const results = serverRuntime.generateCssForClasses(Array.from(allClasses));
  const css = results.map(r => r.css).join('\n');
  
  // Write to file
  fs.writeFileSync('dist/generated.css', css);
```

### API Endpoint

```typescript
import { ServerRuntime } from '@barocss/server';
import express from 'express';

const app = express();
const serverRuntime = new ServerRuntime({
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6'
      }
    }
  }
});

// API endpoint to generate CSS
app.post('/api/generate-css', (req, res) => {
  const { classes } = req.body;
  
  try {
    const results = serverRuntime.generateCssForClasses(classes);
    res.json({
      success: true,
      css: results.map(r => r.css).join('\n'),
      classes: results.map(r => r.className)
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

## Advanced Usage

### Custom Configuration

```typescript
const serverRuntime = new ServerRuntime({
  darkMode: 'class',
  prefix: 'tw-',
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
});
```

### Batch Processing

```typescript
// Process large sets of classes efficiently
const classes = [
  'bg-blue-500',
  'text-white',
  'p-4',
  'hover:bg-blue-600',
  'focus:ring-2',
  'sm:text-lg',
  'md:text-xl',
  'lg:text-2xl',
  'dark:bg-gray-900',
  'dark:text-white'
];

// Generate CSS for all classes
const results = serverRuntime.generateCssForClasses(classes);

// Process results
results.forEach(result => {
  console.log(`Generated CSS for ${result.className}:`);
  console.log(result.css);
});
```

### Error Handling

```typescript
try {
  const css = serverRuntime.generateCss('invalid-class');
  if (!css) {
    console.warn('No CSS generated for class');
  }
} catch (error) {
  console.error('CSS generation failed:', error);
```

## Caching

The server runtime includes built-in caching:

```typescript
// Classes are cached automatically
const css1 = serverRuntime.generateCss('bg-blue-500'); // Parsed and cached
const css2 = serverRuntime.generateCss('bg-blue-500'); // Retrieved from cache
```

### Cache Management

For long-running processes, consider clearing caches periodically:

```typescript
import { clearAllCaches } from '@barocss/kit';

// Clear caches periodically
setInterval(() => {
  clearAllCaches();
}, 60000); // Every minute
```

## Examples

### Static HTML build script

Install the published `0.5.0` package with `pnpm add @barocss/server@0.5.0`. Save this as `build-css.mjs` and run it from the project root with `node build-css.mjs`.

```js
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ServerRuntime } from '@barocss/server'

const sourceDir = 'src/components'
const classes = new Set()

for (const file of readdirSync(sourceDir)) {
  if (!file.endsWith('.html')) continue
  const content = readFileSync(join(sourceDir, file), 'utf8')
  for (const [, classList] of content.matchAll(/\bclass="([^"]+)"/g)) {
    for (const cls of classList.split(/\s+/).filter(Boolean)) classes.add(cls)
  }
}

const runtime = new ServerRuntime()
const css = runtime.generateCssForClasses([...classes])
  .map(({ css }) => css)
  .filter(Boolean)
  .join('\n')

mkdirSync('dist', { recursive: true })
writeFileSync('dist/styles.css', css)
```

This minimal scanner reads static, double-quoted `class` attributes in `.html` files directly under `src/components`. It does not find dynamic classes, nested files, or classes in JSX and templates. Check the generated CSS and provide your own extractor for those cases.
