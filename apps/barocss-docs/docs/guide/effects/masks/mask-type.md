# mask-type

Utilities for controlling how an SVG mask is interpreted.

## Quick reference

| Class               | Styles                  |
|---------------------|-------------------------|
| `mask-type-alpha`   | `mask-type: alpha;`     |
| `mask-type-luminance` | `mask-type: luminance;` |

Source: https://tailwindcss.com/docs/mask-type

## Examples

### Basic example

```html
<svg>
  <mask id="blob1" class="mask-type-alpha fill-gray-700/70">
    <path d="..."></path>
  </mask>
  <image href="/img/mountains.jpg" height="100%" width="100%" mask="url(#blob1)" />
</svg>

<svg>
  <mask id="blob2" class="mask-type-luminance fill-gray-700/70">
    <path d="..."></path>
  </mask>
  <image href="/img/mountains.jpg" height="100%" width="100%" mask="url(#blob2)" />
</svg>
```

### Responsive design

Prefix a `mask-type` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<mask class="mask-type-alpha md:mask-type-luminance">
  <!-- ... -->
</mask>
```

Learn more about using variants in the variants documentation.
