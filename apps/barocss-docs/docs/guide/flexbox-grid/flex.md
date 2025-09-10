# flex

Utilities for controlling how flex items both grow and shrink.

## Quick reference

| Class | Styles |
|---|---|
| `flex-&lt;number&gt;` | `flex: &lt;number&gt;;` |
| `flex-&lt;fraction&gt;` | `flex: calc(&lt;fraction&gt; * 100%);` |
| `flex-auto` | `flex: auto;` |
| `flex-initial` | `flex: 0 auto;` |
| `flex-none` | `flex: none;` |
| `flex-(&lt;custom-property&gt;)` | `flex: var(&lt;custom-property&gt;);` |
| `flex-[&lt;value&gt;]` | `flex: &lt;value&gt;;` |


## Examples

### Basic example

Use `flex-&lt;number&gt;` utilities like `flex-1` to allow a flex item to grow and shrink as needed, ignoring its initial size:

```html
<!-- [!code word:flex-1] -->
<div class="flex">
  <div class="w-14 flex-none ...">01</div>
  <div class="w-64 flex-1 ...">02</div>
  <div class="w-32 flex-1 ...">03</div>
</div>
```

### Initial

Use `flex-initial` to allow a flex item to shrink but not grow, taking into account its initial size:

```html
<!-- [!code word:flex-initial] -->
<div class="flex">
  <div class="w-14 flex-none ...">01</div>
  <div class="w-64 flex-initial ...">02</div>
  <div class="w-32 flex-initial ...">03</div>
</div>
```

### Auto

Use `flex-auto` to allow a flex item to grow and shrink, taking into account its initial size:

```html
<!-- [!code word:flex-auto] -->
<div class="flex ...">
  <div class="w-14 flex-none ...">01</div>
  <div class="w-64 flex-auto ...">02</div>
  <div class="w-32 flex-auto ...">03</div>
</div>
```

### None

Use `flex-none` to prevent a flex item from growing or shrinking:

```html
<!-- [!code word:flex-none] -->
<div class="flex ...">
  <div class="w-14 flex-none ...">01</div>
  <div class="w-32 flex-none ...">02</div>
  <div class="flex-1 ...">03</div>
</div>
```

### Using a custom value

Use the `flex-[&lt;value&gt;]` syntax to set the flex based on a completely custom value:

```html
<div class="flex-[3_1_auto] ...">Lorem ipsum dolor sit amet...</div>
```

For CSS variables, you can also use the `flex-(&lt;custom-property&gt;)` syntax:

```html
<div class="flex-(--my-flex) ...">Lorem ipsum dolor sit amet...</div>
```

This is just a shorthand for `flex-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `flex` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="flex-none md:flex-1 ...">Lorem ipsum dolor sit amet...</div>
```

