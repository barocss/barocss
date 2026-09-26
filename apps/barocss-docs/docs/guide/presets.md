# Presets

Presets let you compose theme foundations.

Install the published `__BAROCSS_VERSION__` browser and kit packages:

```bash
pnpm add @barocss/browser@__BAROCSS_VERSION__ @barocss/kit@__BAROCSS_VERSION__
```

Include `defaultTheme` first when your preset list needs the standard theme values. The published kit package exports it from `@barocss/kit/theme/default`.

```ts
import { BrowserRuntime } from '@barocss/browser';
import { defaultTheme } from '@barocss/kit/theme/default';

new BrowserRuntime({
  config: {
    presets: [
      { theme: defaultTheme },
      // Add more presets here
    ]
  }
});
```
