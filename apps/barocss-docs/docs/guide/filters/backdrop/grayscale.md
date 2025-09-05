# backdrop-filter: grayscale()

Utilities for applying backdrop grayscale filters to an element.

Source: https://tailwindcss.com/guide/backdrop-filter-grayscale

## Quick reference

- `backdrop-grayscale`, `backdrop-grayscale-0`, `backdrop-grayscale-[&lt;value&gt;]`, `backdrop-grayscale-(&lt;custom-property&gt;)`

## Examples

### Basic example

Use utilities like `backdrop-grayscale` and `backdrop-grayscale-0` to control the grayscale of an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-grayscale ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-grayscale-0 ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-grayscale-[&lt;value&gt;]` syntax to set the backdrop grayscale based on a completely custom value:

```html
<div class="backdrop-grayscale-[.8] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-grayscale-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-grayscale-(--my-backdrop-grayscale) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-grayscale-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: grayscale()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-grayscale md:backdrop-grayscale-0 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
