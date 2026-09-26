# Presets

Presets let you compose theme foundations.

Install the published `0.6.0` browser and kit packages:

```bash
pnpm add @barocss/browser@0.6.0 @barocss/kit@0.6.0
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
