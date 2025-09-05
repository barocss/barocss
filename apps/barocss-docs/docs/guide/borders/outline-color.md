# outline-color

Utilities for controlling the color of an element's outline.

## Quick reference

| Class                     | Styles                                   |
|---------------------------|------------------------------------------|
| `outline-inherit`         | `outline-color: inherit;`                |
| `outline-current`         | `outline-color: currentColor;`           |
| `outline-transparent`     | `outline-color: transparent;`            |
| `outline-&lt;color&gt;`         | `outline-color: var(--color-&lt;color&gt;);`   |
| `outline-(&lt;custom-property&gt;)` | `outline-color: var(&lt;custom-property&gt;);` |
| `outline-[&lt;value&gt;]`       | `outline-color: &lt;value&gt;;`                |

Source: https://tailwindcss.com/guide/outline-color

## Examples

### Basic example

Use utilities like `outline-blue-500` and `outline-cyan-500` to control the outline color of an element:

```
<button class="outline-2 outline-offset-2 outline-blue-500">Button A</button>
<button class="outline-2 outline-offset-2 outline-cyan-500">Button B</button>
<button class="outline-2 outline-offset-2 outline-pink-500">Button C</button>
```

### Changing the opacity

Use the color opacity modifier to control the opacity of an element's outline color:

```
<button class="outline-2 outline-blue-500/75">
  Semi
</button>
```

### Using a custom value

Use the `outline-[&lt;value&gt;]` syntax to set the outline color based on a completely custom value:

```
<button class="outline-[#243c5a] outline-2">
  Custom
</button>
```

For CSS variables, you can also use the `outline-(&lt;custom-property&gt;)` syntax:

```
<button class="outline-(--my-outline-color) outline-2">
  <!-- ... -->
</button>
```

This is just a shorthand for `outline-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `outline-color` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<button class="outline md:outline-blue-400">
  <!-- ... -->
</button>
```

Learn more about using variants in the variants documentation.
