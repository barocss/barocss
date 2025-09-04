# place-content

Utilities for controlling how content is justified and aligned at the same time.

## Quick reference

| Class                      | Styles                         |
|----------------------------|--------------------------------|
| `place-content-center`     | `place-content: center;`       |
| `place-content-center-safe`| `place-content: safe center;`  |
| `place-content-start`      | `place-content: start;`        |
| `place-content-end`        | `place-content: end;`          |
| `place-content-end-safe`   | `place-content: safe end;`     |
| `place-content-between`    | `place-content: space-between;`|
| `place-content-around`     | `place-content: space-around;` |
| `place-content-evenly`     | `place-content: space-evenly;` |
| `place-content-baseline`   | `place-content: baseline;`     |
| `place-content-stretch`    | `place-content: stretch;`      |

Source: https://tailwindcss.com/docs/place-content

## Examples

### Center

```html
<div class="grid h-48 grid-cols-2 place-content-center gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### Start

```html
<div class="grid h-48 grid-cols-2 place-content-start gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### End

```html
<div class="grid h-48 grid-cols-2 place-content-end gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### Space between

```html
<div class="grid h-48 grid-cols-2 place-content-between gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### Space around

```html
<div class="grid h-48 grid-cols-2 place-content-around gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### Space evenly

```html
<div class="grid h-48 grid-cols-2 place-content-evenly gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### Stretch

```html
<div class="grid h-48 grid-cols-2 place-content-stretch gap-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### Responsive design

Prefix a `place-content` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grid place-content-start md:place-content-center ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
