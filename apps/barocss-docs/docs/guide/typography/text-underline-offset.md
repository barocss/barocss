# text-underline-offset

Utilities for controlling the offset of a text underline.

## Quick reference

| Class                       | Styles                                   |
|-----------------------------|------------------------------------------|
| `underline-offset-&lt;number&gt;` | `text-underline-offset: &lt;number&gt;px;`     |
| `-underline-offset-&lt;number&gt;`| `text-underline-offset: calc(&lt;number&gt;px * -1);` |
| `underline-offset-auto`     | `text-underline-offset: auto;`           |
| `underline-offset-(&lt;custom-property&gt;)` | `text-underline-offset: var(&lt;custom-property&gt;);` |
| `underline-offset-[&lt;value&gt;]`| `text-underline-offset: &lt;value&gt;;`        |

Source: https://tailwindcss.com/guide/text-underline-offset

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

Use the `underline-offset-[&lt;value&gt;]` syntax to set the text underline offset based on a completely custom value:

```html
<p class="underline underline-offset-[3px] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `underline-offset-(&lt;custom-property&gt;)` syntax:

```html
<p class="underline underline-offset-(--my-offset) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `underline-offset-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `text-underline-offset` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="underline md:underline-offset-4 ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.
