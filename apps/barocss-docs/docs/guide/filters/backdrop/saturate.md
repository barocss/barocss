# backdrop-filter: saturate()

Utilities for applying backdrop saturate filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `backdrop-saturate-&lt;number&gt;` | `backdrop-filter: saturate(&lt;number&gt;%);` |
| `backdrop-saturate-(&lt;custom-property&gt;)` | `backdrop-filter: saturate(var(&lt;custom-property&gt;));` |
| `backdrop-saturate-[&lt;value&gt;]` | `backdrop-filter: saturate(&lt;value&gt;);` |

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

Use the `backdrop-saturate-[&lt;value&gt;]` syntax to set the backdrop saturate based on a completely custom value:

```html
<div class="backdrop-saturate-[1.75] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-saturate-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-saturate-(--my-backdrop-saturate) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-saturate-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: saturate()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-saturate-150 md:backdrop-saturate-200 ...">
  <!-- ... -->
</div>
```

