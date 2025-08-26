# CSSMA v4

A modern CSS utility library inspired by Tailwind CSS v4, designed for high performance and developer experience.

## 🚀 Features

### Core Features
- **Tailwind v4 Compatible**: Matches Tailwind CSS v4's AST structure and CSS generation
- **TypeScript First**: Full TypeScript support with comprehensive type definitions
- **Universal Runtime**: Works in both browser and server environments

### Runtime System
- **Browser Runtime**: Dynamic CSS injection with DOM manipulation
- **Server Runtime**: Static CSS generation for server-side rendering
- **Incremental Parsing**: Efficient class processing with change detection
- **Memory Optimization**: WeakMap caching, compression, and memory pooling

### Cache Architecture
- **Multi-Level Caching**: AST, CSS, and utility caches for optimal performance
- **Automatic Invalidation**: Cache clearing on context changes
- **Memory Efficient**: WeakMap-based caching with automatic cleanup

### Plugin System
- **Extensible Architecture**: Plugin system for custom utilities, variants, and themes
- **Multiple Plugin Types**: Utility, Variant, and Theme plugins
- **Configuration Support**: Plugin-specific configuration options
- **Error Handling**: Graceful error handling for plugin failures

## 📦 Installation

```bash
pnpm add cssma-v4
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { createContext, StyleRuntime } from 'cssma-v4';

// Create context with configuration
const ctx = createContext({
  theme: {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d'
    }
  }
});

// Browser runtime for dynamic CSS injection
const runtime = new StyleRuntime({
  config: {
    theme: ctx.theme
  }
});

// Process classes
runtime.processClasses('bg-primary text-white p-4 rounded');
```

### Server-Side Usage

```typescript
import { createContext, ServerRuntime } from 'cssma-v4/runtime/server';

const ctx = createContext({
  theme: {
    colors: { primary: '#007bff' }
  }
});

const serverRuntime = new ServerRuntime({
  config: {
    theme: ctx.theme
  }
});

// Generate static CSS
const css = serverRuntime.generateCss('bg-primary text-white');
```

## 🔌 Plugin System

CSSMA v4 provides a comprehensive plugin system for extending functionality with full type safety.

### Plugin Types

#### 1. General Plugin
```typescript
import { createContext } from 'cssma-v4';

const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Custom plugin example',
  handler: (ctx, config) => {
    // Register utilities, modify theme, etc.
    console.log('Plugin executed with config:', config);
  }
};

const ctx = createContext({
  plugins: [myPlugin]
});
```

#### 2. Utility Plugin with AST Functions
```typescript
import { createUtilityPlugin } from 'cssma-v4/core/plugin';
import { staticUtility, functionalUtility } from 'cssma-v4/core/registry';
import { decl, rule, atRule, atRoot } from 'cssma-v4/core/ast';

const utilityPlugin = createUtilityPlugin({
  name: 'custom-utilities',
  version: '1.0.0',
  description: 'Adds custom utility classes with AST functions',
  utilities: (ctx) => {
    // Static utility with complex selector using rule()
    staticUtility('custom-space-x-2', [
      rule('& > :not([hidden]) ~ :not([hidden])', [
        decl('margin-inline-start', '0.5rem'),
        decl('margin-inline-end', '0.5rem')
      ])
    ]);
    
    // Functional utility with theme awareness
    functionalUtility({
      name: 'custom-text',
      prop: 'color',
      supportsArbitrary: true,
      handle: (value, ctx) => {
        const themeColor = ctx.theme('colors', value);
        return [decl('color', themeColor || value)];
      }
    });
  }
});
```

#### 3. Theme Plugin with Safe API
```typescript
import { createThemePlugin } from 'cssma-v4/core/plugin';

const themePlugin = createThemePlugin({
  name: 'custom-theme',
  version: '1.0.0',
  description: 'Extends theme with custom values',
  theme: (ctx) => ({
    colors: {
      'custom-blue': '#0066cc',
      'custom-green': '#00cc66'
    },
    spacing: {
      'custom-lg': '2rem',
      'custom-xl': '3rem'
    }
  })
});

const ctx = createContext({
  plugins: [themePlugin]
});

// Custom theme values are now available
console.log(ctx.theme('colors', 'custom-blue')); // '#0066cc'
```

