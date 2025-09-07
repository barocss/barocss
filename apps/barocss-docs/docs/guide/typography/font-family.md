# font-family

Utilities for controlling the font family of an element.

## Quick reference

| Class | Styles |
|---|---|
| `font-sans` | `font-family: var(--font-sans); /* ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' */` |
| `font-serif` | `font-family: var(--font-serif); /* ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif */` |
| `font-mono` | `font-family: var(--font-mono); /* ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace */` |
| `font-(family-name:&lt;custom-property&gt;)` | `font-family: var(&lt;custom-property&gt;);` |
| `font-[&lt;value&gt;]` | `font-family: &lt;value&gt;;` |


## Examples

### Basic example

Use utilities like `font-sans` and `font-mono` to set the font family of an element:

```html
<!-- [!code classes:font-sans,font-serif,font-mono] -->
<p class="font-sans ...">The quick brown fox ...</p>
<p class="font-serif ...">The quick brown fox ...</p>
<p class="font-mono ...">The quick brown fox ...</p>
```

### Using a custom value

Use the `font-[&lt;value&gt;]` syntax to set the font family based on a completely custom value:

```html
<p class="font-[Open_Sans] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `font-(family-name:&lt;custom-property&gt;)` syntax:

```html
<p class="font-(family-name:--my-font) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `font-[family-name:var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `font-family` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="font-sans md:font-serif ...">Lorem ipsum dolor sit amet...</p>
```


## Customizing your theme

Use the `--font-*` theme variables to customize the font family utilities in your project:

```css
```

Now the `font-display` utility can be used in your markup:

```html
<div class="font-display">
  <!-- ... -->
</div>
```

You can also provide default `font-feature-settings` and `font-variation-settings` values for a font family:


If needed, use the `@font-face` at-rule to load custom fonts:

```css
@font-face {
  font-family: Oswald;
  font-style: normal;
  font-weight: 200 700;
  font-display: swap;
  src: url("/fonts/Oswald.woff2") format("woff2");
```


