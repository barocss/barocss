# stroke

Utilities for styling the stroke of SVG elements.

Source: https://tailwindcss.com/docs/stroke

## Quick reference

| Class                    | Styles                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| stroke-none              | stroke: none;                                                      |
| stroke-inherit           | stroke: inherit;                                                    |
| stroke-current           | stroke: currentColor;                                               |
| stroke-transparent       | stroke: transparent;                                                |
| stroke-black             | stroke: var(--color-black); /* #000 */                            |
| stroke-white             | stroke: var(--color-white); /* #fff */                            |
| stroke-<custom-property> | stroke: var(<custom-property>);                                     |
| stroke-\[<color>\]       | stroke: <color>;                                                    |

## Examples

### Basic example

Use utilities like `stroke-indigo-500` and `stroke-lime-600` to change the stroke color of an SVG:

```html
<svg class="stroke-cyan-500 ...">
  <!-- ... -->
</svg>
```

This can be useful for styling icon sets like Heroicons.

### Using the current color

Use the `stroke-current` utility to set the stroke color to the current text color:

```html
<button class="bg-white text-pink-600 hover:bg-pink-600 hover:text-white ...">
  <svg class="size-5 stroke-current ..." fill="none">
    <!-- ... -->
  </svg>
  Download file
</button>
```

### Using a custom value

Use the `stroke-[<value>]` syntax to set the stroke color based on a completely custom value:

```html
<svg class="stroke-[#243c5a] ...">
  <!-- ... -->
</svg>
```

For CSS variables, you can also use the `stroke-(<custom-property>)` syntax:

```html
<svg class="stroke-(--my-stroke-color) ...">
  <!-- ... -->
</svg>
```

This is just a shorthand for `stroke-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `stroke` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<svg class="stroke-cyan-500 md:stroke-cyan-700 ...">
  <!-- ... -->
</svg>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

Use the `--color-*` theme variables to customize the color utilities in your project:

```css
@theme {
  --color-regal-blue: #243c5a;
}
```

Now the `stroke-regal-blue` utility can be used in your markup:

```html
<svg class="stroke-regal-blue">
  <!-- ... -->
</svg>
```

Learn more about customizing your theme in the theme documentation.
