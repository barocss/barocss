# justify-content

Utilities for controlling how flex and grid items are positioned along a container's main axis.

## Quick reference

| Class | Styles |
|---|---|
| `justify-start` | `justify-content: flex-start;` |
| `justify-end` | `justify-content: flex-end;` |
| `justify-end-safe` | `justify-content: safe flex-end;` |
| `justify-center` | `justify-content: center;` |
| `justify-center-safe` | `justify-content: safe center;` |
| `justify-between` | `justify-content: space-between;` |
| `justify-around` | `justify-content: space-around;` |
| `justify-evenly` | `justify-content: space-evenly;` |
| `justify-stretch` | `justify-content: stretch;` |
| `justify-baseline` | `justify-content: baseline;` |
| `justify-normal` | `justify-content: normal;` |

Source: https://tailwindcss.com/docs/justify-content

## Examples

### Start

Use the `justify-start` utility to justify items against the start of the container's main axis:

```html
<!-- [!code classes:justify-start] -->
<div class="flex justify-start ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Center

Use the `justify-center` or `justify-center-safe` utilities to justify items along the center of the container's main axis:

```html
<!-- [!code filename:justify-center] -->
<!-- [!code classes:justify-center] -->
<div class="flex justify-center ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

```html
<!-- [!code filename:justify-center-safe] -->
<!-- [!code classes:justify-center-safe] -->
<div class="flex justify-center-safe ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>04</div>
</div>
```

When there is not enough space available, the `justify-center-safe` utility will align items to the start of the container instead of the center.

### End

Use the `justify-end` or `justify-end-safe` utilities to justify items against the end of the container's main axis:

```html
<!-- [!code filename:justify-end] -->
<!-- [!code classes:justify-end] -->
<div class="flex justify-end ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>03</div>
</div>
```

```html
<!-- [!code filename:justify-end-safe] -->
<!-- [!code classes:justify-end-safe] -->
<div class="flex justify-end-safe ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
  <div>03</div>
</div>
```

When there is not enough space available, the `justify-end-safe` utility will align items to the start of the container instead of the end.

### Space between

Use the `justify-between` utility to justify items along the container's main axis such that there is an equal amount of space between each item:

```html
<!-- [!code classes:justify-between] -->
<div class="flex justify-between ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Space around

Use the `justify-around` utility to justify items along the container's main axis such that there is an equal amount of space on each side of each item:

```html
<!-- [!code classes:justify-around] -->
<div class="flex justify-around ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Space evenly

Use the `justify-evenly` utility to justify items along the container's main axis such that there is an equal amount of space around each item, but also accounting for the doubling of space you would normally see between each item when using `justify-around`:

```html
<!-- [!code classes:justify-evenly] -->
<div class="flex justify-evenly ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Stretch

Use the `justify-stretch` utility to allow auto-sized content items to fill the available space along the container's main axis:

```html
<!-- [!code classes:justify-stretch] -->
<div class="grid grid-cols-[4rem_auto_4rem] justify-stretch ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Normal

Use the `justify-normal` utility to pack content items in their default position as if no `justify-content` value was set:

```html
<!-- [!code classes:justify-normal] -->
<div class="flex justify-normal ...">
  <div>01</div>
  <div>02</div>
  <div>03</div>
</div>
```

### Responsive design

Prefix a `justify-content` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="flex justify-start md:justify-between ...">
  <!-- ... -->
</div>
```

Learn more about using variants in the variants documentation.
