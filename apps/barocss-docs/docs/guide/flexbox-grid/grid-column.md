# grid-column

Utilities for controlling how elements are sized and placed across grid columns.

## Quick reference

| Class | Styles |
|---|---|
| `col-span-&lt;number&gt;` | `grid-column: span &lt;number&gt; / span &lt;number&gt;;` |
| `col-span-full` | `grid-column: 1 / -1;` |
| `col-span-(&lt;custom-property&gt;)` | `grid-column: span var(&lt;custom-property&gt;) / span var(&lt;custom-property&gt;);` |
| `col-span-[&lt;value&gt;]` | `grid-column: span &lt;value&gt; / span &lt;value&gt;;` |
| `col-start-&lt;number&gt;` | `grid-column-start: &lt;number&gt;;` |
| `-col-start-&lt;number&gt;` | `grid-column-start: calc(&lt;number&gt; * -1);` |
| `col-start-auto` | `grid-column-start: auto;` |
| `col-start-(&lt;custom-property&gt;)` | `grid-column-start: var(&lt;custom-property&gt;);` |
| `col-start-[&lt;value&gt;]` | `grid-column-start: &lt;value&gt;;` |
| `col-end-&lt;number&gt;` | `grid-column-end: &lt;number&gt;;` |
| `-col-end-&lt;number&gt;` | `grid-column-end: calc(&lt;number&gt; * -1);` |
| `col-end-auto` | `grid-column-end: auto;` |
| `col-end-(&lt;custom-property&gt;)` | `grid-column-end: var(&lt;custom-property&gt;);` |
| `col-end-[&lt;value&gt;]` | `grid-column-end: &lt;value&gt;;` |
| `col-auto` | `grid-column: auto;` |
| `col-&lt;number&gt;` | `grid-column: &lt;number&gt;;` |
| `-col-&lt;number&gt;` | `grid-column: calc(&lt;number&gt; * -1);` |
| `col-(&lt;custom-property&gt;)` | `grid-column: var(&lt;custom-property&gt;);` |
| `col-[&lt;value&gt;]` | `grid-column: &lt;value&gt;;` |

Source: https://tailwindcss.com/guide/grid-column

## Examples

### Spanning columns

Use `col-span-&lt;number&gt;` utilities like `col-span-2` and `col-span-4` to make an element span _n_ columns:

```html
<!-- [!code classes:col-span-2] -->
<div class="grid grid-cols-3 gap-4">
  <div class="...">01</div>
  <div class="...">02</div>
  <div class="...">03</div>
  <div class="col-span-2 ...">04</div>
  <div class="...">05</div>
  <div class="...">06</div>
  <div class="col-span-2 ...">07</div>
</div>
```

### Starting and ending lines

Use `col-start-&lt;number&gt;` or `col-end-&lt;number&gt;` utilities like `col-start-2` and `col-end-3` to make an element start or end at the _nth_ grid line:

```html
<!-- [!code classes:col-start-1,col-start-2,col-end-3,col-end-7] -->
<div class="grid grid-cols-6 gap-4">
  <div class="col-span-4 col-start-2 ...">01</div>
  <div class="col-start-1 col-end-3 ...">02</div>
  <div class="col-span-2 col-end-7 ...">03</div>
  <div class="col-start-1 col-end-7 ...">04</div>
</div>
```

These can also be combined with the `col-span-&lt;number&gt;` utilities to span a specific number of columns.

### Using a custom value

Use the `col-[&lt;value&gt;]` syntax to set the grid column based on a completely custom value:

```html
<div class="col-[16] col-span-[span_16_/_span_16] ...">Lorem ipsum dolor sit amet...</div>
```

For CSS variables, you can also use the `col-(&lt;custom-property&gt;)` syntax:

```html
<div class="col-(--my-column) ...">Lorem ipsum dolor sit amet...</div>
```

This is just a shorthand for `col-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `grid-column` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="col-span-2 md:col-span-6 ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
