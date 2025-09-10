# white-space

Utilities for controlling an element's white-space property.

## Quick reference

| Class                   | Styles                      |
|-------------------------|-----------------------------|
| `whitespace-normal`     | `white-space: normal;`      |
| `whitespace-nowrap`     | `white-space: nowrap;`      |
| `whitespace-pre`        | `white-space: pre;`         |
| `whitespace-pre-line`   | `white-space: pre-line;`    |
| `whitespace-pre-wrap`   | `white-space: pre-wrap;`    |
| `whitespace-break-spaces` | `white-space: break-spaces;` |



## Examples

### Normal

Use the `whitespace-normal` utility to collapse sequences of whitespace:

```html
<p class="whitespace-normal ...">Hey everyone!\n\nIt's almost 2022 ...</p>
```

### No Wrap

Use the `whitespace-nowrap` utility to prevent text from wrapping:

```html
<p class="overflow-auto whitespace-nowrap ...">Hey everyone! ...</p>
```

### Pre

Use the `whitespace-pre` utility to preserve sequences of whitespace:

```html
<p class="overflow-auto whitespace-pre ...">Hey everyone!\n\nIt's almost 2022 ...</p>
```

### Pre Line

Use the `whitespace-pre-line` utility to preserve sequences of whitespace but allow text to wrap:

```html
<p class="whitespace-pre-line ...">Hey everyone!\n\nIt's almost 2022 ...</p>
```

### Pre Wrap

Use the `whitespace-pre-wrap` utility to preserve sequences of whitespace and allow text to wrap:

```html
<p class="whitespace-pre-wrap ...">Hey everyone!\n\nIt's almost 2022 ...</p>
```

### Break Spaces

Use the `whitespace-break-spaces` utility to preserve sequences of whitespace and allow text to wrap, but break on any character:

```html
<p class="whitespace-break-spaces ...">Hey everyone!\n\nIt's almost 2022 ...</p>
```

### Responsive design

Prefix a `white-space` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="whitespace-pre md:whitespace-normal ...">Lorem ipsum dolor sit amet...</p>
```

