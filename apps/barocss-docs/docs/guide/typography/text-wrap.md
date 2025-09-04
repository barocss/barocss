# text-wrap

Utilities for controlling how text wraps within an element.

## Quick reference

| Class          | Styles                 |
|----------------|------------------------|
| `text-wrap`    | `text-wrap: wrap;`     |
| `text-nowrap`  | `text-wrap: nowrap;`   |
| `text-balance` | `text-wrap: balance;`  |
| `text-pretty`  | `text-wrap: pretty;`   |

Source: https://tailwindcss.com/docs/text-wrap

## Examples

### Allowing text to wrap

Use the `text-wrap` utility to allow text to wrap:

```html
<article class="text-wrap ...">
  <h3>Beloved Manhattan soup stand closes</h3>
  <p>New Yorkers are facing the winter chill...</p>
</article>
```

### Preventing text from wrapping

Use the `text-nowrap` utility to prevent text from wrapping:

```html
<article class="text-nowrap ...">
  <h3>Beloved Manhattan soup stand closes</h3>
  <p>New Yorkers are facing the winter chill...</p>
</article>
```

### Balanced text wrapping

Use the `text-balance` utility to balance text wrapping:

```html
<h3 class="text-balance ...">Beloved Manhattan soup stand closes</h3>
```

### Pretty text wrapping

Use the `text-pretty` utility to enable pretty text wrapping:

```html
<h3 class="text-pretty ...">Beloved Manhattan soup stand closes</h3>
```

### Responsive design

Prefix a `text-wrap` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<h1 class="text-pretty md:text-balance ...">Lorem ipsum dolor sit amet...</h1>
```

Learn more about using variants in the variants documentation.
