# backdrop-filter

Utilities for applying backdrop filters to an element.

## Quick reference

| Class | Styles |
|---|---|
| `backdrop-filter-none` | `backdrop-filter: none;` |
| `backdrop-filter-(&lt;custom-property&gt;)` | `backdrop-filter: var(&lt;custom-property&gt;);` |
| `backdrop-filter-[&lt;value&gt;]` | `backdrop-filter: &lt;value&gt;;` |

## Examples

### Basic example

Use utilities like `backdrop-blur-xs` and `backdrop-grayscale` to apply filters to an element's backdrop:

```html
<!-- [!code classes:backdrop-blur-xs,backdrop-grayscale] -->
<div class="bg-[url(/img/mountains.jpg)] ...">
  <div class="backdrop-blur-xs ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)] ...">
  <div class="backdrop-grayscale ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)] ...">
  <div class="backdrop-blur-xs backdrop-grayscale ..."></div>
</div>
```

You can combine the following backdrop filter utilities: blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate, and sepia.

### Removing filters

Use the `backdrop-filter-none` utility to remove all of the backdrop filters applied to an element:

```html
<!-- [!code classes:md:backdrop-filter-none] -->
<div class="backdrop-blur-md backdrop-brightness-150 md:backdrop-filter-none"></div>
```

### Using a custom value

Use the `backdrop-filter-[&lt;value&gt;]` syntax to set the backdrop filter based on a completely custom value:

```html
<div class="backdrop-filter-[url('filters.svg#filter-id')] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-filter-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-filter-(--my-backdrop-filter) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-filter-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Applying on hover

Prefix a `backdrop-filter` utility with a variant like `hover:*` to only apply the utility in that state:

```html
<div class="backdrop-blur-sm hover:backdrop-filter-none ...">
  <!-- ... -->
</div>
```


### Responsive design

Prefix a `backdrop-filter` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-blur-sm md:backdrop-filter-none ...">
  <!-- ... -->
</div>
```


See also:
- Blur: /guide/filters/backdrop/blur
- Brightness: /guide/filters/backdrop/brightness
- Contrast: /guide/filters/backdrop/contrast
- Grayscale: /guide/filters/backdrop/grayscale
- Hue Rotate: /guide/filters/backdrop/hue-rotate
- Invert: /guide/filters/backdrop/invert
- Opacity: /guide/filters/backdrop/opacity
- Saturate: /guide/filters/backdrop/saturate
- Sepia: /guide/filters/backdrop/sepia
