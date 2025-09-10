# filter: sepia()

Utilities for applying sepia filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `sepia` | `filter: sepia(100%);` |
| `sepia-&lt;number&gt;` | `filter: sepia(&lt;number&gt;%);` |
| `sepia-(&lt;custom-property&gt;)` | `filter: sepia(var(&lt;custom-property&gt;));` |
| `sepia-[&lt;value&gt;]` | `filter: sepia(&lt;value&gt;);` |

## Examples

### Basic example

```html
<img class="sepia" src="/img/mountains.jpg" />
<img class="sepia-0" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="sepia-[.8] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="sepia-(--my-sepia) ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="sepia md:sepia-0 ..." src="/img/mountains.jpg" />
```
