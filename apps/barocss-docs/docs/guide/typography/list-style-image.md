# list-style-image

Utilities for controlling the image of a list item marker.

## Quick reference

| Class | Styles |
|-------|--------|
| `list-image-none` | `list-style-image: none;` |
| `list-image-(&lt;custom-property&gt;)` | `list-style-image: var(&lt;custom-property&gt;);` |
| `list-image-[&lt;value&gt;]` | `list-style-image: &lt;value&gt;;` |

## Examples

### Basic example

Use utilities like `list-image-none` to control the image of a list item marker:

```html
<ul class="list-image-none ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

### Using a custom value

Use the `list-image-[&lt;value&gt;]` syntax to set the list style image based on a completely custom value:

```html
<ul class="list-image-[url('/path/to/image.png')] ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

For CSS variables, you can also use the `list-image-(&lt;custom-property&gt;)` syntax:

```html
<ul class="list-image-(--my-image) ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```

This is just a shorthand for `list-image-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `list-style-image` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<ul class="list-image-none md:list-image-[url('/path/to/image.png')] ...">
  <li>First item</li>
  <li>Second item</li>
  <li>Third item</li>
</ul>
```



