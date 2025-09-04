# object-fit

Utilities for controlling how a replaced element's content should be resized.

## Quick reference

| Class               | Styles                    |
|---------------------|---------------------------|
| `object-contain`    | `object-fit: contain;`    |
| `object-cover`      | `object-fit: cover;`      |
| `object-fill`       | `object-fit: fill;`       |
| `object-none`       | `object-fit: none;`       |
| `object-scale-down` | `object-fit: scale-down;` |

Source: https://tailwindcss.com/docs/object-fit

## Examples

### Resizing to cover

```html
<img class="h-48 w-96 object-cover ..." src="/img/mountains.jpg" />
```

### Containing within

```html
<img class="h-48 w-96 object-contain ..." src="/img/mountains.jpg" />
```

### Stretching to fit

```html
<img class="h-48 w-96 object-fill ..." src="/img/mountains.jpg" />
```

### Scaling down

```html
<img class="h-48 w-96 object-scale-down ..." src="/img/mountains.jpg" />
```

### Using the original size

```html
<img class="h-48 w-96 object-none ..." src="/img/mountains.jpg" />
```

### Responsive design

Prefix an `object-fit` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="object-contain md:object-cover ..." src="/img/mountains.jpg" />
```

Learn more about using variants in the variants documentation.

