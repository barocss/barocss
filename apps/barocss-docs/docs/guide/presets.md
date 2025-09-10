# Presets

Presets let you compose theme foundations.

```ts
import { BrowserRuntime } from '@barocss/browser';
import { defaultTheme } from '@barocss/kit/theme';

new BrowserRuntime({
  config: {
    presets: [
      { theme: defaultTheme },
      // Add more presets here
    ]
  }
});
```
