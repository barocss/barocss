---
title: API Reference
description: Complete API reference for BaroCSS
---

# BaroCSS API Reference

BaroCSS provides a comprehensive API for real-time CSS generation and utility-first styling. This section covers all the core APIs, runtime systems, and configuration options.

## 🚀 Quick Start

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';
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

## 📚 API Overview

### Core APIs

- **[Context API](/api/context)** - Theme and configuration management
- **[Engine API](/api/engine)** - CSS generation and AST processing
- **[Parser API](/api/engine)** - Class name parsing and tokenization

### Runtime APIs

- **[Browser Runtime](/api/browser-runtime)** - Browser-specific DOM integration
- **[Server Runtime](/api/server-runtime)** - Server-side CSS generation

### Extension APIs

- **[Plugin System](/api/plugins)** - Custom utilities and variants
- **[Configuration](/api/configuration)** - Theme and behavior customization

## 🎯 Main Entry Points

### Browser Usage

```typescript
// CDN
import { BrowserRuntime } from 'https://unpkg.com/@barocss/kit/dist/cdn/barocss.js';

// NPM
import { BrowserRuntime } from '@barocss/kit/runtime/browser';
```

### Server Usage

```typescript
import { ServerRuntime } from '@barocss/kit/runtime/server';
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
The central configuration and theme management system that provides access to theme values, configuration options, and plugin functionality.

### Engine
The core CSS generation system that parses class names, builds ASTs, and converts them to CSS rules.

### Runtime
Environment-specific implementations that handle CSS injection (browser) or generation (server).

### Plugins
Extensible system for adding custom utilities, variants, and theme extensions.

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

### Plugin System
- `registerUtility()` - Register custom utilities
- `registerModifier()` - Register custom variants
- `Plugin` interface - Plugin development

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

### Plugin Development
```typescript
const customPlugin = (ctx) => {
  ctx.extendTheme('colors', {
    'custom-blue': '#1e40af'
  });
};
```

## 🔗 Related Documentation

- [Installation Guide](/guide/installation)
- [Configuration](/guide/theme)
- [Custom Styles](/guide/adding-custom-styles)
- [Plugin Development](/api/plugins)

---

Ready to dive deeper? Start with the [Context API](/api/context) to understand how BaroCSS manages themes and configuration.
