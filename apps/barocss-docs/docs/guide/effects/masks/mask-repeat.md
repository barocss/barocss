# mask-repeat

Utilities for controlling the repetition of an element's mask image.

## Quick reference

| Class              | Styles                   |
|--------------------|--------------------------|
| `mask-repeat`      | `mask-repeat: repeat;`   |
| `mask-no-repeat`   | `mask-repeat: no-repeat;`|
| `mask-repeat-x`    | `mask-repeat: repeat-x;` |
| `mask-repeat-y`    | `mask-repeat: repeat-y;` |
| `mask-repeat-space`| `mask-repeat: space;`    |
| `mask-repeat-round`| `mask-repeat: round;`    |

Source: https://tailwindcss.com/docs/mask-repeat

## Examples

### Basic example

```html
<div class="mask-repeat mask-[url(/img/circle.png)] mask-size-[50px_50px] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Repeating horizontally

```html
<div class="mask-repeat-x mask-[url(/img/circle.png)] mask-size-[50px_50px] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Repeating vertically

```html
<div class="mask-repeat-y mask-[url(/img/circle.png)] mask-size-[50px_50px] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Preventing clipping

```html
<div class="mask-repeat-space mask-[url(/img/circle.png)] mask-size-[50px_50px] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Preventing clipping and gaps

```html
<div class="mask-repeat-round mask-[url(/img/circle.png)] mask-size-[50px_50px] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Disabling repeating

```html
<div class="mask-no-repeat mask-[url(/img/circle.png)] mask-size-[50px_50px] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Responsive design

Prefix a `mask-repeat` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="mask-repeat md:mask-repeat-x">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
