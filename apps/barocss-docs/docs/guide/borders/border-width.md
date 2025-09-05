# border-width

Utilities for controlling the width of an element's borders.

## Quick reference

| Class | Styles |
|---|---|
| `border` | `border-width: 1px;` |
| `border-&lt;number&gt;` | `border-width: &lt;number&gt;px;` |
| `border-(length:&lt;custom-property&gt;)` | `border-width: var(&lt;custom-property&gt;);` |
| `border-[&lt;value&gt;]` | `border-width: &lt;value&gt;;` |
| `border-x` | `border-inline-width: 1px;` |
| `border-x-&lt;number&gt;` | `border-inline-width: &lt;number&gt;px;` |
| `border-x-(length:&lt;custom-property&gt;)` | `border-inline-width: var(&lt;custom-property&gt;);` |
| `border-x-[&lt;value&gt;]` | `border-inline-width: &lt;value&gt;;` |
| `border-y` | `border-block-width: 1px;` |
| `border-y-&lt;number&gt;` | `border-block-width: &lt;number&gt;px;` |
| `border-y-(length:&lt;custom-property&gt;)` | `border-block-width: var(&lt;custom-property&gt;);` |
| `border-y-[&lt;value&gt;]` | `border-block-width: &lt;value&gt;;` |
| `border-s` | `border-inline-start-width: 1px;` |
| `border-s-&lt;number&gt;` | `border-inline-start-width: &lt;number&gt;px;` |
| `border-s-(length:&lt;custom-property&gt;)` | `border-inline-start-width: var(&lt;custom-property&gt;);` |
| `border-s-[&lt;value&gt;]` | `border-inline-start-width: &lt;value&gt;;` |
| `border-e` | `border-inline-end-width: 1px;` |
| `border-e-&lt;number&gt;` | `border-inline-end-width: &lt;number&gt;px;` |
| `border-e-(length:&lt;custom-property&gt;)` | `border-inline-end-width: var(&lt;custom-property&gt;);` |
| `border-e-[&lt;value&gt;]` | `border-inline-end-width: &lt;value&gt;;` |
| `border-t` | `border-top-width: 1px;` |
| `border-t-&lt;number&gt;` | `border-top-width: &lt;number&gt;px;` |
| `border-t-(length:&lt;custom-property&gt;)` | `border-top-width: var(&lt;custom-property&gt;);` |
| `border-t-[&lt;value&gt;]` | `border-top-width: &lt;value&gt;;` |
| `border-r` | `border-right-width: 1px;` |
| `border-r-&lt;number&gt;` | `border-right-width: &lt;number&gt;px;` |
| `border-r-(length:&lt;custom-property&gt;)` | `border-right-width: var(&lt;custom-property&gt;);` |
| `border-r-[&lt;value&gt;]` | `border-right-width: &lt;value&gt;;` |
| `border-b` | `border-bottom-width: 1px;` |
| `border-b-&lt;number&gt;` | `border-bottom-width: &lt;number&gt;px;` |
| `border-b-(length:&lt;custom-property&gt;)` | `border-bottom-width: var(&lt;custom-property&gt;);` |
| `border-b-[&lt;value&gt;]` | `border-bottom-width: &lt;value&gt;;` |
| `border-l` | `border-left-width: 1px;` |
| `border-l-&lt;number&gt;` | `border-left-width: &lt;number&gt;px;` |
| `border-l-(length:&lt;custom-property&gt;)` | `border-left-width: var(&lt;custom-property&gt;);` |
| `border-l-[&lt;value&gt;]` | `border-left-width: &lt;value&gt;;` |
| `divide-x` | `& > :not(:last-child) { border-inline-start-width: 0px; border-inline-end-width: 1px; }` |
| `divide-x-&lt;number&gt;` | `& > :not(:last-child) { border-inline-start-width: 0px; border-inline-end-width: &lt;number&gt;px; }` |
| `divide-x-(length:&lt;custom-property&gt;)` | `& > :not(:last-child) { border-inline-start-width: 0px; border-inline-end-width: var(&lt;custom-property&gt;); }` |
| `divide-x-[&lt;value&gt;]` | `& > :not(:last-child) { border-inline-start-width: 0px; border-inline-end-width: &lt;value&gt;; }` |
| `divide-y` | `& > :not(:last-child) { border-top-width: 0px; border-bottom-width: 1px; }` |
| `divide-y-&lt;number&gt;` | `& > :not(:last-child) { border-top-width: 0px; border-bottom-width: &lt;number&gt;px; }` |
| `divide-y-(length:&lt;custom-property&gt;)` | `& > :not(:last-child) { border-top-width: 0px; border-bottom-width: var(&lt;custom-property&gt;); }` |
| `divide-y-[&lt;value&gt;]` | `& > :not(:last-child) { border-top-width: 0px; border-bottom-width: &lt;value&gt;; }` |
| `divide-x-reverse` | `--tw-divide-x-reverse: 1;` |
| `divide-y-reverse` | `--tw-divide-y-reverse: 1;` |

