# grid-template-rows

Utilities for specifying the rows in a grid layout.

## Quick reference

| Class | Styles |
|---|---|
| `grid-rows-&lt;number&gt;` | `grid-template-rows: repeat(&lt;number&gt;, minmax(0, 1fr));` |
| `grid-rows-none` | `grid-template-rows: none;` |
| `grid-rows-subgrid` | `grid-template-rows: subgrid;` |
| `grid-rows-[&lt;value&gt;]` | `grid-template-rows: &lt;value&gt;;` |
| `grid-rows-(&lt;custom-property&gt;)` | `grid-template-rows: var(&lt;custom-property&gt;);` |

Source: https://tailwindcss.com/guide/grid-template-rows

## Examples

### Specifying the grid rows

Use `grid-rows-&lt;number&gt;` utilities like `grid-rows-2` and `grid-rows-4` to create grids with _n_ equally sized rows:

```html
<!-- [!code classes:grid-rows-4] -->
<div class="grid grid-flow-col grid-rows-4 gap-4">
  <div>01</div>
  <!-- ... -->
  <div>09</div>
</div>
```

### Implementing a subgrid

Use the `grid-rows-subgrid` utility to adopt the row tracks defined by the item's parent:

```html
<!-- [!code classes:grid-rows-subgrid] -->
<div class="grid grid-flow-col grid-rows-4 gap-4">
  <div>01</div>
  <!-- ... -->
  <div>05</div>
  <div class="row-span-3 grid grid-rows-subgrid gap-4">
    <div class="row-start-2">06</div>
  </div>
  <div>07</div>
  <!-- ... -->
  <div>10</div>
</div>
```

### Using a custom value

Use the `grid-rows-[&lt;value&gt;]` syntax to set the grid template rows based on a completely custom value:

```html
<div class="grid grid-rows-[200px_minmax(900px,1fr)_100px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `grid-rows-(&lt;custom-property&gt;)` syntax:

```html
<div class="grid grid-rows-(--my-rows) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `grid-rows-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `grid-template-rows` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grid grid-rows-2 md:grid-rows-6 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
