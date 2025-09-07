# filter: blur()

Utilities for applying blur filters to an element.


## Quick reference

| Class | Styles |
|---|---|
| `blur-none` | `filter: ;` |
| `blur-xs` | `filter: blur(var(--blur-xs));` |
| `blur-sm` | `filter: blur(var(--blur-sm));` |
| `blur-md` | `filter: blur(var(--blur-md));` |
| `blur-lg` | `filter: blur(var(--blur-lg));` |
| `blur-xl` | `filter: blur(var(--blur-xl));` |
| `blur-2xl` | `filter: blur(var(--blur-2xl));` |
| `blur-3xl` | `filter: blur(var(--blur-3xl));` |
| `blur-(&lt;custom-property&gt;)` | `filter: blur(var(&lt;custom-property&gt;));` |
| `blur-[&lt;value&gt;]` | `filter: blur(&lt;value&gt;);` |

## Examples

### Basic example

Use utilities like `blur-sm` and `blur-lg` to blur an element:

```html
<img class="blur-none" src="/img/mountains.jpg" />
<img class="blur-sm" src="/img/mountains.jpg" />
<img class="blur-lg" src="/img/mountains.jpg" />
<img class="blur-2xl" src="/img/mountains.jpg" />
```

### Using a custom value

Use the `blur-[&lt;value&gt;]` syntax to set the blur based on a completely custom value:

```html
<img class="blur-[2px] ..." src="/img/mountains.jpg" />
```

For CSS variables, you can also use the `blur-(&lt;custom-property&gt;)` syntax:

```html
<img class="blur-(--my-blur) ..." src="/img/mountains.jpg" />
```

This is just a shorthand for `blur-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `filter: blur()` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="blur-none md:blur-lg ..." src="/img/mountains.jpg" />
```

## Customizing your theme

Use the `--blur-*` theme variables to customize the blur utilities in your project:

```css
@theme {
  --blur-2xs: 2px;
}
```

Now the `blur-2xs` utility can be used in your markup:

```html
<img class="blur-2xs" src="/img/mountains.jpg" />
```

