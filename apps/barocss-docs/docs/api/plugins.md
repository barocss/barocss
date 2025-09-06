---
title: Plugin System API
description: Extending BaroCSS with custom utilities, variants, and theme extensions
---

# Plugin System API

The Plugin System API allows you to extend BaroCSS with custom utilities, variants, and theme extensions. Plugins are functions that receive the BaroCSS context and can register new functionality.

## Plugin Interface

```typescript
interface Plugin {
  name?: string;
  version?: string;
  description?: string;
  handler: (ctx: Context, config?: any) => void;
  theme?: (ctx: Context, config?: any) => Record<string, any>;
  dependencies?: string[];
  optionsSchema?: Record<string, any>;
}
```

## Basic Plugin Structure

```typescript
import { Context } from '@barocss/kit';

const myPlugin = (ctx: Context, config?: any) => {
  // Plugin logic here
  console.log('Plugin executed!');
};

// Register plugin
const runtime = new BrowserRuntime({
  config: {
    plugins: [myPlugin]
  }
});
```

## Plugin Types

### Utility Plugin

Extends BaroCSS with custom utility classes.

```typescript
import { staticUtility, functionalUtility } from '@barocss/kit';

const utilityPlugin = (ctx: Context, config?: any) => {
  // Register static utility
  staticUtility('text-brand', [
    ['color', '#3b82f6']
  ], {
    description: 'Brand text color',
    category: 'typography'
  });

  // Register functional utility
  functionalUtility({
    name: 'bg-brand',
    prop: 'background-color',
    themeKey: 'colors.brand',
    supportsArbitrary: true,
    description: 'Brand background color'
  });
};
```

### Variant Plugin

Extends BaroCSS with custom variants/modifiers.

```typescript
import { staticModifier, functionalModifier } from '@barocss/kit';

const variantPlugin = (ctx: Context, config?: any) => {
  // Register static variant
  staticModifier('data-state', [
    '[data-state="open"]',
    '[data-state="closed"]'
  ]);

  // Register functional variant
  functionalModifier(
    (mod: string) => mod.startsWith('data-'),
    ({ selector, mod }) => `[${mod}]${selector}`
  );
};
```

### Theme Plugin

Extends BaroCSS with custom theme values.

```typescript
const themePlugin = (ctx: Context, config?: any) => {
  // Extend theme
  ctx.extendTheme('colors', {
    'brand': {
      50: '#eff6ff',
      500: '#3b82f6',
      900: '#1e3a8a'
    }
  });

  ctx.extendTheme('spacing', {
    '18': '4.5rem',
    '88': '22rem'
  });
};
```

## Plugin Registration

### Using Plugin Function

```typescript
const customPlugin = (ctx: Context, config?: any) => {
  // Plugin logic
  ctx.extendTheme('colors', {
    'custom-blue': '#1e40af'
  });
};

const runtime = new BrowserRuntime({
  config: {
    plugins: [customPlugin]
  }
});
```

### Using Plugin Object

```typescript
const customPlugin = {
  name: 'custom-plugin',
  version: '1.0.0',
  description: 'Custom plugin for brand colors',
  handler: (ctx: Context, config?: any) => {
    ctx.extendTheme('colors', {
      'brand': '#3b82f6'
    });
  },
  theme: (ctx: Context, config?: any) => ({
    colors: {
      'brand': '#3b82f6'
    }
  })
};

const runtime = new BrowserRuntime({
  config: {
    plugins: [customPlugin]
  }
});
```

## Plugin Helper Functions

### createUtilityPlugin()

Creates a utility-focused plugin.

```typescript
import { createUtilityPlugin } from '@barocss/kit';

const utilityPlugin = createUtilityPlugin({
  name: 'brand-utilities',
  version: '1.0.0',
  description: 'Brand-specific utilities',
  utilities: (ctx: Context, config?: any) => {
    staticUtility('text-brand', [
      ['color', '#3b82f6']
    ]);
  },
  theme: (ctx: Context, config?: any) => ({
    colors: {
      'brand': '#3b82f6'
    }
  })
});
```

