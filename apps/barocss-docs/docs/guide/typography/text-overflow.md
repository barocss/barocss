# text-overflow

Utilities for controlling how the text of an element overflows.

## Quick reference

| Class          | Styles                                      |
|----------------|---------------------------------------------|
| `truncate`     | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` |
| `text-ellipsis`| `text-overflow: ellipsis;`                  |
| `text-clip`    | `text-overflow: clip;`                      |



## Examples

### Truncating text

Use the `truncate` utility to truncate text with an ellipsis:

```html
<p class="truncate ...">The longest word in any of the major...</p>
```

### Adding an ellipsis

Use the `text-ellipsis` utility to add an ellipsis to text:

```html
<p class="overflow-hidden text-ellipsis ...">The longest word in any of the major...</p>
```

### Clipping text

Use the `text-clip` utility to clip text:

```html
<p class="overflow-hidden text-clip ...">The longest word in any of the major...</p>
```

### Responsive design

Prefix a `text-overflow` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="text-ellipsis md:text-clip ...">Lorem ipsum dolor sit amet...</p>
```


