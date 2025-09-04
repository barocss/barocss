# filter: invert()

Utilities for applying invert filters to an element.

Source: https://tailwindcss.com/docs/filter-invert

## Quick reference

- `invert`, `invert-0`, `invert-[<value>]`, `invert-(<custom-property>)`

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
