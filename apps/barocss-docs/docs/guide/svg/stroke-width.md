# stroke-width

Utilities for styling the stroke width of SVG elements.

Source: https://tailwindcss.com/guide/stroke-width

## Quick reference

| Class | Styles |
|---|---|
| stroke-&lt;number&gt; | stroke-width: &lt;number&gt;; |
| stroke-(length:&lt;custom-property&gt;) | stroke-width: var(&lt;custom-property&gt;); |
| stroke-[&lt;value&gt;] | stroke-width: &lt;value&gt;; |

## Examples

### Basic example

Use `stroke-&lt;number&gt;` utilities like `stroke-1` and `stroke-2` to set the stroke width of an SVG:

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

Use the `stroke-[&lt;value&gt;]` syntax to set the stroke width based on a completely custom value:

```html
<svg class="stroke-[1.5] ...">
  <!-- ... -->
</svg>
```

For CSS variables, you can also use the `stroke-(length:&lt;custom-property&gt;)` syntax:

```html
<svg class="stroke-(length:--my-stroke-width) ...">
  <!-- ... -->
</svg>
```

This is just a shorthand for `stroke-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `stroke-width` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<svg class="stroke-1 md:stroke-2 ...">
  <!-- ... -->
</svg>
```

Learn more about using variants in the variants documentation.
