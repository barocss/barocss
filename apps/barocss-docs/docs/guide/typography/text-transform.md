# text-transform

Utilities for controlling the capitalization of text.

## Quick reference

| Class         | Styles                       |
|---------------|------------------------------|
| `uppercase`   | `text-transform: uppercase;` |
| `lowercase`   | `text-transform: lowercase;` |
| `capitalize`  | `text-transform: capitalize;`|
| `normal-case` | `text-transform: none;`      |

Source: https://tailwindcss.com/docs/text-transform

## Examples

### Uppercase

Use the `uppercase` utility to transform text to uppercase:

```html
<p class="uppercase ...">The quick brown fox ...</p>
```

### Lowercase

Use the `lowercase` utility to transform text to lowercase:

```html
<p class="lowercase ...">The quick brown fox ...</p>
```

### Capitalize

Use the `capitalize` utility to transform text to capitalize:

```html
<p class="capitalize ...">The quick brown fox ...</p>
```

### Reset casing

Use the `normal-case` utility to reset text casing:

```html
<p class="normal-case ...">The quick brown fox ...</p>
```

### Responsive design

Prefix a `text-transform` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="capitalize md:uppercase ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.
