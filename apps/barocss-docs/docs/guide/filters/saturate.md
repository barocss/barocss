# filter: saturate()

Utilities for applying saturate filters to an element.

Source: https://tailwindcss.com/docs/filter-saturate

## Quick reference

- `saturate-[<value>]`, `saturate-(<custom-property>)`, presets like `saturate-150`, `saturate-200`

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
