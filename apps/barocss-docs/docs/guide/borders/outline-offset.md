# outline-offset

Utilities for controlling the offset of an element's outline.

## Quick reference

| Class                       | Styles                              |
|-----------------------------|-------------------------------------|
| `outline-offset-<number>`   | `outline-offset: <number>px;`       |
| `-outline-offset-<number>`  | `outline-offset: calc(<number>px * -1);` |
| `outline-offset-(<custom-property>)` | `outline-offset: var(<custom-property>);` |
| `outline-offset-[<value>]`  | `outline-offset: <value>;`          |

Source: https://tailwindcss.com/docs/outline-offset

## Examples

### Basic example

Use `outline-offset-<number>` utilities like `outline-offset-2` and `outline-offset-4` to set the outline offset of an element:

```
<button class="outline-2 outline-offset-0">Button A</button>
<button class="outline-2 outline-offset-2">Button B</button>
<button class="outline-2 outline-offset-4">Button C</button>
```

### Using negative values

To use a negative outline offset value, prefix the class name with a dash to convert it to a negative value:

```
<button class="outline-2 -outline-offset-2">
  Negative offset
</button>
```

### Using a custom value

Use the `outline-offset-[<value>]` syntax to set the outline offset based on a completely custom value:

```
<button class="outline-2 outline-offset-[2vw]">
  Custom
</button>
```

For CSS variables, you can also use the `outline-offset-(<custom-property>)` syntax:

```
<button class="outline-2 outline-offset-(--my-offset)">
  <!-- ... -->
</button>
```

This is just a shorthand for `outline-offset-[var(<custom-property>)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `outline-offset` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<button class="outline md:outline-offset-2">
  <!-- ... -->
</button>
```

Learn more about using variants in the variants documentation.
