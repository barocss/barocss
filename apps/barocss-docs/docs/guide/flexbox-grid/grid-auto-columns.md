# grid-auto-columns

Utilities for controlling the size of implicitly-created grid columns.

## Quick reference

| Class | Styles |
|---|---|
| `auto-cols-auto` | `grid-auto-columns: auto;` |
| `auto-cols-min` | `grid-auto-columns: min-content;` |
| `auto-cols-max` | `grid-auto-columns: max-content;` |
| `auto-cols-fr` | `grid-auto-columns: minmax(0, 1fr);` |
| `auto-cols-(&lt;custom-property&gt;)` | `grid-auto-columns: var(&lt;custom-property&gt;);` |
| `auto-cols-[&lt;value&gt;]` | `grid-auto-columns: &lt;value&gt;;` |


## Examples

### Basic example

Use utilities like `auto-cols-min` and `auto-cols-max` to control the size of implicitly-created grid columns:

```html
<!-- [!code classes:auto-cols-max] -->
<div class="grid auto-cols-max grid-flow-col">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Using a custom value

Use the `auto-cols-[&lt;value&gt;]` syntax to set the grid auto columns based on a completely custom value:

```html
<div class="grid grid-flow-col auto-cols-[minmax(0,2fr)] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `auto-cols-(&lt;custom-property&gt;)` syntax:

```html
<div class="grid grid-flow-col auto-cols-(--my-columns) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `auto-cols-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `grid-auto-columns` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grid grid-flow-col auto-cols-max md:auto-cols-min ...">
  <!-- ... -->
</div>
```


