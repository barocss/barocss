# filter: invert()

Utilities for applying invert filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `invert` | `filter: invert(100%);` |
| `invert-&lt;number&gt;` | `filter: invert(&lt;number&gt;%);` |
| `invert-(&lt;custom-property&gt;)` | `filter: invert(var(&lt;custom-property&gt;));` |
| `invert-[&lt;value&gt;]` | `filter: invert(&lt;value&gt;);` |

## Examples

### Basic example

```html
<img class="invert" src="/img/mountains.jpg" />
<img class="invert-0" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="invert-[.8] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="invert-(--my-invert) ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="invert md:invert-0 ..." src="/img/mountains.jpg" />
```
