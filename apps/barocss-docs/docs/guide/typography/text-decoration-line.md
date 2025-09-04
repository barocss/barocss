# text-decoration-line

Utilities for controlling the decoration of text.

## Quick reference

| Class          | Styles                             |
|----------------|------------------------------------|
| `underline`    | `text-decoration-line: underline;` |
| `overline`     | `text-decoration-line: overline;`  |
| `line-through` | `text-decoration-line: line-through;` |
| `no-underline` | `text-decoration-line: none;`      |

Source: https://tailwindcss.com/docs/text-decoration-line

## Examples

### Underlining text

Use the `underline` utility to underline text:

```html
<p class="underline ...">The quick brown fox...</p>
```

### Overline

Use the `overline` utility to add an overline to text:

```html
<p class="overline ...">The quick brown fox...</p>
```

### Line-through

Use the `line-through` utility to add a line through text:

```html
<p class="line-through ...">The quick brown fox...</p>
```

### Remove decoration

Use the `no-underline` utility to remove text decoration:

```html
<p class="no-underline ...">The quick brown fox...</p>
```

### Applying on hover

Prefix a `text-decoration-line` utility with a variant like `hover:*` to only apply the utility in that state:

```html
<a class="no-underline hover:underline ...">quick brown fox</a>
```

Learn more about using variants in the variants documentation.

### Responsive design

Prefix a `text-decoration-line` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<a class="no-underline md:underline ...">Lorem ipsum dolor sit amet...</a>
```

Learn more about using variants in the variants documentation.
