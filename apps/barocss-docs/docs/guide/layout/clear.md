# clear

Utilities for controlling the wrapping of content around an element.

## Quick reference

| Class         | Styles            |
|---------------|-------------------|
| `clear-left`  | `clear: left;`    |
| `clear-right` | `clear: right;`   |
| `clear-both`  | `clear: both;`    |
| `clear-start` | `clear: inline-start;` |
| `clear-end`   | `clear: inline-end;`   |
| `clear-none`  | `clear: none;`    |

Source: https://tailwindcss.com/docs/clear

## Examples

### Clearing left

```html
<article>
  <img class="float-left mr-6 mb-4 aspect-16/9 w-1/4 rounded-lg object-cover ..." src="/img/a.jpg" />
  <img class="float-right ml-6 aspect-6/5 w-2/5 rounded-lg object-cover ..." src="/img/b.jpg" />
  <p class="clear-left text-justify">…</p>
</article>
```

### Clearing right

```html
<article>
  <img class="float-left mr-6 aspect-6/5 w-2/5 rounded-lg object-cover ..." src="/img/b.jpg" />
  <img class="float-right mb-4 ml-6 aspect-16/9 w-1/4 rounded-lg object-cover ..." src="/img/a.jpg" />
  <p class="clear-right text-justify">…</p>
</article>
```

### Clearing all

```html
<article>
  <img class="float-left mr-6 mb-4 aspect-16/9 w-1/4 rounded-lg object-cover ..." src="/img/a.jpg" />
  <img class="float-right ml-6 aspect-6/5 w-2/5 rounded-lg object-cover ..." src="/img/b.jpg" />
  <p class="clear-both text-justify">…</p>
</article>
```

### Using logical properties

```html
<article dir="rtl">
  <img class="float-left mr-6 mb-4 aspect-16/9 w-1/4 rounded-lg object-cover ..." src="/img/a.jpg" />
  <img class="float-right ml-6 aspect-6/5 w-2/5 rounded-lg object-cover ..." src="/img/b.jpg" />
  <p class="clear-end text-justify">…</p>
</article>
```

### Disabling clears

```html
<article>
  <img class="float-left mr-6 aspect-6/5 w-2/5 rounded-lg object-cover ..." src="/img/b.jpg" />
  <img class="float-right ml-6 aspect-16/9 w-1/4 rounded-lg object-cover ..." src="/img/a.jpg" />
  <p class="clear-none text-justify">…</p>
</article>
```

### Responsive design

Prefix a `clear` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="clear-left md:clear-none ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.
