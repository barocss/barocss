# aspect-ratio

Utilities for controlling the aspect ratio of an element.

## Quick reference

| Class                      | Styles                                                  |
| -------------------------- | ------------------------------------------------------- |
| aspect-&lt;ratio&gt;             | aspect-ratio: &lt;ratio&gt;;                                  |
| aspect-square              | aspect-ratio: 1 / 1;                                    |
| aspect-video               | aspect-ratio: var(--aspect-ratio-video); /* 16 / 9 */ |
| aspect-auto                | aspect-ratio: auto;                                     |
| aspect-(&lt;custom-property&gt;) | aspect-ratio: var(&lt;custom-property&gt;);                   |
| aspect-\[&lt;value&gt;\]         | aspect-ratio: &lt;value&gt;;                                  |

Source: https://tailwindcss.com/guide/aspect-ratio

## Examples

### Basic example

Use `aspect-&lt;ratio&gt;` utilities like `aspect-3/2` to give an element a specific aspect ratio:

Resize the example to see the expected behavior

```html
<img class="aspect-3/2 object-cover ..." src="/img/villas.jpg" />
```

### Using a video aspect ratio

Use the `aspect-video` utility to give a video element a 16 / 9 aspect ratio:

Resize the example to see the expected behavior

```html
<iframe class="aspect-video ..." src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
```

### Using a custom value

Use the `aspect-[&lt;value&gt;]` syntax to set the aspect ratio based on a completely custom value:

```html
<img class="aspect-[calc(4*3+1)/3] ..." src="/img/villas.jpg" />
```

For CSS variables, you can also use the `aspect-(&lt;custom-property&gt;)` syntax:

```html
<img class="aspect-(--my-aspect-ratio) ..." src="/img/villas.jpg" />
```

This is just a shorthand for `aspect-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `aspect-ratio` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<iframe class="aspect-video md:aspect-square ..." src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

Use the `--aspect-*` theme variables to customize the aspect ratio utilities in your project:

```css
@theme {
  --aspect-retro: 4 / 3;
}
```

Now the `aspect-retro` utility can be used in your markup:

```html
<iframe class="aspect-retro" src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
```

Learn more about customizing your theme in the theme documentation.
