# mask-origin

Utilities for controlling how an element's mask image is positioned relative to borders, padding, and content.

## Quick reference

| Class               | Styles                    |
|---------------------|---------------------------|
| `mask-origin-border`  | `mask-origin: border-box;`  |
| `mask-origin-padding` | `mask-origin: padding-box;` |
| `mask-origin-content` | `mask-origin: content-box;` |
| `mask-origin-fill`    | `mask-origin: fill-box;`    |
| `mask-origin-stroke`  | `mask-origin: stroke-box;`  |
| `mask-origin-view`    | `mask-origin: view-box;`    |

Source: https://tailwindcss.com/docs/mask-origin

## Examples

### Basic example

Use utilities like `mask-origin-border` and `mask-origin-padding` to control how an element's mask image is positioned relative to borders, padding, and content:

```html
<div class="mask-origin-border border-3 p-1.5 mask-[url(/img/circle.png)] bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-origin-padding border-3 p-1.5 mask-[url(/img/circle.png)] bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-origin-content border-3 p-1.5 mask-[url(/img/circle.png)] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Responsive design

Prefix a `mask-origin` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="mask-origin-border md:mask-origin-padding">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
