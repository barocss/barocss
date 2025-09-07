# margin

Utilities for controlling an element's margin.

## Quick reference

| Class | Styles |
|---|---|
| `m-&lt;number&gt;` | `margin: calc(var(--spacing) * &lt;number&gt;);` |
| `-m-&lt;number&gt;` | `margin: calc(var(--spacing) * -&lt;number&gt;);` |
| `m-auto` | `margin: auto;` |
| `m-px` | `margin: 1px;` |
| `-m-px` | `margin: -1px;` |
| `m-(&lt;custom-property&gt;)` | `margin: var(&lt;custom-property&gt;);` |
| `m-[&lt;value&gt;]` | `margin: &lt;value&gt;;` |
| `mx-&lt;number&gt;` | `margin-inline: calc(var(--spacing) * &lt;number&gt;);` |
| `-mx-&lt;number&gt;` | `margin-inline: calc(var(--spacing) * -&lt;number&gt;);` |
| `mx-auto` | `margin-inline: auto;` |
| `mx-px` | `margin-inline: 1px;` |
| `-mx-px` | `margin-inline: -1px;` |
| `mx-(&lt;custom-property&gt;)` | `margin-inline: var(&lt;custom-property&gt;);` |
| `mx-[&lt;value&gt;]` | `margin-inline: &lt;value&gt;;` |
| `my-&lt;number&gt;` | `margin-block: calc(var(--spacing) * &lt;number&gt;);` |
| `-my-&lt;number&gt;` | `margin-block: calc(var(--spacing) * -&lt;number&gt;);` |
| `my-auto` | `margin-block: auto;` |
| `my-px` | `margin-block: 1px;` |
| `-my-px` | `margin-block: -1px;` |
| `my-(&lt;custom-property&gt;)` | `margin-block: var(&lt;custom-property&gt;);` |
| `my-[&lt;value&gt;]` | `margin-block: &lt;value&gt;;` |
| `ms-&lt;number&gt;` | `margin-inline-start: calc(var(--spacing) * &lt;number&gt;);` |
| `-ms-&lt;number&gt;` | `margin-inline-start: calc(var(--spacing) * -&lt;number&gt;);` |
| `ms-auto` | `margin-inline-start: auto;` |
| `ms-px` | `margin-inline-start: 1px;` |
| `-ms-px` | `margin-inline-start: -1px;` |
| `ms-(&lt;custom-property&gt;)` | `margin-inline-start: var(&lt;custom-property&gt;);` |
| `ms-[&lt;value&gt;]` | `margin-inline-start: &lt;value&gt;;` |
| `me-&lt;number&gt;` | `margin-inline-end: calc(var(--spacing) * &lt;number&gt;);` |
| `-me-&lt;number&gt;` | `margin-inline-end: calc(var(--spacing) * -&lt;number&gt;);` |
| `me-auto` | `margin-inline-end: auto;` |
| `me-px` | `margin-inline-end: 1px;` |
| `-me-px` | `margin-inline-end: -1px;` |
| `me-(&lt;custom-property&gt;)` | `margin-inline-end: var(&lt;custom-property&gt;);` |
| `me-[&lt;value&gt;]` | `margin-inline-end: &lt;value&gt;;` |
| `mt-&lt;number&gt;` | `margin-top: calc(var(--spacing) * &lt;number&gt;);` |
| `-mt-&lt;number&gt;` | `margin-top: calc(var(--spacing) * -&lt;number&gt;);` |
| `mt-auto` | `margin-top: auto;` |
| `mt-px` | `margin-top: 1px;` |
| `-mt-px` | `margin-top: -1px;` |
| `mt-(&lt;custom-property&gt;)` | `margin-top: var(&lt;custom-property&gt;);` |
| `mt-[&lt;value&gt;]` | `margin-top: &lt;value&gt;;` |
| `mr-&lt;number&gt;` | `margin-right: calc(var(--spacing) * &lt;number&gt;);` |
| `-mr-&lt;number&gt;` | `margin-right: calc(var(--spacing) * -&lt;number&gt;);` |
| `mr-auto` | `margin-right: auto;` |
| `mr-px` | `margin-right: 1px;` |
| `-mr-px` | `margin-right: -1px;` |
| `mr-(&lt;custom-property&gt;)` | `margin-right: var(&lt;custom-property&gt;);` |
| `mr-[&lt;value&gt;]` | `margin-right: &lt;value&gt;;` |
| `mb-&lt;number&gt;` | `margin-bottom: calc(var(--spacing) * &lt;number&gt;);` |
| `-mb-&lt;number&gt;` | `margin-bottom: calc(var(--spacing) * -&lt;number&gt;);` |
| `mb-auto` | `margin-bottom: auto;` |
| `mb-px` | `margin-bottom: 1px;` |
| `-mb-px` | `margin-bottom: -1px;` |
| `mb-(&lt;custom-property&gt;)` | `margin-bottom: var(&lt;custom-property&gt;);` |
| `mb-[&lt;value&gt;]` | `margin-bottom: &lt;value&gt;;` |
| `ml-&lt;number&gt;` | `margin-left: calc(var(--spacing) * &lt;number&gt;);` |
| `-ml-&lt;number&gt;` | `margin-left: calc(var(--spacing) * -&lt;number&gt;);` |
| `ml-auto` | `margin-left: auto;` |
| `ml-px` | `margin-left: 1px;` |
| `-ml-px` | `margin-left: -1px;` |
| `ml-(&lt;custom-property&gt;)` | `margin-left: var(&lt;custom-property&gt;);` |
| `ml-[&lt;value&gt;]` | `margin-left: &lt;value&gt;;` |
| `space-x-&lt;number&gt;` | `& > :not(:last-child) { --tw-space-x-reverse: 0; margin-inline-start: calc(calc(var(--spacing) * &lt;number&gt;) * var(--tw-space-x-reverse)); margin-inline-end: calc(calc(var(--spacing) * &lt;number&gt;) * calc(1 - var(--tw-space-x-reverse))); }` |
| `-space-x-&lt;number&gt;` | `& > :not(:last-child) { --tw-space-x-reverse: 0; margin-inline-start: calc(calc(var(--spacing) * -&lt;number&gt;) * var(--tw-space-x-reverse)); margin-inline-end: calc(calc(var(--spacing) * -&lt;number&gt;) * calc(1 - var(--tw-space-x-reverse))); }` |
| `space-x-px` | `& > :not(:last-child) { --tw-space-x-reverse: 0; margin-inline-start: calc(1px * var(--tw-space-x-reverse)); margin-inline-end: calc(1px * calc(1 - var(--tw-space-x-reverse))); }` |
| `-space-x-px` | `& > :not(:last-child) { --tw-space-x-reverse: 0; margin-inline-start: calc(-1px * var(--tw-space-x-reverse)); margin-inline-end: calc(-1px * calc(1 - var(--tw-space-x-reverse))); }` |
| `space-x-(&lt;custom-property&gt;)` | `& > :not(:last-child) { --tw-space-x-reverse: 0; margin-inline-start: calc(var(&lt;custom-property&gt;) * var(--tw-space-x-reverse)); margin-inline-end: calc(var(&lt;custom-property&gt;) * calc(1 - var(--tw-space-x-reverse))); }` |
| `space-x-[&lt;value&gt;]` | `& > :not(:last-child) { --tw-space-x-reverse: 0; margin-inline-start: calc(&lt;value&gt; * var(--tw-space-x-reverse)); margin-inline-end: calc(&lt;value&gt; * calc(1 - var(--tw-space-x-reverse))); }` |
| `space-y-&lt;number&gt;` | `& > :not(:last-child) { --tw-space-y-reverse: 0; margin-block-start: calc(calc(var(--spacing) * &lt;number&gt;) * var(--tw-space-y-reverse)); margin-block-end: calc(calc(var(--spacing) * &lt;number&gt;) * calc(1 - var(--tw-space-y-reverse))); }` |
| `-space-y-&lt;number&gt;` | `& > :not(:last-child) { --tw-space-y-reverse: 0; margin-block-start: calc(calc(var(--spacing) * -&lt;number&gt;) * var(--tw-space-y-reverse)); margin-block-end: calc(calc(var(--spacing) * -&lt;number&gt;) * calc(1 - var(--tw-space-y-reverse))); }` |
| `space-y-px` | `& > :not(:last-child) { --tw-space-y-reverse: 0; margin-block-start: calc(1px * var(--tw-space-y-reverse)); margin-block-end: calc(1px * calc(1 - var(--tw-space-y-reverse))); }` |
| `-space-y-px` | `& > :not(:last-child) { --tw-space-y-reverse: 0; margin-block-start: calc(-1px * var(--tw-space-y-reverse)); margin-block-end: calc(-1px * calc(1 - var(--tw-space-y-reverse))); }` |
| `space-y-(&lt;custom-property&gt;)` | `& > :not(:last-child) { --tw-space-y-reverse: 0; margin-block-start: calc(var(&lt;custom-property&gt;) * var(--tw-space-y-reverse)); margin-block-end: calc(var(&lt;custom-property&gt;) * calc(1 - var(--tw-space-y-reverse))); }` |
| `space-y-[&lt;value&gt;]` | `& > :not(:last-child) { --tw-space-y-reverse: 0; margin-block-start: calc(&lt;value&gt; * var(--tw-space-y-reverse)); margin-block-end: calc(&lt;value&gt; * calc(1 - var(--tw-space-y-reverse))); }` |
| `space-x-reverse` | `& > :not(:last-child) { --tw-space-x-reverse: 1; }` |
| `space-y-reverse` | `& > :not(:last-child) { --tw-space-y-reverse: 1; }` |



