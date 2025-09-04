# filter: sepia()

Utilities for applying sepia filters to an element.

Source: https://tailwindcss.com/docs/filter-sepia

## Quick reference

- `sepia`, `sepia-0`, `sepia-[<value>]`, `sepia-(<custom-property>)`

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
