# mask-size

Utilities for controlling the size of an element's mask image.

## Quick reference

| Class               | Styles                |
|---------------------|-----------------------|
| `mask-auto`         | `mask-size: auto;`    |
| `mask-cover`        | `mask-size: cover;`   |
| `mask-contain`      | `mask-size: contain;` |
| `mask-size-(<var>)` | `mask-size: var(<var>);` |
| `mask-size-[&lt;value&gt;]` | `mask-size: &lt;value&gt;;` |

Source: https://tailwindcss.com/guide/mask-size

## Examples

### Filling the container

```html
<div class="mask-cover mask-[url(/img/scribble.png)] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Filling without cropping

```html
<div class="mask-contain mask-[url(/img/scribble.png)] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Using the default size

```html
<div class="mask-auto mask-[url(/img/scribble.png)] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Using a custom value

Use the `mask-size-[&lt;value&gt;]` syntax to set the mask size based on a completely custom value:

```html
<div class="mask-size-[auto_100px]">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `mask-size-(&lt;custom-property&gt;)` syntax:

```html
<div class="mask-size-(--my-mask-size)">
  <!-- ... -->
</div>
```

This is just a shorthand for `mask-size-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `mask-size` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="mask-auto md:mask-contain">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