#### 4. Variant Plugin with AST Functions
```typescript
import { createVariantPlugin } from 'cssma-v4/core/plugin';
import { staticModifier, functionalModifier } from 'cssma-v4/core/registry';
import { atRule, rule } from 'cssma-v4/core/ast';

const variantPlugin = createVariantPlugin({
  name: 'custom-variants',
  version: '1.0.0',
  description: 'Adds custom variant modifiers with AST functions',
  variants: (ctx) => {
    // Static modifier with atRule for media queries
    staticModifier('print', [
      atRule('media', 'print', [
        rule('&', [])
      ])
    ]);
    
    // Functional modifier with complex logic
    functionalModifier(
      (mod) => mod.startsWith('dark-'),
      ({ selector, mod, ctx }) => {
        const darkMode = ctx.theme('darkMode') || 'media';
        if (darkMode === 'class') {
          return rule('.dark ' + selector, []);
        } else {
          return atRule('media', '(prefers-color-scheme: dark)', [
            rule(selector, [])
          ]);
        }
      }
    );
  }
});
```

### Advanced Plugin Capabilities

#### Theme Extension with Safe API
```typescript
const themeExtensionPlugin = (ctx, config) => {
  // Safe theme extension using extendTheme API
  ctx.extendTheme('colors', {
    'brand-primary': '#3b82f6',
    'brand-secondary': '#10b981'
  });
  
  // Function-based theme extension
  ctx.extendTheme('colors', (theme) => ({
    'primary': theme('colors', 'blue', '500'),
    'secondary': theme('colors', 'gray', '500')
  }));
};
```

#### Complex Utility with AST Functions
```typescript
import { decl, rule, atRule, atRoot } from 'cssma-v4/core/ast';

const complexUtilityPlugin = (ctx, config) => {
  // Utility with CSS custom properties using atRoot
  staticUtility('custom-theme-vars', [
    atRoot([
      decl('--custom-primary', ctx.theme('colors', 'blue', '500')),
      decl('--custom-secondary', ctx.theme('colors', 'gray', '500'))
    ])
  ]);
  
  // Utility with media query using atRule
  staticUtility('responsive-utility', [
    atRule('media', '(min-width: 768px)', [
      rule('.md\\:custom-utility', [
        decl('display', 'block'),
        decl('padding', '1rem')
      ])
    ])
  ]);
  
  // Functional utility with complex AST
  functionalUtility({
    name: 'custom-layout',
    prop: 'display',
    supportsArbitrary: true,
    handle: (value, ctx) => {
      if (value === 'grid') {
        return [
          decl('display', 'grid'),
          decl('grid-template-columns', 'repeat(auto-fit, minmax(200px, 1fr))'),
          decl('gap', '1rem')
        ];
      }
      return [decl('display', value)];
    }
  });
};
```

### Plugin Configuration

```typescript
const configurablePlugin = {
  name: 'configurable-plugin',
  version: '1.0.0',
  description: 'Plugin with configuration',
  handler: (ctx, config) => {
    if (config?.enableCustomUtilities) {
      staticUtility('custom-enabled', [
        decl('background-color', config.customColor || '#000000')
      ]);
    }
  }
};

const ctx = createContext({
  plugins: [configurablePlugin],
  pluginConfig: {
    enableCustomUtilities: true,
    customColor: '#ff6600'
  }
});
```

### Plugin Dependencies

```typescript
const basePlugin = {
  name: 'base-plugin',
  version: '1.0.0',
  handler: (ctx) => {
    staticUtility('base-color', [
      decl('--base-color', '#333333')
    ]);
  }
};

const dependentPlugin = {
  name: 'dependent-plugin',
  version: '1.0.0',
  dependencies: ['base-plugin'],
  handler: (ctx) => {
    staticUtility('dependent-utility', [
      decl('color', 'var(--base-color)')
    ]);
  }
};

const ctx = createContext({
  plugins: [basePlugin, dependentPlugin]
});
```

### Plugin Error Handling

```typescript
const errorPlugin = {
  name: 'error-plugin',
  handler: () => {
    throw new Error('Plugin error for testing');
  }
};

const workingPlugin = {
  name: 'working-plugin',
  handler: (ctx) => {
    staticUtility('working-utility', [
      decl('background-color', '#ffffff')
    ]);
  }
};

// Error plugin fails gracefully, working plugin continues
const ctx = createContext({
  plugins: [errorPlugin, workingPlugin]
});
```

### Plugin Best Practices

1. **Use AST Functions**: Always use `decl()`, `rule()`, `atRule()`, `atRoot()` for creating AST nodes
2. **Use Safe APIs**: Use `ctx.extendTheme()` instead of direct theme manipulation
3. **Handle Errors**: Wrap plugin logic in try-catch blocks
4. **Validate Configuration**: Check plugin configuration before use
5. **Test Thoroughly**: Write comprehensive tests for plugin functionality

## 🎨 Theme System

### Theme Configuration

```typescript
import { createContext } from 'cssma-v4';

const ctx = createContext({
  theme: {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      danger: '#dc3545'
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '3rem'
    },
    borderRadius: {
      sm: '0.125rem',
      md: '0.25rem',
      lg: '0.5rem',
      full: '9999px'
    }
  }
});
```

