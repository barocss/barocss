# box-decoration-break

Utilities for controlling how element fragments should be rendered across multiple lines, columns, or pages.

## Quick reference

| Class                  | Styles                     |
|------------------------|----------------------------|
| `box-decoration-clone` | `box-decoration-break: clone;` |
| `box-decoration-slice` | `box-decoration-break: slice;` |


## Examples

### Basic example

Use utilities like `box-decoration-slice` and `box-decoration-clone` to control how element fragments should be rendered across multiple lines, columns, or pages:

```html
<span class="box-decoration-slice bg-linear-to-r from-indigo-600 to-pink-500 px-2 text-white ...">
  Hello<br />World
</span>
<span class="box-decoration-clone bg-linear-to-r from-indigo-600 to-pink-500 px-2 text-white ...">
  Hello<br />World
</span>
```

### Responsive design

Prefix a `box-decoration-break` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<span class="box-decoration-clone md:box-decoration-slice ...">Lorem ipsum dolor sit amet...</span>
```

