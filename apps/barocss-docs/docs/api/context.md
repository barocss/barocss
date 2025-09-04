---
title: Context API
description: Theme and configuration management in BaroCSS
---

# Context API

The Context API is the central system for managing themes, configuration, and plugin functionality in BaroCSS. It provides a unified interface for accessing theme values, configuration options, and extending functionality.

## createContext()

Creates a new BaroCSS context with the provided configuration.

```typescript
import { createContext } from 'barocss';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6'
      }
    }
  },
  darkMode: 'class',
  plugins: [customPlugin]
});
```

### Parameters

- `config` (Config): Configuration object

### Returns

- `Context`: BaroCSS context instance

## Context Interface

```typescript
interface Context {
  // Theme access
  theme: (...path: (string|number)[]) => any;
  
  // Configuration access
  config: (...path: (string|number)[]) => any;
  
  // Plugin management
  plugins: any[];
  
  // Theme extension
  extendTheme: (category: string, values: Record<string, any> | Function) => void;
  
  // CSS variables generation
  themeToCssVars: (prefix?: string) => string;
  
  // Preflight CSS
  getPreflightCSS: (level?: PreflightLevel) => string;
  
  // Preset checking
  hasPreset: (category: string, preset: string) => boolean;
}
```

## Theme Access

Access theme values using the `theme()` method with dot notation or array paths.

```typescript
// Using dot notation
const primaryColor = ctx.theme('colors.blue.500');
const fontSize = ctx.theme('fontSize.lg');

// Using array paths
const spacing = ctx.theme('spacing', '4');
const borderRadius = ctx.theme('borderRadius', 'lg');

// Dynamic theme functions
const dynamicSpacing = ctx.theme('spacing', 'custom', 'value');
```

### Theme Categories

- `colors` - Color palette
- `spacing` - Spacing scale
- `fontSize` - Font sizes
- `fontWeight` - Font weights
- `fontFamily` - Font families
- `borderRadius` - Border radius values
- `boxShadow` - Shadow definitions
- `zIndex` - Z-index scale
- `opacity` - Opacity values
- `animations` - Animation definitions
- `keyframes` - Keyframe animations

## Configuration Access

Access configuration values using the `config()` method.

```typescript
// Get configuration values
const darkMode = ctx.config('darkMode');
const prefix = ctx.config('prefix');
const preflight = ctx.config('preflight');

// Nested configuration
const customConfig = ctx.config('custom', 'setting');
```

## Theme Extension

Extend themes dynamically using the `extendTheme()` method.

```typescript
// Extend with object
ctx.extendTheme('colors', {
  'brand-primary': '#3b82f6',
  'brand-secondary': '#1e40af'
});

// Extend with function
ctx.extendTheme('spacing', (theme) => ({
  ...theme('spacing'),
  '18': '4.5rem',
  '88': '22rem'
}));
```

## CSS Variables Generation

Generate CSS custom properties from the theme.

```typescript
// Generate CSS variables
const cssVars = ctx.themeToCssVars();

// With custom prefix
const cssVars = ctx.themeToCssVars('--my-prefix');
```

Output:
```css
:root,:host {
  --color-blue-500: #3b82f6;
  --spacing-4: 1rem;
  --text-lg: 1.125rem;
  /* ... more variables */
}
```

## Preflight CSS

Get preflight CSS for consistent styling.

```typescript
// Full preflight (default)
const preflight = ctx.getPreflightCSS();

// Minimal preflight
const minimal = ctx.getPreflightCSS('minimal');

// Standard preflight
const standard = ctx.getPreflightCSS('standard');

// No preflight
const none = ctx.getPreflightCSS(false);
```

## Preset Checking

Check if a preset is available in a theme category.

```typescript
// Check if preset exists
const hasPreset = ctx.hasPreset('colors', 'blue');
const hasCustomPreset = ctx.hasPreset('spacing', 'custom');
```

## Configuration Options

### Basic Configuration

```typescript
interface Config {
  // Class name prefix
  prefix?: string;
  
  // Dark mode strategy
  darkMode?: 'media' | 'class' | string[];
  
  // Theme configuration
  theme?: Theme;
  
  // Presets
  presets?: { theme: Theme }[];
  
  // Preflight CSS level
  preflight?: 'minimal' | 'standard' | 'full' | true | false;
  
  // Plugins
  plugins?: Plugin[];
  
  // Cache management
  clearCacheOnContextChange?: boolean;
}
```

### Theme Configuration

```typescript
interface Theme {
  // Extend existing theme
  extend?: Theme;
  
  // Override theme values
  [namespace: string]: any;
}
```

## Examples

### Basic Context Creation

```typescript
import { createContext } from 'barocss';

const ctx = createContext({
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
  darkMode: 'class',
  preflight: 'standard'
});
```

### Dynamic Theme Extension

```typescript
// Extend theme based on conditions
if (isProduction) {
  ctx.extendTheme('colors', {
    'production-blue': '#1e40af'
  });
}

// Extend with function for dynamic values
ctx.extendTheme('spacing', (theme) => {
  const baseSpacing = theme('spacing');
  return {
    ...baseSpacing,
    'dynamic': 'calc(1rem + 2vw)'
  };
});
```

### Plugin Integration

```typescript
const customPlugin = (ctx, config) => {
  // Extend theme
  ctx.extendTheme('colors', {
    'plugin-color': '#10b981'
  });
  
  // Access configuration
  const pluginConfig = config.pluginOptions || {};
  
  // Register utilities (see Plugin API)
  // ...
};

const ctx = createContext({
  plugins: [customPlugin],
  pluginOptions: {
    customSetting: true
  }
});
```

## Best Practices

1. **Reuse Contexts**: Create contexts once and reuse them across your application
2. **Theme Functions**: Use theme functions for dynamic values that depend on other theme values
3. **Plugin Order**: Plugins are executed in order, so consider dependencies
4. **Cache Management**: Use `clearCacheOnContextChange: false` for better performance when context doesn't change
5. **Type Safety**: Use TypeScript for better theme and configuration type safety

## Related APIs

- [Engine API](/api/engine) - CSS generation using context
- [Plugin System](/api/plugins) - Extending context functionality
- [Configuration](/api/configuration) - Detailed configuration options
