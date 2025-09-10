# transform-style

Utilities for controlling if an element's children are placed in 3D space.



## Quick reference

| Class            | Styles                         |
|------------------|--------------------------------|
| transform-3d     | transform-style: preserve-3d;  |
| transform-flat   | transform-style: flat;         |

## Examples

### Basic example

Use utilities like `transform-3d` and `transform-flat` to control whether an element's children are positioned in 3D space or flattened:

```html
<div class="size-20 transform-flat ...">
  <!-- ... -->
</div>
<div class="size-20 transform-3d ...">
  <!-- ... -->
</div>
```

Without `transform-3d`, children are transformed in 2D space only.

### Responsive design

Prefix a `transform-style` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="transform-3d md:transform-flat ...">
  <!-- ... -->
</div>
```

