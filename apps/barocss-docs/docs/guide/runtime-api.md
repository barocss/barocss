# Runtime API

BaroCSS provides a lightweight runtime for generating and injecting CSS in the browser.

## BrowserRuntime

```ts
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime(options?);
```

### Options
```ts
{
  config?: Config;              // Full BaroCSS config (theme, preflight, etc.)
  styleId?: string;             // ID of the style element (default: '@barocss/kit-runtime')
  insertionPoint?: 'head' | 'body' | HTMLElement; // Where to insert style partitions (default: 'head')
  maxRulesPerPartition?: number; // Max CSS rules per <style> partition (default: 50)
}
```

- config: See Configuration for `theme` and `preflight`. Preflight values: true | false | 'minimal' | 'standard' | 'full'.
- styleId: Prefix used when creating partitioned style elements.
- insertionPoint: Determines where style tags are appended. You can pass a specific HTMLElement.
- maxRulesPerPartition: Splits rules across multiple `<style>` tags to avoid large sheets.

### Methods

- addClass(classes: string | string[]): Process classes and inject CSS.
- removeClass(classes: string | string[]): Remove classes from runtime cache (does not remove injected CSS).
- getCss(cls: string): Get generated CSS for a single class.
- getAllCss(): Get all CSS currently cached by the runtime.
- getClasses(): Get an array of class names currently cached.
- clearCaches(): Clear runtime, AST, and incremental caches; remove style partitions.
- reset(): Clear runtime caches and style partitions without clearing global caches.
- updateConfig(newConfig: Config): Recreate context and reapply existing classes.
- destroy(): Cleanup style partitions and mark runtime as destroyed.
- getStats(): Retrieve runtime and cache statistics.

### observe
The runtime can watch the DOM and automatically process classes.

```ts
const observer = runtime.observe(document.body, {
  scan?: boolean;         // Perform an initial DOM scan and process existing class attributes
  onReady?: () => void;   // Callback invoked after initial scan is applied
});

// Later
observer.disconnect();
```

- scan: When true, runs a synchronous scan to process existing class names immediately before monitoring mutations.
- onReady: Invoked after layout-related results are applied during the initial scan.

## Notes
- The runtime is browser-only. For Node.js or server-side processing, use the core parser APIs directly.
- Removing a class from the runtime cache does not remove corresponding rules already injected into the DOM.
