# backdrop-filter: contrast()

Utilities for applying backdrop contrast filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `backdrop-contrast-125` | `backdrop-filter: contrast(var(--backdrop-contrast-125));` |
| `backdrop-contrast-200` | `backdrop-filter: contrast(var(--backdrop-contrast-200));` |
| `backdrop-contrast-(&lt;custom-property&gt;)` | `backdrop-filter: contrast(var(&lt;custom-property&gt;));` |
| `backdrop-contrast-[&lt;value&gt;]` | `backdrop-filter: contrast(&lt;value&gt;);` |

## Examples

### Basic example

Use utilities like `backdrop-contrast-125` and `backdrop-contrast-200` to increase the contrast of an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-contrast-125 ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-contrast-200 ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-contrast-[&lt;value&gt;]` syntax to set the backdrop contrast based on a completely custom value:

```html
<div class="backdrop-contrast-[1.2] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-contrast-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-contrast-(--my-backdrop-contrast) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-contrast-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: contrast()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-contrast-125 md:backdrop-contrast-200 ...">
  <!-- ... -->
</div>
```

