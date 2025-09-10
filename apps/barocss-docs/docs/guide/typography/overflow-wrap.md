# overflow-wrap

Utilities for controlling line breaks within words in an overflowing element.

## Quick reference

| Class             | Styles                         |
|-------------------|--------------------------------|
| `wrap-break-word` | `overflow-wrap: break-word;`   |
| `wrap-anywhere`   | `overflow-wrap: anywhere;`     |
| `wrap-normal`     | `overflow-wrap: normal;`       |



## Examples

### Wrapping mid-word

Use the `wrap-break-word` utility to break words at arbitrary points:

```html
<p class="wrap-break-word ...">The longest word in any of the major...</p>
```

### Wrapping anywhere

Use the `wrap-anywhere` utility to break words at any character:

```html
<div class="wrap-anywhere ...">
  <p>Jay Riemenschneider</p>
  <p>jason.riemenschneider@vandelayindustries.com</p>
</div>
```

### Wrapping normally

Use the `wrap-normal` utility to use the default line breaking rules:

```html
<p class="wrap-normal ...">The longest word in any of the major...</p>
```

### Responsive design

Prefix an `overflow-wrap` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="wrap-normal md:wrap-break-word ...">Lorem ipsum dolor sit amet...</p>
```

