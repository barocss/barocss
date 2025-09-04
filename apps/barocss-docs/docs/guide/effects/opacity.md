# opacity

Utilities for controlling the opacity of an element.

## Quick reference

| Class | Styles |
|---|---|
| `opacity-<number>` | `opacity: <number>%;` |
| `opacity-(<custom-property>)` | `opacity: var(<custom-property>);` |
| `opacity-[<value>]` | `opacity: <value>;` |

Source: https://tailwindcss.com/docs/opacity

## Examples

### Basic example

Use `opacity-<number>` utilities like `opacity-25` and `opacity-100` to set the opacity of an element:

```
<button class="bg-indigo-500 opacity-100 ..."></button>
<button class="bg-indigo-500 opacity-75 ..."></button>
<button class="bg-indigo-500 opacity-50 ..."></button>
<button class="bg-indigo-500 opacity-25 ..."></button>
```

### Applying conditionally

Use the `disabled:` prefix to conditionally apply an opacity on disabled elements:

```
<input type="text" class="opacity-100 disabled:opacity-75" />
```

### Using a custom value

Use the `opacity-[<value>]` syntax to set the opacity based on a completely custom value:

```
<button class="opacity-[.67]">
  Custom
</button>
```

For CSS variables, you can also use the `opacity-(<custom-property>)` syntax:

```
<button class="opacity-(--my-opacity)">
  <!-- ... -->
</button>
```

This is just a shorthand for `opacity-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `opacity` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<button class="opacity-50 md:opacity-100">
  <!-- ... -->
</button>
```

Learn more about using variants in the variants documentation.
