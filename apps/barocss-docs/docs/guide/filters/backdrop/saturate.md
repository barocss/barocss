# backdrop-filter: saturate()

Utilities for applying backdrop saturate filters to an element.

Source: https://tailwindcss.com/docs/backdrop-filter-saturate

## Quick reference

- `backdrop-saturate-[<value>]`, `backdrop-saturate-(<custom-property>)`, preset utilities like `backdrop-saturate-150`, `backdrop-saturate-200`

## Examples

### Basic example

Use utilities like `backdrop-saturate-150` and `backdrop-saturate-200` to increase the saturation of an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-saturate-150 ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-saturate-200 ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-saturate-[<value>]` syntax to set the backdrop saturate based on a completely custom value:

```html
<div class="backdrop-saturate-[1.75] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-saturate-(<custom-property>)` syntax:

```html
<div class="backdrop-saturate-(--my-backdrop-saturate) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-saturate-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: saturate()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-saturate-150 md:backdrop-saturate-200 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
