# top / right / bottom / left

Utilities for controlling the placement of positioned elements.

## Quick reference

Prefixes and properties:
- `inset-*`: `inset`
- `inset-x-*`: `inset-inline`
- `inset-y-*`: `inset-block`
- `start-*`: `inset-inline-start`
- `end-*`: `inset-inline-end`
- `top-*`: `top`
- `right-*`: `right`
- `bottom-*`: `bottom`
- `left-*`: `left`

Values (per prefix):
- `&lt;number&gt;`: `calc(var(--spacing) * &lt;number&gt;)`
- `-&lt;number&gt;`: `calc(var(--spacing) * -&lt;number&gt;)`
- `&lt;fraction&gt;`: `calc(&lt;fraction&gt; * 100%)`
- `-&lt;fraction&gt;`: `calc(&lt;fraction&gt; * -100%)`
- `px`: `1px` (also `-px`)
- `full`: `100%` (also `-full`)
- `auto`: `auto`
- `(&lt;custom-property&gt;)`: `var(&lt;custom-property&gt;)`
- `[&lt;value&gt;]`: `&lt;value&gt;`


## Examples

### Basic example

```html
<!-- Pin to top left corner -->
<div class="relative size-32 ...">
  <div class="absolute top-0 left-0 size-16 ...">01</div>
</div>

<!-- Span top edge -->
<div class="relative size-32 ...">
  <div class="absolute inset-x-0 top-0 h-16 ...">02</div>
</div>

<!-- Pin to top right corner -->
<div class="relative size-32 ...">
  <div class="absolute top-0 right-0 size-16 ...">03</div>
</div>

<!-- Span left edge -->
<div class="relative size-32 ...">
  <div class="absolute inset-y-0 left-0 w-16 ...">04</div>
</div>

<!-- Fill entire parent -->
<div class="relative size-32 ...">
  <div class="absolute inset-0 ...">05</div>
</div>

<!-- Span right edge -->
<div class="relative size-32 ...">
  <div class="absolute inset-y-0 right-0 w-16 ...">06</div>
</div>

<!-- Pin to bottom left corner -->
<div class="relative size-32 ...">
  <div class="absolute bottom-0 left-0 size-16 ...">07</div>
</div>

<!-- Span bottom edge -->
<div class="relative size-32 ...">
  <div class="absolute inset-x-0 bottom-0 h-16 ...">08</div>
</div>

<!-- Pin to bottom right corner -->
<div class="relative size-32 ...">
  <div class="absolute right-0 bottom-0 size-16 ...">09</div>
</div>
```

### Using negative values

```html
<div class="relative size-32 ...">
  <div class="absolute -top-4 -left-4 size-14 ..."></div>
</div>
```

### Using logical properties

```html
<!-- LTR -->
<div dir="ltr">
  <div class="relative size-32 ...">
    <div class="absolute start-0 top-0 size-14 ..."></div>
  </div>
</div>

<!-- RTL -->
<div dir="rtl">
  <div class="relative size-32 ...">
    <div class="absolute start-0 top-0 size-14 ..."></div>
  </div>
</div>
```

### Using a custom value

```html
<div class="relative">
  <div class="absolute top-[3px] ..."></div>
</div>
```

### Responsive design

Prefix a positioning utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="relative top-4 md:top-6 ...">Lorem ipsum dolor sit amet...</div>
```


## Customizing your theme

Use the `--spacing-*` theme variables to customize the positioning utilities in your project:

```css
@theme {
  --spacing-18: 4.5rem;
}
```

Now the `top-18`, `right-18`, `bottom-18`, `left-18`, `inset-18`, `start-18`, and `end-18` utilities can be used in your markup:

```html
<div class="relative top-18 ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about customizing your theme in the theme documentation.
