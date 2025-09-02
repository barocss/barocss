# Adding custom styles

Use CSS alongside utilities for bespoke styles.

```css
.button-primary {
  @apply px-4 py-2 rounded bg-blue-600 text-white; /* if @apply is supported */
}
```

Or compose with variables:

```css
:root {
  /* runtime injects theme variables */
}
.card {
  box-shadow: var(--barocss-shadows-md);
}
```
