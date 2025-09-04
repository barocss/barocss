# text-indent

Utilities for controlling the amount of empty space shown before text in a block.

## Quick reference

| Class              | Styles                                            |
|--------------------|---------------------------------------------------|
| `indent-<number>`  | `text-indent: calc(var(--spacing) * <number>)`    |
| `-indent-<number>` | `text-indent: calc(var(--spacing) * -<number>)`   |
| `indent-px`        | `text-indent: 1px;`                                |
| `-indent-px`       | `text-indent: -1px;`                               |
| `indent-(<custom-property>)` | `text-indent: var(<custom-property>);`   |
| `indent-[<value>]` | `text-indent: <value>;`                            |

Source: https://tailwindcss.com/docs/text-indent

## Examples

### Basic example

Use utilities like `indent-8` to control the amount of empty space shown before text in a block:

```html
<p class="indent-8 ...">So I started to walk into the water...</p>
```

### Using negative values

Use negative values to create a hanging indent:

```html
<p class="-indent-8 ...">So I started to walk into the water...</p>
```

### Using a custom value

Use the `indent-[<value>]` syntax to set the text indent based on a completely custom value:

```html
<p class="indent-[50%] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `indent-(<custom-property>)` syntax:

```html
<p class="indent-(--my-indent) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `indent-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `text-indent` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="indent-4 md:indent-8 ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.
