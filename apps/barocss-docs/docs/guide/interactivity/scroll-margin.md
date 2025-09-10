# scroll-margin

Utilities for controlling the scroll offset around items in a snap container.



## Quick reference

Prefixes map to properties:
- `scroll-m*`: scroll-margin
- `scroll-mx/*-my/*-ms/*-me/*-mt/*-mr/*-mb/*-ml`: per-side logical/physical

Supports: `&lt;number&gt;`, negative, `(<var>)`, `[&lt;value&gt;]`.

## Examples

### Basic example

Use utilities like `scroll-ml-6` and `scroll-mt-8` to control the scroll offset around items in a snap container:

```html
<div class="snap-x ...">
  <div class="snap-start scroll-ml-6 ...">
    <img src="/img/vacation-01.jpg" />
  </div>
  <!-- ... -->
</div>
```

### Using negative values

Use negative values to reduce the scroll offset:

```html
<div class="snap-start -scroll-ml-6 ...">
  <!-- ... -->
</div>
```

### Using logical properties

Use logical properties like `scroll-ms-6` to control the scroll offset based on the writing direction:

```html
<div dir="ltr">
  <div class="snap-x ...">
    <div class="snap-start scroll-ms-6 ...">
      <!-- ... -->
    </div>
  </div>
</div>

<div dir="rtl">
  <div class="snap-x ...">
    <div class="snap-start scroll-ms-6 ...">
      <!-- ... -->
    </div>
  </div>
</div>
```

### Using a custom value

Use the `scroll-margin-[&lt;value&gt;]` syntax to set the scroll margin based on a completely custom value:

```html
<div class="scroll-margin-[24rem] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `scroll-margin-(&lt;custom-property&gt;)` syntax:

```html
<div class="scroll-margin-(--my-margin) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `scroll-margin-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `scroll-margin` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="scroll-m-8 md:scroll-m-0 ...">
  <!-- ... -->
</div>
```

