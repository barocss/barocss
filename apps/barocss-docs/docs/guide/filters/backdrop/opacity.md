# backdrop-filter: opacity()

Utilities for applying backdrop opacity filters to an element.

Source: https://tailwindcss.com/guide/backdrop-filter-opacity

## Quick reference

- `backdrop-opacity-[&lt;value&gt;]`, `backdrop-opacity-(&lt;custom-property&gt;)`, preset utilities like `backdrop-opacity-25`, `backdrop-opacity-50`, `backdrop-opacity-75`

## Examples

### Basic example

Use utilities like `backdrop-opacity-25` and `backdrop-opacity-75` to control the opacity of an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-opacity-25 ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-opacity-50 ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-opacity-75 ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-opacity-[&lt;value&gt;]` syntax to set the backdrop opacity based on a completely custom value:

```html
<div class="backdrop-opacity-[.3] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-opacity-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-opacity-(--my-backdrop-opacity) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-opacity-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: opacity()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-opacity-25 md:backdrop-opacity-75 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
