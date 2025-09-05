# padding

Utilities for controlling an element's padding.

## Quick reference

| Class | Styles |
|---|---|
| `p-&lt;number&gt;` | `padding: calc(var(--spacing) * &lt;number&gt;);` |
| `p-px` | `padding: 1px;` |
| `p-(&lt;custom-property&gt;)` | `padding: var(&lt;custom-property&gt;);` |
| `p-[&lt;value&gt;]` | `padding: &lt;value&gt;;` |
| `px-&lt;number&gt;` | `padding-inline: calc(var(--spacing) * &lt;number&gt;);` |
| `px-px` | `padding-inline: 1px;` |
| `px-(&lt;custom-property&gt;)` | `padding-inline: var(&lt;custom-property&gt;);` |
| `px-[&lt;value&gt;]` | `padding-inline: &lt;value&gt;;` |
| `py-&lt;number&gt;` | `padding-block: calc(var(--spacing) * &lt;number&gt;);` |
| `py-px` | `padding-block: 1px;` |
| `py-(&lt;custom-property&gt;)` | `padding-block: var(&lt;custom-property&gt;);` |
| `py-[&lt;value&gt;]` | `padding-block: &lt;value&gt;;` |
| `ps-&lt;number&gt;` | `padding-inline-start: calc(var(--spacing) * &lt;number&gt;);` |
| `ps-px` | `padding-inline-start: 1px;` |
| `ps-(&lt;custom-property&gt;)` | `padding-inline-start: var(&lt;custom-property&gt;);` |
| `ps-[&lt;value&gt;]` | `padding-inline-start: &lt;value&gt;;` |
| `pe-&lt;number&gt;` | `padding-inline-end: calc(var(--spacing) * &lt;number&gt;);` |
| `pe-px` | `padding-inline-end: 1px;` |
| `pe-(&lt;custom-property&gt;)` | `padding-inline-end: var(&lt;custom-property&gt;);` |
| `pe-[&lt;value&gt;]` | `padding-inline-end: &lt;value&gt;;` |
| `pt-&lt;number&gt;` | `padding-top: calc(var(--spacing) * &lt;number&gt;);` |
| `pt-px` | `padding-top: 1px;` |
| `pt-(&lt;custom-property&gt;)` | `padding-top: var(&lt;custom-property&gt;);` |
| `pt-[&lt;value&gt;]` | `padding-top: &lt;value&gt;;` |
| `pr-&lt;number&gt;` | `padding-right: calc(var(--spacing) * &lt;number&gt;);` |
| `pr-px` | `padding-right: 1px;` |
| `pr-(&lt;custom-property&gt;)` | `padding-right: var(&lt;custom-property&gt;);` |
| `pr-[&lt;value&gt;]` | `padding-right: &lt;value&gt;;` |
| `pb-&lt;number&gt;` | `padding-bottom: calc(var(--spacing) * &lt;number&gt;);` |
| `pb-px` | `padding-bottom: 1px;` |
| `pb-(&lt;custom-property&gt;)` | `padding-bottom: var(&lt;custom-property&gt;);` |
| `pb-[&lt;value&gt;]` | `padding-bottom: &lt;value&gt;;` |
| `pl-&lt;number&gt;` | `padding-left: calc(var(--spacing) * &lt;number&gt;);` |
| `pl-px` | `padding-left: 1px;` |
| `pl-(&lt;custom-property&gt;)` | `padding-left: var(&lt;custom-property&gt;);` |
| `pl-[&lt;value&gt;]` | `padding-left: &lt;value&gt;;` |

Source: https://tailwindcss.com/guide/padding

## Examples

### Basic example

Use `p-&lt;number&gt;` utilities like `p-4` and `p-8` to control the padding on all sides of an element:

```html
<!-- [!code classes:p-8] -->
<div class="p-8 ...">p-8</div>
```

### Adding padding to one side

Use `pt-&lt;number&gt;`, `pr-&lt;number&gt;`, `pb-&lt;number&gt;`, and `pl-&lt;number&gt;` utilities like `pt-6` and `pr-4` to control the padding on one side of an element:

```html
<!-- [!code classes:pt-6,pr-4,pb-8,pl-2] -->
<div class="pt-6 ...">pt-6</div>
<div class="pr-4 ...">pr-4</div>
<div class="pb-8 ...">pb-8</div>
<div class="pl-2 ...">pl-2</div>
```

### Adding horizontal padding

Use `px-&lt;number&gt;` utilities like `px-4` and `px-8` to control the horizontal padding of an element:

```html
<!-- [!code classes:px-8] -->
<div class="px-8 ...">px-8</div>
```

### Adding vertical padding

Use `py-&lt;number&gt;` utilities like `py-4` and `py-8` to control the vertical padding of an element:

```html
<!-- [!code classes:py-8] -->
<div class="py-8 ...">py-8</div>
```

### Using logical properties

Use `ps-&lt;number&gt;` or `pe-&lt;number&gt;` utilities like `ps-4` and `pe-8` to set the `padding-inline-start` and `padding-inline-end` logical properties, which map to either the left or right side based on the text direction:

```html
<!-- [!code classes:ps-8,pe-8] -->
<!-- [!code word:dir="ltr"] -->
<!-- [!code word:dir="rtl"] -->
<div>
  <div dir="ltr">
    <div class="ps-8 ...">ps-8</div>
    <div class="pe-8 ...">pe-8</div>
  </div>
  <div dir="rtl">
    <div class="ps-8 ...">ps-8</div>
    <div class="pe-8 ...">pe-8</div>
  </div>
</div>
```

For more control, you can also use the LTR and RTL modifiers to conditionally apply specific styles depending on the current text direction.

### Using a custom value

Use utilities like `p-[&lt;value&gt;]`,`px-[&lt;value&gt;]`, and `pb-[&lt;value&gt;]` to set the padding based on a completely custom value:

```html
<div class="p-[5px] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `p-(&lt;custom-property&gt;)` syntax:

```html
<div class="p-(--my-padding) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `p-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `padding` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="py-4 md:py-8 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

The `p-&lt;number&gt;`,`px-&lt;number&gt;`,`py-&lt;number&gt;`,`ps-&lt;number&gt;`,`pe-&lt;number&gt;`,`pt-&lt;number&gt;`,`pr-&lt;number&gt;`,`pb-&lt;number&gt;`, and `pl-&lt;number&gt;` utilities are driven by the `--spacing` theme variable, which can be customized in your own theme:

```css
@theme {
  --spacing: 1px;
}
```

Learn more about customizing the spacing scale in the theme variable documentation.
