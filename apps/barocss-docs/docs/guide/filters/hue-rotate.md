# filter: hue-rotate()

Utilities for applying hue-rotate filters to an element.

## Quick reference

| Class | Styles |
|---|---|
| `hue-rotate-&lt;number&gt;` | `filter: hue-rotate(&lt;number&gt;deg);` |
| `-hue-rotate-&lt;number&gt;` | `filter: hue-rotate(calc(&lt;number&gt;deg * -1));` |
| `hue-rotate-(&lt;custom-property&gt;)` | `filter: hue-rotate(var(&lt;custom-property&gt;));` |
| `hue-rotate-[&lt;value&gt;]` | `filter: hue-rotate(&lt;value&gt;);` |

## Examples

### Basic example

```html
<img class="hue-rotate-60" src="/img/mountains.jpg" />
<img class="-hue-rotate-15" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="hue-rotate-[120deg] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="hue-rotate-(--my-hue) ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="hue-rotate-15 md:hue-rotate-60 ..." src="/img/mountains.jpg" />
```
