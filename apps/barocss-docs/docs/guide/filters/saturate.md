# filter: saturate()

Utilities for applying saturate filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `saturate-&lt;number&gt;` | `filter: saturate(&lt;number&gt;%);` |
| `saturate-(&lt;custom-property&gt;)` | `filter: saturate(var(&lt;custom-property&gt;));` |
| `saturate-[&lt;value&gt;]` | `filter: saturate(&lt;value&gt;);` |

## Examples

### Basic example

```html
<img class="saturate-150" src="/img/mountains.jpg" />
<img class="saturate-200" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="saturate-[1.75] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="saturate-(--my-saturate) ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="saturate-150 md:saturate-200 ..." src="/img/mountains.jpg" />
```
