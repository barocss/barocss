# grid-row

Utilities for controlling how elements are sized and placed across grid rows.

## Quick reference

| Class | Styles |
|---|---|
| `row-span-&lt;number&gt;` | `grid-row: span &lt;number&gt; / span &lt;number&gt;;` |
| `row-span-full` | `grid-row: 1 / -1;` |
| `row-span-(&lt;custom-property&gt;)` | `grid-row: span var(&lt;custom-property&gt;) / span var(&lt;custom-property&gt;);` |
| `row-span-[&lt;value&gt;]` | `grid-row: span &lt;value&gt; / span &lt;value&gt;;` |
| `row-start-&lt;number&gt;` | `grid-row-start: &lt;number&gt;;` |
| `-row-start-&lt;number&gt;` | `grid-row-start: calc(&lt;number&gt; * -1);` |
| `row-start-auto` | `grid-row-start: auto;` |
| `row-start-(&lt;custom-property&gt;)` | `grid-row-start: var(&lt;custom-property&gt;);` |
| `row-start-[&lt;value&gt;]` | `grid-row-start: &lt;value&gt;;` |
| `row-end-&lt;number&gt;` | `grid-row-end: &lt;number&gt;;` |
| `-row-end-&lt;number&gt;` | `grid-row-end: calc(&lt;number&gt; * -1);` |
| `row-end-auto` | `grid-row-end: auto;` |
| `row-end-(&lt;custom-property&gt;)` | `grid-row-end: var(&lt;custom-property&gt;);` |
| `row-end-[&lt;value&gt;]` | `grid-row-end: &lt;value&gt;;` |
| `row-auto` | `grid-row: auto;` |
| `row-&lt;number&gt;` | `grid-row: &lt;number&gt;;` |
| `-row-&lt;number&gt;` | `grid-row: calc(&lt;number&gt; * -1);` |
| `row-(&lt;custom-property&gt;)` | `grid-row: var(&lt;custom-property&gt;);` |
| `row-[&lt;value&gt;]` | `grid-row: &lt;value&gt;;` |

Source: https://tailwindcss.com/guide/grid-row

## Examples

### Spanning rows

Use `row-span-&lt;number&gt;` utilities like `row-span-2` and `row-span-4` to make an element span _n_ rows:

```html
<!-- [!code classes:row-span-2,row-span-3] -->
<div class="grid grid-flow-col grid-rows-3 gap-4">
  <div class="row-span-3 ...">01</div>
  <div class="col-span-2 ...">02</div>
  <div class="col-span-2 row-span-2 ...">03</div>
</div>
```

### Starting and ending lines

Use `row-start-&lt;number&gt;` or `row-end-&lt;number&gt;` utilities like `row-start-2` and `row-end-3` to make an element start or end at the _nth_ grid line:

```html
<!-- [!code classes:row-start-1,row-start-2,row-end-3,row-end-4] -->
<div class="grid grid-flow-col grid-rows-3 gap-4">
  <div class="row-span-2 row-start-2 ...">01</div>
  <div class="row-span-2 row-end-3 ...">02</div>
  <div class="row-start-1 row-end-4 ...">03</div>
</div>
```

These can also be combined with the `row-span-&lt;number&gt;` utilities to span a specific number of rows.

### Using a custom value

Use the `row-[&lt;value&gt;]` syntax to set the grid row based on a completely custom value:

```html
<div class="row-[16] row-span-[span_16_/_span_16] ...">Lorem ipsum dolor sit amet...</div>
```

For CSS variables, you can also use the `row-(&lt;custom-property&gt;)` syntax:

```html
<div class="row-(--my-row) ...">Lorem ipsum dolor sit amet...</div>
```

This is just a shorthand for `row-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `grid-row` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="row-span-3 md:row-span-4 ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
