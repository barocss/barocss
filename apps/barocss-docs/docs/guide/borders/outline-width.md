# outline-width

Utilities for controlling the width of an element's outline.

## Quick reference

| Class                | Styles                               |
|----------------------|--------------------------------------|
| `outline`            | `outline-width: 1px;`                |
| `outline-&lt;number&gt;`   | `outline-width: &lt;number&gt;px;`         |
| `outline-(&lt;custom-property&gt;)` | `outline-width: var(&lt;custom-property&gt;);` |
| `outline-[&lt;value&gt;]`  | `outline-width: &lt;value&gt;;`            |

Source: https://tailwindcss.com/guide/outline-width

## Examples

### Basic example

Use `outline` or `outline-&lt;number&gt;` utilities like `outline-2` and `outline-4` to set the outline width of an element:

```
<button class="outline outline-offset-2">Button A</button>
<button class="outline-2 outline-offset-2">Button B</button>
<button class="outline-4 outline-offset-2">Button C</button>
```

### Applying on focus

Use the `focus:` prefix to conditionally apply an outline width on focus:

```
<button class="outline-offset-2 outline-sky-500 focus:outline-2">
  Save Changes
</button>
```

### Using a custom value

Use the `outline-[&lt;value&gt;]` syntax to set the outline width based on a completely custom value:

```
<button class="outline-[2vw] outline-offset-2">
  Custom
</button>
```

For CSS variables, you can also use the `outline-(&lt;custom-property&gt;)` syntax:

```
<button class="outline-(--my-outline-width) outline-offset-2">
  <!-- ... -->
</button>
```

This is just a shorthand for `outline-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `outline-width` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<button class="outline md:outline-2">
  <!-- ... -->
</button>
```

Learn more about using variants in the variants documentation.
