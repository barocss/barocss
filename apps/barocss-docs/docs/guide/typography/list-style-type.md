# list-style-type

Utilities for controlling the type of a list item marker.

## Quick reference

| Class | Styles |
|-------|--------|
| `list-none` | `list-style-type: none;` |
| `list-disc` | `list-style-type: disc;` |
| `list-decimal` | `list-style-type: decimal;` |

## Examples

### None

Use the `list-none` utility to remove the list item marker:

```html
<ul class="list-none ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

### Disc

Use the `list-disc` utility to set the list item marker to a disc:

```html
<ul class="list-disc ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

### Decimal

Use the `list-decimal` utility to set the list item marker to a decimal number:

```html
<ol class="list-decimal ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ol>
```

### Responsive design

Prefix a `list-style-type` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<ul class="list-none md:list-disc ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

Learn more about using variants in the variants documentation.


