# flex-grow

Utilities for controlling how flex items grow.

## Quick reference

| Class | Styles |
|---|---|
| `grow` | `flex-grow: 1;` |
| `grow-&lt;number&gt;` | `flex-grow: &lt;number&gt;;` |
| `grow-[&lt;value&gt;]` | `flex-grow: &lt;value&gt;;` |
| `grow-(&lt;custom-property&gt;)` | `flex-grow: var(&lt;custom-property&gt;);` |

Source: https://tailwindcss.com/guide/flex-grow

## Examples

### Allowing items to grow

Use `grow` to allow a flex item to grow to fill any available space:

```html
<!-- [!code classes:grow] -->
<div class="flex ...">
  <div class="size-14 flex-none ...">01</div>
  <div class="size-14 grow ...">02</div>
  <div class="size-14 flex-none ...">03</div>
</div>
```

### Growing items based on factor

Use `grow-&lt;number&gt;` utilities like `grow-3` to make flex items grow proportionally based on their growth factor, allowing them to fill the available space relative to each other:

```html
<!-- [!code classes:grow-3,grow-7] -->
<div class="flex ...">
  <div class="size-14 grow-3 ...">01</div>
  <div class="size-14 grow-7 ...">02</div>
  <div class="size-14 grow-3 ...">03</div>
</div>
```

### Preventing items from growing

Use `grow-0` to prevent a flex item from growing:

```html
<!-- [!code classes:grow-0] -->
<div class="flex ...">
  <div class="size-14 grow ...">01</div>
  <div class="size-14 grow-0 ...">02</div>
  <div class="size-14 grow ...">03</div>
</div>
```

### Using a custom value

Use the `grow-[&lt;value&gt;]` syntax to set the flex grow based on a completely custom value:

```html
<div class="grow-[25vw] ...">Lorem ipsum dolor sit amet...</div>
```

For CSS variables, you can also use the `grow-(&lt;custom-property&gt;)` syntax:

```html
<div class="grow-(--my-grow) ...">Lorem ipsum dolor sit amet...</div>
```

This is just a shorthand for `grow-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `flex-grow` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grow md:grow-0 ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
