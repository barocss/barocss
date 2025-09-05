# color-scheme

Utilities for controlling the color scheme of an element.

Source: https://tailwindcss.com/guide/color-scheme

## Quick reference

| Class               | Styles                    |
|---------------------|---------------------------|
| scheme-normal       | color-scheme: normal;     |
| scheme-dark         | color-scheme: dark;       |
| scheme-light        | color-scheme: light;      |
| scheme-light-dark   | color-scheme: light dark; |
| scheme-only-dark    | color-scheme: only dark;  |
| scheme-only-light   | color-scheme: only light; |

## Examples

### Basic example

Use utilities like `scheme-light` and `scheme-dark` to control the color scheme of form controls:

```html
<div class="scheme-light ...">
  <input type="date" />
</div>
<div class="scheme-dark ...">
  <input type="date" />
</div>
<div class="scheme-light-dark ...">
  <input type="date" />
</div>
```

### Applying in dark mode

Use the `dark:` variant to apply different color schemes in dark mode:

```html
<html class="dark:scheme-dark scheme-light ...">
  <!-- ... -->
</html>
```

### Responsive design

Prefix a `color-scheme` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="scheme-light md:scheme-dark ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
