# Colors

Use color utilities for text, background, borders, and more.

```html
<div class="text-blue-600 bg-blue-50 border border-blue-200"></div>
```

Customize via theme:

```ts
new BrowserRuntime({
  config: {
    theme: {
      colors: { custom: { 500: '#7c3aed' } }
    }
  }
});
```
