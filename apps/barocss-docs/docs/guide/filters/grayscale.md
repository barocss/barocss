# filter: grayscale()

Utilities for applying grayscale filters to an element.

## Quick reference

| Class | Styles |
|---|---|
| `grayscale` | `filter: grayscale(100%);` |
| `grayscale-0` | `filter: grayscale(0%);` |
| `grayscale-(&lt;custom-property&gt;)` | `filter: grayscale(var(&lt;custom-property&gt;));` |
| `grayscale-[&lt;value&gt;]` | `filter: grayscale(&lt;value&gt;);` |

## Examples

### Basic example

```html
<img class="grayscale" src="/img/mountains.jpg" />
<img class="grayscale-0" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="grayscale-[.8] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="grayscale-(--my-grayscale) ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="grayscale md:grayscale-0 ..." src="/img/mountains.jpg" />
```
