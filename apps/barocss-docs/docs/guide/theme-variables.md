# Theme Configuration

Using JavaScript/TypeScript to configure your design tokens and theme values.

## Overview

BaroCSS is a framework for building custom designs with real-time CSS generation. Different designs need different typography, colors, shadows, breakpoints, and more.

These low-level design decisions are often called _design tokens_, and in BaroCSS projects you store those values in your _theme configuration_.

### What is theme configuration?

Theme configuration in BaroCSS is done through JavaScript/TypeScript objects that define your design tokens and influence which utility classes are available in your project.

For example, you can add a new color to your project by defining it in your theme configuration:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          'mint-500': '#10b981'
        }
      }
    }
  }
});
```

Now you can use utility classes like `bg-mint-500`, `text-mint-500`, or `border-mint-500` in your HTML:

```html
<div class="bg-mint-500">
  <!-- ... -->
</div>
```

BaroCSS automatically generates CSS custom properties for your theme values so you can reference your design tokens in arbitrary values or inline styles:

```html
<div style="background-color: var(--color-mint-500)">
  <!-- ... -->
</div>
```

Learn more about how theme configuration maps to different utility classes in the [Configuration API](/api/configuration) documentation.

#### Why JavaScript configuration instead of CSS?

Theme configuration in BaroCSS isn't _just_ CSS variables — it also instructs BaroCSS to create new utility classes that you can use in your HTML.

Since BaroCSS generates CSS in real-time, JavaScript/TypeScript configuration provides:
- **Type safety** with TypeScript
- **Dynamic configuration** based on runtime conditions
- **Custom utilities** for extending functionality
- **Better IDE support** with autocomplete and validation

You can still use regular CSS variables with `:root` in BaroCSS projects when you want to define a variable that isn't meant to be connected to a utility class. Use theme configuration when you want a design token to map directly to a utility class.

#### Relationship to utility classes

Every theme value you define creates corresponding utility classes that you can use in your HTML.

For example, defining `colors.mint-500` creates utilities like:
- `bg-mint-500` (background-color)
- `text-mint-500` (color)
- `border-mint-500` (border-color)
- `fill-mint-500` (fill)
- `stroke-mint-500` (stroke)
- `outline-mint-500` (outline-color)
- `ring-mint-500` (ring-color)
- `shadow-mint-500` (box-shadow color)
- `accent-mint-500` (accent-color)
- `caret-mint-500` (caret-color)
- `decoration-mint-500` (text-decoration-color)

#### Theme configuration namespaces

Theme configuration is organized into namespaces that determine which utility classes are generated. For example:

- `colors.*` creates color utilities
- `fontFamily.*` creates font-family utilities  
- `fontSize.*` creates font-size utilities
- `spacing.*` creates padding/margin utilities

See the [Configuration API](/api/configuration) documentation for a complete reference.

#### Default theme configuration

BaroCSS comes with a comprehensive set of default theme values that you can extend or override. Here's a small sample of the default configuration:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      colors: {
        black: '#000',
        white: '#fff',
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712'
        }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Consolas', 'Liberation Mono', 'Menlo', 'monospace']
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
        '7xl': '4.5rem',
        '8xl': '6rem',
        '9xl': '8rem'
      },
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900'
      },
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
        normal: '0em',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em'
      },
      lineHeight: {
        tight: '1.25',
        snug: '1.375',
        normal: '1.5',
        relaxed: '1.625',
        loose: '2'
      },
      borderRadius: {
        xs: '0.125rem',
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem'
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)'
      },
      blur: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '40px',
        '3xl': '64px'
      },
      animation: {
        spin: 'spin 1s linear infinite',
        ping: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        bounce: 'bounce 1s infinite'
      },
      keyframes: {
        spin: {
          to: { transform: 'rotate(360deg)' }
        },
        ping: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' }
        },
        pulse: {
          '50%': { opacity: '0.5' }
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(-25%)', animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)' },
          '50%': { transform: 'none', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' }
        }
      }
    }
  }
});
```

## Customizing your theme

### Extending the default theme

To add new values to the default theme without replacing it entirely, you can extend the default theme by adding your custom values:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          'mint-500': '#10b981'
        },
        fontSize: {
          '10xl': '12rem'
        },
        spacing: {
          '18': '4.5rem'
        }
      }
    }
  }
});
```

### Overriding the default theme

To completely replace the default theme with your own values, you can override the entire theme:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        accent: '#f59e0b'
      },
      spacing: {
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
        72: '18rem',
        80: '20rem',
        96: '24rem'
      }
    }
  }
});
```

### Using a custom theme

You can also use a completely custom theme by importing it from a separate file:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';
import { customTheme } from './my-custom-theme';

const runtime = new BrowserRuntime({
  config: {
    theme: customTheme
  }
});
```

### Defining animation keyframes

You can define custom animation keyframes within your theme:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        animation: {
          'fade-in': 'fade-in 0.5s ease-in-out'
        },
        keyframes: {
          'fade-in': {
            from: { opacity: '0' },
            to: { opacity: '1' }
          }
        }
      }
    }
  }
});
```

### Referencing other values

You can reference other theme values within your theme definition using JavaScript functions:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          primary: '#3b82f6',
          'primary-dark': '#1e40af',
          'primary-light': '#60a5fa'
        }
      }
    }
  }
});
```

### Dynamic theme generation

BaroCSS generates CSS variables in real-time based on the classes you use. You can also generate all CSS variables by using the `generateCss` function:

```typescript
import { createContext, generateCss } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        'mint-500': '#10b981'
      }
    }
  }
});

// Generate CSS for all theme values
const css = generateCss(['bg-mint-500', 'text-mint-500'], ctx);
```

### Sharing across projects

You can share theme configuration across multiple projects by creating a shared theme file:

```typescript
// shared-theme.ts
export const sharedTheme = {
  colors: {
    'brand-primary': '#3b82f6',
    'brand-secondary': '#64748b'
  },
  fontFamily: {
    brand: ['Inter', 'sans-serif']
  }
};
```

Then import it in your projects:

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';
import { sharedTheme } from './shared-theme';

const runtime = new BrowserRuntime({
  config: {
    theme: sharedTheme
  }
});
```

## Using your theme configuration

### With custom CSS

You can use your theme values in custom CSS by referencing the generated CSS variables:

```css
.custom-button {
  background-color: var(--color-mint-500);
  color: white;
  padding: var(--spacing-4);
  border-radius: var(--radius-lg);
}
```

### With arbitrary values

You can also use theme values in arbitrary values:

```html
<div class="bg-[var(--color-mint-500)] text-white p-[var(--spacing-4)] rounded-[var(--radius-lg)]">
  Custom styled element
</div>
```

### Referencing in JavaScript

You can access theme values in JavaScript using the `getComputedStyle` API:

```js
const element = document.querySelector('.my-element');
const mintColor = getComputedStyle(element).getPropertyValue('--color-mint-500');
console.log(mintColor); // #10b981
```

### Using the Context API

You can also access theme values programmatically using the Context API:

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        'mint-500': '#10b981'
      }
    }
  }
});

// Get theme value
const mintColor = ctx.theme('colors.mint-500');
console.log(mintColor); // #10b981
```

## Default theme configuration reference

For a complete reference of all default theme configuration options, see the [Configuration API](/api/configuration) documentation.
