# outline-offset

Utilities for controlling the offset of an element's outline.

## Quick reference

| Class                       | Styles                              |
|-----------------------------|-------------------------------------|
| `outline-offset-&lt;number&gt;`   | `outline-offset: &lt;number&gt;px;`       |
| `-outline-offset-&lt;number&gt;`  | `outline-offset: calc(&lt;number&gt;px * -1);` |
| `outline-offset-(&lt;custom-property&gt;)` | `outline-offset: var(&lt;custom-property&gt;);` |
| `outline-offset-[&lt;value&gt;]`  | `outline-offset: &lt;value&gt;;`          |



## Examples

### Basic example

Use `outline-offset-&lt;number&gt;` utilities like `outline-offset-2` and `outline-offset-4` to set the outline offset of an element:

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

Use the `outline-offset-[&lt;value&gt;]` syntax to set the outline offset based on a completely custom value:

```
<button class="outline-2 outline-offset-[2vw]">
  Custom
</button>
```

For CSS variables, you can also use the `outline-offset-(&lt;custom-property&gt;)` syntax:

```
<button class="outline-2 outline-offset-(--my-offset)">
  <!-- ... -->
</button>
```

This is just a shorthand for `outline-offset-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `outline-offset` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<button class="outline md:outline-offset-2">
  <!-- ... -->
</button>
```

