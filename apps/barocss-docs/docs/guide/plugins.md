# Plugins

Extend BaroCSS with plugins that can register utilities, variants, and theme extensions.

## Using Plugins

```ts
import { BrowserRuntime } from 'barocss/runtime/browser';

function myPlugin(ctx, config) {
  // Extend theme
  ctx.extendTheme('spacing', { '104': '26rem' });
}

const runtime = new BrowserRuntime({
  config: {
    plugins: [myPlugin]
  }
});
```

## Plugin Shape

- Function: `(ctx, config) => void`
- Object: `{ name?: string, handler: (ctx, config) => void, theme?: (ctx, config) => any }`

```ts
const pluginObject = {
  name: 'example',
  handler(ctx, config) {
    ctx.extendTheme('colors', { brand: { 500: '#0ea5e9' } });
  },
  theme(ctx, config) {
    return {
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' }
        }
      }
    };
  }
};

new BrowserRuntime({ config: { plugins: [pluginObject] } });
```

## Accessing Theme Values

Plugins can read current theme values using:

```ts
const size = ctx.theme('spacing.4');
```

## Notes

- Plugins run after context is created and can extend theme categories safely using `extendTheme`.
- If a plugin exposes a `theme(ctx, config)` function, its returned values are shallow-merged into the theme categories.

