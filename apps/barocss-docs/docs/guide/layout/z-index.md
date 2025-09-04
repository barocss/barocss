# z-index

Utilities for controlling the stack order of an element.

## Quick reference

| Class | Styles |
|---|---|
| `z-<number>` | `z-index: <number>;` |
| `z-auto` | `z-index: auto;` |
| `z-[<value>]` | `z-index: <value>;` |
| `z-(<custom-property>)` | `z-index: var(<custom-property>);` |

Source: https://tailwindcss.com/docs/z-index

## Examples

### Basic example

Use the `z-<number>` utilities like `z-10` and `z-50` to control the stack order (or three-dimensional positioning) of an element, regardless of the order it has been displayed:

```html
<!-- [!code classes:z-40,z-30,z-20,z-10,z-0] -->
<div class="z-40 ...">05</div>
<div class="z-30 ...">04</div>
<div class="z-20 ...">03</div>
<div class="z-10 ...">02</div>
<div class="z-0 ...">01</div>
```

### Using negative values

To use a negative z-index value, prefix the class name with a dash to convert it to a negative value:

```html
<!-- [!code classes:-z-10] -->
<div class="...">05</div>
<div class="...">04</div>
<div class="-z-10 ...">03</div>
<div class="...">02</div>
<div class="...">01</div>
```

### Using a custom value

Use the `z-[<value>]` syntax to set the z-index based on a completely custom value:

```html
<div class="z-[999] ...">Lorem ipsum dolor sit amet...</div>
<div class="z-[calc(var(--index)+1)] ...">Lorem ipsum dolor sit amet...</div>
```

For CSS variables, you can also use the `z-(<custom-property>)` syntax:

```html
<div class="z-(--my-z-index) ...">Lorem ipsum dolor sit amet...</div>
```

This is just a shorthand for `z-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `z-index` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="z-0 md:z-50 ...">Lorem ipsum dolor sit amet...</div>
```

Learn more about using variants in the variants documentation.
