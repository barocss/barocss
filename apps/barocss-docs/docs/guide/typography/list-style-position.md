# list-style-position

Utilities for controlling the position of a list item marker.

## Quick reference

| Class | Styles |
|-------|--------|
| `list-inside` | `list-style-position: inside;` |
| `list-outside` | `list-style-position: outside;` |

## Examples

### Inside

Use the `list-inside` utility to position the list item marker inside the content flow:

```html
<ul class="list-inside ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

### Outside

Use the `list-outside` utility to position the list item marker outside the content flow:

```html
<ul class="list-outside ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

### Responsive design

Prefix a `list-style-position` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<ul class="list-inside md:list-outside ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```



