# text-align

Utilities for controlling the alignment of text.

## Quick reference

| Class         | Styles                  |
|---------------|-------------------------|
| `text-left`   | `text-align: left;`     |
| `text-center` | `text-align: center;`   |
| `text-right`  | `text-align: right;`    |
| `text-justify`| `text-align: justify;`  |
| `text-start`  | `text-align: start;`    |
| `text-end`    | `text-align: end;`      |

Source: https://tailwindcss.com/docs/text-align

## Examples

### Left aligning text

Use the `text-left` utility to align text to the left:

```html
<p class="text-left ...">So I started to walk into the water...</p>
```

### Right aligning text

Use the `text-right` utility to align text to the right:

```html
<p class="text-right ...">So I started to walk into the water...</p>
```

### Centering text

Use the `text-center` utility to center text:

```html
<p class="text-center ...">So I started to walk into the water...</p>
```

### Justifying text

Use the `text-justify` utility to justify text:

```html
<p class="text-justify ...">So I started to walk into the water...</p>
```

### Using logical properties

Use the `text-start` and `text-end` utilities to align text using logical properties:

```html
<p class="text-start ...">So I started to walk into the water...</p>
<p class="text-end ...">So I started to walk into the water...</p>
```

### Responsive design

Prefix a `text-align` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="text-left md:text-center ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.