### createVariantPlugin()

Creates a variant-focused plugin.

```typescript
import { createVariantPlugin } from '@barocss/kit';

const variantPlugin = createVariantPlugin({
  name: 'data-variants',
  version: '1.0.0',
  description: 'Data attribute variants',
  variants: (ctx: Context, config?: any) => {
    staticModifier('data-state', [
      '[data-state="open"]',
      '[data-state="closed"]'
    ]);
  }
});
```

### createThemePlugin()

Creates a theme-focused plugin.

```typescript
import { createThemePlugin } from '@barocss/kit';

const themePlugin = createThemePlugin({
  name: 'brand-theme',
  version: '1.0.0',
  description: 'Brand theme extension',
  theme: (ctx: Context, config?: any) => ({
    colors: {
      'brand': {
        50: '#eff6ff',
        500: '#3b82f6',
        900: '#1e3a8a'
      }
    }
  })
});
```

## Plugin Registry

### Global Registry

```typescript
import { registerPlugin, pluginRegistry } from '@barocss/kit';

// Register plugin globally
registerPlugin({
  name: 'global-plugin',
  handler: (ctx: Context) => {
    ctx.extendTheme('colors', {
      'global': '#10b981'
    });
  }
});

// Get all registered plugins
const plugins = pluginRegistry.getPlugins();
```

### Plugin Dependencies

```typescript
const basePlugin = {
  name: 'base-plugin',
  handler: (ctx: Context) => {
    ctx.extendTheme('colors', {
      'base': '#6b7280'
    });
  }
};

const dependentPlugin = {
  name: 'dependent-plugin',
  dependencies: ['base-plugin'],
  handler: (ctx: Context) => {
    // This plugin depends on base-plugin
    const baseColor = ctx.theme('colors.base');
    ctx.extendTheme('colors', {
      'derived': baseColor + '80' // Add opacity
    });
  }
};
```

## Advanced Plugin Examples

### Responsive Plugin

```typescript
const responsivePlugin = (ctx: Context, config?: any) => {
  // Add custom breakpoints
  ctx.extendTheme('screens', {
    'xs': '475px',
    '3xl': '1600px'
  });

  // Add custom spacing for new breakpoints
  ctx.extendTheme('spacing', {
    '18': '4.5rem',
    '88': '22rem'
  });
};
```

### Animation Plugin

```typescript
const animationPlugin = (ctx: Context, config?: any) => {
  // Add custom animations
  ctx.extendTheme('animations', {
    'bounce-slow': 'bounce 2s infinite',
    'pulse-fast': 'pulse 0.5s infinite'
  });

  // Add custom keyframes
  ctx.extendTheme('keyframes', {
    'fade-in': {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' }
    }
  });
};
```

### Component Plugin

```typescript
const componentPlugin = (ctx: Context, config?: any) => {
  // Register component utilities
  staticUtility('btn', [
    ['display', 'inline-flex'],
    ['align-items', 'center'],
    ['justify-content', 'center'],
    ['padding', '0.5rem 1rem'],
    ['border-radius', '0.375rem'],
    ['font-weight', '500'],
    ['text-decoration', 'none'],
    ['transition', 'all 0.2s']
  ]);

  staticUtility('btn-primary', [
    ['background-color', '#3b82f6'],
    ['color', '#ffffff']
  ]);

  staticUtility('btn-primary:hover', [
    ['background-color', '#2563eb']
  ]);
};
```

### Data Attribute Plugin

```typescript
const dataAttributePlugin = (ctx: Context, config?: any) => {
  // Register data attribute variants
  staticModifier('data-state', [
    '[data-state="open"]',
    '[data-state="closed"]',
    '[data-state="loading"]'
  ]);

  staticModifier('data-theme', [
    '[data-theme="light"]',
    '[data-theme="dark"]'
  ]);

  // Functional variant for dynamic data attributes
  functionalModifier(
    (mod: string) => mod.startsWith('data-'),
    ({ selector, mod }) => `[${mod}]${selector}`
  );
};
```

