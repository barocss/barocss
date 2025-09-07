# filter: contrast()

Utilities for applying contrast filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `contrast-&lt;number&gt;` | `filter: contrast(&lt;number&gt;%);` |
| `contrast-(&lt;custom-property&gt;)` | `filter: contrast(var(&lt;custom-property&gt;));` |
| `contrast-[&lt;value&gt;]` | `filter: contrast(&lt;value&gt;);` |

## Examples

### Basic example

```html
<img class="contrast-125" src="/img/mountains.jpg" />
<img class="contrast-200" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="contrast-[1.2] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="contrast-(--my-contrast) ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="contrast-125 md:contrast-200 ..." src="/img/mountains.jpg" />
```
