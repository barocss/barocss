# order

Utilities for controlling the order of flex and grid items.

## Quick reference

| Class               | Styles                            |
|---------------------|-----------------------------------|
| `order-<number>`    | `order: <number>;`                |
| `-order-<number>`   | `order: calc(<number> * -1);`     |
| `order-first`       | `order: -9999;`                   |
| `order-last`        | `order: 9999;`                    |
| `order-none`        | `order: 0;`                       |
| `order-(<custom-property>)` | `order: var(<custom-property>);` |
| `order-[<value>]`   | `order: <value>;`                 |

Source: https://tailwindcss.com/docs/order

## Examples

### Explicitly setting a sort order

```html
<div class="flex justify-between ...">
  <div class="order-3 ...">01</div>
  <div class="order-1 ...">02</div>
  <div class="order-2 ...">03</div>
</div>
```

### Ordering items first or last

```html
<div class="flex justify-between ...">
  <div class="order-last ...">01</div>
  <div class="...">02</div>
  <div class="order-first ...">03</div>
</div>
```

### Using negative values

```html
<div class="-order-1">…</div>
```

### Using a custom value

Use the `order-[<value>]` syntax to set the order based on a completely custom value:

```html
<div class="order-[min(var(--total-items),10)] ...">Lorem ipsum dolor sit amet...</div>
```

For CSS variables, you can also use the `order-(<custom-property>)` syntax:

```html
<div class="order-(--my-order) ...">Lorem ipsum dolor sit amet...</div>
```

This is just a shorthand for `order-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `order` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="order-first md:order-last ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
