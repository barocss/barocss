# backdrop-filter: opacity()

Utilities for applying backdrop opacity filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `backdrop-opacity-&lt;number&gt;` | `backdrop-filter: opacity(&lt;number&gt;%);` |
| `backdrop-opacity-(&lt;custom-property&gt;)` | `backdrop-filter: opacity(var(&lt;custom-property&gt;));` |
| `backdrop-opacity-[&lt;value&gt;]` | `backdrop-filter: opacity(&lt;value&gt;);` |

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

