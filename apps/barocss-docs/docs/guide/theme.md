# Theme Configuration

Customize your design system using the `config.theme` object.

## Preflight

Controls base styles injection.

```ts
// true | false | 'minimal' | 'standard' | 'full'
{ config: { preflight: true } }
```

## Colors

```ts
import { BrowserRuntime } from 'barocss/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e',
        }
      }
    }
  }
});
```

## Extending Theme

Use `extend` to merge values.

```ts
import { BrowserRuntime } from 'barocss/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        spacing: { '72': '18rem' },
      }
    }
  }
});
```

## Dynamic Category Functions

Categories can be functions that receive a theme getter.

```ts
import { BrowserRuntime } from 'barocss/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      spacing: (theme) => ({
        1: '0.25rem',
        2: theme('spacing.1'),
      })
    }
  }
});
```

## Dark Mode

```ts
// 'media' | 'class' | string[] selectors
{ config: { darkMode: 'class' } }
```

## CSS Variables

Export CSS variables from theme for custom CSS.

```ts
const cssVars = runtime['context']?.themeToCssVars?.();
```
