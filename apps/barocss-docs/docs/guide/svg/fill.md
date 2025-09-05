# fill

Utilities for styling the fill of SVG elements.

Source: https://tailwindcss.com/guide/fill

## Quick reference

| Class                    | Styles                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| fill-none                | fill: none;                                                        |
| fill-inherit             | fill: inherit;                                                     |
| fill-current             | fill: currentColor;                                                |
| fill-transparent         | fill: transparent;                                                 |
| fill-black               | fill: var(--color-black); /* #000 */                             |
| fill-white               | fill: var(--color-white); /* #fff */                             |
| fill-&lt;custom-property&gt;   | fill: var(&lt;custom-property&gt;);                                      |
| fill-\[&lt;color&gt;\]         | fill: &lt;color&gt;;                                                     |

## Examples

### Basic example

Use utilities like `fill-indigo-500` and `fill-lime-600` to change the fill color of an SVG:

```html
<svg class="fill-blue-500 ...">
  <!-- ... -->
</svg>
```

This can be useful for styling icon sets like Heroicons.

### Using the current color

Use the `fill-current` utility to set the fill color to the current text color:

Hover over the button to see the fill color change

Check for updates

```html
<button class="bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white ...">
  <svg class="size-5 fill-current ...">
    <!-- ... -->
  </svg>
  Check for updates
</button>
```

### Using a custom value

Use the `fill-[&lt;value&gt;]` syntax to set the fill color based on a completely custom value:

```html
<svg class="fill-[#243c5a] ...">
  <!-- ... -->
</svg>
```

For CSS variables, you can also use the `fill-(&lt;custom-property&gt;)` syntax:

```html
<svg class="fill-(--my-fill-color) ...">
  <!-- ... -->
</svg>
```

This is just a shorthand for `fill-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `fill` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<svg class="fill-cyan-500 md:fill-cyan-700 ...">
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

Now the `fill-regal-blue` utility can be used in your markup:

```html
<svg class="fill-regal-blue">
  <!-- ... -->
</svg>
```

Learn more about customizing your theme in the theme documentation.
