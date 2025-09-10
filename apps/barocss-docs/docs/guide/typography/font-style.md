# font-style

Utilities for controlling the style of text.

## Quick reference

| Class | Styles |
|-------|--------|
| `italic` | `font-style: italic;` |
| `not-italic` | `font-style: normal;` |

## Examples

### Italicizing text

Use the `italic` utility to make text italic:

The quick brown fox jumps over the lazy dog.

```html
<p class="italic ...">The quick brown fox ...</p>
```

### Displaying text normally

Use the `not-italic` utility to display text normally:

The quick brown fox jumps over the lazy dog.

```html
<p class="not-italic ...">The quick brown fox ...</p>
```

### Responsive design

Prefix a `font-style` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="italic md:not-italic ...">Lorem ipsum dolor sit amet...</p>
```



