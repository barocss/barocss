# filter: hue-rotate()

Utilities for applying hue-rotate filters to an element.

Source: https://tailwindcss.com/docs/filter-hue-rotate

## Quick reference

- Presets like `hue-rotate-15`, `hue-rotate-30`, `hue-rotate-60`, negative variants `-hue-rotate-15`, etc.
- `hue-rotate-[<angle>]`, `hue-rotate-(<custom-property>)`

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
