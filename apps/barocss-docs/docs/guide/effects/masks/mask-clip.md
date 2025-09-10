# mask-clip

Utilities for controlling the bounding box of an element's mask.

## Quick reference

| Class               | Styles                    |
|---------------------|---------------------------|
| `mask-clip-border`  | `mask-clip: border-box;`  |
| `mask-clip-padding` | `mask-clip: padding-box;` |
| `mask-clip-content` | `mask-clip: content-box;` |
| `mask-clip-fill`    | `mask-clip: fill-box;`    |
| `mask-clip-stroke`  | `mask-clip: stroke-box;`  |
| `mask-clip-view`    | `mask-clip: view-box;`    |
| `mask-no-clip`      | `mask-clip: no-clip;`     |



## Examples

### Basic example

Use utilities like `mask-clip-border` and `mask-clip-padding` to control the bounding box of an element's mask:

```
<div class="mask-clip-border border-3 p-1.5 mask-[url(/img/circle.png)] bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-clip-padding border-3 p-1.5 mask-[url(/img/circle.png)] bg-[url(/img/mountains.jpg)] ..."></div>
<div class="mask-clip-content border-3 p-1.5 mask-[url(/img/circle.png)] bg-[url(/img/mountains.jpg)] ..."></div>
```

### Responsive design

Prefix a `mask-clip` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<div class="mask-clip-border md:mask-clip-padding">
  <!-- ... -->
</div>
```

