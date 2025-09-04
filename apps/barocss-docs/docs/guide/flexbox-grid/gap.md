# gap

Utilities for controlling gutters between grid and flexbox items.

## Quick reference

| Class | Styles |
|---|---|
| `gap-<number>` | `gap: calc(var(--spacing) * <value>);` |
| `gap-(<custom-property>)` | `gap: var(<custom-property>);` |
| `gap-[<value>]` | `gap: <value>;` |
| `gap-x-<number>` | `column-gap: calc(var(--spacing) * <value>);` |
| `gap-x-(<custom-property>)` | `column-gap: var(<custom-property>);` |
| `gap-x-[<value>]` | `column-gap: <value>;` |
| `gap-y-<number>` | `row-gap: calc(var(--spacing) * <value>);` |
| `gap-y-(<custom-property>)` | `row-gap: var(<custom-property>);` |
| `gap-y-[<value>]` | `row-gap: <value>;` |

Source: https://tailwindcss.com/docs/gap

## Examples

### Basic example

Use `gap-<number>` utilities like `gap-2` and `gap-4` to change the gap between both rows and columns in grid and flexbox layouts:

```html
<!-- [!code classes:gap-4] -->
<div class="grid grid-cols-2 gap-4">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

### Changing row and column gaps independently

Use `gap-x-<number>` or `gap-y-<number>` utilities like `gap-x-8` and `gap-y-4` to change the gap between columns and rows independently:

```html
<!-- [!code classes:gap-x-8,gap-y-4] -->
<div class="grid grid-cols-3 gap-x-8 gap-y-4">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
  <div>05</div>
  <div>06</div>
</div>
```

### Using a custom value

Use the `gap-[<value>]` syntax to set the gap based on a completely custom value:

```html
<div class="grid gap-[10vw] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `gap-(<custom-property>)` syntax:

```html
<div class="grid gap-(--my-gap) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `gap-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `gap` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="grid gap-4 md:gap-6 ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
