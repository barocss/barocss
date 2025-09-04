# vertical-align

Utilities for controlling the vertical alignment of an inline or table-cell box.

## Quick reference

| Class              | Styles                         |
|--------------------|--------------------------------|
| `align-baseline`   | `vertical-align: baseline;`    |
| `align-top`        | `vertical-align: top;`         |
| `align-middle`     | `vertical-align: middle;`      |
| `align-bottom`     | `vertical-align: bottom;`      |
| `align-text-top`   | `vertical-align: text-top;`    |
| `align-text-bottom`| `vertical-align: text-bottom;` |
| `align-sub`        | `vertical-align: sub;`         |
| `align-super`      | `vertical-align: super;`       |
| `align-(<custom-property>)` | `vertical-align: var(<custom-property>);` |
| `align-[<value>]`  | `vertical-align: <value>;`     |

Source: https://tailwindcss.com/docs/vertical-align

## Examples

### Aligning to baseline

Use the `align-baseline` utility to align to the baseline:

```html
<span class="inline-block align-baseline ...">The quick brown fox...</span>
```

### Aligning to top

Use the `align-top` utility to align to the top:

```html
<span class="inline-block align-top ...">The quick brown fox...</span>
```

### Aligning to middle

Use the `align-middle` utility to align to the middle:

```html
<span class="inline-block align-middle ...">The quick brown fox...</span>
```

### Aligning to bottom

Use the `align-bottom` utility to align to the bottom:

```html
<span class="inline-block align-bottom ...">The quick brown fox...</span>
```

### Aligning to parent top/bottom

Use the `align-text-top` and `align-text-bottom` utilities to align to the parent's top and bottom:

```html
<span class="inline-block align-text-top ...">Top</span>
<span class="inline-block align-text-bottom ...">Bottom</span>
```

### Using a custom value

Use the `align-[<value>]` syntax to set the vertical alignment based on a completely custom value:

```html
<span class="align-[4px] ...">Lorem ipsum dolor sit amet...</span>
```

For CSS variables, you can also use the `align-(<custom-property>)` syntax:

```html
<span class="align-(--my-align) ...">Lorem ipsum dolor sit amet...</span>
```

This is just a shorthand for `align-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `vertical-align` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<span class="align-middle md:align-top ...">Lorem ipsum dolor sit amet...</span>
```

Learn more about using variants in the variants documentation.
