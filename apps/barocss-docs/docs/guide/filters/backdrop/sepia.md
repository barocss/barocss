# backdrop-filter: sepia()

Utilities for applying backdrop sepia filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `backdrop-sepia` | `backdrop-filter: sepia(100%);` |
| `backdrop-sepia-&lt;number&gt;` | `backdrop-filter: sepia(&lt;number&gt;%);` |
| `backdrop-sepia-(&lt;custom-property&gt;)` | `backdrop-filter: sepia(var(&lt;custom-property&gt;));` |
| `backdrop-sepia-[&lt;value&gt;]` | `backdrop-filter: sepia(&lt;value&gt;);` |

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

Use the `backdrop-sepia-[&lt;value&gt;]` syntax to set the backdrop sepia based on a completely custom value:

```html
<div class="backdrop-sepia-[.8] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-sepia-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-sepia-(--my-backdrop-sepia) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-sepia-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: sepia()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-sepia md:backdrop-sepia-0 ...">
  <!-- ... -->
</div>
```

