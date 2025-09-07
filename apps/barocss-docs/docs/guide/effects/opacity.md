# opacity

Utilities for controlling the opacity of an element.

## Quick reference

| Class | Styles |
|---|---|
| `opacity-&lt;number&gt;` | `opacity: &lt;number&gt;%;` |
| `opacity-(&lt;custom-property&gt;)` | `opacity: var(&lt;custom-property&gt;);` |
| `opacity-[&lt;value&gt;]` | `opacity: &lt;value&gt;;` |



## Examples

### Basic example

Use `opacity-&lt;number&gt;` utilities like `opacity-25` and `opacity-100` to set the opacity of an element:

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

Use the `opacity-[&lt;value&gt;]` syntax to set the opacity based on a completely custom value:

```
<button class="opacity-[.67]">
  Custom
</button>
```

For CSS variables, you can also use the `opacity-(&lt;custom-property&gt;)` syntax:

```
<button class="opacity-(--my-opacity)">
  <!-- ... -->
</button>
```

This is just a shorthand for `opacity-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix an `opacity` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```
<button class="opacity-50 md:opacity-100">
  <!-- ... -->
</button>
```

