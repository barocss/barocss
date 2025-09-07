# Theme Configuration

::: tip Design System Foundation
BaroCSS provides a powerful theming system that allows you to customize every aspect of your design system. From colors and spacing to typography and breakpoints, you have complete control over your design tokens.
:::

## Overview

BaroCSS themes are configured through the `config.theme` object in your runtime configuration. This system supports:

- **Design Tokens**: Colors, spacing, typography, breakpoints
- **Extending**: Add new values to existing categories
- **Overriding**: Replace default values completely
- **Dynamic Values**: Functions that receive theme context
- **CSS Variables**: Export theme values for custom CSS

## Preflight

::: details Purpose
Controls base styles injection. Preflight provides CSS reset and normalization.
:::

```ts
// Available options
{ 
  config: { 
    preflight: true | false | 'minimal' | 'standard' | 'full' 
  } 
```

**Options:**
- `true` / `'full'` - Complete preflight CSS (default)
- `'standard'` - Standard preflight CSS
- `'minimal'` - Minimal preflight CSS
- `false` - No preflight CSS

## Colors

::: details Purpose
Define your color palette with semantic naming and multiple shades.
:::

```ts
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      colors: {
        // Brand colors with multiple shades
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Semantic colors
        primary: '#3b82f6',
        secondary: '#64748b',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      }
    }
  }
});
```

**Usage:**
```html
<div class="bg-brand-500 text-white">Brand color</div>
<div class="bg-primary text-white">Primary color</div>
```

## Extending Theme

::: details Purpose
Add new values to existing categories without replacing defaults.
:::

```ts
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        // Add new spacing values
        spacing: { 
          '72': '18rem',
          '80': '20rem',
          '96': '24rem'
        },
        // Add new font sizes
        fontSize: {
          'xs': ['0.75rem', { lineHeight: '1rem' }],
          'sm': ['0.875rem', { lineHeight: '1.25rem' }],
          'base': ['1rem', { lineHeight: '1.5rem' }],
          'lg': ['1.125rem', { lineHeight: '1.75rem' }],
          'xl': ['1.25rem', { lineHeight: '1.75rem' }],
          '2xl': ['1.5rem', { lineHeight: '2rem' }],
          '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
          '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
          '5xl': ['3rem', { lineHeight: '1' }],
          '6xl': ['3.75rem', { lineHeight: '1' }],
          '7xl': ['4.5rem', { lineHeight: '1' }],
          '8xl': ['6rem', { lineHeight: '1' }],
          '9xl': ['8rem', { lineHeight: '1' }],
        },
        // Add new breakpoints
        screens: {
          'xs': '475px',
          'sm': '640px',
          'md': '768px',
          'lg': '1024px',
          'xl': '1280px',
          '2xl': '1536px',
        }
      }
    }
  }
});
```

## Dynamic Category Functions

::: details Purpose
Create theme values that depend on other theme values or context.
:::

```ts
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      // Dynamic spacing based on base unit
      spacing: (theme) => ({
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
      }),
      // Dynamic colors based on base color
      colors: (theme) => ({
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      })
    }
  }
});
```

## Dark Mode

::: details Purpose
Configure how dark mode is applied across your application.
:::

```ts
// Available options
{ 
  config: { 
    darkMode: 'media' | 'class' | string[] 
  } 
```

**Options:**
- `'media'` - Uses `@media (prefers-color-scheme: dark)` (default)
- `'class'` - Uses `.dark` class on parent element
- `string[]` - Custom selectors like `['class', '[data-theme="dark"]']`

```ts
// Media query approach (default)
const runtime = new BrowserRuntime({
  config: {
    darkMode: 'media'
  }
});

// Class-based approach
const runtime = new BrowserRuntime({
  config: {
    darkMode: 'class'
  }
});

// Custom selectors
const runtime = new BrowserRuntime({
  config: {
    darkMode: ['class', '[data-theme="dark"]', '[data-mode="dark"]']
  }
});
```

**Usage:**
```html
<!-- Media query approach -->
<div class="bg-white dark:bg-gray-900">Auto dark mode</div>

<!-- Class approach -->
<div class="dark">
  <div class="bg-white dark:bg-gray-900">Dark mode active</div>
</div>
```

## CSS Variables

::: details Purpose
Export theme values as CSS custom properties for use in custom CSS.
:::

```ts
// Get CSS variables from theme
const cssVars = runtime.context?.themeToCssVars?.();

// Use in custom CSS
const customCSS = `
  .my-component {
    background-color: var(--color-primary);
    padding: var(--spacing-4);
    font-size: var(--font-size-lg);
  }
`;
```

**Generated CSS variables:**
```css
:root {
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  /* ... more variables */
```

## Advanced Configuration

::: details Purpose
Complete theme configuration with all available options.
:::

```ts
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime({
  config: {
    // Preflight configuration
    preflight: 'full',
    
    // Dark mode configuration
    darkMode: 'class',
    
    // Complete theme configuration
    theme: {
      // Colors
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      
      // Spacing
      spacing: {
        0: '0px',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
      },
      
      // Typography
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['Fira Code', 'monospace'],
      },
      
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      
      // Breakpoints
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      
      // Border radius
      borderRadius: {
        none: '0px',
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      
      // Box shadow
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        none: '0 0 #0000',
      },
    }
  }
});
```

## Next Steps

- **[CSS Variables](/guide/theme#css-variables)** - Learn about CSS custom properties
- **[Dark Mode](/guide/dark-mode)** - Implement dark theme support
- **[Custom Utilities](/guide/adding-custom-styles)** - Create utilities that use your theme
- **[API Reference](/api/context)** - Complete theme API documentation