## Plugin Configuration

### Configurable Plugin

```typescript
const configurablePlugin = (ctx: Context, config?: any) => {
  const options = config?.pluginOptions || {};
  
  // Use configuration
  if (options.enableBrandColors) {
    ctx.extendTheme('colors', {
      'brand': options.brandColor || '#3b82f6'
    });
  }

  if (options.enableCustomSpacing) {
    ctx.extendTheme('spacing', {
      'custom': options.customSpacing || '2rem'
    });
  }
};

const runtime = new BrowserRuntime({
  config: {
    plugins: [configurablePlugin],
    pluginOptions: {
      enableBrandColors: true,
      brandColor: '#10b981',
      enableCustomSpacing: true,
      customSpacing: '3rem'
    }
  }
});
```

### Plugin Validation

```typescript
const validatedPlugin = {
  name: 'validated-plugin',
  optionsSchema: {
    type: 'object',
    properties: {
      color: { type: 'string' },
      size: { type: 'number' }
    },
    required: ['color']
  },
  handler: (ctx: Context, config?: any) => {
    // Validate configuration
    if (!config?.color) {
      throw new Error('Color is required');
    }

    ctx.extendTheme('colors', {
      'custom': config.color
    });
  }
};
```

## Plugin Development Best Practices

### 1. Use Descriptive Names

```typescript
const plugin = {
  name: 'brand-colors-plugin',
  description: 'Adds brand-specific color utilities and theme values'
};
```

### 2. Handle Errors Gracefully

```typescript
const robustPlugin = (ctx: Context, config?: any) => {
  try {
    ctx.extendTheme('colors', {
      'brand': config?.brandColor || '#3b82f6'
    });
  } catch (error) {
    console.warn('Plugin failed to extend theme:', error);
  }
};
```

### 3. Use TypeScript for Type Safety

```typescript
interface PluginConfig {
  brandColor?: string;
  enableAnimations?: boolean;
}

const typedPlugin = (ctx: Context, config?: PluginConfig) => {
  if (config?.brandColor) {
    ctx.extendTheme('colors', {
      'brand': config.brandColor
    });
  }
};
```

### 4. Document Your Plugin

```typescript
/**
 * Brand Colors Plugin
 * 
 * Adds brand-specific color utilities and theme values.
 * 
 * @param ctx - BaroCSS context
 * @param config - Plugin configuration
 * @param config.brandColor - Primary brand color (default: #3b82f6)
 * @param config.enableVariants - Enable hover/focus variants (default: true)
 */
const brandColorsPlugin = (ctx: Context, config?: any) => {
  // Plugin implementation
};
```

## Plugin Testing

### Unit Testing

```typescript
import { createContext } from '@barocss/kit';

describe('Brand Colors Plugin', () => {
  it('should extend theme with brand colors', () => {
    const ctx = createContext({
      plugins: [brandColorsPlugin]
    });

    expect(ctx.theme('colors.brand')).toBe('#3b82f6');
  });
});
```

### Integration Testing

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

describe('Plugin Integration', () => {
  it('should work with runtime', () => {
    const runtime = new BrowserRuntime({
      config: {
        plugins: [brandColorsPlugin]
      }
    });

    runtime.addClass('bg-brand');
    const css = runtime.getCss('bg-brand');
    expect(css).toContain('background-color: #3b82f6');
  });
});
```

## Related APIs

- [Context API](/api/context) - Plugin context and theme extension
- [Configuration API](/api/configuration) - Plugin configuration options
- [Engine API](/api/engine) - Core functionality for plugins
- [Browser Runtime](/api/browser-runtime) - Using plugins in browser
- [Server Runtime](/api/server-runtime) - Using plugins on server
