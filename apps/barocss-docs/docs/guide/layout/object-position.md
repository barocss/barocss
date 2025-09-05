# object-position

Utilities for controlling how a replaced element's content should be positioned within its container.

## Quick reference

| Class                  | Styles                          |
|------------------------|---------------------------------|
| `object-top-left`      | `object-position: top left;`    |
| `object-top`           | `object-position: top;`         |
| `object-top-right`     | `object-position: top right;`   |
| `object-left`          | `object-position: left;`        |
| `object-center`        | `object-position: center;`      |
| `object-right`         | `object-position: right;`       |
| `object-bottom-left`   | `object-position: bottom left;` |
| `object-bottom`        | `object-position: bottom;`      |
| `object-bottom-right`  | `object-position: bottom right;`|
| `object-(&lt;custom-property&gt;)` | `object-position: var(&lt;custom-property&gt;);` |
| `object-[&lt;value&gt;]`     | `object-position: &lt;value&gt;;`     |

Source: https://tailwindcss.com/guide/object-position

## Examples

### Basic example

```html
<img class="size-24 object-top-left ..." src="/img/mountains.jpg" />
<img class="size-24 object-top ..." src="/img/mountains.jpg" />
<img class="size-24 object-top-right ..." src="/img/mountains.jpg" />
<img class="size-24 object-left ..." src="/img/mountains.jpg" />
<img class="size-24 object-center ..." src="/img/mountains.jpg" />
<img class="size-24 object-right ..." src="/img/mountains.jpg" />
<img class="size-24 object-bottom-left ..." src="/img/mountains.jpg" />
<img class="size-24 object-bottom ..." src="/img/mountains.jpg" />
<img class="size-24 object-bottom-right ..." src="/img/mountains.jpg" />
```

### Using a custom value

Use the `object-[&lt;value&gt;]` syntax to set the object position based on a completely custom value:

```html
<img class="object-[25%_75%] ..." src="/img/mountains.jpg" />
```

For CSS variables, you can also use the `object-(&lt;custom-property&gt;)` syntax:

```html
<img class="object-(--my-position) ..." src="/img/mountains.jpg" />
```

This is just a shorthand for `object-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `object-position` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="object-center md:object-top ..." src="/img/mountains.jpg" />
```

Learn more about using variants in the variants documentation.
