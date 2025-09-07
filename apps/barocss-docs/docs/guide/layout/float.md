# float

Utilities for controlling the wrapping of content around an element.

## Quick reference

| Class         | Styles            |
|---------------|-------------------|
| `float-right` | `float: right;`   |
| `float-left`  | `float: left;`    |
| `float-start` | `float: inline-start;` |
| `float-end`   | `float: inline-end;`   |
| `float-none`  | `float: none;`    |


## Examples

### Floating elements to the right

```html
<article>
  <img class="float-right ml-6 aspect-16/9 w-2/5 rounded-lg object-cover ..." src="/img/mountains.jpg" />
  <p class="text-justify">…</p>
</article>
```

### Floating elements to the left

```html
<article>
  <img class="float-left mr-6 aspect-16/9 w-2/5 rounded-lg object-cover ..." src="/img/mountains.jpg" />
  <p class="text-justify">…</p>
</article>
```

### Using logical properties

```html
<!-- [dir=ltr] -->
<article>
  <img class="float-start me-6 aspect-16/9 w-2/5 rounded-lg object-cover ..." src="/img/mountains.jpg" />
  <p class="text-justify">…</p>
</article>

<!-- [dir=rtl] -->
<article dir="rtl">
  <img class="float-start me-6 aspect-16/9 w-2/5 rounded-lg object-cover ..." src="/img/mountains.jpg" />
  <p class="text-justify">…</p>
</article>
```

### Disabling a float

```html
<article>
  <img class="float-none aspect-16/9 w-2/5 rounded-lg object-cover ..." src="/img/mountains.jpg" />
  <p class="text-justify">…</p>
</article>
```

### Responsive design

Prefix a `float` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="float-right md:float-left ..." src="/img/mountains.jpg" />
```

