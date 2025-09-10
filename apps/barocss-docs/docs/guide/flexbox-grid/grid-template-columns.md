# grid-template-columns

Utilities for specifying the columns in a grid layout.

## Quick reference

| Class | Styles |
|---|---|
| `grid-cols-&lt;number&gt;` | `grid-template-columns: repeat(&lt;number&gt;, minmax(0, 1fr));` |
| `grid-cols-none` | `grid-template-columns: none;` |
| `grid-cols-subgrid` | `grid-template-columns: subgrid;` |
| `grid-cols-[&lt;value&gt;]` | `grid-template-columns: &lt;value&gt;;` |
| `grid-cols-(&lt;custom-property&gt;)` | `grid-template-columns: var(&lt;custom-property&gt;);` |


## Examples

### Specifying the grid columns

Use `grid-cols-&lt;number&gt;` utilities like `grid-cols-2` and `grid-cols-4` to create grids with _n_ equally sized columns:

```html
<!-- [!code classes:grid-cols-4] -->
<div class="grid grid-cols-4 gap-4">
  <div>01</div>
  <!-- ... -->
  <div>09</div>
</div>
```

### Implementing a subgrid

Use the `grid-cols-subgrid` utility to adopt the column tracks defined by the item's parent:

```html
<!-- [!code classes:grid-cols-subgrid] -->
<div class="grid grid-cols-4 gap-4">
  <div>01</div>
  <!-- ... -->
  <div>05</div>
  <div class="col-span-3 grid grid-cols-subgrid gap-4">
    <div class="col-start-2">06</div>
  </div>
</div>
```

### Using a custom value

Use the `grid-cols-[&lt;value&gt;]` syntax to set the grid template columns based on a completely custom value:

```html
<div class="grid grid-cols-[200px_minmax(900px,_1fr)_100px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `grid-cols-(&lt;custom-property&gt;)` syntax:

```html
<div class="grid grid-cols-(--my-columns) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `grid-cols-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `grid-template-columns` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grid grid-cols-1 md:grid-cols-6 ...">
  <!-- ... -->
</div>
```

