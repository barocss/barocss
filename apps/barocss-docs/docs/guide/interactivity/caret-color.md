# caret-color

Utilities for controlling the color of the text input cursor.



## Quick reference

| Class               | Styles                            |
|---------------------|-----------------------------------|
| caret-inherit       | caret-color: inherit;             |
| caret-current       | caret-color: currentColor;        |
| caret-transparent   | caret-color: transparent;         |
| caret-black         | caret-color: var(--color-black);  |
| caret-white         | caret-color: var(--color-white);  |
| caret-&lt;custom-property&gt; | caret-color: var(&lt;custom-property&gt;); |
| caret-\[&lt;value&gt;\]   | caret-color: &lt;value&gt;;             |

## Examples

### Basic example

Use utilities like `caret-pink-500` and `caret-lime-600` to change the color of the text input cursor:

```html
<textarea class="w-80 caret-pink-500 ...">
  <!-- ... -->
</textarea>
```

### Using a custom value

Use the `caret-[&lt;value&gt;]` syntax to set the caret color based on a completely custom value:

```html
<textarea class="caret-[#50d71e] ...">
  <!-- ... -->
</textarea>
```

For CSS variables, you can also use the `caret-(&lt;custom-property&gt;)` syntax:

```html
<textarea class="caret-(--my-caret-color) ...">
  <!-- ... -->
</textarea>
```

This is just a shorthand for `caret-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `caret-color` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<textarea class="caret-rose-500 md:caret-lime-600 ...">
  <!-- ... -->
</textarea>
```


## Customizing your theme

Use the `--color-*` theme variables to customize the color utilities in your project:

```css
```

Now the `caret-regal-blue` utility can be used in your markup:

```html
<textarea class="caret-regal-blue">
  <!-- ... -->
</textarea>
```

