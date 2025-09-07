# height

Utilities for setting the height of an element.

## Quick reference

| Class | Styles |
|---|---|
| `h-&lt;number&gt;` | `height: calc(var(--spacing) * &lt;number&gt;);` |
| `h-&lt;fraction&gt;` | `height: calc(&lt;fraction&gt; * 100%);` |
| `h-auto` | `height: auto;` |
| `h-px` | `height: 1px;` |
| `h-full` | `height: 100%;` |
| `h-screen` | `height: 100vh;` |
| `h-dvh` | `height: 100dvh;` |
| `h-dvw` | `height: 100dvw;` |
| `h-lvh` | `height: 100lvh;` |
| `h-lvw` | `height: 100lvw;` |
| `h-svh` | `height: 100svh;` |
| `h-svw` | `height: 100svw;` |
| `h-min` | `height: min-content;` |
| `h-max` | `height: max-content;` |
| `h-fit` | `height: fit-content;` |
| `h-lh` | `height: 1lh;` |
| `h-(&lt;custom-property&gt;)` | `height: var(&lt;custom-property&gt;);` |
| `h-[&lt;value&gt;]` | `height: &lt;value&gt;;` |
| `size-&lt;number&gt;` | `width: calc(var(--spacing) * &lt;number&gt;); height: calc(var(--spacing) * &lt;number&gt;);` |
| `size-&lt;fraction&gt;` | `width: calc(&lt;fraction&gt; * 100%); height: calc(&lt;fraction&gt; * 100%);` |
| `size-auto` | `width: auto; height: auto;` |
| `size-px` | `width: 1px; height: 1px;` |
| `size-full` | `width: 100%; height: 100%;` |
| `size-dvw` | `width: 100dvw; height: 100dvw;` |
| `size-dvh` | `width: 100dvh; height: 100dvh;` |
| `size-lvw` | `width: 100lvw; height: 100lvw;` |
| `size-lvh` | `width: 100lvh; height: 100lvh;` |
| `size-svw` | `width: 100svw; height: 100svw;` |
| `size-svh` | `width: 100svh; height: 100svh;` |
| `size-min` | `width: min-content; height: min-content;` |
| `size-max` | `width: max-content; height: max-content;` |
| `size-fit` | `width: fit-content; height: fit-content;` |
| `size-(&lt;custom-property&gt;)` | `width: var(&lt;custom-property&gt;); height: var(&lt;custom-property&gt;);` |
| `size-[&lt;value&gt;]` | `width: &lt;value&gt;; height: &lt;value&gt;;` |



## Examples

### Basic example

Use `h-&lt;number&gt;` utilities like `h-24` and `h-64` to set an element to a fixed height based on the spacing scale:

```html
<!-- [!code classes:h-96,h-80,h-64,h-48,h-40,h-32,h-24] -->
<div class="h-96 ...">h-96</div>
<div class="h-80 ...">h-80</div>
<div class="h-64 ...">h-64</div>
<div class="h-48 ...">h-48</div>
<div class="h-40 ...">h-40</div>
<div class="h-32 ...">h-32</div>
<div class="h-24 ...">h-24</div>
```

### Using a percentage

Use `h-full` or `h-&lt;fraction&gt;` utilities like `h-1/2` and `h-2/5` to give an element a percentage-based height:

```html
<!-- [!code classes:h-9/10,h-3/4,h-1/2,h-1/3,h-full] -->
<div class="h-full ...">h-full</div>
<div class="h-9/10 ...">h-9/10</div>
<div class="h-3/4 ...">h-3/4</div>
<div class="h-1/2 ...">h-1/2</div>
<div class="h-1/3 ...">h-1/3</div>
```

### Matching viewport

Use the `h-screen` utility to make an element span the entire height of the viewport:

```html
<!-- [!code classes:h-screen] -->
<div class="h-screen">
  <!-- ... -->
</div>
```

### Matching dynamic viewport

Use the `h-dvh` utility to make an element span the entire height of the viewport, which changes as the browser UI expands or contracts:

```html
<!-- [!code classes:h-dvh] -->
<div class="h-dvh">
  <!-- ... -->
</div>
```

### Matching large viewport

Use the `h-lvh` utility to set an element's height to the largest possible height of the viewport:

```html
<!-- [!code classes:h-lvh] -->
<div class="h-lvh">
  <!-- ... -->
</div>
```

### Matching small viewport

Use the `h-svh` utility to set an element's height to the smallest possible height of the viewport:

```html
<!-- [!code classes:h-svh] -->
<div class="h-svh">
  <!-- ... -->
</div>
```

### Setting both width and height

Use utilities like `size-px`, `size-4`, and `size-full` to set both the width and height of an element at the same time:

```html
<!-- [!code classes:size-16,size-20,size-24,size-32,size-40] -->
<div class="size-16 ...">size-16</div>
<div class="size-20 ...">size-20</div>
<div class="size-24 ...">size-24</div>
<div class="size-32 ...">size-32</div>
<div class="size-40 ...">size-40</div>
```

### Using a custom value

Use the `h-[&lt;value&gt;]` syntax to set the height based on a completely custom value:

```html
<div class="h-[32rem] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `h-(&lt;custom-property&gt;)` syntax:

```html
<div class="h-(--my-height) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `h-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `height` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="h-1/2 md:h-full ...">
  <!-- ... -->
</div>
```


## Customizing your theme

The `h-&lt;number&gt;` and `size-&lt;number&gt;` utilities are driven by the `--spacing` theme variable, which can be customized in your own theme:

```css
@theme {
  --spacing: 1px;
}
```

Learn more about customizing the spacing scale in the theme variable documentation.
