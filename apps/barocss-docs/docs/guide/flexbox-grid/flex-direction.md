# flex-direction

Utilities for controlling the direction of flex items.

## Quick reference

| Class | Styles |
|---|---|
| `flex-row` | `flex-direction: row;` |
| `flex-row-reverse` | `flex-direction: row-reverse;` |
| `flex-col` | `flex-direction: column;` |
| `flex-col-reverse` | `flex-direction: column-reverse;` |


## Examples

### Row

Use `flex-row` to position flex items horizontally in the same direction as text:

```html
<!-- [!code classes:flex-row] -->
<div class="flex flex-row ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Row reversed

Use `flex-row-reverse` to position flex items horizontally in the opposite direction:

```html
<!-- [!code classes:flex-row-reverse] -->
<div class="flex flex-row-reverse ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Column

Use `flex-col` to position flex items vertically:

```html
<!-- [!code classes:flex-col] -->
<div class="flex flex-col ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Column reversed

Use `flex-col-reverse` to position flex items vertically in the opposite direction:

```html
<!-- [!code classes:flex-col-reverse] -->
<div class="flex flex-col-reverse ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Responsive design

Prefix a `flex-direction` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="flex flex-col md:flex-row ...">
  <!-- ... -->
</div>
```


