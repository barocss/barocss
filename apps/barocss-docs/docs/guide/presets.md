# Presets

Presets let you compose theme foundations.

```ts
import { BrowserRuntime } from 'barocss/runtime/browser';
import { defaultTheme } from 'barocss/theme';

new BrowserRuntime({
  config: {
    presets: [
      { theme: defaultTheme },
      // Add more presets here
    ]
  }
});
```
