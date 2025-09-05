# background-attachment

Utilities for controlling how a background image behaves when scrolling.

## Quick reference

| Class | Styles |
|---|---|
| `bg-fixed` | `background-attachment: fixed;` |
| `bg-local` | `background-attachment: local;` |
| `bg-scroll` | `background-attachment: scroll;` |

Source: https://tailwindcss.com/guide/background-attachment

## Examples

### Fixing the background image

Use the `bg-fixed` utility to fix the background image relative to the viewport:

```html
<!-- [!code classes:bg-fixed] -->
<div class="bg-[url(/img/mountains.jpg)] bg-fixed ...">
  <!-- ... -->
</div>
```

### Scrolling with the container

Use the `bg-local` utility to scroll the background image with the container and the viewport:

```html
<!-- [!code classes:bg-local] -->
<div class="bg-[url(/img/mountains.jpg)] bg-local ...">
  <!-- ... -->
</div>
```

### Scrolling with the viewport

Use the `bg-scroll` utility to scroll the background image with the viewport, but not with the container:

```html
<!-- [!code classes:bg-scroll] -->
<div class="bg-[url(/img/mountains.jpg)] bg-scroll ...">
  <!-- ... -->
</div>
```

### Responsive design

Prefix a `background-attachment` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="bg-local md:bg-fixed ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
