# place-items

Utilities for controlling how items are justified and aligned at the same time.

## Quick reference

| Class                    | Styles                 |
|--------------------------|------------------------|
| `place-items-start`      | `place-items: start;`  |
| `place-items-end`        | `place-items: end;`    |
| `place-items-end-safe`   | `place-items: safe end;` |
| `place-items-center`     | `place-items: center;` |
| `place-items-center-safe`| `place-items: safe center;` |
| `place-items-baseline`   | `place-items: baseline;` |
| `place-items-stretch`    | `place-items: stretch;` |

Source: https://tailwindcss.com/docs/place-items

## Examples

### Start

```html
<div class="grid grid-cols-3 place-items-start gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### End

```html
<div class="grid h-56 grid-cols-3 place-items-end gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Center

```html
<div class="grid h-56 grid-cols-3 place-items-center gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Stretch

```html
<div class="grid h-56 grid-cols-3 place-items-stretch gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Responsive design

Prefix a `place-items` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grid place-items-start md:place-items-center ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
