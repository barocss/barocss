# caret-color

Utilities for controlling the color of the text input cursor.

Source: https://tailwindcss.com/docs/caret-color

## Quick reference

| Class               | Styles                            |
|---------------------|-----------------------------------|
| caret-inherit       | caret-color: inherit;             |
| caret-current       | caret-color: currentColor;        |
| caret-transparent   | caret-color: transparent;         |
| caret-black         | caret-color: var(--color-black);  |
| caret-white         | caret-color: var(--color-white);  |
| caret-<custom-property> | caret-color: var(<custom-property>); |
| caret-\[<value>\]   | caret-color: <value>;             |

## Examples

### Basic example

Use utilities like `caret-pink-500` and `caret-lime-600` to change the color of the text input cursor:

```html
<textarea class="w-80 caret-pink-500 ...">
  <!-- ... -->
</textarea>
```

### Using a custom value

Use the `caret-[<value>]` syntax to set the caret color based on a completely custom value:

```html
<textarea class="caret-[#50d71e] ...">
  <!-- ... -->
</textarea>
```

For CSS variables, you can also use the `caret-(<custom-property>)` syntax:

```html
<textarea class="caret-(--my-caret-color) ...">
  <!-- ... -->
</textarea>
```

This is just a shorthand for `caret-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `caret-color` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<textarea class="caret-rose-500 md:caret-lime-600 ...">
  <!-- ... -->
</textarea>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

Use the `--color-*` theme variables to customize the color utilities in your project:

```css
@theme {
  --color-regal-blue: #243c5a;
}
```

Now the `caret-regal-blue` utility can be used in your markup:

```html
<textarea class="caret-regal-blue">
  <!-- ... -->
</textarea>
```

Learn more about customizing your theme in the theme documentation.
