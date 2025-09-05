# scroll-padding

Utilities for controlling an element's scroll offset within a snap container.

Source: https://tailwindcss.com/guide/scroll-padding

## Quick reference

Prefixes map to properties:
- `scroll-p*`: scroll-padding
- `scroll-px/*-py/*-ps/*-pe/*-pt/*-pr/*-pb/*-pl`: per-side logical/physical

Supports: `&lt;number&gt;`, negative, `(<var>)`, `[&lt;value&gt;]`.

## Examples

### Basic example

Use utilities like `scroll-pl-6` and `scroll-pt-8` to control the scroll offset within a snap container:

```html
<div class="snap-x scroll-pl-6 ...">
  <div class="snap-start ...">
    <img src="/img/vacation-01.jpg" />
  </div>
  <!-- ... -->
</div>
```

### Using logical properties

Use logical properties like `scroll-ps-6` to control the scroll padding based on the writing direction:

```html
<div dir="ltr">
  <div class="snap-x scroll-ps-6 ...">
    <!-- ... -->
  </div>
</div>

<div dir="rtl">
  <div class="snap-x scroll-ps-6 ...">
    <!-- ... -->
  </div>
</div>
```

### Using negative values

Use negative values to reduce the scroll padding:

```html
<div class="-scroll-ps-6 snap-x ...">
  <!-- ... -->
</div>
```

### Using a custom value

Use the `scroll-padding-[&lt;value&gt;]` syntax to set the scroll padding based on a completely custom value:

```html
<div class="scroll-padding-[24rem] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `scroll-padding-(&lt;custom-property&gt;)` syntax:

```html
<div class="scroll-padding-(--my-padding) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `scroll-padding-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `scroll-padding` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="scroll-p-8 md:scroll-p-0 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
