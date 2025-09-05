# accent-color

Utilities for controlling the accented color of a form control.

Source: https://tailwindcss.com/guide/accent-color

## Quick reference

| Class                    | Styles                                                                     |
| ------------------------ | -------------------------------------------------------------------------- |
| accent-inherit           | accent-color: inherit;                                                     |
| accent-current           | accent-color: currentColor;                                                |
| accent-transparent       | accent-color: transparent;                                                 |
| accent-black             | accent-color: var(--color-black); /* #000 */                             |
| accent-white             | accent-color: var(--color-white); /* #fff */                             |
| accent-&lt;custom-property&gt; | accent-color: var(&lt;custom-property&gt;);                                      |
| accent-\[&lt;value&gt;\]       | accent-color: &lt;value&gt;;                                                     |

## Examples

### Setting the accent color

Use utilities like `accent-rose-500` and `accent-lime-600` to change the accent color of an element:

Browser default

Customized

```html
<label>
  <input type="checkbox" checked />
  Browser default
</label>
<label>
  <input class="accent-pink-500" type="checkbox" checked />
  Customized
</label>
```

This is helpful for styling elements like checkboxes and radio groups by overriding the browser's default color.

### Changing the opacity

Use the color opacity modifier to control the opacity of an element's accent color:

accent-purple-500/25

accent-purple-500/75

```html
<input class="accent-purple-500/25" type="checkbox" checked />
<input class="accent-purple-500/75" type="checkbox" checked />
```

Setting the accent color opacity has limited browser-support and only works in Firefox at this time.

### Using a custom value

Use the `accent-[&lt;value&gt;]` syntax to set the accent color based on a completely custom value:

```html
<input class="accent-[#50d71e] ..." type="checkbox" />
```

For CSS variables, you can also use the `accent-(&lt;custom-property&gt;)` syntax:

```html
<input class="accent-(--my-accent-color) ..." type="checkbox" />
```

This is just a shorthand for `accent-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Applying on hover

Prefix an `accent-color` utility with a variant like `hover:*` to only apply the utility in that state:

Agree to terms

```html
<input class="accent-black hover:accent-pink-500" type="checkbox" />
```

Learn more about using variants in the variants documentation.

### Responsive design

Prefix an `accent-color` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<input class="accent-black md:accent-pink-500 ..." type="checkbox" />
```

Learn more about using variants in the variants documentation.

## Customizing your theme

Use the `--color-*` theme variables to customize the color utilities in your project:

```css
@theme {
  --color-regal-blue: #243c5a;
}
```

Now the `accent-regal-blue` utility can be used in your markup:

```html
<input class="accent-regal-blue" type="checkbox" />
```

Learn more about customizing your theme in the theme documentation.
