# background-position

Utilities for controlling the position of an element's background image.

## Quick reference

| Class | Styles |
|---|---|
| `bg-top-left` | `background-position: top left;` |
| `bg-top` | `background-position: top;` |
| `bg-top-right` | `background-position: top right;` |
| `bg-left` | `background-position: left;` |
| `bg-center` | `background-position: center;` |
| `bg-right` | `background-position: right;` |
| `bg-bottom-left` | `background-position: bottom left;` |
| `bg-bottom` | `background-position: bottom;` |
| `bg-bottom-right` | `background-position: bottom right;` |
| `bg-position-(<custom-property>)` | `background-position: var(<custom-property>);` |
| `bg-position-[<value>]` | `background-position: <value>;` |

Source: https://tailwindcss.com/docs/background-position

## Examples

### Basic example

Use utilities like `bg-center`, `bg-right`, and `bg-top-left` to control the position of an element's background image:

```html
<!-- [!code classes:bg-top-left,bg-top-right,bg-bottom-right,bg-bottom-left,bg-center,bg-right,bg-top,bg-bottom,bg-left] -->
<div class="bg-[url(/img/mountains.jpg)] bg-top-left"></div>
<div class="bg-[url(/img/mountains.jpg)] bg-top"></div>
<div class="bg-[url(/img/mountains.jpg)] bg-top-right"></div>
<div class="bg-[url(/img/mountains.jpg)] bg-left"></div>
<div class="bg-[url(/img/mountains.jpg)] bg-center"></div>
<div class="bg-[url(/img/mountains.jpg)] bg-right"></div>
<div class="bg-[url(/img/mountains.jpg)] bg-bottom-left"></div>
<div class="bg-[url(/img/mountains.jpg)] bg-bottom"></div>
<div class="bg-[url(/img/mountains.jpg)] bg-bottom-right"></div>
```

### Using a custom value

Use the `bg-position-[<value>]` syntax to set the background position based on a completely custom value:

```html
<div class="bg-position-[center_top_1rem] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `bg-position-(<custom-property>)` syntax:

```html
<div class="bg-position-(--my-position) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `bg-position-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `background-position` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="bg-center md:bg-top ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