Source: https://tailwindcss.com/guide/border-width

## Examples

### Basic example

Use `border` or `border-&lt;number&gt;` utilities like `border-2` and `border-4` to set the border width for all sides of an element:

```html
<!-- [!code classes:border,border-2,border-4,border-8] -->
<div class="border border-indigo-600 ..."></div>
<div class="border-2 border-indigo-600 ..."></div>
<div class="border-4 border-indigo-600 ..."></div>
<div class="border-8 border-indigo-600 ..."></div>
```

### Individual sides

Use utilities like `border-r` and `border-t-4` to set the border width for one side of an element:

```html
<!-- [!code classes:border-t-4,border-r-4,border-b-4,border-l-4] -->
<div class="border-t-4 border-indigo-500 ..."></div>
<div class="border-r-4 border-indigo-500 ..."></div>
<div class="border-b-4 border-indigo-500 ..."></div>
<div class="border-l-4 border-indigo-500 ..."></div>
```

### Horizontal and vertical sides

Use utilities like `border-x` and `border-y-4` to set the border width on two sides of an element at the same time:

```html
<!-- [!code classes:border-x-4,border-y-4] -->
<div class="border-x-4 border-indigo-500 ..."></div>
<div class="border-y-4 border-indigo-500 ..."></div>
```

### Using logical properties

Use utilities like `border-s` and `border-e-4` to set the `border-inline-start-width` and `border-inline-end-width` [logical properties](https://developer.mozilla.org/en-US/guide/Web/CSS/CSS_Logical_Properties/Basic_concepts), which map to either the left or right border based on the text direction:

```html
<!-- [!code word:dir="ltr"] -->
<!-- [!code word:dir="rtl"] -->
<!-- [!code classes:border-s-4] -->
<div dir="ltr">
  <div class="border-s-4 ..."></div>
</div>
<div dir="rtl">
  <div class="border-s-4 ..."></div>
</div>
```

### Between children

Use utilities like `divide-x` and `divide-y-4` to add borders between child elements:

```html
<!-- [!code classes:divide-x-4] -->
<div class="grid grid-cols-3 divide-x-4">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

#### Reversing children order

If your elements are in reverse order (using say `flex-row-reverse` or `flex-col-reverse`), use the `divide-x-reverse` or `divide-y-reverse` utilities to ensure the border is added to the correct side of each element:

```html
<!-- [!code classes:flex-col-reverse,divide-y-4,divide-y-reverse] -->
<div class="flex flex-col-reverse divide-y-4 divide-y-reverse divide-gray-200">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Using a custom value

Use the `border-[&lt;value&gt;]` syntax to set the border width based on a completely custom value:

```html
<div class="border-[2vw] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `border-(length:&lt;custom-property&gt;)` syntax:

```html
<div class="border-(length:--my-border-width) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `border-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `border-width` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="border-2 md:border-t-4 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
