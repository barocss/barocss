# filter: drop-shadow()

Utilities for applying drop-shadow filters to an element.

Source: https://tailwindcss.com/docs/filter-drop-shadow

## Quick reference

- Presets like `drop-shadow-sm`, `drop-shadow-md`, `drop-shadow-lg`, `drop-shadow-xl`, `drop-shadow-2xl`, `drop-shadow-none`
- `drop-shadow-[<value>]`, `drop-shadow-(<custom-property>)`

## Examples

### Basic example

```html
<img class="drop-shadow-sm" src="/img/mountains.jpg" />
<img class="drop-shadow-lg" src="/img/mountains.jpg" />
```

### Using a custom value

```html
<img class="drop-shadow-[0_35px_35px_rgba(0,0,0,0.25)] ..." src="/img/mountains.jpg" />
```

For CSS variables:

```html
<img class="drop-shadow-(--my-drop-shadow) ..." src="/img/mountains.jpg" />
```

### Responsive design

```html
<img class="drop-shadow-none md:drop-shadow-lg ..." src="/img/mountains.jpg" />
```
