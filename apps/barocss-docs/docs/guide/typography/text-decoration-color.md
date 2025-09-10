# text-decoration-color

Utilities for controlling the color of text decorations.

## Quick reference

| Class                    | Styles                                   |
|--------------------------|------------------------------------------|
| `decoration-inherit`     | `text-decoration-color: inherit;`        |
| `decoration-current`     | `text-decoration-color: currentColor;`   |
| `decoration-transparent` | `text-decoration-color: transparent;`    |
| `decoration-&lt;color&gt;`     | `text-decoration-color: var(--color-&lt;color&gt;);` |
| `decoration-(&lt;custom-property&gt;)` | `text-decoration-color: var(&lt;custom-property&gt;);` |
| `decoration-[&lt;value&gt;]`   | `text-decoration-color: &lt;value&gt;;`        |


## Examples

### Basic example

Use utilities like `decoration-sky-500` and `decoration-pink-500` to control the color of text decorations:

```html
<p>
  I'm Derek at <a class="underline decoration-sky-500 ...">My Company, Inc</a>.
  I like to <a class="underline decoration-pink-500 ...">watch pod-racing</a>
  and <a class="underline decoration-indigo-500 ...">light-saber</a> fights.
</p>
```

### Changing the opacity

Use the color opacity modifier to control the text decoration color opacity of an element:

```html
<a class="underline decoration-sky-500/30 ...">My Company, Inc</a>
```

### Using a custom value

Use the `decoration-[&lt;value&gt;]` syntax to set the text decoration color based on a completely custom value:

```html
<a class="underline decoration-[#50d71e] ...">Lorem ipsum dolor sit amet...</a>
```

For CSS variables, you can also use the `decoration-(&lt;custom-property&gt;)` syntax:

```html
<a class="underline decoration-(--my-color) ...">Lorem ipsum dolor sit amet...</a>
```

This is just a shorthand for `decoration-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Applying on hover

Prefix a `text-decoration-color` utility with a variant like `hover:*` to only apply the utility in that state:

```html
<a class="underline hover:decoration-pink-500 ...">quick brown fox</a>
```


### Responsive design

Prefix a `text-decoration-color` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="underline decoration-sky-600 md:decoration-blue-400 ...">Lorem ipsum dolor sit amet...</p>
```


## Customizing your theme

Use the `--color-*` theme variables to customize the text decoration color utilities in your project:

```css
```

Now the `decoration-regal-blue` utility can be used in your markup:

```html
<a class="underline decoration-regal-blue">Lorem ipsum dolor sit amet...</a>
```


