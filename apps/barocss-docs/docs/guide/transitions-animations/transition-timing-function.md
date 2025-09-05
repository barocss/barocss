# transition-timing-function

Utilities for controlling the easing of CSS transitions.

Source: https://tailwindcss.com/guide/transition-timing-function

## Quick reference

| Class                    | Styles                                                                    |
| ------------------------ | ------------------------------------------------------------------------- |
| ease-linear              | transition-timing-function: linear;                                       |
| ease-in                  | transition-timing-function: var(--ease-in); /* cubic-bezier(0.4, 0, 1, 1) */ |
| ease-out                 | transition-timing-function: var(--ease-out); /* cubic-bezier(0, 0, 0.2, 1) */ |
| ease-in-out              | transition-timing-function: var(--ease-in-out); /* cubic-bezier(0.4, 0, 0.2, 1) */ |
| ease-initial             | transition-timing-function: initial;                                      |
| ease-(&lt;custom-property&gt;) | transition-timing-function: var(&lt;custom-property&gt;);                       |
| ease-\[&lt;value&gt;\]         | transition-timing-function: &lt;value&gt;;                                      |

## Examples

### Basic example

Use utilities like `ease-in` and `ease-out` to control the easing curve of an element's transition:

```html
<button class="duration-300 ease-in ...">Button A</button>
<button class="duration-300 ease-out ...">Button B</button>
<button class="duration-300 ease-in-out ...">Button C</button>
```

### Using a custom value

Use the `ease-[&lt;value&gt;]` syntax to set the transition timing function based on a completely custom value:

```html
<button class="ease-[cubic-bezier(0.95,0.05,0.795,0.035)] ...">
  <!-- ... -->
</button>
```

For CSS variables, you can also use the `ease-(&lt;custom-property&gt;)` syntax:

```html
<button class="ease-(--my-easing) ...">
  <!-- ... -->
</button>
```

This is just a shorthand for `ease-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `transition-timing-function` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<button class="ease-out md:ease-in ...">
  <!-- ... -->
</button>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

The `ease-*` utilities are driven by the `--ease-*` theme variables, which can be customized in your own theme:

```css
@theme {
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

Learn more about customizing the easing scale in the theme variable documentation.
