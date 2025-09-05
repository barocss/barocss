# transition-delay

Utilities for controlling the delay of CSS transitions.

Source: https://tailwindcss.com/guide/transition-delay

## Quick reference

| Class                    | Styles                              |
| ------------------------ | ----------------------------------- |
| delay-&lt;number&gt;           | transition-delay: &lt;number&gt;ms;        |
| delay-(&lt;custom-property&gt;) | transition-delay: var(&lt;custom-property&gt;); |
| delay-\[&lt;value&gt;\]        | transition-delay: &lt;value&gt;;          |

## Examples

### Basic example

Use utilities like `delay-150` and `delay-700` to set the transition delay of an element in milliseconds:

```html
<button class="transition delay-150 duration-300 ease-in-out ...">Button A</button>
<button class="transition delay-300 duration-300 ease-in-out ...">Button B</button>
<button class="transition delay-700 duration-300 ease-in-out ...">Button C</button>
```

### Using a custom value

Use the `delay-[&lt;value&gt;]` syntax to set the transition delay based on a completely custom value:

```html
<button class="delay-[1s,250ms] ...">
  <!-- ... -->
</button>
```

For CSS variables, you can also use the `delay-(&lt;custom-property&gt;)` syntax:

```html
<button class="delay-(--my-delay) ...">
  <!-- ... -->
</button>
```

This is just a shorthand for `delay-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `transition-delay` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<button class="delay-150 md:delay-300 ...">
  <!-- ... -->
</button>
```

Learn more about using variants in the variants documentation.
