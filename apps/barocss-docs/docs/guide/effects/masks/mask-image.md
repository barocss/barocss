# mask-image

Utilities for controlling an element's mask image.

## Quick reference

- `mask-[<value>]`, `mask-(<var>)`, `mask-none`
- Linear: `mask-linear-<angle>`, `mask-linear-from-*`, `mask-linear-to-*`
- Side masks: `mask-t/r/b/l-from-*`, `mask-t/r/b/l-to-*`, `mask-x/y-from-*`, `mask-x/y-to-*`
- Radial: `mask-radial-[<value>]`, size/pos modifiers, `mask-circle`, `mask-ellipse`
- Conic: `mask-conic-<angle>`, `mask-conic-from-*`, `mask-conic-to-*`

Source: https://tailwindcss.com/docs/mask-image

## Examples

### Using an image mask

```html
<div class="mask-[url(/img/scribble.png)] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Masking edges

```html
<div class="mask-t-from-50% bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-r-from-30% bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-l-from-50% mask-l-to-90% bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-b-from-20% mask-b-to-80% bg-[url(/img/mountains.jpg)] ..."></div>
```

### Two sides at once

```html
<div class="mask-x-from-70% mask-x-to-90% bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-y-from-70% mask-y-to-90% bg-[url(/img/mountains.jpg)] ..."></div>
```

### Angled linear mask

```html
<div class="mask-linear-50 mask-linear-from-60% mask-linear-to-80% bg-[url(/img/mountains.jpg)] ..."></div>
<div class="-mask-linear-50 mask-linear-from-60% mask-linear-to-80% bg-[url(/img/mountains.jpg)] ..."></div>
```

### Radial masks

```html
<div class="mask-radial-at-top-left mask-radial-from-100% bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-radial-closest-side mask-radial-from-100% mask-radial-at-[30%_30%] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Conic mask

```html
<div class="mask-conic-from-75% mask-conic-to-75% ..."></div>
```

### Removing mask images

```html
<div class="mask-none"></div>
```

### Responsive design

Prefix a `mask-image` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="mask-radial-from-70% md:mask-radial-from-50%">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

Use the `--mask-*` theme variables to customize the mask image utilities in your project:

```css
@theme {
  --mask-custom: url('/img/custom-mask.png');
}
```

Now the `mask-custom` utility can be used in your markup:

```html
<div class="mask-custom">
  <!-- ... -->
</div>
```

Learn more about customizing your theme in the theme documentation.
