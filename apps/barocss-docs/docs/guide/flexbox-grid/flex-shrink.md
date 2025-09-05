# flex-shrink

Utilities for controlling how flex items shrink.

## Quick reference

| Class | Styles |
|---|---|
| `shrink` | `flex-shrink: 1;` |
| `shrink-&lt;number&gt;` | `flex-shrink: &lt;number&gt;;` |
| `shrink-[&lt;value&gt;]` | `flex-shrink: &lt;value&gt;;` |
| `shrink-(&lt;custom-property&gt;)` | `flex-shrink: var(&lt;custom-property&gt;);` |

Source: https://tailwindcss.com/guide/flex-shrink

## Examples

### Allowing flex items to shrink

Use `shrink` to allow a flex item to shrink if needed:

```html
<!-- [!code classes:shrink] -->
<div class="flex ...">
  <div class="h-14 w-14 flex-none ...">01</div>
  <div class="h-14 w-64 shrink ...">02</div>
  <div class="h-14 w-14 flex-none ...">03</div>
</div>
```

### Preventing items from shrinking

Use `shrink-0` to prevent a flex item from shrinking:

```html
<!-- [!code classes:shrink-0] -->
<div class="flex ...">
  <div class="h-16 flex-1 ...">01</div>
  <div class="h-16 w-32 shrink-0 ...">02</div>
  <div class="h-16 flex-1 ...">03</div>
</div>
```

### Using a custom value

Use the `shrink-[&lt;value&gt;]` syntax to set the flex shrink based on a completely custom value:

```html
<div class="shrink-[calc(100vw-var(--sidebar))] ...">Lorem ipsum dolor sit amet...</div>
```

For CSS variables, you can also use the `shrink-(&lt;custom-property&gt;)` syntax:

```html
<div class="shrink-(--my-shrink) ...">Lorem ipsum dolor sit amet...</div>
```

This is just a shorthand for `shrink-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `flex-shrink` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="shrink md:shrink-0 ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
