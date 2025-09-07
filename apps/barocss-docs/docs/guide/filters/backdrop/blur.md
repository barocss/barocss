# backdrop-filter: blur()

Utilities for applying backdrop blur filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `backdrop-blur-none` | `backdrop-filter: ;` |
| `backdrop-blur-xs` | `backdrop-filter: blur(var(--blur-xs));` |
| `backdrop-blur-sm` | `backdrop-filter: blur(var(--blur-sm));` |
| `backdrop-blur-md` | `backdrop-filter: blur(var(--blur-md));` |
| `backdrop-blur-lg` | `backdrop-filter: blur(var(--blur-lg));` |
| `backdrop-blur-xl` | `backdrop-filter: blur(var(--blur-xl));` |
| `backdrop-blur-2xl` | `backdrop-filter: blur(var(--blur-2xl));` |
| `backdrop-blur-3xl` | `backdrop-filter: blur(var(--blur-3xl));` |
| `backdrop-blur-(&lt;custom-property&gt;)` | `backdrop-filter: blur(var(&lt;custom-property&gt;));` |
| `backdrop-blur-[&lt;value&gt;]` | `backdrop-filter: blur(&lt;value&gt;);` |

## Examples

### Basic example

Use utilities like `backdrop-blur-sm` and `backdrop-blur-lg` to blur an element's backdrop:

```html
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-blur-none ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-blur-sm ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-blur-md ..."></div>
</div>
<div class="bg-[url(/img/mountains.jpg)]">
  <div class="bg-white/30 backdrop-blur-lg ..."></div>
</div>
```

### Using a custom value

Use the `backdrop-blur-[&lt;value&gt;]` syntax to set the backdrop blur based on a completely custom value:

```html
<div class="backdrop-blur-[2px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `backdrop-blur-(&lt;custom-property&gt;)` syntax:

```html
<div class="backdrop-blur-(--my-backdrop-blur) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `backdrop-blur-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `backdrop-filter: blur()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="backdrop-blur-none md:backdrop-blur-lg ...">
  <!-- ... -->
</div>
```


## Customizing your theme

Use the `--blur-*` theme variables to customize the backdrop blur utilities in your project:

```css
@theme {
  --blur-2xs: 2px;
}
```

Now the `backdrop-blur-2xs` utility can be used in your markup:

```html
<div class="backdrop-blur-2xs">
  <!-- ... -->
</div>
```

Learn more about customizing your theme in the theme documentation.
