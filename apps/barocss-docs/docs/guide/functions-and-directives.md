# API Reference

A reference for the core APIs and functions that BaroCSS exposes for real-time CSS generation.

## Core APIs

BaroCSS provides a comprehensive set of APIs for managing themes, generating CSS, and extending functionality through plugins.

### Context API

Use the `createContext` function to create a BaroCSS context with your theme configuration:

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        'avocado-100': '#f0fdf4',
        'avocado-200': '#dcfce7',
        'avocado-300': '#bbf7d0',
        'avocado-400': '#86efac',
        'avocado-500': '#4ade80',
        'avocado-600': '#22c55e'
      },
      fontFamily: {
        display: ['Satoshi', 'sans-serif']
      },
      screens: {
        '3xl': '120rem'
      }
    }
  }
});
```

Learn more about the Context API in the [Context API documentation](/api/context).

### Engine API

Use the Engine API to parse class names and generate CSS:

```typescript
import { parseClassToAst, generateCss } from '@barocss/kit';

// Parse a class name to AST
const ast = parseClassToAst('bg-blue-500', ctx);

// Generate CSS from class names
const css = generateCss(['bg-blue-500', 'text-white', 'p-4'], ctx);
```

Learn more about the Engine API in the [Engine API documentation](/api/engine).

### Runtime APIs

BaroCSS provides different runtime implementations for different environments:

#### Browser Runtime

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          'brand-primary': '#3b82f6'
        }
      }
    }
  }
});

// Start watching DOM changes
runtime.observe(document.body, { scan: true });
```

#### Server Runtime

```typescript
import { ServerRuntime } from '@barocss/kit/runtime/server';

const runtime = new ServerRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          'brand-primary': '#3b82f6'
        }
      }
    }
  }
});

// Generate CSS for specific classes
const css = runtime.generateCssForClasses(['bg-brand-primary', 'text-white']);
```

Learn more about runtime APIs in the [Browser Runtime](/api/browser-runtime) and [Server Runtime](/api/server-runtime) documentation.

### Plugin System

Use the Plugin System to extend BaroCSS functionality:

```typescript
import { createUtilityPlugin, createVariantPlugin } from '@barocss/kit';

// Create a custom utility plugin
const customUtilityPlugin = createUtilityPlugin('tab-4', {
  'tab-size': '4'
});

// Create a custom variant plugin
const customVariantPlugin = createVariantPlugin('theme-midnight', {
  selector: '&:where([data-theme="midnight"] *)'
});

// Register plugins
const ctx = createContext({
  plugins: [customUtilityPlugin, customVariantPlugin]
});
```

Learn more about the Plugin System in the [Plugin System documentation](/api/plugins).

## Utility Functions

BaroCSS provides utility functions to make working with colors and spacing easier.

### Color Functions

Use color functions to manipulate colors dynamically:

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        'lime-300': '#bef264'
      }
    }
  }
});

// Get color with opacity
const colorWithOpacity = ctx.theme('colors.lime-300', { opacity: 0.5 });
// Returns: rgba(190, 242, 100, 0.5)
```

### Spacing Functions

Use spacing functions to generate spacing values based on your theme:

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      spacing: {
        4: '1rem'
      }
    }
  }
});

// Get spacing value
const spacing = ctx.theme('spacing.4');
// Returns: 1rem

// Use in arbitrary values
const css = generateCss(['p-[calc(var(--spacing-4)-1px)]'], ctx);
```

## Configuration

BaroCSS uses JavaScript/TypeScript configuration instead of CSS directives.

### Configuration Object

Use the configuration object to define your theme and behavior:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    prefix: 'tw-',
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          'brand-primary': '#3b82f6'
        }
      }
    },
    plugins: [
      // Custom plugins
    ]
  }
});
```

### Dynamic Configuration

You can update configuration at runtime:

```typescript
// Update theme
runtime.updateConfig({
  theme: {
    extend: {
      colors: {
        'brand-primary': '#1e40af'
      }
    }
  }
});
```

## Best practices

1. **Use TypeScript configuration**: Prefer TypeScript configuration for better type safety and IDE support.

2. **Organize your configuration**: Group related configuration options together and use comments to explain complex setups.

3. **Leverage theme values**: Use theme configuration for design tokens to maintain consistency across your project.

4. **Use runtime APIs efficiently**: Use the appropriate runtime API (Browser vs Server) for your environment.

5. **Create reusable plugins**: Create custom plugins for project-specific utilities and variants.

6. **Document custom APIs**: Document any custom plugins and configurations you create for team members.

7. **Test thoroughly**: Test your configuration and custom plugins across different browsers and environments.

8. **Use incremental parsing**: Leverage BaroCSS's incremental parsing for better performance in large applications.

9. **Cache generated CSS**: Use the built-in caching mechanisms to avoid regenerating CSS unnecessarily.

10. **Monitor performance**: Use the runtime stats API to monitor CSS generation performance.
