# filter: grayscale()

Utilities for applying grayscale filters to an element.

Source: https://tailwindcss.com/docs/filter-grayscale

## Quick reference

- `grayscale`, `grayscale-0`, `grayscale-[<value>]`, `grayscale-(<custom-property>)`

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
