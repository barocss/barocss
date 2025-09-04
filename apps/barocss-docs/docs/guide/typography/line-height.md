# line-height

Utilities for controlling the leading, or line height, of an element.

## Quick reference

| Class | Styles |
|---|---|
| `text-<size>/<number>` | `font-size: <size>; line-height: calc(var(--spacing) * <number>);` |
| `text-<size>/(<custom-property>)` | `font-size: <size>; line-height: var(<custom-property>);` |
| `text-<size>/[<value>]` | `font-size: <size>; line-height: <value>;` |
| `leading-none` | `line-height: 1;` |
| `leading-<number>` | `line-height: calc(var(--spacing) * <number>)` |
| `leading-(<custom-property>)` | `line-height: var(<custom-property>);` |
| `leading-[<value>]` | `line-height: <value>;` |

Source: https://tailwindcss.com/docs/line-height

## Examples

### Basic example

Use font size utilities like `text-sm/6` and `text-lg/7` to set the font size and line-height of an element at the same time:

```html
<!-- [!code classes:text-base/6,text-base/7,text-base/8] -->
<p class="text-base/6 ...">So I started to walk into the water...</p>
<p class="text-base/7 ...">So I started to walk into the water...</p>
<p class="text-base/8 ...">So I started to walk into the water...</p>
```

Each font size utility also sets a default line height when one isn't provided. You can learn more about these values and how to customize them in the font-size documentation.

### Setting independently

Use `leading-<number>` utilities like `leading-6` and `leading-7` to set the line height of an element independent of the font-size:

```html
<!-- [!code classes:leading-6,leading-7,leading-8] -->
<p class="text-sm leading-6">So I started to walk into the water...</p>
<p class="text-sm leading-7">So I started to walk into the water...</p>
<p class="text-sm leading-8">So I started to walk into the water...</p>
```

### Removing the leading

Use the `leading-none` utility to set the line height of an element equal to its font size:

```html
<!-- [!code classes:leading-none] -->
<p class="text-2xl leading-none ...">The quick brown fox...</p>
```

### Using a custom value

Use the `leading-[<value>]` syntax to set the line height based on a completely custom value:

```html
<p class="leading-[1.5] ...">Lorem ipsum dolor sit amet...</p>
```

For CSS variables, you can also use the `leading-(<custom-property>)` syntax:

```html
<p class="leading-(--my-leading) ...">Lorem ipsum dolor sit amet...</p>
```

This is just a shorthand for `leading-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `line-height` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<p class="leading-5 md:leading-6 ...">Lorem ipsum dolor sit amet...</p>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

Use the `--leading-*` theme variables to customize the line height utilities in your project:

```css
@theme {
  --leading-extra-loose: 2.5;
  --leading-12: 3rem;
}
```

Now the `leading-extra-loose` and `leading-12` utilities can be used in your markup:

```html
<p class="leading-extra-loose">Lorem ipsum dolor sit amet...</p>
<p class="leading-12">Lorem ipsum dolor sit amet...</p>
```

Learn more about customizing your theme in the theme documentation.
