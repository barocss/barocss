# background-clip

Utilities for controlling the bounding box of an element's background.

## Quick reference

| Class | Styles |
|---|---|
| `bg-clip-border` | `background-clip: border-box;` |
| `bg-clip-padding` | `background-clip: padding-box;` |
| `bg-clip-content` | `background-clip: content-box;` |
| `bg-clip-text` | `background-clip: text;` |

Source: https://tailwindcss.com/guide/background-clip

## Examples

### Basic example

Use the `bg-clip-border`, `bg-clip-padding`, and `bg-clip-content` utilities to control the bounding box of an element's background:

```html
<!-- [!code classes:bg-clip-border,bg-clip-padding,bg-clip-content] -->
<div class="border-4 bg-indigo-500 bg-clip-border p-3"></div>
<div class="border-4 bg-indigo-500 bg-clip-padding p-3"></div>
<div class="border-4 bg-indigo-500 bg-clip-content p-3"></div>
```

### Cropping to text

Use the `bg-clip-text` utility to crop an element's background to match the shape of the text:

```html
<!-- [!code classes:bg-clip-text] -->
<p class="bg-linear-to-r from-pink-500 to-violet-500 bg-clip-text text-5xl font-extrabold text-transparent ...">
  Hello world
</p>
```

### Responsive design

Prefix a `background-clip` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="bg-clip-border md:bg-clip-padding ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
