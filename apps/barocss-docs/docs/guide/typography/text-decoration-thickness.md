# text-decoration-thickness

Utilities for controlling the thickness of text decorations.

## Quick reference

| Class                      | Styles                                      |
|----------------------------|---------------------------------------------|
| `decoration-&lt;number&gt;`      | `text-decoration-thickness: &lt;number&gt;px;`    |
| `decoration-from-font`     | `text-decoration-thickness: from-font;`     |
| `decoration-auto`          | `text-decoration-thickness: auto;`          |
| `decoration-(length:&lt;custom-property&gt;)` | `text-decoration-thickness: var(&lt;custom-property&gt;);` |
| `decoration-[&lt;value&gt;]`     | `text-decoration-thickness: &lt;value&gt;;`       |


## Examples

### Basic example

Use utilities like `decoration-1` and `decoration-4` to control the thickness of text decorations:

```html
<p class="underline decoration-1 ...">The quick brown fox...</p>
<p class="underline decoration-2 ...">The quick brown fox...</p>
<p class="underline decoration-4 ...">The quick brown fox...</p>
```

### Using a custom value

Use the `decoration-[&lt;value&gt;]` syntax to set the text decoration thickness based on a completely custom value:

```html
<p class="underline decoration-[0.25rem] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `decoration-(length:&lt;custom-property&gt;)` syntax:

```html
<p class="underline decoration-(length:--my-thickness) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `decoration-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `text-decoration-thickness` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="underline md:decoration-4 ...">Lorem ipsum dolor sit amet...</p>
```

