# backdrop-filter: sepia()

Utilities for applying backdrop sepia filters to an element.

Source: https://tailwindcss.com/docs/backdrop-filter-sepia

## Quick reference

- `backdrop-sepia`, `backdrop-sepia-0`, `backdrop-sepia-[<value>]`, `backdrop-sepia-(<custom-property>)`

## Examples

### Basic example

Use utilities like `backdrop-sepia` and `backdrop-sepia-0` to control the sepia effect of an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-sepia ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-sepia-0 ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-sepia-[<value>]` syntax to set the backdrop sepia based on a completely custom value:

```html
<div class="backdrop-sepia-[.8] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-sepia-(<custom-property>)` syntax:

```html
<div class="backdrop-sepia-(--my-backdrop-sepia) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-sepia-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: sepia()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-sepia md:backdrop-sepia-0 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
