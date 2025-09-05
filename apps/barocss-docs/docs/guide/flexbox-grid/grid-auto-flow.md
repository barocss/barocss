# grid-auto-flow

Utilities for controlling how elements in a grid are auto-placed.

## Quick reference

| Class                 | Styles                     |
|-----------------------|----------------------------|
| `grid-flow-row`       | `grid-auto-flow: row;`     |
| `grid-flow-col`       | `grid-auto-flow: column;`  |
| `grid-flow-dense`     | `grid-auto-flow: dense;`   |
| `grid-flow-row-dense` | `grid-auto-flow: row dense;` |
| `grid-flow-col-dense` | `grid-auto-flow: column dense;` |

Source: https://tailwindcss.com/guide/grid-auto-flow

## Examples

### Basic example

```html
<div class="grid grid-flow-row-dense grid-cols-3 grid-rows-3 ...">
  <div class="col-span-2">01</div>
  <div class="col-span-2">02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
</div>
```

### Responsive design

Prefix a `grid-auto-flow` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grid grid-flow-col md:grid-flow-row ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
