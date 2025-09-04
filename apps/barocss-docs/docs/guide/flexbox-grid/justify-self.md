# justify-self

Utilities for controlling how an individual grid item is aligned along its inline axis.

## Quick reference

| Class | Styles |
|---|---|
| `justify-self-auto` | `justify-self: auto;` |
| `justify-self-start` | `justify-self: start;` |
| `justify-self-center` | `justify-self: center;` |
| `justify-self-center-safe` | `justify-self: safe center;` |
| `justify-self-end` | `justify-self: end;` |
| `justify-self-end-safe` | `justify-self: safe end;` |
| `justify-self-stretch` | `justify-self: stretch;` |

Source: https://tailwindcss.com/docs/justify-self

## Examples

### Auto

Use the `justify-self-auto` utility to align an item based on the value of the grid's `justify-items` property:

```html
<!-- [!code classes:justify-self-auto] -->
<div class="grid justify-items-stretch ...">
  <!-- ... -->
  <div class="justify-self-auto ...">02</div>
  <!-- ... -->
</div>
```

### Start

Use the `justify-self-start` utility to align a grid item to the start of its inline axis:

```html
<!-- [!code classes:justify-self-start] -->
<div class="grid justify-items-stretch ...">
  <!-- ... -->
  <div class="justify-self-start ...">02</div>
  <!-- ... -->
</div>
```

### Center

Use the `justify-self-center` or `justify-self-center-safe` utilities to align a grid item along the center of its inline axis:

```html
<!-- [!code filename:justify-self-center] -->
<!-- [!code classes:justify-self-center] -->
<div class="grid justify-items-stretch ...">
  <!-- ... -->
  <div class="justify-self-center ...">02</div>
  <!-- ... -->
</div>
```

```html
<!-- [!code filename:justify-self-center-safe] -->
<!-- [!code classes:justify-self-center-safe] -->
<div class="grid justify-items-stretch ...">
  <!-- ... -->
  <div class="justify-self-center-safe ...">02</div>
  <!-- ... -->
</div>
```

When there is not enough space available, the `justify-self-center-safe` utility will align the item to the start of the container instead of the end.

### End

Use the `justify-self-end` or `justify-self-end-safe` utilities to align a grid item to the end of its inline axis:

```html
<!-- [!code filename:justify-self-end] -->
<!-- [!code classes:justify-self-end] -->
<div class="grid justify-items-stretch ...">
  <!-- ... -->
  <div class="justify-self-end ...">02</div>
  <!-- ... -->
</div>
```

```html
<!-- [!code filename:justify-self-end-safe] -->
<!-- [!code classes:justify-self-end-safe] -->
<div class="grid justify-items-stretch ...">
  <!-- ... -->
  <div class="justify-self-end-safe ...">02</div>
  <!-- ... -->
</div>
```

When there is not enough space available, the `justify-self-end-safe` utility will align the item to the start of the container instead of the end.

### Stretch

Use the `justify-self-stretch` utility to stretch a grid item to fill the grid area on its inline axis:

```html
<!-- [!code classes:justify-self-stretch] -->
<div class="grid justify-items-start ...">
  <!-- ... -->
  <div class="justify-self-stretch ...">02</div>
  <!-- ... -->
</div>
```

### Responsive design

Prefix a `justify-self` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="justify-self-start md:justify-self-end ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