### Theme Extension

```typescript
const ctx = createContext({
  theme: {
    extend: {
      colors: {
        'brand-blue': '#1e40af',
        'brand-green': '#059669'
      }
    }
  }
});
```

### Presets

```typescript
const ctx = createContext({
  presets: [
    {
      theme: {
        colors: {
          'preset-red': '#ef4444',
          'preset-blue': '#3b82f6'
        }
      }
    }
  ]
});
```

## 🔧 Configuration

### CssmaConfig Interface

```typescript
interface CssmaConfig {
  prefix?: string;  // Class name prefix
  darkMode?: 'media' | 'class' | string[];  // Dark mode strategy
  theme?: CssmaTheme;  // Theme configuration
  presets?: { theme: CssmaTheme }[];  // Theme presets
  plugins?: (CssmaPlugin | ((ctx: CssmaContext, config?: any) => void))[];  // Plugins
  clearCacheOnContextChange?: boolean;  // Cache invalidation
}
```

### Runtime Configuration

```typescript
interface StyleRuntimeOptions {
  config?: CssmaConfig;  // CSSMA configuration
  scan?: boolean;  // Scan existing classes
  observe?: boolean;  // Observe DOM changes
}
```

## 📚 API Reference

### Core Functions

#### `createContext(config: CssmaConfig): CssmaContext`
Creates a CSSMA context with resolved theme and configuration.

#### `parseClassToAst(className: string, ctx: CssmaContext): AstNode[]`
Parses a CSS class name into an AST representation.

### Runtime Classes

#### `StyleRuntime` (Browser)
```typescript
class StyleRuntime {
  constructor(options: StyleRuntimeOptions);
  processClasses(classes: string): void;
  updateConfig(newConfig: CssmaConfig): void;
  getStats(): RuntimeStats;
}
```

#### `ServerRuntime` (Server)
```typescript
class ServerRuntime {
  constructor(options: { config: CssmaConfig });
  generateCss(classes: string): string;
  getStats(): RuntimeStats;
}
```

### Plugin Functions

#### `createUtilityPlugin(plugin: UtilityPlugin): UtilityPlugin`
Creates a utility plugin for registering custom utilities.

#### `createVariantPlugin(plugin: VariantPlugin): VariantPlugin`
Creates a variant plugin for registering custom variants.

#### `createThemePlugin(plugin: ThemePlugin): ThemePlugin`
Creates a theme plugin for extending themes.

### Cache Functions

#### `clearAllCaches(): void`
Clears all global caches (AST, CSS, utility, parse result).

### Types

#### `CssmaConfig`
Configuration interface for CSSMA.

#### `CssmaContext`
Context object with theme and configuration access.

#### `CssmaPlugin`
Base plugin interface.

#### `UtilityPlugin`
Plugin interface for utility registration.

#### `VariantPlugin`
Plugin interface for variant registration.

#### `ThemePlugin`
Plugin interface for theme extension.

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test tests/plugins/plugin-system.test.ts

# Run tests with coverage
pnpm test --coverage
```

## 📖 Examples

### Complete Plugin Example

```typescript
import { createContext } from 'cssma-v4';
import { createUtilityPlugin } from 'cssma-v4/core/plugin';
import { staticUtility, functionalUtility } from 'cssma-v4/core/registry';

// Create a comprehensive plugin
const comprehensivePlugin = {
  name: 'comprehensive-example-plugin',
  version: '1.0.0',
  description: 'A comprehensive plugin example',
  handler: (ctx, config) => {
    // 1. Register custom utilities
    staticUtility('btn', [
      ['display', 'inline-block'],
      ['padding', '0.5rem 1rem'],
      ['border-radius', '0.25rem'],
      ['text-decoration', 'none'],
      ['cursor', 'pointer']
    ]);

    functionalUtility({
      name: 'btn',
      prop: 'background-color',
      supportsArbitrary: true,
      handleBareValue: ({ value }) => {
        return `var(--btn-color-${value})`;
      }
    });

    // 2. Register custom variants
    staticModifier('btn-hover', ['&:hover'], { source: 'button' });
    staticModifier('btn-active', ['&:active'], { source: 'button' });

    // 3. Extend theme with custom values
    const customTheme = {
      colors: {
        'btn-primary': '#007bff',
        'btn-secondary': '#6c757d',
        'btn-success': '#28a745'
      },
      spacing: {
        'btn-sm': '0.25rem 0.5rem',
        'btn-lg': '0.75rem 1.5rem'
      }
    };

    // Theme extension would be handled by the plugin system
  }
};

// Use the plugin
const ctx = createContext({
  plugins: [comprehensivePlugin]
});

// Test the plugin functionality
const result = parseClassToAst('btn btn-primary', ctx);
console.log(result);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
