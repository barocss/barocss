# overflow

Utilities for controlling how an element handles content that is too large for the container.

## Quick reference

| Class | Styles |
|---|---|
| `overflow-auto` | `overflow: auto;` |
| `overflow-hidden` | `overflow: hidden;` |
| `overflow-clip` | `overflow: clip;` |
| `overflow-visible` | `overflow: visible;` |
| `overflow-scroll` | `overflow: scroll;` |
| `overflow-x-auto` | `overflow-x: auto;` |
| `overflow-y-auto` | `overflow-y: auto;` |
| `overflow-x-hidden` | `overflow-x: hidden;` |
| `overflow-y-hidden` | `overflow-y: hidden;` |
| `overflow-x-clip` | `overflow-x: clip;` |
| `overflow-y-clip` | `overflow-y: clip;` |
| `overflow-x-visible` | `overflow-x: visible;` |
| `overflow-y-visible` | `overflow-y: visible;` |
| `overflow-x-scroll` | `overflow-x: scroll;` |
| `overflow-y-scroll` | `overflow-y: scroll;` |


## Examples

### Showing content that overflows

Use the `overflow-visible` utility to prevent content within an element from being clipped:

```html
<!-- [!code classes:overflow-visible] -->
<div class="overflow-visible ...">
  <!-- ... -->
</div>
```

Note that any content that overflows the bounds of the element will then be visible.

### Hiding content that overflows

Use the `overflow-hidden` utility to clip any content within an element that overflows the bounds of that element:

```html
<!-- [!code classes:overflow-hidden] -->
<div class="overflow-hidden ...">
  <!-- ... -->
</div>
```

### Scrolling if needed

Use the `overflow-auto` utility to add scrollbars to an element in the event that its content overflows the bounds of that element:

```html
<!-- [!code classes:overflow-auto] -->
<div class="overflow-auto ...">
  <!-- ... -->
</div>
```

Unlike `overflow-scroll`, which always shows scrollbars, this utility will only show them if scrolling is necessary.

### Scrolling horizontally if needed

Use the `overflow-x-auto` utility to allow horizontal scrolling if needed:

```html
<!-- [!code classes:overflow-x-auto] -->
<div class="overflow-x-auto ...">
  <!-- ... -->
</div>
```

### Scrolling vertically if needed

Use the `overflow-y-auto` utility to allow vertical scrolling if needed:

```html
<!-- [!code classes:overflow-y-auto] -->
<div class="h-32 overflow-y-auto ...">
  <!-- ... -->
</div>
```

### Scrolling horizontally always

Use the `overflow-x-scroll` utility to allow horizontal scrolling and always show scrollbars unless always-visible scrollbars are disabled by the operating system:

```html
<!-- [!code classes:overflow-x-scroll] -->
<div class="overflow-x-scroll ...">
  <!-- ... -->
</div>
```

### Scrolling vertically always

Use the `overflow-y-scroll` utility to allow vertical scrolling and always show scrollbars unless always-visible scrollbars are disabled by the operating system:

```html
<!-- [!code classes:overflow-y-scroll] -->
<div class="overflow-y-scroll ...">
  <!-- ... -->
</div>
```

### Scrolling in all directions

Use the `overflow-scroll` utility to add scrollbars to an element:

```html
<!-- [!code classes:overflow-scroll] -->
<div class="overflow-scroll ...">
  <!-- ... -->
</div>
```

Unlike `overflow-auto`, which only shows scrollbars if they are necessary, this utility always shows them. Note that some operating systems (like macOS) hide unnecessary scrollbars regardless of this setting.

### Responsive design

Prefix an `overflow` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="overflow-auto md:overflow-scroll ...">Lorem ipsum dolor sit amet...</div>
```