## Examples

### Basic example

Use `m-&lt;number&gt;` utilities like `m-4` and `m-8` to control the margin on all sides of an element:

```html
<!-- [!code classes:m-8] -->
<div class="m-8 ...">m-8</div>
```

### Adding margin to a single side

Use `mt-&lt;number&gt;`, `mr-&lt;number&gt;`, `mb-&lt;number&gt;`, and `ml-&lt;number&gt;` utilities like `ml-2` and `mt-6` to control the margin on one side of an element:

```html
<!-- [!code classes:mt-6,mr-4,mb-8,ml-2] -->
<div class="mt-6 ...">mt-6</div>
<div class="mr-4 ...">mr-4</div>
<div class="mb-8 ...">mb-8</div>
<div class="ml-2 ...">ml-2</div>
```

### Adding horizontal margin

Use `mx-&lt;number&gt;` utilities like `mx-4` and `mx-8` to control the horizontal margin of an element:

```html
<!-- [!code classes:mx-8] -->
<div class="mx-8 ...">mx-8</div>
```

### Adding vertical margin

Use `my-&lt;number&gt;` utilities like `my-4` and `my-8` to control the vertical margin of an element:

```html
<!-- [!code classes:my-8] -->
<div class="my-8 ...">my-8</div>
```

### Using negative values

