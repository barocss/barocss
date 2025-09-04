# background-origin

Utilities for controlling how an element's background is positioned relative to borders, padding, and content.

## Quick reference

| Class | Styles |
|---|---|
| `bg-origin-border` | `background-origin: border-box;` |
| `bg-origin-padding` | `background-origin: padding-box;` |
| `bg-origin-content` | `background-origin: content-box;` |

Source: https://tailwindcss.com/docs/background-origin

## Examples

### Basic example

Use the `bg-origin-border`, `bg-origin-padding`, and `bg-origin-content` utilities to control where an element's background is rendered:

```html
<!-- [!code classes:bg-origin-border,bg-origin-padding,bg-origin-content] -->
<div class="border-4 bg-[url(/img/mountains.jpg)] bg-origin-border p-3 ..."></div>
<div class="border-4 bg-[url(/img/mountains.jpg)] bg-origin-padding p-3 ..."></div>
<div class="border-4 bg-[url(/img/mountains.jpg)] bg-origin-content p-3 ..."></div>
```

### Responsive design

Prefix a `background-origin` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="bg-origin-border md:bg-origin-padding ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
