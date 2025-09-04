# text-decoration-thickness

Utilities for controlling the thickness of text decorations.

## Quick reference

| Class                      | Styles                                      |
|----------------------------|---------------------------------------------|
| `decoration-<number>`      | `text-decoration-thickness: <number>px;`    |
| `decoration-from-font`     | `text-decoration-thickness: from-font;`     |
| `decoration-auto`          | `text-decoration-thickness: auto;`          |
| `decoration-(length:<custom-property>)` | `text-decoration-thickness: var(<custom-property>);` |
| `decoration-[<value>]`     | `text-decoration-thickness: <value>;`       |

Source: https://tailwindcss.com/docs/text-decoration-thickness

## Examples

### Basic example

Use utilities like `decoration-1` and `decoration-4` to control the thickness of text decorations:

```html
<p class="underline decoration-1 ...">The quick brown fox...</p>
<p class="underline decoration-2 ...">The quick brown fox...</p>
<p class="underline decoration-4 ...">The quick brown fox...</p>
```

### Using a custom value

Use the `decoration-[<value>]` syntax to set the text decoration thickness based on a completely custom value:

```html
<p class="underline decoration-[0.25rem] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `decoration-(length:<custom-property>)` syntax:

```html
<p class="underline decoration-(length:--my-thickness) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `decoration-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `text-decoration-thickness` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="underline md:decoration-4 ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.
