# backdrop-filter: invert()

Utilities for applying backdrop invert filters to an element.

Source: https://tailwindcss.com/guide/backdrop-filter-invert

## Quick reference

- `backdrop-invert`, `backdrop-invert-0`, `backdrop-invert-[&lt;value&gt;]`, `backdrop-invert-(&lt;custom-property&gt;)`

## Examples

### Basic example

Use utilities like `backdrop-invert` and `backdrop-invert-0` to control the inversion of an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-invert ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-invert-0 ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-invert-[&lt;value&gt;]` syntax to set the backdrop invert based on a completely custom value:

```html
<div class="backdrop-invert-[.8] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-invert-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-invert-(--my-backdrop-invert) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-invert-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: invert()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-invert md:backdrop-invert-0 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
