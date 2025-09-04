# box-sizing

Utilities for controlling how the browser should calculate an element's total size.

## Quick reference

| Class         | Styles                   |
|---------------|--------------------------|
| `box-border`  | `box-sizing: border-box;`|
| `box-content` | `box-sizing: content-box;`|

Source: https://tailwindcss.com/docs/box-sizing

## Examples

### Including borders and padding

Use the `box-border` utility to include borders and padding in the element's total size:

```html
<div class="box-border size-32 border-4 p-4 ..."></div>
```

### Excluding borders and padding

Use the `box-content` utility to exclude borders and padding from the element's total size:

```html
<div class="box-content size-32 border-4 p-4 ..."></div>
```

### Responsive design

Prefix a `box-sizing` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="box-content md:box-border ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