To use a negative margin value, prefix the class name with a dash to convert it to a negative value:

```html
<!-- [!code classes:-mt-8] -->
<div class="h-16 w-36 bg-sky-400 opacity-20 ..."></div>
<div class="-mt-8 bg-sky-300 ...">-mt-8</div>
```

### Using logical properties

Use `ms-&lt;number&gt;` or `me-&lt;number&gt;` utilities like `ms-4` and `me-8` to set the `margin-inline-start` and `margin-inline-end` logical properties:

```html
<!-- [!code classes:ms-8,me-8] -->
<!-- [!code word:dir="ltr"] -->
<!-- [!code word:dir="rtl"] -->
<div>
  <div dir="ltr">
    <div class="ms-8 ...">ms-8</div>
    <div class="me-8 ...">me-8</div>
  </div>
  <div dir="rtl">
    <div class="ms-8 ...">ms-8</div>
    <div class="me-8 ...">me-8</div>
  </div>
</div>
```

### Adding space between children

Use `space-x-&lt;number&gt;` or `space-y-&lt;number&gt;` utilities like `space-x-4` and `space-y-8` to control the space between elements:

```html
<!-- [!code classes:space-x-4] -->
<div class="flex space-x-4 ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

#### Reversing children order

If your elements are in reverse order (using say `flex-row-reverse` or `flex-col-reverse`), use the `space-x-reverse` or `space-y-reverse` utilities to ensure the space is added to the correct side of each element:

```html
<!-- [!code classes:flex-row-reverse,space-x-4,space-x-reverse] -->
<div class="flex flex-row-reverse space-x-4 space-x-reverse ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

#### Limitations

The space utilities are really just a shortcut for adding margin to all-but-the-last-item in a group, and aren't designed to handle complex cases like grids, layouts that wrap, or situations where the children are rendered in a complex custom order rather than their natural DOM order.

For those situations, it's better to use the gap utilities when possible, or add margin to every element with a matching negative margin on the parent.

Additionally, the space utilities are not designed to work together with the divide utilities. For those situations, consider adding margin/padding utilities to the children instead.

### Using a custom value

Use utilities like `m-[&lt;value&gt;]`,`mx-[&lt;value&gt;]`, and `mb-[&lt;value&gt;]` to set the margin based on a completely custom value:

```html
<div class="m-[5px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `m-(&lt;custom-property&gt;)` syntax:

```html
<div class="m-(--my-margin) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `m-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `margin` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="mt-4 md:mt-8 ...">
  <!-- ... -->
</div>
```


## Customizing your theme

The `m-&lt;number&gt;`,`mx-&lt;number&gt;`,`my-&lt;number&gt;`,`ms-&lt;number&gt;`,`me-&lt;number&gt;`,`mt-&lt;number&gt;`,`mr-&lt;number&gt;`,`mb-&lt;number&gt;`, and `ml-&lt;number&gt;` utilities are driven by the `--spacing` theme variable, which can be customized in your own theme:

```css
@theme {
  --spacing: 1px;
}
```

Learn more about customizing the spacing scale in the theme variable documentation.
