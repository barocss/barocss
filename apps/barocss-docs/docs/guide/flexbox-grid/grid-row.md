# grid-row

Utilities for controlling how elements are sized and placed across grid rows.

## Quick reference

| Class | Styles |
|---|---|
| `row-span-<number>` | `grid-row: span <number> / span <number>;` |
| `row-span-full` | `grid-row: 1 / -1;` |
| `row-span-(<custom-property>)` | `grid-row: span var(<custom-property>) / span var(<custom-property>);` |
| `row-span-[<value>]` | `grid-row: span <value> / span <value>;` |
| `row-start-<number>` | `grid-row-start: <number>;` |
| `-row-start-<number>` | `grid-row-start: calc(<number> * -1);` |
| `row-start-auto` | `grid-row-start: auto;` |
| `row-start-(<custom-property>)` | `grid-row-start: var(<custom-property>);` |
| `row-start-[<value>]` | `grid-row-start: <value>;` |
| `row-end-<number>` | `grid-row-end: <number>;` |
| `-row-end-<number>` | `grid-row-end: calc(<number> * -1);` |
| `row-end-auto` | `grid-row-end: auto;` |
| `row-end-(<custom-property>)` | `grid-row-end: var(<custom-property>);` |
| `row-end-[<value>]` | `grid-row-end: <value>;` |
| `row-auto` | `grid-row: auto;` |
| `row-<number>` | `grid-row: <number>;` |
| `-row-<number>` | `grid-row: calc(<number> * -1);` |
| `row-(<custom-property>)` | `grid-row: var(<custom-property>);` |
| `row-[<value>]` | `grid-row: <value>;` |

Source: https://tailwindcss.com/docs/grid-row

## Examples

### Spanning rows

Use `row-span-<number>` utilities like `row-span-2` and `row-span-4` to make an element span _n_ rows:

```html
<!-- [!code classes:row-span-2,row-span-3] -->
<div class="grid grid-flow-col grid-rows-3 gap-4">
  <div class="row-span-3 ...">01</div>
  <div class="col-span-2 ...">02</div>
  <div class="col-span-2 row-span-2 ...">03</div>
</div>
```

### Starting and ending lines

Use `row-start-<number>` or `row-end-<number>` utilities like `row-start-2` and `row-end-3` to make an element start or end at the _nth_ grid line:

```html
<!-- [!code classes:row-start-1,row-start-2,row-end-3,row-end-4] -->
<div class="grid grid-flow-col grid-rows-3 gap-4">
  <div class="row-span-2 row-start-2 ...">01</div>
  <div class="row-span-2 row-end-3 ...">02</div>
  <div class="row-start-1 row-end-4 ...">03</div>
</div>
```

These can also be combined with the `row-span-<number>` utilities to span a specific number of rows.

### Using a custom value

Use the `row-[<value>]` syntax to set the grid row based on a completely custom value:

```html
<div class="row-[16] row-span-[span_16_/_span_16] ...">Lorem ipsum dolor sit amet...</div>
```

For CSS variables, you can also use the `row-(<custom-property>)` syntax:

```html
<div class="row-(--my-row) ...">Lorem ipsum dolor sit amet...</div>
```

This is just a shorthand for `row-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `grid-row` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="row-span-3 md:row-span-4 ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
