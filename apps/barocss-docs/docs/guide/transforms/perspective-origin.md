# perspective-origin

Utilities for controlling an element's perspective origin when placed in 3D space.

Source: https://tailwindcss.com/docs/perspective-origin

## Quick reference

| Class                          | Styles                     |
|--------------------------------|----------------------------|
| perspective-origin-center      | perspective-origin: center; |
| perspective-origin-top         | perspective-origin: top;    |
| perspective-origin-top-right   | perspective-origin: top right; |
| perspective-origin-right       | perspective-origin: right;  |
| perspective-origin-bottom-right| perspective-origin: bottom right; |
| perspective-origin-bottom      | perspective-origin: bottom; |
| perspective-origin-bottom-left | perspective-origin: bottom left; |
| perspective-origin-left        | perspective-origin: left;   |
| perspective-origin-top-left    | perspective-origin: top left; |
| perspective-origin-(<custom-property>) | perspective-origin: var(<custom-property>); |
| perspective-origin-\[<value>\] | perspective-origin: <value>; |

## Examples

### Basic example

Use utilities like `perspective-origin-top-left` and `perspective-origin-bottom-right` to control where the perspective is positioned:

```html
<div class="size-20 perspective-near perspective-origin-top-left ...">
  <!-- ... -->
</div>
<div class="size-20 perspective-near perspective-origin-bottom-right ...">
  <!-- ... -->
</div>
```

### Using a custom value

Use the `perspective-origin-[<value>]` syntax to set the perspective origin based on a completely custom value:

```html
<div class="perspective-origin-[200%_150%] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `perspective-origin-(<custom-property>)` syntax:

```html
<div class="perspective-origin-(--my-perspective-origin) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `perspective-origin-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `perspective-origin` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="perspective-origin-center md:perspective-origin-bottom-left ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
