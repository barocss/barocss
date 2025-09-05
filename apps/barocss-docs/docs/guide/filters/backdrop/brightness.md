# backdrop-filter: brightness()

Utilities for applying backdrop brightness filters to an element.

Source: https://tailwindcss.com/guide/backdrop-filter-brightness

## Quick reference

- `backdrop-brightness-[&lt;value&gt;]`, `backdrop-brightness-(&lt;custom-property&gt;)`, preset utilities like `backdrop-brightness-110`, `backdrop-brightness-150`

## Examples

### Basic example

Use utilities like `backdrop-brightness-110` and `backdrop-brightness-150` to increase the brightness of an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-brightness-110 ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-brightness-150 ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-brightness-[&lt;value&gt;]` syntax to set the backdrop brightness based on a completely custom value:

```html
<div class="backdrop-brightness-[1.25] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-brightness-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-brightness-(--my-backdrop-brightness) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-brightness-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: brightness()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-brightness-110 md:backdrop-brightness-150 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
