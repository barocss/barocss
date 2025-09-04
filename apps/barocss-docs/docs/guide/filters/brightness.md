# filter: brightness()

Utilities for applying brightness filters to an element.

Source: https://tailwindcss.com/docs/filter-brightness

## Quick reference

- `brightness-[<value>]`, `brightness-(<custom-property>)`, preset utilities like `brightness-110`, `brightness-150`

## Examples

### Basic example

Use utilities like `brightness-110` and `brightness-150` to increase the brightness of an element:

```html
<img class="brightness-110" src="/img/mountains.jpg" />
<img class="brightness-150" src="/img/mountains.jpg" />
```

### Using a custom value

Use the `brightness-[<value>]` syntax to set the brightness based on a completely custom value:

```html
<img class="brightness-[1.25] ..." src="/img/mountains.jpg" />
```

For CSS variables, you can also use the `brightness-(<custom-property>)` syntax:

```html
<img class="brightness-(--my-brightness) ..." src="/img/mountains.jpg" />
```

This is just a shorthand for `brightness-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `filter: brightness()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="brightness-110 md:brightness-150 ..." src="/img/mountains.jpg" />
```
