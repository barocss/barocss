# break-after

Utilities for controlling how a column or page should break after an element.

## Quick reference

| Class                 | Styles                  |
|-----------------------|-------------------------|
| `break-after-auto`    | `break-after: auto;`    |
| `break-after-avoid`   | `break-after: avoid;`   |
| `break-after-all`     | `break-after: all;`     |
| `break-after-avoid-page` | `break-after: avoid-page;` |
| `break-after-page`    | `break-after: page;`    |
| `break-after-left`    | `break-after: left;`    |
| `break-after-right`   | `break-after: right;`   |
| `break-after-column`  | `break-after: column;`  |

Source: https://tailwindcss.com/docs/break-after

## Examples

### Basic example

Use utilities like `break-after-column` to control how a column or page should break after an element:

```html
<div class="columns-2 ...">
  <p>Well, let me tell you something, ...</p>
  <p class="break-after-column ...">Sure, go ahead, laugh...</p>
  <p>Maybe we can live without...</p>
  <p>Look. If you think this is...</p>
</div>
```

### Responsive design

Prefix a `break-after` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="break-after-column md:break-after-auto ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
