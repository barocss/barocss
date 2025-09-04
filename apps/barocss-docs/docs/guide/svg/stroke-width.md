# stroke-width

Utilities for styling the stroke width of SVG elements.

Source: https://tailwindcss.com/docs/stroke-width

## Quick reference

| Class | Styles |
|---|---|
| stroke-<number> | stroke-width: <number>; |
| stroke-(length:<custom-property>) | stroke-width: var(<custom-property>); |
| stroke-[<value>] | stroke-width: <value>; |

## Examples

### Basic example

Use `stroke-<number>` utilities like `stroke-1` and `stroke-2` to set the stroke width of an SVG:

```html
<svg class="stroke-1 ...">
  <!-- ... -->
</svg>
<svg class="stroke-2 ...">
  <!-- ... -->
</svg>
```

This can be useful for styling icon sets like Heroicons.

### Using a custom value

Use the `stroke-[<value>]` syntax to set the stroke width based on a completely custom value:

```html
<svg class="stroke-[1.5] ...">
  <!-- ... -->
</svg>
```

For CSS variables, you can also use the `stroke-(length:<custom-property>)` syntax:

```html
<svg class="stroke-(length:--my-stroke-width) ...">
  <!-- ... -->
</svg>
```

This is just a shorthand for `stroke-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `stroke-width` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<svg class="stroke-1 md:stroke-2 ...">
  <!-- ... -->
</svg>
```

Learn more about using variants in the variants documentation.
