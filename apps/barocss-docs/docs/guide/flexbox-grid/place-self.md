# place-self

Utilities for controlling how an individual item is justified and aligned at the same time.

## Quick reference

| Class                    | Styles                 |
|--------------------------|------------------------|
| `place-self-auto`        | `place-self: auto;`    |
| `place-self-start`       | `place-self: start;`   |
| `place-self-end`         | `place-self: end;`     |
| `place-self-end-safe`    | `place-self: safe end;`|
| `place-self-center`      | `place-self: center;`  |
| `place-self-center-safe` | `place-self: safe center;` |
| `place-self-stretch`     | `place-self: stretch;` |


## Examples

### Auto

```html
<div class="grid grid-cols-3 gap-4 ...">
  <div>01</div>
  <div class="place-self-auto ...">02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Start

```html
<div class="grid grid-cols-3 gap-4 ...">
  <div>01</div>
  <div class="place-self-start ...">02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Center

```html
<div class="grid grid-cols-3 gap-4 ...">
  <div>01</div>
  <div class="place-self-center ...">02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### End

```html
<div class="grid grid-cols-3 gap-4 ...">
  <div>01</div>
  <div class="place-self-end ...">02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Stretch

```html
<div class="grid grid-cols-3 gap-4 ...">
  <div>01</div>
  <div class="place-self-stretch ...">02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Responsive design

Prefix a `place-self` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="place-self-start md:place-self-end ...">Lorem ipsum dolor sit amet...</div>
```


