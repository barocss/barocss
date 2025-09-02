# Theme variables

BaroCSS exposes CSS variables derived from your theme.

```ts
const vars = runtime['context']?.themeToCssVars?.();
```

Use them in your CSS:

```css
:root {
  /* injected by runtime */
}

.button {
  color: var(--barocss-colors-blue-500);
}
```
