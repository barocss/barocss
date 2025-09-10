# mask-mode

Utilities for controlling an element's mask mode.

## Quick reference

| Class            | Styles                  |
|------------------|-------------------------|
| `mask-alpha`     | `mask-mode: alpha;`     |
| `mask-luminance` | `mask-mode: luminance;` |
| `mask-match`     | `mask-mode: match-source;` |



## Examples

### Basic example

Use utilities like `mask-alpha` and `mask-luminance` to control an element's mask mode:

```html
<div class="mask-alpha mask-r-from-black mask-r-from-50% mask-r-to-transparent bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-luminance mask-r-from-white mask-r-from-50% mask-r-to-black bg-[url(/img/mountains.jpg)] ..."></div>
```

### Responsive design

Prefix a `mask-mode` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="mask-alpha md:mask-luminance">
  <!-- ... -->
</div>
```

