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
constructor(config: Config = {})
```

**Parameters:**
- `config` (Config): BaroCSS configuration object

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

Generate CSS for a single class name.

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

Generate CSS for multiple class names.

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
  config: {
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
    },
    // Custom utilities are registered globally
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

### Complete Build Script

```typescript
import { ServerRuntime } from '@barocss/server';
import fs from 'fs';
import path from 'path';

async function buildCSS() {
  // Initialize server runtime
  const serverRuntime = new ServerRuntime({
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

  // Read all component files
  const componentFiles = fs.readdirSync('src/components');
  const allClasses = new Set<string>();

  // Extract classes from components
  for (const file of componentFiles) {
    const content = fs.readFileSync(`src/components/${file}`, 'utf8');
    const classes = extractClassesFromContent(content);
    classes.forEach(cls => allClasses.add(cls));
  }

  // Generate CSS
  const results = serverRuntime.generateCssForClasses(Array.from(allClasses));
  const css = results.map(r => r.css).join('\n');

  // Write to output
  fs.writeFileSync('dist/styles.css', css);
  console.log(`Generated CSS for ${results.length} classes`);

function extractClassesFromContent(content: string): string[] {
  // Simple regex to extract class names (implement your own logic)
  const classRegex = /class[=:]["']([^"']+)["']/g;
  const classes: string[] = [];
  let match;

  while ((match = classRegex.exec(content)) !== null) {
    const classList = match[1].split(/\s+/);
    classes.push(...classList);
  }

  return classes;

buildCSS().catch(console.error);
```

