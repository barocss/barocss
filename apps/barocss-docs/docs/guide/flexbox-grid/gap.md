# gap

Utilities for controlling gutters between grid and flexbox items.

## Quick reference

| Class | Styles |
|---|---|
| `gap-&lt;number&gt;` | `gap: calc(var(--spacing) * &lt;value&gt;);` |
| `gap-(&lt;custom-property&gt;)` | `gap: var(&lt;custom-property&gt;);` |
| `gap-[&lt;value&gt;]` | `gap: &lt;value&gt;;` |
| `gap-x-&lt;number&gt;` | `column-gap: calc(var(--spacing) * &lt;value&gt;);` |
| `gap-x-(&lt;custom-property&gt;)` | `column-gap: var(&lt;custom-property&gt;);` |
| `gap-x-[&lt;value&gt;]` | `column-gap: &lt;value&gt;;` |
| `gap-y-&lt;number&gt;` | `row-gap: calc(var(--spacing) * &lt;value&gt;);` |
| `gap-y-(&lt;custom-property&gt;)` | `row-gap: var(&lt;custom-property&gt;);` |
| `gap-y-[&lt;value&gt;]` | `row-gap: &lt;value&gt;;` |

Source: https://tailwindcss.com/guide/gap

## Examples

### Basic example

Use `gap-&lt;number&gt;` utilities like `gap-2` and `gap-4` to change the gap between both rows and columns in grid and flexbox layouts:

```html
<!-- [!code classes:gap-4] -->
<div class="grid grid-cols-2 gap-4">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### Changing row and column gaps independently

Use `gap-x-&lt;number&gt;` or `gap-y-&lt;number&gt;` utilities like `gap-x-8` and `gap-y-4` to change the gap between columns and rows independently:

```html
<!-- [!code classes:gap-x-8,gap-y-4] -->
<div class="grid grid-cols-3 gap-x-8 gap-y-4">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Using a custom value

Use the `gap-[&lt;value&gt;]` syntax to set the gap based on a completely custom value:

```html
<div class="grid gap-[10vw] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `gap-(&lt;custom-property&gt;)` syntax:

```html
<div class="grid gap-(--my-gap) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `gap-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `gap` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grid gap-4 md:gap-6 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
