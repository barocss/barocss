# text-underline-offset

Utilities for controlling the offset of a text underline.

## Quick reference

| Class                       | Styles                                   |
|-----------------------------|------------------------------------------|
| `underline-offset-<number>` | `text-underline-offset: <number>px;`     |
| `-underline-offset-<number>`| `text-underline-offset: calc(<number>px * -1);` |
| `underline-offset-auto`     | `text-underline-offset: auto;`           |
| `underline-offset-(<custom-property>)` | `text-underline-offset: var(<custom-property>);` |
| `underline-offset-[<value>]`| `text-underline-offset: <value>;`        |

Source: https://tailwindcss.com/docs/text-underline-offset

## Examples

### Basic example

Use utilities like `underline-offset-1` and `underline-offset-4` to control the offset of a text underline:

```html
<p class="underline underline-offset-1 ...">The quick brown fox...</p>
<p class="underline underline-offset-2 ...">The quick brown fox...</p>
<p class="underline underline-offset-4 ...">The quick brown fox...</p>
<p class="underline underline-offset-8 ...">The quick brown fox...</p>
```

### Using a custom value

Use the `underline-offset-[<value>]` syntax to set the text underline offset based on a completely custom value:

```html
<p class="underline underline-offset-[3px] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `underline-offset-(<custom-property>)` syntax:

```html
<p class="underline underline-offset-(--my-offset) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `underline-offset-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `text-underline-offset` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="underline md:underline-offset-4 ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.
