# break-inside

Utilities for controlling how a column or page should break within an element.

## Quick reference

| Class                     | Styles                      |
|---------------------------|-----------------------------|
| `break-inside-auto`       | `break-inside: auto;`       |
| `break-inside-avoid`      | `break-inside: avoid;`      |
| `break-inside-avoid-page` | `break-inside: avoid-page;` |
| `break-inside-avoid-column` | `break-inside: avoid-column;` |


## Examples

### Basic example

Use utilities like `break-inside-avoid-column` to control how a column or page should break within an element:

```html
<div class="columns-2 ...">
  <p>Well, let me tell you something, ...</p>
  <p class="break-inside-avoid-column ...">Sure, go ahead, laugh...</p>
  <p>Maybe we can live without...</p>
  <p>Look. If you think this is...</p>
</div>
```

### Responsive design

Prefix a `break-inside` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="break-inside-avoid-column md:break-inside-auto ...">Lorem ipsum dolor sit amet...</div>
```

