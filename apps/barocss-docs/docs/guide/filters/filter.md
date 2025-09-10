# filter

Utilities for applying filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `filter-none` | `filter: none;` |
| `filter-(&lt;custom-property&gt;)` | `filter: var(&lt;custom-property&gt;);` |
| `filter-[&lt;value&gt;]` | `filter: &lt;value&gt;;` |

You can combine filter utilities:
- `blur`, `brightness`, `contrast`, `drop-shadow`, `grayscale`, `hue-rotate`, `invert`, `saturate`, `sepia`

## Examples

### Basic example

```html
<img class="blur-xs" src="/img/mountains.jpg" />
<img class="grayscale" src="/img/mountains.jpg" />
<img class="blur-xs grayscale" src="/img/mountains.jpg" />
```

### Removing filters

```html
<img class="blur-md brightness-150 invert md:filter-none" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="filter-[url('filters.svg#filter-id')] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="filter-(--my-filter) ..." src="/img/mountains.jpg" />
```

### Applying on hover

```html
<img class="blur-sm hover:filter-none ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="blur-sm md:filter-none ..." src="/img/mountains.jpg" />
```

See also:
- Blur: /guide/filters/blur
- Brightness: /guide/filters/brightness
- Contrast: /guide/filters/contrast
- Drop Shadow: /guide/filters/drop-shadow
- Grayscale: /guide/filters/grayscale
- Hue Rotate: /guide/filters/hue-rotate
- Invert: /guide/filters/invert
- Saturate: /guide/filters/saturate
- Sepia: /guide/filters/sepia
