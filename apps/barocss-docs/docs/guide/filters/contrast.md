# filter: contrast()

Utilities for applying contrast filters to an element.

Source: https://tailwindcss.com/guide/filter-contrast

## Quick reference

- `contrast-[&lt;value&gt;]`, `contrast-(&lt;custom-property&gt;)`, preset utilities like `contrast-125`, `contrast-200`

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
