# border-color

Utilities for controlling the color of an element's borders.

## Quick reference

| Class | Styles |
|---|---|
| `border-inherit` | `border-color: inherit;` |
| `border-current` | `border-color: currentColor;` |
| `border-transparent` | `border-color: transparent;` |
| `border-{name}` | `border-color: var(--color-{name});` |
| `border-(&lt;custom-property&gt;)` | `border-color: var(&lt;custom-property&gt;);` |
| `border-[&lt;value&gt;]` | `border-color: &lt;value&gt;;` |
| `border-x-{name}` | `border-inline-color: var(--color-{name});` |
| `border-y-{name}` | `border-block-color: var(--color-{name});` |
| `border-s-{name}` | `border-inline-start-color: var(--color-{name});` |
| `border-e-{name}` | `border-inline-end-color: var(--color-{name});` |
| `border-t-{name}` | `border-top-color: var(--color-{name});` |
| `border-r-{name}` | `border-right-color: var(--color-{name});` |
| `border-b-{name}` | `border-bottom-color: var(--color-{name});` |
| `border-l-{name}` | `border-left-color: var(--color-{name});` |
| `divide-{name}` | `& > :not(:last-child) { border-color: var(--color-{name}); }` |

Source: https://tailwindcss.com/guide/border-color

## Examples

### Basic example

Use utilities like `border-rose-500` and `border-lime-100` to control the border color of an element:

```html
<!-- [!code classes:border-indigo-500,border-purple-500,border-sky-500] -->
<div class="border-4 border-indigo-500 ..."></div>
<div class="border-4 border-purple-500 ..."></div>
<div class="border-4 border-sky-500 ..."></div>
```

### Changing the opacity

Use the color opacity modifier to control the opacity of an element's border color:

```html
<!-- [!code word:/100] -->
<!-- [!code word:/75] -->
<!-- [!code word:/50] -->
<div class="border-4 border-indigo-500/100 ..."></div>
<div class="border-4 border-indigo-500/75 ..."></div>
<div class="border-4 border-indigo-500/50 ..."></div>
```

### Individual sides

Use utilities like `border-t-indigo-500` and `border-r-lime-100` to set the border color for one side of an element:

```html
<!-- [!code classes:border-t-indigo-500,border-r-indigo-500,border-b-indigo-500,border-l-indigo-500] -->
<div class="border-4 border-indigo-200 border-t-indigo-500 ..."></div>
<div class="border-4 border-indigo-200 border-r-indigo-500 ..."></div>
<div class="border-4 border-indigo-200 border-b-indigo-500 ..."></div>
<div class="border-4 border-indigo-200 border-l-indigo-500 ..."></div>
```

### Horizontal and vertical sides

Use utilities like `border-x-indigo-500` and `border-y-lime-100` to set the border color on two sides of an element at the same time:

```html
<!-- [!code classes:border-x-indigo-500,border-y-indigo-500] -->
<div class="border-4 border-indigo-200 border-x-indigo-500 ..."></div>
<div class="border-4 border-indigo-200 border-y-indigo-500 ..."></div>
```

### Using logical properties

Use utilities like `border-s-indigo-500` and `border-e-lime-100` to set the `border-inline-start-color` and `border-inline-end-color` [logical properties](https://developer.mozilla.org/en-US/guide/Web/CSS/CSS_Logical_Properties/Basic_concepts), which map to either the left or right border based on the text direction:

```html
<!-- [!code classes:border-s-indigo-500,border-s-indigo-500] -->
<!-- [!code word:dir="ltr"] -->
<!-- [!code word:dir="rtl"] -->
<div dir="ltr">
  <div class="border-s-indigo-500 ..."></div>
</div>
<div dir="rtl">
  <div class="border-s-indigo-500 ..."></div>
</div>
```

### Divider between children

Use utilities like `divide-indigo-500` and `divide-lime-100` to control the border color between child elements:

```html
<!-- [!code classes:divide-indigo-500] -->
<div class="grid grid-cols-3 divide-x-4 divide-indigo-500">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Using a custom value

Use the `border-[&lt;value&gt;]` syntax to set the border color based on a completely custom value:

```html
<div class="border-[#243c5a] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `border-(&lt;custom-property&gt;)` syntax:

```html
<div class="border-(--my-border-color) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `border-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Applying on focus

Use the `focus:` prefix to conditionally apply a border color on focus:

```html
<input class="border-2 border-gray-700 focus:border-pink-600 ..." />
```

### Responsive design

Prefix a `border-color` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="border-blue-500 md:border-green-500 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

Use your design tokens to populate `--color-*` variables and reference them with `border-{name}` (for example, `border-blue-500`). You can also use arbitrary values with `border-[&lt;value&gt;]` and custom properties with `border-(&lt;custom-property&gt;)`.

For example, to add a custom border color to your theme:

```css
@theme {
  --color-regal-blue: #243c5a;
}
```

Then use it in your HTML:

```html
<div class="border-regal-blue">
  <!-- ... -->
</div>
```

Learn more about customizing your theme in the theme documentation.