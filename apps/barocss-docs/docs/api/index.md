---
title: API Reference
description: Complete API reference for BaroCSS
---

# BaroCSS API Reference

BaroCSS provides a comprehensive API for real-time CSS generation and utility-first styling. This section covers all the core APIs, runtime systems, and configuration options.

## 🚀 Quick Start

```typescript
import { BrowserRuntime } from '@barocss/browser';
import { createContext } from '@barocss/kit';

// Initialize runtime
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

// Start watching DOM changes
runtime.observe(document.body, { scan: true });
```

## 📚 API Learning Path

::: tip Recommended Reading Order
Follow this path to understand BaroCSS APIs from basic to advanced concepts.
:::

### 🎯 Step 1: Getting Started
**Essential APIs for basic usage**

- **[Context API](/api/context)** - Theme and configuration management
- **[Configuration](/api/configuration)** - Theme and behavior customization
- **[Browser Runtime](/api/browser-runtime)** - Browser-specific DOM integration
- **[Server Runtime](/api/server-runtime)** - Server-side CSS generation

### 🔧 Step 2: Core Engine
**Understanding how CSS is generated**

- **[Parser API](/api/parser)** - Class name parsing and tokenization
- **[Engine API](/api/engine)** - CSS generation and AST processing

### 🛠️ Step 3: Customization
**Creating custom utilities and modifiers**

- **[Static Utility API](/api/static-utility)** - Creating fixed utilities
- **[Functional Utility API](/api/functional-utility)** - Creating dynamic utilities
- **[Static Modifier API](/api/static-modifier)** - Creating fixed modifiers
- **[Functional Modifier API](/api/functional-modifier)** - Creating dynamic modifiers
- **[Custom Utilities](/guide/styling-with-utility-classes)** - Custom utilities and variants

### 🔬 Step 4: Advanced Concepts
**Deep dive into internal mechanisms**

- **[AST Processing API](/api/ast-processing)** - Advanced AST manipulation functions

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
import { BrowserRuntime } from 'https://unpkg.com/@barocss/browser/dist/cdn/barocss.js';

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
Global registry system for adding custom utilities, variants, and theme extensions.

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
