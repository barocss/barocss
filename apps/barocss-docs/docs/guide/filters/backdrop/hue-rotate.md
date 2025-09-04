# backdrop-filter: hue-rotate()

Utilities for applying backdrop hue-rotate filters to an element.

Source: https://tailwindcss.com/docs/backdrop-filter-hue-rotate

## Quick reference

- Presets like `backdrop-hue-rotate-15`, `backdrop-hue-rotate-30`, `backdrop-hue-rotate-60`, negative variants `-backdrop-hue-rotate-15`, etc.
- `backdrop-hue-rotate-[<angle>]`, `backdrop-hue-rotate-(<custom-property>)`

## Examples

### Basic example

Use utilities like `backdrop-hue-rotate-60` and `-backdrop-hue-rotate-15` to control the hue rotation of an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-hue-rotate-60 ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 -backdrop-hue-rotate-15 ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-hue-rotate-[<angle>]` syntax to set the backdrop hue rotation based on a completely custom value:

```html
<div class="backdrop-hue-rotate-[120deg] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-hue-rotate-(<custom-property>)` syntax:

```html
<div class="backdrop-hue-rotate-(--my-backdrop-hue) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-hue-rotate-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: hue-rotate()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-hue-rotate-15 md:backdrop-hue-rotate-60 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
