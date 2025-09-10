# overscroll-behavior

Utilities for controlling how the browser behaves when reaching the boundary of a scrolling area.

## Quick reference

| Class                   | Styles                          |
|-------------------------|---------------------------------|
| `overscroll-auto`       | `overscroll-behavior: auto;`    |
| `overscroll-contain`    | `overscroll-behavior: contain;` |
| `overscroll-none`       | `overscroll-behavior: none;`    |
| `overscroll-x-auto`     | `overscroll-behavior-x: auto;`  |
| `overscroll-x-contain`  | `overscroll-behavior-x: contain;` |
| `overscroll-x-none`     | `overscroll-behavior-x: none;`  |
| `overscroll-y-auto`     | `overscroll-behavior-y: auto;`  |
| `overscroll-y-contain`  | `overscroll-behavior-y: contain;` |
| `overscroll-y-none`     | `overscroll-behavior-y: none;`  |



## Examples

### Preventing parent overscrolling

```html
<div class="h-48 overflow-auto overscroll-contain p-8 ...">
  <p>Well, let me tell you something, …</p>
  <p>Sure, go ahead, laugh if you want to. …</p>
  <p>Maybe we can live without libraries, …</p>
</div>
```

### Preventing overscroll bouncing

```html
<div class="h-48 overflow-auto overscroll-none p-8 ...">
  <p>Well, let me tell you something, …</p>
  <p>Sure, go ahead, laugh if you want to. …</p>
  <p>Maybe we can live without libraries, …</p>
</div>
```

### Using the default overscroll behavior

```html
<div class="h-48 overflow-auto overscroll-auto p-8 ...">
  <p>Well, let me tell you something, …</p>
  <p>Sure, go ahead, laugh if you want to. …</p>
  <p>Maybe we can live without libraries, …</p>
</div>
```

### Responsive design

Prefix an `overscroll-behavior` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="overscroll-auto md:overscroll-contain ...">Lorem ipsum dolor sit amet...</div>
```

